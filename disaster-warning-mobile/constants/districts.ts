/**
 * All 25 administrative districts of Sri Lanka.
 * Used for district selection in signup, shelter registration, and resource coordination.
 */
export const SRI_LANKAN_DISTRICTS = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
] as const;

export type District = (typeof SRI_LANKAN_DISTRICTS)[number];

/**
 * Districts grouped by province for organisational context.
 */
export const DISTRICTS_BY_PROVINCE: Record<string, readonly string[]> = {
  Western: ['Colombo', 'Gampaha', 'Kalutara'],
  Central: ['Kandy', 'Matale', 'Nuwara Eliya'],
  Southern: ['Galle', 'Matara', 'Hambantota'],
  Northern: ['Jaffna', 'Kilinochchi', 'Mannar', 'Mullaitivu', 'Vavuniya'],
  Eastern: ['Ampara', 'Batticaloa', 'Trincomalee'],
  'North Western': ['Kurunegala', 'Puttalam'],
  'North Central': ['Anuradhapura', 'Polonnaruwa'],
  Uva: ['Badulla', 'Monaragala'],
  Sabaragamuwa: ['Ratnapura', 'Kegalle'],
};

/**
 * Shelter facility types with labels.
 */
export const FACILITY_TYPES = [
  { value: 'school', label: 'School' },
  { value: 'community_hall', label: 'Community Hall' },
  { value: 'temple', label: 'Temple / Religious Centre' },
  { value: 'stadium', label: 'Stadium / Sports Complex' },
  { value: 'government_building', label: 'Government Building' },
] as const;

/**
 * Shelter facilities/amenities.
 */
export const SHELTER_FACILITIES = [
  'Water Supply',
  'Electricity',
  'Medical Aid',
  'Sanitation',
  'Kitchen',
  'Bedding',
  'Communication',
  'Vehicle Access',
] as const;

/**
 * Organisation types with labels.
 */
export const ORGANISATION_TYPES = [
  { value: 'government', label: 'Government' },
  { value: 'armed_forces', label: 'Armed Forces' },
  { value: 'ngo', label: 'NGO' },
  { value: 'private_donor', label: 'Private Donor' },
] as const;

/**
 * Supply types with labels and icons.
 */
export const SUPPLY_TYPES = [
  { value: 'food', label: 'Food', icon: '🍚' },
  { value: 'water', label: 'Water', icon: '💧' },
  { value: 'medicine', label: 'Medicine', icon: '💊' },
  { value: 'blankets', label: 'Blankets', icon: '🛏️' },
  { value: 'tents', label: 'Tents', icon: '⛺' },
] as const;

/**
 * Rescue team specialisations.
 */
export const TEAM_SPECIALISATIONS = [
  'Water Rescue',
  'Search & Rescue',
  'Medical Response',
  'Evacuation',
  'Debris Clearance',
  'Logistics & Transport',
  'Communication Support',
] as const;
