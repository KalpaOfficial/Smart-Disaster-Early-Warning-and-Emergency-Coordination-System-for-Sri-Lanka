import { PdfExportStrategy } from '../src/strategies/PdfExportStrategy';
import { CsvExportStrategy } from '../src/strategies/CsvExportStrategy';
import { ExportStrategyFactory } from '../src/strategies/ExportStrategyFactory';

describe('Export Strategies Unit Tests', () => {
  const mockReportData = {
    eventId: 'EVT_TEST_123',
    overallStatus: 'COMPLETE',
    metrics: { alerts: {}, citizenReach: {}, shelterOccupancy: {}, resourceDistribution: {} },
  };

  it('PdfExportStrategy should generate PDF URL containing event ID and pdf extension', async () => {
    const pdfStrategy = new PdfExportStrategy();
    expect(pdfStrategy.format).toBe('pdf');

    const fileUrl = await pdfStrategy.generateFile(mockReportData);
    expect(fileUrl).toContain('.pdf');
    expect(fileUrl).toContain('EVT_TEST_123');
  });

  it('CsvExportStrategy should generate CSV URL containing event ID and csv extension', async () => {
    const csvStrategy = new CsvExportStrategy();
    expect(csvStrategy.format).toBe('csv');

    const fileUrl = await csvStrategy.generateFile(mockReportData);
    expect(fileUrl).toContain('.csv');
    expect(fileUrl).toContain('EVT_TEST_123');
  });

  describe('ExportStrategyFactory', () => {
    it('should return PdfExportStrategy when requesting format "pdf"', () => {
      const strategy = ExportStrategyFactory.getStrategy('pdf');
      expect(strategy).toBeInstanceOf(PdfExportStrategy);
      expect(strategy.format).toBe('pdf');
    });

    it('should return CsvExportStrategy when requesting format "CSV" (case-insensitive)', () => {
      const strategy = ExportStrategyFactory.getStrategy('CSV');
      expect(strategy).toBeInstanceOf(CsvExportStrategy);
      expect(strategy.format).toBe('csv');
    });

    it('should throw error for unsupported format', () => {
      expect(() => ExportStrategyFactory.getStrategy('docx')).toThrow('Unsupported export format');
    });
  });
});
