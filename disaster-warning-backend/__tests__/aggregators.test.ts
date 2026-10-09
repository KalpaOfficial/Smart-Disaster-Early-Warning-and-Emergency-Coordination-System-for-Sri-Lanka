import { AlertMetricAggregator } from '../src/aggregators/AlertMetricAggregator';
import { CitizenReachAggregator } from '../src/aggregators/CitizenReachAggregator';
import { OccupancyMetricAggregator } from '../src/aggregators/OccupancyMetricAggregator';
import { DistributionMetricAggregator } from '../src/aggregators/DistributionMetricAggregator';

describe('Aggregators Unit Tests', () => {
  describe('AlertMetricAggregator', () => {
    it('should return alert timeline metrics for valid eventId', async () => {
      const aggregator = new AlertMetricAggregator(5);
      const result = await aggregator.aggregate('EVT_FLOOD_2026');

      expect(aggregator.key).toBe('alerts');
      expect(result.totalAlertsIssued).toBeGreaterThan(0);
      expect(result.escalationCount).toBeDefined();
      expect(Array.isArray(result.timeline)).toBe(true);
    });

    it('should throw error when simulated failure condition is triggered', async () => {
      const aggregator = new AlertMetricAggregator(5);
      await expect(aggregator.aggregate('EVT_FAIL_ALERT')).rejects.toThrow('Firestore timeout');
    });
  });

  describe('CitizenReachAggregator', () => {
    it('should return citizen reach metrics for valid eventId', async () => {
      const aggregator = new CitizenReachAggregator(5);
      const result = await aggregator.aggregate('EVT_FLOOD_2026');

      expect(aggregator.key).toBe('citizenReach');
      expect(result.totalCitizensReached).toBeGreaterThan(0);
      expect(result.reachBySector).toBeDefined();
    });

    it('should throw error when simulated failure condition is triggered', async () => {
      const aggregator = new CitizenReachAggregator(5);
      await expect(aggregator.aggregate('EVT_FAIL_CITIZEN')).rejects.toThrow('Firestore timeout');
    });
  });

  describe('OccupancyMetricAggregator', () => {
    it('should return shelter occupancy metrics for valid eventId', async () => {
      const aggregator = new OccupancyMetricAggregator(5);
      const result = await aggregator.aggregate('EVT_FLOOD_2026');

      expect(aggregator.key).toBe('shelterOccupancy');
      expect(result.totalSheltersActive).toBeGreaterThan(0);
      expect(Array.isArray(result.timeSeriesOccupancy)).toBe(true);
    });

    it('should throw error when simulated failure condition is triggered', async () => {
      const aggregator = new OccupancyMetricAggregator(5);
      await expect(aggregator.aggregate('EVT_FAIL_OCCUPANCY')).rejects.toThrow('Firestore timeout');
    });
  });

  describe('DistributionMetricAggregator', () => {
    it('should return resource distribution metrics for valid eventId', async () => {
      const aggregator = new DistributionMetricAggregator(5);
      const result = await aggregator.aggregate('EVT_FLOOD_2026');

      expect(aggregator.key).toBe('resourceDistribution');
      expect(result.totalPackagesDistributed).toBeGreaterThan(0);
      expect(result.distributionByDistrict).toBeDefined();
    });

    it('should throw error when simulated failure condition is triggered', async () => {
      const aggregator = new DistributionMetricAggregator(5);
      await expect(aggregator.aggregate('EVT_FAIL_DISTRIBUTION')).rejects.toThrow('Firestore timeout');
    });
  });
});
