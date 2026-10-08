import type { UserRole } from '@/types/auth';

/**
 * Role definitions with display labels and descriptions.
 * Maps to the actors defined in the case study.
 */
export interface RoleDefinition {
  value: UserRole;
  label: string;
  description: string;
  requiresDistrict: boolean;
  requiresOrganisation: boolean;
}

export const USER_ROLES: RoleDefinition[] = [
  {
    value: 'citizen',
    label: 'Citizen',
    description: 'Receive warnings and submit ground reports',
    requiresDistrict: false,
    requiresOrganisation: false,
  },
  {
    value: 'volunteer',
    label: 'Community Volunteer',
    description: 'Submit ground reports as a community disaster volunteer',
    requiresDistrict: false,
    requiresOrganisation: false,
  },
  {
    value: 'district_officer',
    label: 'District Officer',
    description: 'Coordinate shelters, rescue teams, and relief supplies',
    requiresDistrict: true,
    requiresOrganisation: true,
  },
  {
    value: 'dmc_officer',
    label: 'DMC Officer',
    description: 'Issue warnings, verify reports, and generate post-event reports',
    requiresDistrict: false,
    requiresOrganisation: true,
  },
];

/**
 * Get role definition by value.
 */
export function getRoleDefinition(role: UserRole): RoleDefinition | undefined {
  return USER_ROLES.find((r) => r.value === role);
}

/**
 * Get display label for a role.
 */
export function getRoleLabel(role: UserRole): string {
  return getRoleDefinition(role)?.label ?? role;
}
