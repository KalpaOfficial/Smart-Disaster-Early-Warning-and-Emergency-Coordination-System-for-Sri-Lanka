/**
 * Unit Tests for UC04 Donor Report Distribution & Audit Logging.
 *
 * Requirements from guide.md Section 5:
 * - Steps 81–83 & Alternate Flow: Donor Report Distribution:
 *   The DMC official chooses to share the exported report with a registered donor organisation.
 *   The system records the report distribution with recipient, format, and delivery timestamp.
 *   The report is delivered to the donor organisation and recorded for audit purposes.
 * - Table 5.1 Justification: Retain as an optional post-export action rather than coupling it to report generation.
 */
import { distributeReportToDonor } from '@/services/postEventReportService';
import { addDoc, collection } from 'firebase/firestore';

describe('UC04: Donor Report Distribution & Audit Logging', () => {
  const reportId = 'report-post-flood-2026';
  const eventId = 'evt-kalu-flood-2026';
  const fileUrl = 'https://storage.disaster-warning.lk/reports/pdf/POST_EVENT_REPORT_2026.pdf';
  const officerUid = 'officer-dmc-01';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Positive Distribution Cases (Steps 81–83)', () => {
    it('successfully logs donor distribution for UNICEF and returns audit record', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-donor-audit-01' });

      const result = await distributeReportToDonor(
        reportId,
        eventId,
        'DONOR_UNICEF_01',
        'UNICEF Sri Lanka Emergency Country Office',
        'pdf',
        fileUrl,
        officerUid,
      );

      expect(result.id).toBe('dist-donor-audit-01');
      expect(result.reportId).toBe(reportId);
      expect(result.eventId).toBe(eventId);
      expect(result.donorId).toBe('DONOR_UNICEF_01');
      expect(result.donorName).toBe('UNICEF Sri Lanka Emergency Country Office');
      expect(result.format).toBe('pdf');
      expect(result.fileUrl).toBe(fileUrl);
      expect(result.distributedBy).toBe(officerUid);
      expect(result.status).toBe('SENT');
      expect(result.distributedAt).toBeDefined();

      expect(addDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          donorId: 'DONOR_UNICEF_01',
          status: 'SENT',
        }),
      );
    });

    it('successfully logs donor distribution for Sri Lanka Red Cross with CSV export', async () => {
      (addDoc as jest.Mock).mockResolvedValueOnce({ id: 'dist-donor-audit-02' });

      const csvUrl = 'https://storage.disaster-warning.lk/reports/csv/POST_EVENT_REPORT_2026.csv';
      const result = await distributeReportToDonor(
        reportId,
        eventId,
        'DONOR_RED_CROSS_02',
        'Sri Lanka Red Cross Society Disaster Management Centre',
        'csv',
        csvUrl,
        officerUid,
      );

      expect(result.id).toBe('dist-donor-audit-02');
      expect(result.format).toBe('csv');
      expect(result.status).toBe('SENT');
    });
  });

  describe('Validation & Audit Safeguards', () => {
    it('throws validation error when donorId or donorName is missing', async () => {
      await expect(
        distributeReportToDonor(reportId, eventId, '', 'UNICEF', 'pdf', fileUrl, officerUid),
      ).rejects.toThrow('Donor organization identifier and name are mandatory for report distribution.');

      await expect(
        distributeReportToDonor(reportId, eventId, 'DONOR_1', '', 'pdf', fileUrl, officerUid),
      ).rejects.toThrow('Donor organization identifier and name are mandatory for report distribution.');

      expect(addDoc).not.toHaveBeenCalled();
    });
  });
});
