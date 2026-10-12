import type {
  CreateShelterData,
  CreateRescueTeamData,
  CreateReliefSupplyData,
  CreateDistributionData,
} from '@/types/resources';
export const shelterInput: CreateShelterData = {
  name: 'Central College',
  facilityType: 'school',
  address: 'Main Road',
  district: 'Ratnapura',
  latitude: 6.68,
  longitude: 80.4,
  capacity: 100,
  facilities: ['Water Supply'],
  managerName: 'Manager',
  managerContact: '0771234567',
  organisationType: 'government',
  organisationName: 'District Council',
};
export const teamInput: CreateRescueTeamData = {
  name: 'Swift Rescue',
  organisationName: 'Sri Lanka Navy',
  organisationType: 'armed_forces',
  memberCount: 12,
  specialisation: 'Water Rescue',
  district: 'Ratnapura',
};
export const supplyInput: CreateReliefSupplyData = {
  itemName: 'Drinking water',
  type: 'water',
  totalQuantity: 100,
  unit: 'bottles',
  organisationType: 'ngo',
  organisationName: 'Red Cross',
  district: 'Ratnapura',
};
export const distributionInput: CreateDistributionData = {
  supplyId: 'stock',
  supplyName: 'Drinking water',
  unit: 'bottles',
  quantity: 60,
  destinationDistrict: 'Ratnapura',
  destinationLocation: 'Central College',
  details: 'Flood response',
};
export function resourceRecords() {
  return {
    'users/officer': { role: 'district_officer', district: 'Ratnapura' },
    'hazardEvents/event': { status: 'active', affectedDistricts: ['Ratnapura', 'Kalutara'] },
    'shelters/shelter': {
      ...shelterInput,
      status: 'registered',
      currentOccupancy: 0,
      occupancyHistory: [],
    },
    'rescueTeams/team': { ...teamInput, status: 'available' },
    'reliefSupplies/stock': { ...supplyInput, remainingQuantity: 100, hazardEventId: 'event' },
  };
}
