/**
 * Strategy Pattern Interface for report export generation.
 * Enables Open/Closed Principle (OCP) allowing new export formats (e.g., PDF, CSV, Excel, JSON)
 * to be added without modifying existing report generation or export logic.
 */
export interface IExportStrategy {
  /**
   * The file format identifier handled by this strategy (e.g. 'pdf', 'csv').
   */
  readonly format: string;

  /**
   * Renders and generates an export file for the given post-event report data.
   * @param reportData - The aggregated post-event report data structure.
   * @returns Promise resolving to the generated file URL or storage path.
   */
  generateFile(reportData: any): Promise<string>;
}
