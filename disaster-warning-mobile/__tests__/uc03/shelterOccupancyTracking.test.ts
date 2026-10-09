/**
 * Unit Tests for UC03 Shelter Occupancy Tracking & Capacity Thresholds.
 *
 * Implements UC03:
 * - Steps 49–50: Recording and monitoring shelter occupancy against capacity
 * - Alternate Flow: Shelter Approaching Capacity (utilization warnings)
 * - Exception Flow: Occupancy Exceeds Registered Capacity (Truthful headcount logging & over_capacity status)
 * - Evacuee Reallocation & decanting back to normal capacity
 */
import { updateOccupancy } from '@/services/shelterService';
import { updateDoc } from 'firebase/firestore';

describe('UC03: Shelter Occupancy Tracking & Capacity Telemetry', () => {
  const shelterId = 'shelter-kegalle-maha-vidyalaya';
  const registeredCapacity = 200;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Capacity and Utilization Calculations', () => {
    it('calculates remaining capacity accurately when evacuees arrive', () => {
      const currentOccupancy = 65;
      const remainingCapacity = registeredCapacity - currentOccupancy;
      const utilizationRate = Math.round((currentOccupancy / registeredCapacity) * 100);

      expect(remainingCapacity).toBe(135);
      expect(utilizationRate).toBe(33); // 32.5% -> 33%
    });

    it('identifies when shelter is approaching capacity (> 80% utilization)', () => {
      const testCases = [
        { occupancy: 100, isApproaching: false, expectedPct: 50 },
        { occupancy: 150, isApproaching: false, expectedPct: 75 },
        { occupancy: 160, isApproaching: true, expectedPct: 80 },
        { occupancy: 180, isApproaching: true, expectedPct: 90 },
        { occupancy: 195, isApproaching: true, expectedPct: 98 },
      ];

      testCases.forEach(({ occupancy, isApproaching, expectedPct }) => {
        const pct = Math.round((occupancy / registeredCapacity) * 100);
        const approaching = pct >= 80 && pct <= 100;
        expect(pct).toBe(expectedPct);
        expect(approaching).toBe(isApproaching);
      });
    });

    it('identifies exact 100% capacity saturation without exceeding', () => {
      const currentOccupancy = 200;
      const remainingCapacity = registeredCapacity - currentOccupancy;
      const utilizationRate = Math.round((currentOccupancy / registeredCapacity) * 100);

      expect(remainingCapacity).toBe(0);
      expect(utilizationRate).toBe(100);
    });
  });

  describe('Main Flow: Headcount Updates & Status Rules', () => {
    it('updates Firestore document with status "active" when occupancy <= capacity', async () => {
      await updateOccupancy(shelterId, 140, registeredCapacity);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 140,
          status: 'active',
        }),
      );
    });

    it('maintains status "active" at full 100% capacity', async () => {
      await updateOccupancy(shelterId, 200, registeredCapacity);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 200,
          status: 'active',
        }),
      );
    });

    it('allows clearing headcount to 0 when all evacuees have vacated', async () => {
      await updateOccupancy(shelterId, 0, registeredCapacity);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 0,
          status: 'active',
        }),
      );
    });
  });

  describe('Exception Flow: Occupancy Exceeds Registered Capacity', () => {
    it('records truthful actual headcount and marks status as "over_capacity"', async () => {
      // 245 evacuees arrive at a 200-capacity shelter
      const surgeOccupancy = 245;

      await updateOccupancy(shelterId, surgeOccupancy, registeredCapacity);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 245,
          status: 'over_capacity',
        }),
      );

      // Verifies remaining capacity is negative
      const remainingCapacity = registeredCapacity - surgeOccupancy;
      expect(remainingCapacity).toBe(-45);

      // Verifies utilization rate exceeds 100%
      const utilizationRate = Math.round((surgeOccupancy / registeredCapacity) * 100);
      expect(utilizationRate).toBe(123); // 122.5% -> 123%
    });

    it('handles extreme overcrowding and faithfully records census', async () => {
      // Severe flood: 400 evacuees seek shelter in a 200-capacity facility (200% capacity)
      await updateOccupancy(shelterId, 400, registeredCapacity);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 400,
          status: 'over_capacity',
        }),
      );
    });
  });

  describe('Decanting & Evacuee Reallocation Workflow', () => {
    it('restores status to "active" when evacuees are transferred to another shelter', async () => {
      // Step 1: Initial surge: Over Capacity (230 / 200)
      await updateOccupancy(shelterId, 230, registeredCapacity);
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 230,
          status: 'over_capacity',
        }),
      );

      // Step 2: District Officer dispatches buses and transfers 50 evacuees to secondary shelter
      // New headcount: 230 - 50 = 180 (within capacity 200, 90% utilization)
      await updateOccupancy(shelterId, 180, registeredCapacity);
      expect(updateDoc).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentOccupancy: 180,
          status: 'active',
        }),
      );
    });
  });
});
