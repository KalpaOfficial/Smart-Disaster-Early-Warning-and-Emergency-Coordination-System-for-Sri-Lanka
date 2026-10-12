import type { HazardWarning } from '@/types/warning';
import type { HazardEvent, Shelter } from '@/types/resources';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';

/** Show relevant open-event warnings, prioritizing evacuation over newer advisories. */
export function getCommunityWarnings(
  warnings: HazardWarning[],
  events: HazardEvent[],
  district?: string
): HazardWarning[] {
  const openEvents = new Set(events.filter(e => e.status === 'active').map(e => e.id));
  const severity = { advisory: 0, warning: 1, evacuation: 2 };
  return warnings
    .filter(w => {
      if (!['active', 'delivered', 'partially_failed'].includes(w.status)) return false;
      if (!openEvents.has(w.eventId || w.hazardEventId || '')) return false;
      if (!district) return true;
      const targetDistricts = w.resolvedDistricts?.length
        ? w.resolvedDistricts
        : w.targetMode === 'district'
          ? w.targetAreas
          : w.targetAreas.flatMap(basin => SRI_LANKA_RIVER_BASINS[basin] || []);
      return targetDistricts.includes(district);
    })
    .sort(
      (a, b) =>
        severity[b.severity] - severity[a.severity] ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );
}

export function getAvailableCommunityShelters(shelters: Shelter[], district?: string): Shelter[] {
  return shelters.filter(
    s =>
      (!district || s.district === district) &&
      s.status === 'active' &&
      s.currentOccupancy < s.capacity
  );
}
