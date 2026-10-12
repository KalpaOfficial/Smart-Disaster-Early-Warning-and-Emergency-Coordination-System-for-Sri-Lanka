import type { GroundReport } from '@/types/groundReport';

export function dmcReportSummary(reports: GroundReport[]) {
  return {
    pending: reports.filter(r => r.status === 'pending_verification').length,
    infoRequested: reports.filter(r => r.status === 'info_requested').length,
    verified: reports.filter(r => r.status === 'verified').length,
    rejected: reports.filter(r => r.status === 'rejected').length,
    pendingReports: reports
      .filter(r => r.status === 'pending_verification')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      .slice(0, 3),
  };
}
