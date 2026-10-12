import type { RescueTeam, TeamStatus } from '@/types/resources';

export interface RescueTeamFilters {
  search: string;
  district: string;
  organisation: string;
  status: TeamStatus | 'all';
}

export function registeredTeamFilters(team: Pick<RescueTeam, 'district'>): RescueTeamFilters {
  return { search: '', district: team.district, organisation: '', status: 'all' };
}

export function filterRescueTeams(teams: RescueTeam[], filters: RescueTeamFilters): RescueTeam[] {
  const search = filters.search.trim().toLowerCase();
  return teams.filter(
    team =>
      (!filters.district || team.district === filters.district) &&
      (!filters.organisation || team.organisationType === filters.organisation) &&
      (filters.status === 'all' || team.status === filters.status) &&
      (!search ||
        [
          team.name,
          team.specialisation,
          team.assignedLocation,
          team.organisationName,
          team.district,
        ]
          .join(' ')
          .toLowerCase()
          .includes(search))
  );
}
