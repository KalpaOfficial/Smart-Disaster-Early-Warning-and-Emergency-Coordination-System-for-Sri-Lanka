/**
 * Unit Tests for UC01 Hazard Event Timeline Attachment & Retrieval.
 */
import { attachWarningToTimeline, getEventTimeline } from '@/services/hazardEventService';

describe('UC01 Hazard Event Timeline Update', () => {
  const eventId = 'event-kelani-flood-2026';
  const warningId = 'warning-doc-999';
  const headline = 'RED EVACUATION ALERT: High flood level reached at Nagalagam Street';
  const severity = 'evacuation';
  const issuedBy = 'DMC Duty Officer Perera';

  it('should attempt to attach warning to timeline without throwing errors', async () => {
    await expect(
      attachWarningToTimeline(eventId, warningId, headline, severity, issuedBy),
    ).resolves.not.toThrow();
  });

  it('should return empty array or array of timeline entries for a given event ID', async () => {
    const timeline = await getEventTimeline(eventId);
    expect(Array.isArray(timeline)).toBe(true);
  });

  it('should handle empty eventId gracefully without throwing errors', async () => {
    await expect(
      attachWarningToTimeline('', warningId, headline, severity, issuedBy),
    ).resolves.not.toThrow();

    const timeline = await getEventTimeline('');
    expect(timeline).toEqual([]);
  });
});
