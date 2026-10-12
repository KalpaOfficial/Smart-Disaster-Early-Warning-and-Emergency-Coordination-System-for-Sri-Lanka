import type { UserRole } from '@/types/auth';
export function canCoordinateResources(role?: UserRole): boolean {
  return role === 'district_officer';
}
