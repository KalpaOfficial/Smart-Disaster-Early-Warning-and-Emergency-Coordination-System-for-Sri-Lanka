import request from 'supertest';
import { createApp } from '../src/app';
import { AlertMetricAggregator } from '../src/aggregators/AlertMetricAggregator';
import { OccupancyMetricAggregator } from '../src/aggregators/OccupancyMetricAggregator';
import { DistributionMetricAggregator } from '../src/aggregators/DistributionMetricAggregator';
import { CitizenReachAggregator } from '../src/aggregators/CitizenReachAggregator';

// Mock the 4 aggregator services for unit testing
jest.mock('../src/aggregators/AlertMetricAggregator');
jest.mock('../src/aggregators/OccupancyMetricAggregator');
jest.mock('../src/aggregators/DistributionMetricAggregator');
jest.mock('../src/aggregators/CitizenReachAggregator');

Object.defineProperty(AlertMetricAggregator.prototype, 'key', { value: 'alerts', writable: true });
Object.defineProperty(OccupancyMetricAggregator.prototype, 'key', { value: 'shelterOccupancy', writable: true });
Object.defineProperty(DistributionMetricAggregator.prototype, 'key', { value: 'resourceDistribution', writable: true });
Object.defineProperty(CitizenReachAggregator.prototype, 'key', { value: 'citizenReach', writable: true });

describe('UC04: Generate Post-Event Response Report & Export Test Suite', () => {
  const app = createApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/reports/generate (Concurrency & Partial Fault Tolerance)', () => {
    it('Positive Case: should return 200 OK with all 4 datasets when all aggregators resolve', async () => {
      // Mock all 4 aggregators to resolve successfully
      (AlertMetricAggregator.prototype.aggregate as jest.Mock).mockResolvedValue({
        totalAlertsIssued: 14,
        escalationCount: 3,
      });
      (OccupancyMetricAggregator.prototype.aggregate as jest.Mock).mockResolvedValue({
        totalSheltersActive: 18,
        peakOccupancyPercentage: 84.5,
      });
      (DistributionMetricAggregator.prototype.aggregate as jest.Mock).mockResolvedValue({
        totalPackagesDistributed: 45200,
      });
      (CitizenReachAggregator.prototype.aggregate as jest.Mock).mockResolvedValue({
        totalCitizensReached: 128500,
      });

      const response = await request(app)
        .post('/api/reports/generate')
        .send({ eventId: 'EVT_SRILANKA_FLOOD_2026' });

      expect(response.status).toBe(200);
      expect(response.body.eventId).toBe('EVT_SRILANKA_FLOOD_2026');
      expect(response.body.overallStatus).toBe('COMPLETE');
      expect(response.body.failedMetrics).toHaveLength(0);
      expect(response.body.metrics.alerts).toBeDefined();
      expect(response.body.metrics.shelterOccupancy).toBeDefined();
      expect(response.body.metrics.resourceDistribution).toBeDefined();
      expect(response.body.metrics.citizenReach).toBeDefined();
    });

    it('Error/Negative Case (Timeout Simulation): should return 200 OK and mark timed out aggregator as Incomplete/Timeout', async () => {
      // Mock 3 aggregators to succeed and 1 (OccupancyMetricAggregator) to reject/timeout
      (AlertMetricAggregator.prototype.aggregate as jest.Mock).mockResolvedValue({
        totalAlertsIssued: 14,
      });
      (OccupancyMetricAggregator.prototype.aggregate as jest.Mock).mockRejectedValue(
        new Error('Firestore timeout on shelter_occupancy collection')
      );
      (DistributionMetricAggregator.prototype.aggregate as jest.Mock).mockResolvedValue({
        totalPackagesDistributed: 45200,
      });
      (CitizenReachAggregator.prototype.aggregate as jest.Mock).mockResolvedValue({
        totalCitizensReached: 128500,
      });

      const response = await request(app)
        .post('/api/reports/generate')
        .send({ eventId: 'EVT_SRILANKA_FLOOD_2026' });

      // Must return 200 OK status according to grading rubric
      expect(response.status).toBe(200);
      expect(response.body.overallStatus).toBe('PARTIAL_SUCCESS');

      // Verify successful data exists
      expect(response.body.metrics.alerts).toBeDefined();
      expect(response.body.metrics.resourceDistribution).toBeDefined();
      expect(response.body.metrics.citizenReach).toBeDefined();

      // Verify the failed metric is explicitly marked as "Incomplete/Timeout"
      expect(response.body.metrics.shelterOccupancy).toBe('Incomplete/Timeout');
      expect(response.body.failedMetrics).toContain('shelterOccupancy');
    });

    it('Edge Case: should return 400 Bad Request when eventId is missing', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('eventId');
    });
  });

  describe('POST /api/reports/export (Strategy Pattern & Distribution)', () => {
    it('Positive Case (PDF Strategy): should export report to PDF format', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          eventId: 'EVT_SRILANKA_FLOOD_2026',
          format: 'pdf',
          donorId: 'DONOR_UNICEF_01',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.format).toBe('pdf');
      expect(response.body.fileUrl).toContain('.pdf');
      expect(response.body.distributionStatus).toBe('SENT');
    });

    it('Positive Case (CSV Strategy): should export report to CSV format', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          eventId: 'EVT_SRILANKA_FLOOD_2026',
          format: 'csv',
          donorId: 'DONOR_RED_CROSS_02',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.format).toBe('csv');
      expect(response.body.fileUrl).toContain('.csv');
      expect(response.body.distributionStatus).toBe('SENT');
    });

    it('Edge Case: should return 400 Bad Request when an unsupported export format is requested', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          eventId: 'EVT_SRILANKA_FLOOD_2026',
          format: 'xml',
          donorId: 'DONOR_01',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('Unsupported export format');
    });
  });
});
