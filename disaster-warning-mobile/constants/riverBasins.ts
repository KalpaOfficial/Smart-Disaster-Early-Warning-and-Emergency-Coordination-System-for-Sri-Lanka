/**
 * Sri Lankan River Basins mapping to districts for UC01 Hazard Warning target resolution.
 * Allows hazard warnings targeted by river basin to resolve underlying districts
 * and deduplicate registered recipients.
 */

export const SRI_LANKA_RIVER_BASINS: Record<string, string[]> = {
  'Kalu River Basin': ['Ratnapura', 'Kalutara'],
  'Kelani River Basin': ['Colombo', 'Gampaha', 'Kegalle'],
  'Nilwala River Basin': ['Matara', 'Galle'],
  'Gin River Basin': ['Galle', 'Matara'],
  'Mahaweli River Basin': ['Kandy', 'Nuwara Eliya', 'Polonnaruwa', 'Trincomalee'],
  'Yan Oya Basin': ['Anuradhapura', 'Trincomalee'],
  'Deduru Oya Basin': ['Kurunegala', 'Puttalam'],
};
