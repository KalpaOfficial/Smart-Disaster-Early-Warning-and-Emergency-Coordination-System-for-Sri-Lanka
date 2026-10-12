import { filterRescueTeams, registeredTeamFilters } from '@/utils/rescueTeamDirectory';
import { createTeam, getTeams } from '@/services/rescueTeamService';
import { auth } from '@/services/firebase';
import { getDocs } from 'firebase/firestore';
import { installResourceFirestore } from '../helpers/resourceFirestore';
import { resourceRecords, teamInput } from '../helpers/resourceFixtures';
import type { RescueTeam } from '@/types/resources';

const teams = [
  { ...teamInput, id: 'ratnapura', district: 'Ratnapura', status: 'dispatched' },
  {
    ...teamInput,
    id: 'colombo',
    district: 'Colombo',
    status: 'available',
    name: 'Special Forces 8 Man Team',
  },
] as RescueTeam[];
const oldFilters = {
  search: 'Red Cross',
  district: 'Ratnapura',
  organisation: 'ngo',
  status: 'en_route' as const,
};

it('shows a newly registered Colombo team to a Ratnapura officer after resetting incompatible filters', async () => {
  Object.assign(auth, { currentUser: { uid: 'officer' } });
  const store = installResourceFirestore(resourceRecords());
  const id = await createTeam(
    { ...teamInput, name: 'Special Forces 8 Man Team', district: 'Colombo' },
    'officer'
  );
  (getDocs as jest.Mock).mockResolvedValueOnce({
    docs: [...store.records.entries()]
      .filter(([path]) => path.startsWith('rescueTeams/'))
      .map(([path, data]) => ({ id: path.split('/').pop(), data: () => data })),
  });
  const persistedTeams = await getTeams();
  const registered = persistedTeams.find(team => team.id === id)!;
  expect(registered.district).toBe('Colombo');
  expect(filterRescueTeams(persistedTeams, oldFilters)).toEqual([]);
  expect(
    filterRescueTeams(persistedTeams, registeredTeamFilters(registered)).map(team => team.id)
  ).toContain(id);
});

it('lets the district filter select another district or all districts', () => {
  const filters = registeredTeamFilters(teams[1]);
  expect(filterRescueTeams(teams, filters).map(team => team.id)).toEqual(['colombo']);
  expect(filterRescueTeams(teams, { ...filters, district: '' }).map(team => team.id)).toEqual([
    'ratnapura',
    'colombo',
  ]);
});

it('combines search, organisation and status filters without losing complete team data', () => {
  expect(
    filterRescueTeams(teams, {
      district: 'Colombo',
      search: '  SPECIAL FORCES  ',
      organisation: 'armed_forces',
      status: 'available',
    }).map(team => team.id)
  ).toEqual(['colombo']);
  expect(
    filterRescueTeams(teams, { ...registeredTeamFilters(teams[1]), status: 'on_site' })
  ).toEqual([]);
});
