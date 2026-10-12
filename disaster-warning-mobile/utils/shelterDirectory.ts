import type { Shelter } from '@/types/resources';
export type ShelterAvailability = 'all' | 'open' | 'full' | 'closed' | 'registered';
export function shelterCapacityNotice(
  shelter: Pick<Shelter, 'status' | 'currentOccupancy' | 'capacity'>
): string {
  if (!['active', 'over_capacity'].includes(shelter.status)) return '';
  if (shelter.currentOccupancy > shelter.capacity)
    return 'Over capacity. Reallocate occupants to another shelter.';
  if (shelter.currentOccupancy >= shelter.capacity)
    return 'Full. Choose another shelter for new arrivals.';
  if (shelter.currentOccupancy >= shelter.capacity * 0.8)
    return 'Nearly full. Limited space remaining.';
  return '';
}
export function shelterAvailability(shelter: Shelter): ShelterAvailability {
  if (shelter.status === 'registered') return 'registered';
  if (shelter.status === 'inactive') return 'closed';
  return shelter.currentOccupancy >= shelter.capacity || shelter.status === 'over_capacity'
    ? 'full'
    : 'open';
}
export function filterShelters(
  shelters: Shelter[],
  filters: {
    district: string;
    search: string;
    availability: ShelterAvailability;
    facility: string;
    manager: boolean;
  }
): Shelter[] {
  const search = filters.search.trim().toLowerCase();
  return shelters.filter(
    s =>
      (filters.manager || s.status !== 'registered') &&
      (!filters.district || s.district === filters.district) &&
      (!filters.facility || s.facilities.includes(filters.facility)) &&
      (filters.availability === 'all' || shelterAvailability(s) === filters.availability) &&
      (!search ||
        [s.name, s.address, s.organisationName, s.district]
          .join(' ')
          .toLowerCase()
          .includes(search))
  );
}
