import { auth } from '@/services/firebase';
import { getDoc, addDoc, updateDoc } from 'firebase/firestore';
import { requireDistrictOfficer } from '@/services/resourceAuthorization';
import { activateShelter, deactivateShelter, updateOccupancy } from '@/services/shelterService';
import { dispatchTeam, updateTeamStatus } from '@/services/rescueTeamService';
import { distributeSupply } from '@/services/reliefSupplyService';
import { filterShelters } from '@/utils/shelterDirectory';
import type { Shelter } from '@/types/resources';
import { installResourceFirestore } from '../helpers/resourceFirestore';
import { canCoordinateResources } from '@/constants/resourcePermissions';

it.each(['citizen', 'volunteer', 'dmc_officer', 'ngo', 'private_donor', undefined] as const)(
  'keeps resource management controls hidden for %s',
  role => {
    expect(canCoordinateResources(role as Parameters<typeof canCoordinateResources>[0])).toBe(
      false
    );
  }
);
it('allows District Officer management controls', () => {
  expect(canCoordinateResources('district_officer')).toBe(true);
});

beforeEach(() => {
  installResourceFirestore();
  Object.assign(auth, { currentUser: { uid: 'officer' } });
  (getDoc as jest.Mock).mockResolvedValue({
    exists: () => true,
    data: () => ({ role: 'district_officer' }),
  });
});

it.each(['citizen', 'volunteer', 'dmc_officer', 'ngo', 'private_donor'])(
  'blocks resource mutations for %s before any write',
  async role => {
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ role }) });
    const attempts = [
      () => activateShelter('s', 'event'),
      () => deactivateShelter('s'),
      () => updateOccupancy('s', 20, 100),
      () => dispatchTeam('t', 'Town', 'event'),
      () => updateTeamStatus('t', 'available'),
      () => distributeSupply({ supplyId: 's' } as never, 'officer', 'event'),
    ];
    for (const attempt of attempts)
      await expect(attempt()).rejects.toThrow('Only District Officers');
    expect(addDoc).not.toHaveBeenCalled();
    expect(updateDoc).not.toHaveBeenCalled();
  }
);

it('requires an authenticated, provisioned District Officer profile', async () => {
  Object.assign(auth, { currentUser: null });
  await expect(requireDistrictOfficer()).rejects.toThrow('Sign in');
  Object.assign(auth, { currentUser: { uid: 'officer' } });
  (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
  await expect(requireDistrictOfficer()).rejects.toThrow('Only District Officers');
  await expect(requireDistrictOfficer()).resolves.toBe('officer');
});

it('refuses to close a shelter with occupants', async () => {
  (getDoc as jest.Mock).mockResolvedValueOnce({
    exists: () => true,
    data: () => ({ role: 'district_officer' }),
  });
  (getDoc as jest.Mock).mockResolvedValueOnce({
    exists: () => true,
    data: () => ({ currentOccupancy: 12 }),
  });
  await expect(deactivateShelter('s')).rejects.toThrow('Reallocate');
  expect(updateDoc).not.toHaveBeenCalled();
});

it('refuses to dispatch an unavailable rescue team', async () => {
  (getDoc as jest.Mock).mockResolvedValueOnce({
    exists: () => true,
    data: () => ({ role: 'district_officer' }),
  });
  (getDoc as jest.Mock).mockResolvedValueOnce({
    exists: () => true,
    data: () => ({ status: 'unavailable' }),
  });
  await expect(dispatchTeam('team', 'Town', 'event')).rejects.toThrow('Only available');
  expect(updateDoc).not.toHaveBeenCalled();
});

it('filters the citizen directory by district, facilities, search and available space', () => {
  const base = {
    name: 'Central School',
    address: 'Main Road',
    district: 'Gampaha',
    facilities: ['Water'],
    organisationName: 'Council',
    capacity: 100,
    currentOccupancy: 50,
    status: 'active',
  };
  const shelters = [
    { ...base, id: 'open' },
    { ...base, id: 'full', currentOccupancy: 100 },
    { ...base, id: 'other', district: 'Colombo' },
    { ...base, id: 'registered', status: 'registered' },
  ] as Shelter[];
  expect(
    filterShelters(shelters, {
      district: 'Gampaha',
      search: 'main',
      availability: 'open',
      facility: 'Water',
      manager: false,
    }).map(s => s.id)
  ).toEqual(['open']);
  expect(
    filterShelters(shelters, {
      district: '',
      search: '',
      availability: 'all',
      facility: '',
      manager: false,
    }).map(s => s.id)
  ).toEqual(['open', 'full', 'other']);
});
