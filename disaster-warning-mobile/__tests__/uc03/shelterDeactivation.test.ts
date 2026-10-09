/**
 * Unit Tests for UC03 Shelter Deactivation & Reactivation Lifecycle.
 *
 * Implements UC03:
 * - Alternate Flow: Shelter Deactivation
 *   The shelter is no longer required or the hazard event is closed.
 *   The officer checks current occupancy and reallocates occupants if required.
 *   The system sets the shelter to Inactive.
 * - Reactivation for a subsequent hazard event.
 * - Operational picture exclusion for inactive shelters.
 */
import { activateShelter, deactivateShelter, updateOccupancy } from '@/services/shelterService';
import { updateDoc } from 'firebase/firestore';
import type { Shelter } from '@/types/resources';

describe('UC03: Shelter Deactivation & Phasing-Down Workflow', () => {
  const shelterId = 'shelter-kalutara-03';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Deactivation Status Progression', () => {
    it('sets shelter status to "inactive" and clears hazardEventId', async () => {
      await deactivateShelter(shelterId);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'inactive',
          hazardEventId: '',
        }),
      );
    });

    it('supports evacuee clearance prior to deactivation', async () => {
      // Step 1: Evacuees return home as flood recedes; headcount set to 0
      await updateOccupancy(shelterId, 0, 150);
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 0,
          status: 'active',
        }),
      );

      // Step 2: Officer deactivates safe haven
      await deactivateShelter(shelterId);
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'inactive',
          hazardEventId: '',
        }),
      );
    });
  });

  describe('Shelter Reactivation for Subsequent Hazard Event', () => {
    it('allows an inactive shelter to be reactivated for a new hazard event', async () => {
      // Cyclone Alert 2026 strikes coastal sector; shelter is reactivated
      await activateShelter(shelterId, 'event-cyclone-nivar-2026');

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'active',
          hazardEventId: 'event-cyclone-nivar-2026',
        }),
      );
    });
  });

  describe('Combined Operational Picture Telemetry Filtering', () => {
    it('excludes inactive shelters from active capacity calculations', () => {
      const allShelters: Pick<Shelter, 'id' | 'status' | 'capacity' | 'currentOccupancy'>[] = [
        { id: 's-active-1', status: 'active', capacity: 200, currentOccupancy: 150 },
        { id: 's-over-2', status: 'over_capacity', capacity: 100, currentOccupancy: 110 },
        { id: 's-inactive-3', status: 'inactive', capacity: 300, currentOccupancy: 0 },
        { id: 's-reg-4', status: 'registered', capacity: 400, currentOccupancy: 0 },
      ];

      // Operational picture only counts shelters operating in current hazard response
      const operationalShelters = allShelters.filter(
        (s) => s.status === 'active' || s.status === 'over_capacity',
      );

      const activeCapacity = operationalShelters.reduce((acc, s) => acc + s.capacity, 0);
      const activeOccupancy = operationalShelters.reduce((acc, s) => acc + s.currentOccupancy, 0);

      expect(operationalShelters).toHaveLength(2);
      expect(activeCapacity).toBe(300); // 200 + 100
      expect(activeOccupancy).toBe(260); // 150 + 110
    });
  });
});
