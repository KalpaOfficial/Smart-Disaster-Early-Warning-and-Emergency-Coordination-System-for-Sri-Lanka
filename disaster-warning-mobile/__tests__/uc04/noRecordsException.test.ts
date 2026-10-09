/**
 * Unit Tests for UC04 Exception Flow: "No Records for Selected Criteria".
 *
 * Requirements from guide.md Section 5:
 * - Exception Flow: No Records for Selected Criteria:
 *   The system finds no records for the selected reporting criteria.
 *   The system displays a message indicating that no data are available.
 *   The DMC official returns to the filter configuration and modifies the criteria.
 *   No response report is generated until valid data are available.
 */
import { generatePostEventReport } from '@/services/postEventReportService';
import { addDoc } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';

describe('UC04: "No Records for Selected Criteria" Exception Flow', () => {
  const closedEvent: HazardEvent = {
    id: 'evt-kalu-flood-2026',
    title: 'Kalu Ganga Basin Inundation Disaster',
    status: 'closed',
    hazardType: 'flood',
    affectedDistricts: ['Ratnapura', 'Kalutara'],
    startDate: '2026-09-01T00:00:00Z',
    description: 'Closed flood event',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws an error and prevents report document persistence when no records match filter criteria', async () => {
    // When date range or district has no telemetry records
    await expect(
      generatePostEventReport(
        closedEvent,
        {
          selectedMetrics: ['alert_timeline'],
          startDate: '2025-01-01T00:00:00Z', // Out of bounds range
          endDate: '2025-01-02T00:00:00Z',
        },
        'officer-dmc-01',
        {
          mockNoRecords: true,
        },
      ),
    ).rejects.toThrow('No records found for the selected reporting criteria and filters.');

    // Verifies no report document is stored in Firestore
    expect(addDoc).not.toHaveBeenCalled();
  });
});
