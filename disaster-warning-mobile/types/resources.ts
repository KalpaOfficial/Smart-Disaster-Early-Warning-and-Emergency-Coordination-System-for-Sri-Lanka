/**
 * Resource coordination types for UC03:
 * Coordinate Shelters, Rescue Teams and Relief Supplies.
 */

// --- Organisation ---

export type OrganisationType = 'government' | 'armed_forces' | 'ngo' | 'private_donor';

// --- Hazard Event ---

export type HazardType = 'flood' | 'landslide' | 'cyclone' | 'tsunami' | 'drought';
export type EventStatus = 'active' | 'closed';

export interface HazardEvent {
  id: string;
  title: string;
  hazardType: HazardType;
  status: EventStatus;
  affectedDistricts: string[];
  affectedRiverBasins?: string[];
  warningLevel?: string;
  startDate: string;
  description: string;
}

// --- Shelter ---

export type ShelterFacilityType =
  | 'school'
  | 'community_hall'
  | 'temple'
  | 'stadium'
  | 'government_building';

export type ShelterStatus = 'registered' | 'active' | 'inactive' | 'over_capacity';

export interface Shelter {
  id: string;
  name: string;
  facilityType: ShelterFacilityType;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  capacity: number;
  currentOccupancy: number;
  facilities: string[];
  managerName: string;
  managerContact: string;
  organisationType: OrganisationType;
  organisationName: string;
  status: ShelterStatus;
  hazardEventId: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateShelterData {
  name: string;
  facilityType: ShelterFacilityType;
  address: string;
  district: string;
  latitude: number;
  longitude: number;
  capacity: number;
  facilities: string[];
  managerName: string;
  managerContact: string;
  organisationType: OrganisationType;
  organisationName: string;
}

// --- Rescue Team ---

export type TeamStatus =
  | 'available'
  | 'dispatched'
  | 'en_route'
  | 'on_site'
  | 'completed'
  | 'unavailable';

export interface RescueTeam {
  id: string;
  name: string;
  organisationName: string;
  organisationType: OrganisationType;
  memberCount: number;
  specialisation: string;
  district: string;
  status: TeamStatus;
  assignedLocation: string;
  hazardEventId: string;
  lastStatusUpdate: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateRescueTeamData {
  name: string;
  organisationName: string;
  organisationType: OrganisationType;
  memberCount: number;
  specialisation: string;
  district: string;
}

// --- Relief Supply ---

export type SupplyType = 'food' | 'water' | 'medicine' | 'blankets' | 'tents';

export interface ReliefSupply {
  id: string;
  type: SupplyType;
  itemName: string;
  totalQuantity: number;
  remainingQuantity: number;
  unit: string;
  organisationName: string;
  organisationType: OrganisationType;
  district: string;
  hazardEventId: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateReliefSupplyData {
  type: SupplyType;
  itemName: string;
  totalQuantity: number;
  unit: string;
  organisationName: string;
  organisationType: OrganisationType;
  district: string;
}

// --- Distribution Record ---

export interface Distribution {
  id: string;
  supplyId: string;
  supplyName: string;
  quantity: number;
  unit: string;
  destinationDistrict: string;
  destinationLocation: string;
  details: string;
  distributedBy: string;
  hazardEventId: string;
  distributedAt: string;
}

export interface CreateDistributionData {
  supplyId: string;
  supplyName: string;
  quantity: number;
  unit: string;
  destinationDistrict: string;
  destinationLocation: string;
  details: string;
}
