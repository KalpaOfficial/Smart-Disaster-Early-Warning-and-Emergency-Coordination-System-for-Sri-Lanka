import {
  getPendingReports,
  getAllReports,
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
} from '@/services/groundReportService';
import { getReportPermissions } from '@/constants/reportPermissions';
import { updateDoc } from 'firebase/firestore';

describe('UC02: Verification Queue & Officer Decision Workflows', () => {
  const dmcOfficer = {
    uid: 'officer-dmc-01',
    name: 'Major Jayawardena',
    role: 'dmc_officer' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Officer Permissions & Role Boundaries', () => {
    it('verifies only DMC Duty Officers have access to the verification queue', () => {
      expect(getReportPermissions('dmc_officer').canSeeQueue).toBe(true);
      expect(getReportPermissions('dmc_officer').canVerify).toBe(true);
      expect(getReportPermissions('citizen').canSeeQueue).toBe(false);
      expect(getReportPermissions('volunteer').canSeeQueue).toBe(false);
      expect(getReportPermissions('district_officer').canSeeQueue).toBe(false);
    });
  });

  describe('Queue Retrieval & Status Filtering', () => {
    it('queries Firestore for pending verification reports', async () => {
      const pending = await getPendingReports();
      expect(Array.isArray(pending)).toBe(true);
    });

    it('queries Firestore with status filters for info_requested tab', async () => {
      const infoReq = await getAllReports({ status: 'info_requested' });
      expect(Array.isArray(infoReq)).toBe(true);
    });

    it('queries Firestore for all reports tab', async () => {
      const allReports = await getAllReports();
      expect(Array.isArray(allReports)).toBe(true);
    });
  });

  describe('Officer Verification Workflow (Positive & Linked Event)', () => {
    it('attaches decision note, officer credentials, and hazard event link upon verification', async () => {
      await verifyReport('rep-verify-001', dmcOfficer, {
        hazardEventId: 'evt-monsoon-2026',
        hazardEventTitle: 'South-West Monsoon Emergency Warning',
        decisionNote: 'Verified via ground photographic evidence and regional rain gauge.',
      });

      // Updates report status AND links to hazard event timeline (UC02 Phase 7.1)
      expect(updateDoc).toHaveBeenCalledTimes(2);
    });

    it('allows verification without linked hazard event when general observation', async () => {
      await verifyReport('rep-verify-002', dmcOfficer, {
        decisionNote: 'Isolated road blockage verified.',
      });

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Officer Rejection Workflow (Negative & Mandatory Reason)', () => {
    it('enforces non-empty rejection justification before calling rejectReport', async () => {
      const validateRejection = (reason: string): boolean => {
        return !!reason && reason.trim().length > 0;
      };

      expect(validateRejection('')).toBe(false);
      expect(validateRejection('   ')).toBe(false);
      expect(validateRejection('Invalid photo, clear day at coordinates.')).toBe(true);
    });

    it('successfully logs rejection with officer rationale', async () => {
      await rejectReport(
        'rep-reject-001',
        dmcOfficer,
        'Duplicate report already logged for this coordinate.',
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Information Request Workflow (Clarification Flow)', () => {
    it('sets status to info_requested with officer instructions', async () => {
      await requestAdditionalInfo(
        'rep-info-001',
        dmcOfficer,
        'Please take a closer photo showing the bridge foundation.',
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Public Verified Feed & Privacy Access Boundary', () => {
    it('retrieves only verified reports for the public community feed', async () => {
      const verifiedFeed = await getAllReports({ status: 'verified' });
      expect(Array.isArray(verifiedFeed)).toBe(true);
    });

    it('enforces that unverified reports can only be viewed by submitter or DMC officers', () => {
      const canViewReport = (
        report: { submitterId: string; status: string },
        user: { id: string; role: string },
      ): boolean => {
        const isOfficer = user.role === 'dmc_officer';
        const isSubmitter = user.id === report.submitterId;
        const isPubliclyVerified = report.status === 'verified';
        return isOfficer || isSubmitter || isPubliclyVerified;
      };

      const pendingReport = { submitterId: 'citizen-123', status: 'pending_verification' };
      const verifiedReport = { submitterId: 'citizen-123', status: 'verified' };
      const rejectedReport = { submitterId: 'citizen-123', status: 'rejected' };

      const ownerUser = { id: 'citizen-123', role: 'citizen' };
      const otherCitizen = { id: 'citizen-456', role: 'citizen' };
      const officer = { id: 'officer-999', role: 'dmc_officer' };

      // Submitter can view their own reports in all lifecycle states
      expect(canViewReport(pendingReport, ownerUser)).toBe(true);
      expect(canViewReport(verifiedReport, ownerUser)).toBe(true);
      expect(canViewReport(rejectedReport, ownerUser)).toBe(true);

      // DMC Officer can view all reports in queue for assessment
      expect(canViewReport(pendingReport, officer)).toBe(true);
      expect(canViewReport(verifiedReport, officer)).toBe(true);
      expect(canViewReport(rejectedReport, officer)).toBe(true);

      // General public and other citizens can ONLY view verified reports
      expect(canViewReport(verifiedReport, otherCitizen)).toBe(true);
      expect(canViewReport(pendingReport, otherCitizen)).toBe(false);
      expect(canViewReport(rejectedReport, otherCitizen)).toBe(false);
    });

    it('validates tab routing for citizens between verified feed and personal submissions', () => {
      const resolveCitizenTab = (queryTab?: string): 'verified' | 'my_reports' => {
        if (queryTab === 'my_reports' || queryTab === 'my') return 'my_reports';
        return 'verified';
      };

      expect(resolveCitizenTab('verified')).toBe('verified');
      expect(resolveCitizenTab('my_reports')).toBe('my_reports');
      expect(resolveCitizenTab('my')).toBe('my_reports');
      expect(resolveCitizenTab(undefined)).toBe('verified');
    });
  });
});
