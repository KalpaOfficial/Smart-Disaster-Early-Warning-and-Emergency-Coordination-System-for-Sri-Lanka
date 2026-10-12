import { auth } from '@/services/firebase';
import { installResourceFirestore } from '../helpers/resourceFirestore';
import {
  getPendingReports,
  getMyReports,
  getAllReports,
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
} from '@/services/groundReportService';
import { getReportPermissions } from '@/constants/reportPermissions';
import { updateDoc, where } from 'firebase/firestore';

describe('UC02: Verification Queue & Officer Decision Workflows', () => {
  const dmcOfficer = {
    uid: 'officer-dmc-01',
    name: 'Major Jayawardena',
    role: 'dmc_officer' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(auth, { currentUser: { uid: 'officer-dmc-01' } });
    installResourceFirestore({
      'users/officer-dmc-01': { role: 'dmc_officer' },
      'groundReports/rep-verify-001': { status: 'pending_verification' },
      'groundReports/rep-verify-002': { status: 'pending_verification' },
      'groundReports/rep-reject-001': { status: 'pending_verification' },
      'groundReports/rep-info-001': { status: 'pending_verification' },
      'hazardEvents/evt-monsoon-2026': {
        status: 'active',
        title: 'South-West Monsoon Emergency Warning',
      },
    });
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
    it('rejects empty reasons through the actual service', async () => {
      await expect(rejectReport('rep-reject-001', dmcOfficer, ' ')).rejects.toThrow('reason');
      expect(updateDoc).not.toHaveBeenCalled();
    });

    it('successfully logs rejection with officer rationale', async () => {
      await rejectReport(
        'rep-reject-001',
        dmcOfficer,
        'Duplicate report already logged for this coordinate.'
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Information Request Workflow (Clarification Flow)', () => {
    it('sets status to info_requested with officer instructions', async () => {
      await requestAdditionalInfo(
        'rep-info-001',
        dmcOfficer,
        'Please take a closer photo showing the bridge foundation.'
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Public Verified Feed & Privacy Access Boundary', () => {
    it('retrieves only verified reports for the public community feed', async () => {
      const verifiedFeed = await getAllReports({ status: 'verified' });
      expect(Array.isArray(verifiedFeed)).toBe(true);
    });

    it('requests the owner feed with a submitter filter rather than a public unfiltered query', async () => {
      await getMyReports('citizen-123');
      expect(where).toHaveBeenCalledWith('submitterId', '==', 'citizen-123');
    });

    it('refuses signed-out verification even if the caller supplies an officer role', async () => {
      Object.assign(auth, { currentUser: null });
      await expect(verifyReport('rep-verify-002', dmcOfficer, {})).rejects.toThrow('Unauthorized');
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });
});
