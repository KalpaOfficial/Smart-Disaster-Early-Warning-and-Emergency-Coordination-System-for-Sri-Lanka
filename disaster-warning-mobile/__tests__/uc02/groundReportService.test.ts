import {
  submitGroundReport,
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
  submitAdditionalInfo,
  linkReportToHazardEvent,
  getReportById,
  getPendingReports,
  getMyReports,
  getAllReports,
  getReportsForHazardEvent,
  getVerifiedReportsForHazardEvent,
  getGroundReportStats,
} from '@/services/groundReportService';
import { addDoc, updateDoc, getDoc, getDocs } from 'firebase/firestore';
import type { CreateGroundReportData } from '@/types/groundReport';

describe('UC02: Ground Report Service CRUD & Officer Workflows', () => {
  const sampleReportData: CreateGroundReportData = {
    observationType: 'landslide_crack',
    description: 'Active 2-inch crack observed across the slope near Kithulgala road.',
    photoUri: 'https://storage.firebase/photo-sample.jpg',
    location: {
      latitude: 6.9934,
      longitude: 80.4124,
    },
    locationName: 'Avissawella - Hatton Main Road Km 42',
    district: 'Kegalle',
    isManualLocation: false,
    captureTime: '2026-10-09T08:00:00.000Z',
  };

  const citizenActor = {
    id: 'user-cit-441',
    fullName: 'Nimal Jayasuriya',
    role: 'citizen' as const,
  };

  const volunteerActor = {
    id: 'user-vol-109',
    fullName: 'Sunil Weerasinghe',
    role: 'volunteer' as const,
  };

  const dmcOfficerActor = {
    uid: 'officer-dmc-88',
    name: 'Lt. Col. Bandara',
    role: 'dmc_officer' as const,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Report Submission (UC02 Main Flow Steps 8-12)', () => {
    it('successfully submits a ground report for a citizen', async () => {
      const result = await submitGroundReport(
        sampleReportData,
        'https://storage.firebase/uploaded.jpg',
        'ground-reports/path.jpg',
        citizenActor,
      );

      expect(result).toBeDefined();
      expect(result.id).toBe('mock-doc-id-123');
      expect(result.referenceNumber).toMatch(/^GR-\d{8}-\d{4}$/);
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    it('successfully submits a ground report for a community volunteer', async () => {
      const result = await submitGroundReport(
        sampleReportData,
        'https://storage.firebase/uploaded.jpg',
        'ground-reports/path.jpg',
        volunteerActor,
      );

      expect(result).toBeDefined();
      expect(result.referenceNumber).toMatch(/^GR-\d{8}-\d{4}$/);
      expect(addDoc).toHaveBeenCalledTimes(1);
    });

    it('rejects submissions from DMC Officers (UC02 Phase 7.3)', async () => {
      await expect(
        submitGroundReport(
          sampleReportData,
          'https://storage.firebase/uploaded.jpg',
          'ground-reports/path.jpg',
          { id: 'officer-1', fullName: 'Officer Silva', role: 'dmc_officer' },
        ),
      ).rejects.toThrow(/Unauthorized/);
      expect(addDoc).not.toHaveBeenCalled();
    });

    it('rejects submissions from District Officers (UC02 Phase 7.3)', async () => {
      await expect(
        submitGroundReport(
          sampleReportData,
          'https://storage.firebase/uploaded.jpg',
          'ground-reports/path.jpg',
          { id: 'officer-2', fullName: 'District Agent', role: 'district_officer' },
        ),
      ).rejects.toThrow(/Unauthorized/);
      expect(addDoc).not.toHaveBeenCalled();
    });
  });

  describe('Officer Verification (UC02 Main Flow Steps 17, 18, 20)', () => {
    it('allows a DMC Duty Officer to verify a ground report and link a hazard event', async () => {
      await verifyReport('rep-123', dmcOfficerActor, {
        hazardEventId: 'event-kelani-flood',
        hazardEventTitle: 'Kelani River Flood Inundation',
        decisionNote: 'Verified via spatial cross-referencing and gauge telemetry.',
      });

      // Updates report document + appends to hazard event timeline (UC02 Phase 7.1)
      expect(updateDoc).toHaveBeenCalledTimes(2);
    });

    it('rejects verification attempt by unauthorized citizen or volunteer actor', async () => {
      await expect(
        verifyReport(
          'rep-123',
          { uid: citizenActor.id, name: citizenActor.fullName, role: 'citizen' },
          { decisionNote: 'Attempted unauthorized verification' },
        ),
      ).rejects.toThrow(/Unauthorized/);
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Officer Rejection (UC02 Main Flow Steps 17, 19, 20)', () => {
    it('allows a DMC Duty Officer to reject a report with official justification', async () => {
      await rejectReport(
        'rep-123',
        dmcOfficerActor,
        'Old photograph re-submitted; current water level at site is normal.',
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('rejects rejection attempt by unauthorized citizen', async () => {
      await expect(
        rejectReport(
          'rep-123',
          { uid: citizenActor.id, name: citizenActor.fullName, role: 'citizen' },
          'No authority',
        ),
      ).rejects.toThrow(/Unauthorized/);
      expect(updateDoc).not.toHaveBeenCalled();
    });
  });

  describe('Information Request & Submitter Clarification (UC02 Alternate Flow)', () => {
    it('allows a DMC Duty Officer to request clarification from submitter', async () => {
      await requestAdditionalInfo(
        'rep-123',
        dmcOfficerActor,
        'Please confirm if water is currently receding or continuing to rise.',
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('allows submitter to submit additional info and return report to pending verification queue', async () => {
      await submitAdditionalInfo(
        'rep-123',
        'Water level is still rising at approximately 2 inches per hour.',
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });
  });

  describe('Hazard Event Linking (UC02 Phase 7.1)', () => {
    it('updates report document with linked hazard event reference', async () => {
      await linkReportToHazardEvent(
        'rep-123',
        'event-flood-2026',
        'Severe Monsoon Flood - Western Province',
      );

      expect(updateDoc).toHaveBeenCalledTimes(1);
    });

    it('can unlink hazard event by passing null references', async () => {
      await linkReportToHazardEvent('rep-123', null, null);
      expect(updateDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        hazardEventId: null,
        hazardEventTitle: null,
      }));
    });
  });

  describe('Report Retrieval & Queries (UC02 Steps 13-14 & Dashboards)', () => {
    it('retrieves a single report by ID when it exists (Firestore Timestamp format)', async () => {
      const mockDoc = {
        exists: () => true,
        id: 'rep-99',
        data: () => ({
          referenceNumber: 'GR-20261009-9999',
          observationType: 'rising_water',
          description: 'Water over canal wall',
          photoUrl: 'https://storage/sample.jpg',
          photoPath: 'ground-reports/rep-99.jpg',
          location: { latitude: 6.9, longitude: 80.0, altitude: 12, accuracy: 5 },
          locationName: 'Kelaniya Temple Road',
          district: 'Gampaha',
          status: 'verified',
          submitterId: 'user-1',
          submitterName: 'Amal',
          submitterRole: 'citizen',
          captureTime: { toDate: () => new Date('2026-10-09T07:00:00Z') },
          createdAt: { toDate: () => new Date('2026-10-09T07:05:00Z') },
          verificationTimestamp: { toDate: () => new Date('2026-10-09T07:30:00Z') },
          hazardEventId: 'ev-1',
          hazardEventTitle: 'Kelani Flooding',
        }),
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockDoc);

      const report = await getReportById('rep-99');
      expect(report).not.toBeNull();
      expect(report?.id).toBe('rep-99');
      expect(report?.referenceNumber).toBe('GR-20261009-9999');
      expect(report?.observationType).toBe('rising_water');
      expect(report?.captureTime).toBe('2026-10-09T07:00:00.000Z');
      expect(report?.createdAt).toBe('2026-10-09T07:05:00.000Z');
      expect(report?.verificationTimestamp).toBe('2026-10-09T07:30:00.000Z');
    });

    it('retrieves a single report by ID with string timestamps and fallback default fields', async () => {
      const mockDoc = {
        exists: () => true,
        id: 'rep-fallback',
        data: () => ({
          captureTime: '2026-10-09T06:00:00.000Z',
          createdAt: '2026-10-09T06:01:00.000Z',
          verificationTimestamp: '2026-10-09T06:30:00.000Z',
          // Omitting referenceNumber, observationType, location, etc. to test fallbacks
        }),
      };
      (getDoc as jest.Mock).mockResolvedValueOnce(mockDoc);

      const report = await getReportById('rep-fallback');
      expect(report).not.toBeNull();
      expect(report?.referenceNumber).toBe('GR-REP-FALL');
      expect(report?.observationType).toBe('other');
      expect(report?.location.latitude).toBe(6.9271);
      expect(report?.location.longitude).toBe(79.8612);
      expect(report?.locationName).toBe('Unknown Location');
    });

    it('returns null if report does not exist in Firestore', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => false,
      });

      const report = await getReportById('non-existent-id');
      expect(report).toBeNull();
    });

    it('fetches pending verification reports sorted descending by creation date', async () => {
      const doc1 = {
        id: 'doc-older',
        data: () => ({
          status: 'pending_verification',
          createdAt: '2026-10-09T05:00:00.000Z',
        }),
      };
      const doc2 = {
        id: 'doc-newer',
        data: () => ({
          status: 'pending_verification',
          createdAt: '2026-10-09T06:00:00.000Z',
        }),
      };
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [doc1, doc2],
      });

      const pending = await getPendingReports();
      expect(pending).toHaveLength(2);
      expect(pending[0].id).toBe('doc-newer');
      expect(pending[1].id).toBe('doc-older');
    });

    it('fetches citizen own reports via getMyReports', async () => {
      const doc1 = {
        id: 'doc-my-1',
        data: () => ({
          submitterId: 'cit-441',
          createdAt: '2026-10-09T05:00:00.000Z',
        }),
      };
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [doc1],
      });

      const myReports = await getMyReports('cit-441');
      expect(myReports).toHaveLength(1);
      expect(myReports[0].id).toBe('doc-my-1');
    });

    it('fetches all reports with multi-criteria filters', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 'doc-filt',
            data: () => ({
              status: 'pending_verification',
              observationType: 'blocked_road',
              district: 'Ratnapura',
              hazardEventId: 'ev-ratnapura',
              createdAt: '2026-10-09T06:00:00.000Z',
            }),
          },
        ],
      });

      const reports = await getAllReports({
        status: 'pending_verification',
        observationType: 'blocked_road',
        district: 'Ratnapura',
        hazardEventId: 'ev-ratnapura',
      });

      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe('doc-filt');
    });

    it('fetches all reports ignoring "all" filter values', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [],
      });

      const reports = await getAllReports({
        status: 'all',
        observationType: 'all',
        district: 'all',
      });

      expect(reports).toEqual([]);
    });

    it('retrieves reports linked to a hazard event with specific or all statuses', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 'doc-event-1',
            data: () => ({
              hazardEventId: 'ev-100',
              status: 'verified',
              createdAt: '2026-10-09T06:00:00.000Z',
            }),
          },
        ],
      });

      const eventReports = await getReportsForHazardEvent('ev-100', 'all');
      expect(eventReports).toHaveLength(1);
    });

    it('retrieves verified reports for a hazard event', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          {
            id: 'doc-event-ver',
            data: () => ({
              hazardEventId: 'ev-100',
              status: 'verified',
              createdAt: '2026-10-09T06:00:00.000Z',
            }),
          },
        ],
      });

      const verReports = await getVerifiedReportsForHazardEvent('ev-100');
      expect(verReports).toHaveLength(1);
      expect(verReports[0].id).toBe('doc-event-ver');
    });

    it('calculates ground report statistics aggregation', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        docs: [
          { data: () => ({ status: 'pending_verification' }) },
          { data: () => ({ status: 'pending_verification' }) },
          { data: () => ({ status: 'verified' }) },
          { data: () => ({ status: 'rejected' }) },
          { data: () => ({ status: 'info_requested' }) },
        ],
      });

      const stats = await getGroundReportStats();
      expect(stats.total).toBe(5);
      expect(stats.pending).toBe(2);
      expect(stats.verified).toBe(1);
      expect(stats.rejected).toBe(1);
      expect(stats.infoRequested).toBe(1);
      expect(stats.offlineQueued).toBe(0);
    });
  });
});
