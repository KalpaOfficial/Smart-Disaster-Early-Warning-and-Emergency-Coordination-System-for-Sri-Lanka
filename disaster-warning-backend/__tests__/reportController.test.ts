import request from 'supertest';
import { createApp } from '../src/app';

describe('UC04: Report & Export Controller Integration Tests (Supertest)', () => {
  const app = createApp();

  describe('POST /api/reports/generate', () => {
    it('Positive Case: should successfully generate report fetching all 4 metrics concurrently (Status 200)', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          eventId: 'EVT_SRILANKA_FLOOD_2026',
        });

      expect(response.status).toBe(200);
      expect(response.body).toBeDefined();
      expect(response.body.eventId).toBe('EVT_SRILANKA_FLOOD_2026');
      expect(response.body.overallStatus).toBe('COMPLETE');
      expect(response.body.failedMetrics).toHaveLength(0);

      // Verify all 4 metrics datasets are present
      expect(response.body.metrics.alerts).toBeDefined();
      expect(response.body.metrics.alerts.totalAlertsIssued).toBeGreaterThan(0);

      expect(response.body.metrics.citizenReach).toBeDefined();
      expect(response.body.metrics.citizenReach.totalCitizensReached).toBeGreaterThan(0);

      expect(response.body.metrics.shelterOccupancy).toBeDefined();
      expect(response.body.metrics.shelterOccupancy.totalSheltersActive).toBeGreaterThan(0);

      expect(response.body.metrics.resourceDistribution).toBeDefined();
      expect(response.body.metrics.resourceDistribution.totalPackagesDistributed).toBeGreaterThan(0);
    });

    it('Negative/Error Case (Timeout Simulation): should handle single aggregator timeout gracefully (Status 206/200)', async () => {
      // EVT_FAIL_OCCUPANCY triggers simulated Firestore timeout in OccupancyMetricAggregator
      const response = await request(app)
        .post('/api/reports/generate')
        .send({
          eventId: 'EVT_FAIL_OCCUPANCY',
        });

      // Partial success status code (206 Partial Content or 200 with partial payload)
      expect([200, 206]).toContain(response.status);
      expect(response.body.overallStatus).toBe('PARTIAL_SUCCESS');

      // Verify that the failed metric is explicitly flagged as "Incomplete/Timeout"
      expect(response.body.metrics.shelterOccupancy).toBe('Incomplete/Timeout');
      expect(response.body.failedMetrics).toContain('shelterOccupancy');

      // Verify that all other 3 aggregators succeeded
      expect(response.body.metrics.alerts).not.toBe('Incomplete/Timeout');
      expect(response.body.metrics.citizenReach).not.toBe('Incomplete/Timeout');
      expect(response.body.metrics.resourceDistribution).not.toBe('Incomplete/Timeout');
      expect(response.body.summary.successfulMetricsCount).toBe(3);
    });

    it('Validation Case: should return 400 Bad Request when eventId is missing', async () => {
      const response = await request(app)
        .post('/api/reports/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
      expect(response.body.message).toContain('eventId');
    });
  });

  describe('POST /api/reports/export', () => {
    it('Edge Case - Strategy Selection (PDF): should generate PDF report via PdfExportStrategy', async () => {
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
      expect(response.body.donorId).toBe('DONOR_UNICEF_01');
      expect(response.body.fileUrl).toContain('.pdf');
      expect(response.body.distributionStatus).toBe('SENT');
    });

    it('Edge Case - Strategy Selection (CSV): should generate CSV report via CsvExportStrategy', async () => {
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
      expect(response.body.donorId).toBe('DONOR_RED_CROSS_02');
      expect(response.body.fileUrl).toContain('.csv');
      expect(response.body.distributionStatus).toBe('SENT');
    });

    it('Validation Case: should return 400 for unsupported format', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          eventId: 'EVT_SRILANKA_FLOOD_2026',
          format: 'docx',
          donorId: 'DONOR_01',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('Unsupported export format');
    });

    it('Validation Case: should return 400 when donorId or format is missing', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          eventId: 'EVT_SRILANKA_FLOOD_2026',
          format: 'pdf',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('donorId');
    });

    it('Validation Case: should return 400 when eventId is missing in export request', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          format: 'pdf',
          donorId: 'DONOR_01',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('eventId');
    });

    it('Validation Case: should return 400 when format is missing in export request', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          eventId: 'EVT_SRILANKA_FLOOD_2026',
          donorId: 'DONOR_01',
        });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('format');
    });
  });
});
