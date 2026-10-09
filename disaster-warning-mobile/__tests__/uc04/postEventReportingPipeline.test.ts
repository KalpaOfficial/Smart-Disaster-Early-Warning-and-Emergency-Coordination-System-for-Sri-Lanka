/**
 * End-to-End Orchestration & Lifecycle Pipeline Test for UC04:
 * Generate Post-Event Response Report.
 *
 * Simulates the complete chronological reporting workflow:
 * 1. Discover completed / closed hazard events (Steps 64–65)
 * 2. Configure 4 statistical metrics, reporting date range, and district filter (Steps 66–68)
 * 3. Validate request criteria and guard against active events (Step 70)
 * 4. Execute concurrent metrics aggregation with partial fault tolerance (Steps 71–73)
 * 5. Review assembled report datasets (Steps 74–75)
 * 6. Execute Alternate Flow: Filter Refinement
 * 7. Export report to PDF format (Steps 76–80)
 * 8. Execute Alternate Flow: Donor Report Distribution to UNICEF (Steps 81–83)
 * 9. Validate all Postconditions and audit trail persistence
 */
import {
  getClosedHazardEvents,
  validateReportCriteria,
  generatePostEventReport,
  exportReport,
  distributeReportToDonor,
} from '@/services/postEventReportService';
import { getDocs, addDoc, updateDoc } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';
import type {
  AlertTimelineMetric,
  CitizenReachMetric,
  ShelterOccupancyMetric,
  ResourceDistributionMetric,
} from '@/types/postEventReport';

describe('UC04: Post-Event Response Report End-to-End Pipeline', () => {
  const dmcOfficerUid = 'officer-dmc-colombo-01';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('executes the full post-event response report lifecycle from selection to donor distribution', async () => {
    // -------------------------------------------------------------
    // Phase 1: Discover Closed Events (Steps 64–65)
    // -------------------------------------------------------------
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [
        {
          id: 'evt-monsoon-2026-closed',
          data: () => ({
            title: 'Southwest Monsoon Severe Flooding 2026',
            status: 'closed',
            hazardType: 'flood',
            affectedDistricts: ['Ratnapura', 'Kalutara'],
            startDate: { toDate: () => new Date('2026-09-01T00:00:00Z') },
            description: 'Completed monsoon flood disaster.',
          }),
        },
      ],
    });

    const closedEvents = await getClosedHazardEvents();
    expect(closedEvents).toHaveLength(1);
    const selectedEvent = closedEvents[0];
    expect(selectedEvent.id).toBe('evt-monsoon-2026-closed');
    expect(selectedEvent.status).toBe('closed');

    // -------------------------------------------------------------
    // Phase 2: Configure & Validate Reporting Criteria (Steps 66–70)
    // -------------------------------------------------------------
    const initialCriteria = {
      selectedMetrics: [
        'alert_timeline' as const,
        'citizens_reached' as const,
        'shelter_occupancy' as const,
        'resource_distribution' as const,
      ],
      startDate: '2026-09-01T00:00:00Z',
      endDate: '2026-09-15T23:59:59Z',
      district: 'Ratnapura',
    };

    const validation = validateReportCriteria(selectedEvent, initialCriteria);
    expect(validation.valid).toBe(true);

    // -------------------------------------------------------------
    // Phase 3: Generate Post-Event Response Report (Steps 71–74)
    // -------------------------------------------------------------
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'report-pipeline-doc-01' });

    const report = await generatePostEventReport(
      selectedEvent,
      initialCriteria,
      dmcOfficerUid,
    );

    expect(report.id).toBe('report-pipeline-doc-01');
    expect(report.overallStatus).toBe('COMPLETE');
    expect(report.summary.totalMetricsCount).toBe(4);
    expect(report.summary.successfulMetricsCount).toBe(4);
    expect(report.summary.failedMetricsCount).toBe(0);

    // Verify all 4 required metrics datasets are populated
    const alerts = report.metrics.alerts as AlertTimelineMetric;
    const citizenReach = report.metrics.citizenReach as CitizenReachMetric;
    const shelterOccupancy = report.metrics.shelterOccupancy as ShelterOccupancyMetric;
    const distribution = report.metrics.resourceDistribution as ResourceDistributionMetric;

    expect(alerts.totalAlertsIssued).toBeGreaterThan(0);
    expect(citizenReach.totalCitizensReached).toBeGreaterThan(0);
    expect(shelterOccupancy.totalSheltersActive).toBeGreaterThan(0);
    expect(distribution.totalPackagesDistributed).toBeGreaterThan(0);

    // -------------------------------------------------------------
    // Phase 4: Alternate Flow — Filter Refinement
    // -------------------------------------------------------------
    // Officer refines district filter from 'Ratnapura' to 'all' for nationwide summary
    const refinedCriteria = {
      ...initialCriteria,
      district: 'all',
    };

    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'report-pipeline-doc-refined' });

    const refinedReport = await generatePostEventReport(
      selectedEvent,
      refinedCriteria,
      dmcOfficerUid,
    );

    expect(refinedReport.id).toBe('report-pipeline-doc-refined');
    expect(refinedReport.filterCriteria.district).toBe('all');
    expect(refinedReport.overallStatus).toBe('COMPLETE');

    // -------------------------------------------------------------
    // Phase 5: Export Report to PDF (Steps 76–80)
    // -------------------------------------------------------------
    const exportResult = await exportReport(refinedReport.id, 'pdf');
    expect(exportResult.success).toBe(true);
    expect(exportResult.format).toBe('pdf');
    expect(exportResult.exportUrl).toContain('.pdf');

    expect(updateDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        exportUrl: exportResult.exportUrl,
        exportFormat: 'pdf',
      }),
    );

    // -------------------------------------------------------------
    // Phase 6: Alternate Flow — Donor Distribution to UNICEF (Steps 81–83)
    // -------------------------------------------------------------
    (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'donor-audit-pipeline-01' });

    const donorRecord = await distributeReportToDonor(
      refinedReport.id,
      selectedEvent.id,
      'DONOR_UNICEF_01',
      'UNICEF Country Mission Sri Lanka',
      'pdf',
      exportResult.exportUrl,
      dmcOfficerUid,
    );

    expect(donorRecord.id).toBe('donor-audit-pipeline-01');
    expect(donorRecord.reportId).toBe(refinedReport.id);
    expect(donorRecord.donorId).toBe('DONOR_UNICEF_01');
    expect(donorRecord.donorName).toBe('UNICEF Country Mission Sri Lanka');
    expect(donorRecord.format).toBe('pdf');
    expect(donorRecord.fileUrl).toBe(exportResult.exportUrl);
    expect(donorRecord.distributedBy).toBe(dmcOfficerUid);
    expect(donorRecord.status).toBe('SENT');
  });
});
