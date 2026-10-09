/**
 * Unit Tests for UC04 Closed Event Selection & "Event Not Closed" Exception Flow.
 *
 * Requirements from guide.md Section 5:
 * - Steps 64–65: System displays list of completed/closed hazard events; DMC official selects a closed hazard event.
 * - Precondition: At least one hazard event has been completed/closed.
 * - Exception Flow: Event Not Closed:
 *   The selected event is still active. The system rejects it for post-event reporting
 *   and informs the official that a completed/closed event is required.
 */
import {
  getClosedHazardEvents,
  validateReportCriteria,
} from '@/services/postEventReportService';
import { getDocs, query, where, collection } from 'firebase/firestore';
import type { HazardEvent } from '@/types/resources';

describe('UC04: Closed Event Selection & Status Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Closed Hazard Event Discovery (Steps 64–65)', () => {
    it('retrieves only completed / closed hazard events from Firestore', async () => {
      const mockClosedDocs = [
        {
          id: 'evt-kelani-flood-closed',
          data: () => ({
            title: 'Kelani River Major Inundation 2026',
            status: 'closed',
            hazardType: 'flood',
            affectedDistricts: ['Colombo', 'Gampaha'],
            startDate: { toDate: () => new Date('2026-09-15T00:00:00Z') },
            description: 'Completed monsoon flood event.',
          }),
        },
        {
          id: 'evt-cyclone-nivar-closed',
          data: () => ({
            title: 'Cyclone Nivar Coastal Alert 2026',
            status: 'closed',
            hazardType: 'cyclone',
            affectedDistricts: ['Batticaloa', 'Trincomalee'],
            startDate: { toDate: () => new Date('2026-08-20T00:00:00Z') },
            description: 'Phased out coastal hazard event.',
          }),
        },
      ];

      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: mockClosedDocs,
      });

      const events = await getClosedHazardEvents();

      expect(events).toHaveLength(2);
      expect(events[0].id).toBe('evt-kelani-flood-closed');
      expect(events[0].status).toBe('closed');
      expect(events[1].id).toBe('evt-cyclone-nivar-closed');
      expect(events[1].status).toBe('closed');
      expect(where).toHaveBeenCalledWith('status', '==', 'closed');
    });

    it('returns empty array when no hazard events are closed yet', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [],
      });

      const events = await getClosedHazardEvents();
      expect(events).toHaveLength(0);
    });
  });

  describe('Exception Flow: Event Not Closed Guard', () => {
    it('accepts a completed / closed hazard event for post-event reporting', () => {
      const closedEvent: HazardEvent = {
        id: 'evt-closed-01',
        title: 'Southwest Monsoon Floods 2026',
        status: 'closed',
        hazardType: 'flood',
        affectedDistricts: ['Ratnapura', 'Kalutara'],
        startDate: '2026-09-01T00:00:00Z',
        description: 'Completed event',
      };

      const result = validateReportCriteria(closedEvent, {
        selectedMetrics: ['alert_timeline', 'citizens_reached'],
      });

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects an active hazard event with Exception Flow error message', () => {
      const activeEvent: HazardEvent = {
        id: 'evt-active-02',
        title: 'Active Flash Flooding in Kalu River Basin',
        status: 'active', // Active event!
        hazardType: 'flood',
        affectedDistricts: ['Ratnapura'],
        startDate: '2026-10-09T00:00:00Z',
        description: 'Ongoing live disaster',
      };

      const result = validateReportCriteria(activeEvent, {
        selectedMetrics: ['alert_timeline'],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Event Not Closed');
      expect(result.error).toContain('Selected hazard event is still active');
      expect(result.error).toContain('completed/closed event');
    });

    it('rejects null or undefined hazard event selection', () => {
      const result = validateReportCriteria(null, {
        selectedMetrics: ['alert_timeline'],
      });

      expect(result.valid).toBe(false);
      expect(result.error).toBe('A valid hazard event must be selected.');
    });
  });
});
