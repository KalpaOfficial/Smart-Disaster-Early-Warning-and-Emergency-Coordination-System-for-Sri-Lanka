/**
 * Unit Tests for UC04 Report Export (PDF & CSV Strategies) & Export Failure Flow.
 *
 * Requirements from guide.md Section 5:
 * - Steps 76–80: Official selects Export Report; system displays available formats (PDF, CSV);
 *   system generates export file and links it to response report.
 * - Exception Flow: Export Generation Failure:
 *   System fails to generate export file. On-screen report retained. Allows retry or another format.
 */
import { exportReport } from '@/services/postEventReportService';
import { updateDoc, doc } from 'firebase/firestore';

describe('UC04: Report Export Strategies & Export Failure Handling', () => {
  const reportId = 'report-post-flood-2026';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Positive Export Cases (Steps 76–80)', () => {
    it('exports report to PDF format and links URL to report document in Firestore', async () => {
      const result = await exportReport(reportId, 'pdf');

      expect(result.success).toBe(true);
      expect(result.format).toBe('pdf');
      expect(result.exportUrl).toContain('.pdf');
      expect(result.exportUrl).toContain(reportId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          exportUrl: result.exportUrl,
          exportFormat: 'pdf',
        }),
      );
    });

    it('exports report to CSV format and links URL to report document in Firestore', async () => {
      const result = await exportReport(reportId, 'csv');

      expect(result.success).toBe(true);
      expect(result.format).toBe('csv');
      expect(result.exportUrl).toContain('.csv');
      expect(result.exportUrl).toContain(reportId);

      expect(updateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          exportUrl: result.exportUrl,
          exportFormat: 'csv',
        }),
      );
    });
  });

  describe('Exception Cases & Validation', () => {
    it('rejects unsupported export formats with descriptive error', async () => {
      await expect(
        exportReport(reportId, 'xml' as any),
      ).rejects.toThrow('Unsupported export format: "xml"');

      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('handles Export Generation Failure gracefully (Exception Flow)', async () => {
      await expect(
        exportReport(reportId, 'pdf', { mockFailure: true }),
      ).rejects.toThrow('Export Generation Failure: Failed to compile report export document.');

      // Document update should not have been completed
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });
});
