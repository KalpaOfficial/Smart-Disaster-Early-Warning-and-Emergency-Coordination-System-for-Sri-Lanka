import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';
import type { HazardWarning, WarningSeverity } from '@/types/warning';

export function warningDistricts(warning: HazardWarning): string[] {
  return [
    ...new Set([
      ...warning.resolvedDistricts,
      ...(warning.targetMode === 'district'
        ? warning.targetAreas
        : warning.targetAreas.flatMap(area => SRI_LANKA_RIVER_BASINS[area] || [])),
    ]),
  ];
}

export function filterCommunityWarnings(
  warnings: HazardWarning[],
  district: string,
  severity: WarningSeverity | 'all',
  search: string
): HazardWarning[] {
  const term = search.trim().toLowerCase();
  return warnings
    .filter(
      warning =>
        ['active', 'delivered', 'partially_failed'].includes(warning.status) &&
        (district === 'all' || warningDistricts(warning).includes(district)) &&
        (severity === 'all' || warning.severity === severity) &&
        (!term ||
          [
            warning.headline,
            warning.instructions,
            warning.hazardType,
            ...warning.targetAreas,
            ...warningDistricts(warning),
          ]
            .join(' ')
            .toLowerCase()
            .includes(term))
    )
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
