import {
  filterShelters,
  shelterAvailability,
  shelterCapacityNotice,
} from '@/utils/shelterDirectory';
import { shelterInput } from '../helpers/resourceFixtures';
import type { Shelter } from '@/types/resources';

const shelter: Shelter = {
  ...shelterInput,
  id: 'shelter',
  status: 'active',
  currentOccupancy: 50,
  hazardEventId: 'event',
  createdBy: 'officer',
  createdAt: '2026-10-12',
};
const filters = {
  district: '',
  search: '',
  availability: 'all' as const,
  facility: '',
  manager: false,
};
it.each([
  ['registered', 0, 'registered'],
  ['inactive', 0, 'closed'],
  ['active', 99, 'open'],
  ['active', 100, 'full'],
  ['over_capacity', 125, 'full'],
])('classifies %s with %s occupants as %s', (status, currentOccupancy, expected) => {
  expect(
    shelterAvailability({
      ...shelter,
      status: status as Shelter['status'],
      currentOccupancy: currentOccupancy as number,
    })
  ).toBe(expected);
});
it('hides standby shelters from public users and includes them for officers', () => {
  const shelters = [shelter, { ...shelter, id: 'standby', status: 'registered' as const }];
  expect(filterShelters(shelters, filters).map(item => item.id)).toEqual(['shelter']);
  expect(filterShelters(shelters, { ...filters, manager: true }).map(item => item.id)).toEqual([
    'shelter',
    'standby',
  ]);
});
it('combines district, facility, available-space and case-insensitive address search filters', () => {
  const shelters = [
    shelter,
    { ...shelter, id: 'closed', status: 'inactive' as const },
    { ...shelter, id: 'full', currentOccupancy: 100 },
    { ...shelter, id: 'elsewhere', district: 'Colombo' },
  ];
  expect(
    filterShelters(shelters, {
      ...filters,
      district: 'Ratnapura',
      facility: 'Water Supply',
      availability: 'open',
      search: '  MAIN ROAD  ',
    }).map(item => item.id)
  ).toEqual(['shelter']);
  expect(filterShelters(shelters, { ...filters, facility: 'Kitchen' })).toEqual([]);
});
it.each([
  [79, ''],
  [80, 'Nearly full'],
  [99, 'Nearly full'],
  [100, 'Full.'],
  [101, 'Over capacity'],
])('shows the correct capacity notice at %s percent', (currentOccupancy, notice) => {
  expect(
    shelterCapacityNotice({ ...shelter, currentOccupancy: currentOccupancy as number })
  ).toContain(notice);
});
it('does not present a standby or closed shelter as nearly full', () => {
  expect(shelterCapacityNotice({ ...shelter, status: 'registered', currentOccupancy: 90 })).toBe(
    ''
  );
  expect(shelterCapacityNotice({ ...shelter, status: 'inactive', currentOccupancy: 90 })).toBe('');
});
