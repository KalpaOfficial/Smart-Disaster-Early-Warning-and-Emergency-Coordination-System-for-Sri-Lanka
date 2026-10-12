import type { HazardEvent, HazardType } from '@/types/resources';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import { SRI_LANKA_RIVER_BASINS } from '@/constants/riverBasins';

export type HazardEventDetails = Pick<
  HazardEvent,
  | 'title'
  | 'hazardType'
  | 'description'
  | 'affectedDistricts'
  | 'affectedRiverBasins'
  | 'warningLevel'
>;
export const HAZARD_TYPES: { label: string; value: HazardType }[] = [
  { label: 'Flood', value: 'flood' },
  { label: 'Landslide', value: 'landslide' },
  { label: 'Cyclone', value: 'cyclone' },
  { label: 'Tsunami', value: 'tsunami' },
  { label: 'Drought', value: 'drought' },
];
export const EVENT_LEVELS = [
  'Level 1 Advisory',
  'Level 2 Warning',
  'Level 3 Warning',
  'Level 4 Alert',
];

/** Whitelist editable fields so edits preserve status, history and creation metadata. */
export function normalizeHazardEvent(input: HazardEventDetails): HazardEventDetails {
  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || title.length > 150)
    throw new Error('Enter an event title between 1 and 150 characters.');
  if (!HAZARD_TYPES.some(type => type.value === input.hazardType))
    throw new Error('Choose a valid hazard type.');
  if (!description || description.length > 2000)
    throw new Error('Enter an event description between 1 and 2,000 characters.');
  if (
    !Array.isArray(input.affectedDistricts) ||
    !input.affectedDistricts.length ||
    input.affectedDistricts.some(district => !SRI_LANKAN_DISTRICTS.includes(district as never))
  )
    throw new Error('Select at least one valid affected district.');
  if (
    input.affectedRiverBasins != null &&
    (!Array.isArray(input.affectedRiverBasins) ||
      input.affectedRiverBasins.some(basin => !Object.hasOwn(SRI_LANKA_RIVER_BASINS, basin)))
  )
    throw new Error('Choose valid river basins.');
  const level = input.warningLevel?.trim() || EVENT_LEVELS[0];
  if (!EVENT_LEVELS.includes(level)) throw new Error('Choose a valid event alert level.');
  return {
    title,
    description,
    hazardType: input.hazardType,
    affectedDistricts: [...new Set(input.affectedDistricts)],
    affectedRiverBasins: [...new Set(input.affectedRiverBasins || [])],
    warningLevel: level,
  };
}
