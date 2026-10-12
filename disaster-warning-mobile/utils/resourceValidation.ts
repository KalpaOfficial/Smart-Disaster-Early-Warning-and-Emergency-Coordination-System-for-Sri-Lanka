import {
  FACILITY_TYPES,
  ORGANISATION_TYPES,
  SRI_LANKAN_DISTRICTS,
  SUPPLY_TYPES,
} from '@/constants/districts';
import type {
  CreateShelterData,
  CreateRescueTeamData,
  CreateReliefSupplyData,
  CreateDistributionData,
  TeamStatus,
} from '@/types/resources';

function required(value: string, label: string): void {
  if (!value?.trim()) throw new Error(`${label} is required.`);
}
export function validateResourceDistrict(district: string): void {
  if (!(SRI_LANKAN_DISTRICTS as readonly string[]).includes(district))
    throw new Error('Select a valid Sri Lankan district.');
}
export function validatePositiveWholeNumber(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error(`${label} must be a positive whole number.`);
}
function validateOwner(data: {
  organisationType: string;
  organisationName: string;
  district: string;
}): void {
  required(data.organisationName, 'Organisation name');
  if (!ORGANISATION_TYPES.some(type => type.value === data.organisationType))
    throw new Error('Select a valid organisation type.');
  validateResourceDistrict(data.district);
}
export function validateShelter(data: CreateShelterData): void {
  required(data.name, 'Shelter name');
  required(data.address, 'Address');
  required(data.managerName, 'Manager name');
  required(data.managerContact, 'Manager contact');
  validateOwner(data);
  validatePositiveWholeNumber(data.capacity, 'Capacity');
  if (!FACILITY_TYPES.some(type => type.value === data.facilityType))
    throw new Error('Select a valid shelter type.');
  if (
    !Number.isFinite(data.latitude) ||
    !Number.isFinite(data.longitude) ||
    data.latitude < 5.8 ||
    data.latitude > 9.9 ||
    data.longitude < 79.5 ||
    data.longitude > 82
  )
    throw new Error('Select a valid map location in Sri Lanka.');
}
export function validateRescueTeam(data: CreateRescueTeamData): void {
  required(data.name, 'Team name');
  required(data.specialisation, 'Specialisation');
  validateOwner(data);
  validatePositiveWholeNumber(data.memberCount, 'Crew count');
}
export function validateSupply(data: CreateReliefSupplyData): void {
  required(data.itemName, 'Item name');
  required(data.unit, 'Unit');
  validateOwner(data);
  validatePositiveWholeNumber(data.totalQuantity, 'Total quantity');
  if (!SUPPLY_TYPES.some(type => type.value === data.type))
    throw new Error('Select a valid supply type.');
}
export function validateDistribution(data: CreateDistributionData): void {
  required(data.supplyId, 'Supply item');
  required(data.destinationLocation, 'Destination location');
  validateResourceDistrict(data.destinationDistrict);
  validatePositiveWholeNumber(data.quantity, 'Distribution quantity');
}
export const TEAM_STATUS_TRANSITIONS: Record<TeamStatus, readonly TeamStatus[]> = {
  available: ['dispatched', 'unavailable'],
  dispatched: ['en_route', 'on_site', 'available', 'unavailable'],
  en_route: ['on_site', 'available', 'unavailable'],
  on_site: ['completed', 'available', 'unavailable'],
  completed: ['available', 'unavailable'],
  unavailable: ['available'],
};
export function validateTeamTransition(current: TeamStatus, next: TeamStatus): void {
  if (next === 'dispatched' || !TEAM_STATUS_TRANSITIONS[current]?.includes(next))
    throw new Error('This status change is no longer available. Refresh the team and try again.');
}
