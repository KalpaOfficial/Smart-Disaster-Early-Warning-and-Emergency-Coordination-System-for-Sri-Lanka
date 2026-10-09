import type { UserRole } from '@/types/auth';

/**
 * UC02 Ground Report Role Permissions Matrix.
 * 
 * Defines capabilities for each system actor according to UC02:
 * - citizen: Can submit reports, see own submitted reports. Cannot verify or view officer queue.
 * - volunteer: Can submit reports, see own submitted reports. Cannot verify or view officer queue.
 * - dmc_officer: Can verify/reject/request info, see verification queue. Cannot submit citizen reports or see personal report feed.
 * - district_officer: Coordinates logistics (shelters, SAR, relief). Cannot submit or verify ground reports.
 */
export interface ReportRolePermissions {
  canSubmit: boolean;
  canVerify: boolean;
  canSeeQueue: boolean;
  canSeeOwnReports: boolean;
  canViewVerifiedReports: boolean;
}

export const REPORT_ROLE_PERMISSIONS: Record<UserRole, ReportRolePermissions> = {
  citizen: {
    canSubmit: true,
    canVerify: false,
    canSeeQueue: false,
    canSeeOwnReports: true,
    canViewVerifiedReports: true,
  },
  volunteer: {
    canSubmit: true,
    canVerify: false,
    canSeeQueue: false,
    canSeeOwnReports: true,
    canViewVerifiedReports: true,
  },
  dmc_officer: {
    canSubmit: false,
    canVerify: true,
    canSeeQueue: true,
    canSeeOwnReports: false,
    canViewVerifiedReports: true,
  },
  district_officer: {
    canSubmit: false,
    canVerify: false,
    canSeeQueue: false,
    canSeeOwnReports: false,
    canViewVerifiedReports: true,
  },
};

/**
 * Returns typed ground report permissions for a given user role.
 */
export function getReportPermissions(role?: UserRole | null): ReportRolePermissions {
  if (!role || !REPORT_ROLE_PERMISSIONS[role]) {
    return {
      canSubmit: false,
      canVerify: false,
      canSeeQueue: false,
      canSeeOwnReports: false,
      canViewVerifiedReports: true,
    };
  }
  return REPORT_ROLE_PERMISSIONS[role];
}
