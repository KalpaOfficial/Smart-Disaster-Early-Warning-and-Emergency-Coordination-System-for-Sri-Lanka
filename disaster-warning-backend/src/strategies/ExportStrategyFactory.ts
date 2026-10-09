import { IExportStrategy } from '../interfaces/IExportStrategy';
import { PdfExportStrategy } from './PdfExportStrategy';
import { CsvExportStrategy } from './CsvExportStrategy';

/**
 * Factory class to resolve export strategies based on requested file format.
 * Encapsulates strategy instantiation (Factory Pattern + Strategy Pattern).
 */
export class ExportStrategyFactory {
  private static strategies: Map<string, IExportStrategy> = new Map<string, IExportStrategy>([
    ['pdf', new PdfExportStrategy()],
    ['csv', new CsvExportStrategy()],
  ]);

  /**
   * Retrieves an export strategy for a specific file format.
   * @param format - Export format string ('pdf' | 'csv')
   * @throws Error if the format is unsupported
   */
  public static getStrategy(format: string): IExportStrategy {
    const normalizedFormat = format.toLowerCase().trim();
    const strategy = this.strategies.get(normalizedFormat);

    if (!strategy) {
      throw new Error(`Unsupported export format '${format}'. Supported formats are: 'pdf', 'csv'.`);
    }

    return strategy;
  }
}
