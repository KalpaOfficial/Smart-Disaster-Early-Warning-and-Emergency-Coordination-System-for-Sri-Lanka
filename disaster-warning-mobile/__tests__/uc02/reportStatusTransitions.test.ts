import { auth } from '@/services/firebase';
import {
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
  submitAdditionalInfo,
} from '@/services/groundReportService';
import { installResourceFirestore } from '../helpers/resourceFirestore';
import type { ReportStatus } from '@/types/groundReport';
const officer = { uid: 'dmc', name: 'Duty officer', role: 'dmc_officer' as const };
const transitions: [ReportStatus, ReportStatus, boolean][] = [
  ['pending_verification', 'verified', true],
  ['pending_verification', 'rejected', true],
  ['pending_verification', 'info_requested', true],
  ['info_requested', 'pending_verification', true],
  ['info_requested', 'verified', true],
  ['info_requested', 'rejected', true],
  ['verified', 'pending_verification', false],
  ['verified', 'rejected', false],
  ['rejected', 'verified', false],
  ['rejected', 'pending_verification', false],
];
it.each(transitions)(
  'actual service transition %s ? %s is allowed=%s',
  async (current, next, allowed) => {
    Object.assign(auth, {
      currentUser: { uid: next === 'pending_verification' ? 'citizen' : 'dmc' },
    });
    const store = installResourceFirestore({
      'users/dmc': { role: 'dmc_officer' },
      'groundReports/report': { status: current, submitterId: 'citizen' },
    });
    const operation =
      next === 'verified'
        ? verifyReport('report', officer, {})
        : next === 'rejected'
          ? rejectReport('report', officer, 'Invalid evidence')
          : next === 'info_requested'
            ? requestAdditionalInfo('report', officer, 'Please clarify')
            : submitAdditionalInfo('report', 'Confirmed water depth');
    if (allowed) {
      await operation;
      expect(store.records.get('groundReports/report')?.status).toBe(next);
    } else {
      await expect(operation).rejects.toThrow();
      expect(store.records.get('groundReports/report')?.status).toBe(current);
    }
  }
);
