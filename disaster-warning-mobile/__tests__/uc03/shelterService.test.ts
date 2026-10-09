/**
 * Unit Tests for UC03 Shelter Service (`services/shelterService.ts`).
 *
 * Implements UC03:
 * - Steps 41–46: Register Shelter (name, facility type, location, capacity, organisation, manager)
 * - Steps 47–48: Activate Shelter for active hazard event (status: 'active')
 * - Steps 49–50: Record and monitor shelter occupancy against capacity
 * - Alternate Flow: Shelter Approaching Capacity
 * - Alternate Flow: Shelter Deactivation (status: 'inactive')
 * - Exception Flow: Occupancy Exceeds Registered Capacity (status: 'over_capacity')
 */
import {
  getShelters,
  onSheltersChanged,
  createShelter,
  activateShelter,
  updateOccupancy,
  deactivateShelter,
} from '@/services/shelterService';
import {
  addDoc,
  updateDoc,
  getDocs,
  collection,
  doc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import type { CreateShelterData, Shelter } from '@/types/resources';

describe('UC03: Shelter Service CRUD & Lifecycle Management', () => {
  const sampleShelterData: CreateShelterData = {
    name: 'Ratnapura Central College Safe Haven',
    facilityType: 'school',
    address: 'Main Street, Ratnapura',
    district: 'Ratnapura',
    latitude: 6.6828,
    longitude: 80.4035,
    capacity: 250,
    facilities: ['Water Supply', 'Sanitation', 'Kitchen', 'Medical Aid'],
    managerName: 'K. B. Wickramasinghe',
    managerContact: '+94771234567',
    organisationType: 'government',
    organisationName: 'District Secretariat Ratnapura',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Shelter Registration (UC03 Main Flow Steps 41–46)', () => {
    it('should register a new shelter with initial status "registered" and 0 occupancy', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'shelter-ratnapura-01' });

      const shelterId = await createShelter(sampleShelterData, 'officer-user-101');

      expect(shelterId).toBe('shelter-ratnapura-01');
      expect(addDoc).toHaveBeenCalledTimes(1);
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Ratnapura Central College Safe Haven',
          facilityType: 'school',
          district: 'Ratnapura',
          capacity: 250,
          currentOccupancy: 0,
          status: 'registered',
          hazardEventId: '',
          createdBy: 'officer-user-101',
          organisationType: 'government',
          organisationName: 'District Secretariat Ratnapura',
        }),
      );
    });

    it('should register partner-owned shelters (NGO, Armed Forces, Private Donor)', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'shelter-temple-02' });

      const ngoShelterData: CreateShelterData = {
        ...sampleShelterData,
        name: 'Sri Bodhiraja Community Hall',
        facilityType: 'community_hall',
        organisationType: 'ngo',
        organisationName: 'Sri Lanka Red Cross Society',
      };

      const shelterId = await createShelter(ngoShelterData, 'officer-user-101');

      expect(shelterId).toBe('shelter-temple-02');
      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          organisationType: 'ngo',
          organisationName: 'Sri Lanka Red Cross Society',
          status: 'registered',
        }),
      );
    });
  });

  describe('Shelter Activation (UC03 Main Flow Steps 47–48)', () => {
    it('should activate a shelter for an active hazard event and set status to "active"', async () => {
      await activateShelter('shelter-ratnapura-01', 'event-monsoon-2026');

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'active',
          hazardEventId: 'event-monsoon-2026',
        }),
      );
    });
  });

  describe('Occupancy Tracking & Capacity Thresholds (UC03 Steps 49–50 & Exception Flow)', () => {
    it('should update occupancy and maintain status as "active" when headcount is within capacity', async () => {
      // 150 evacuees in a 250-capacity shelter (60% utilization)
      await updateOccupancy('shelter-ratnapura-01', 150, 250);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 150,
          status: 'active',
        }),
      );
    });

    it('should handle exactly 100% capacity and maintain status as "active"', async () => {
      // Exactly 250 evacuees in 250-capacity shelter
      await updateOccupancy('shelter-ratnapura-01', 250, 250);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 250,
          status: 'active',
        }),
      );
    });

    it('should record actual occupancy and flag status as "over_capacity" when headcount exceeds capacity (UC03 Exception Flow)', async () => {
      // 280 evacuees in 250-capacity shelter (Truthful logging requirement)
      await updateOccupancy('shelter-ratnapura-01', 280, 250);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 280,
          status: 'over_capacity',
        }),
      );
    });

    it('should transition status back to "active" when occupancy is reduced below capacity', async () => {
      // Evacuees reallocated: headcount drops from 280 down to 200
      await updateOccupancy('shelter-ratnapura-01', 200, 250);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 200,
          status: 'active',
        }),
      );
    });

    it('should allow occupancy to be reset to 0 evacuees', async () => {
      await updateOccupancy('shelter-ratnapura-01', 0, 250);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 0,
          status: 'active',
        }),
      );
    });
  });

  describe('Shelter Deactivation (UC03 Alternate Flow)', () => {
    it('should set shelter status to "inactive" and clear hazardEventId upon deactivation', async () => {
      await deactivateShelter('shelter-ratnapura-01');

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: 'inactive',
          hazardEventId: '',
        }),
      );
    });
  });

  describe('Shelter Queries & Real-Time Synchronization', () => {
    it('should retrieve all shelters sorted descending by creation time', async () => {
      const mockDoc1 = {
        id: 's-older',
        data: () => ({
          name: 'Older Shelter',
          facilityType: 'school',
          capacity: 100,
          currentOccupancy: 50,
          status: 'active',
          createdAt: { toDate: () => new Date('2026-10-09T04:00:00Z') },
        }),
      };
      const mockDoc2 = {
        id: 's-newer',
        data: () => ({
          name: 'Newer Shelter',
          facilityType: 'community_hall',
          capacity: 200,
          currentOccupancy: 80,
          status: 'active',
          createdAt: { toDate: () => new Date('2026-10-09T06:00:00Z') },
        }),
      };

      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [mockDoc1, mockDoc2],
      });

      const shelters = await getShelters();

      expect(shelters).toHaveLength(2);
      expect(shelters[0].id).toBe('s-newer');
      expect(shelters[1].id).toBe('s-older');
      expect(collection).toHaveBeenCalledWith(expect.anything(), 'shelters');
    });

    it('should filter shelters by active hazard event ID when provided', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 's-filtered',
            data: () => ({
              name: 'Event-Scoped Shelter',
              hazardEventId: 'event-kelani-2026',
              capacity: 150,
              currentOccupancy: 40,
              status: 'active',
              createdAt: { toDate: () => new Date('2026-10-09T05:00:00Z') },
            }),
          },
        ],
      });

      const shelters = await getShelters('event-kelani-2026');

      expect(shelters).toHaveLength(1);
      expect(shelters[0].id).toBe('s-filtered');
      expect(where).toHaveBeenCalledWith('hazardEventId', '==', 'event-kelani-2026');
    });

    it('should subscribe to real-time shelter updates via onSheltersChanged', () => {
      const mockCallback = jest.fn();
      const unsubscribe = onSheltersChanged('event-monsoon-2026', mockCallback);

      expect(onSnapshot).toHaveBeenCalledTimes(1);
      expect(typeof unsubscribe).toBe('function');
    });
  });
});
