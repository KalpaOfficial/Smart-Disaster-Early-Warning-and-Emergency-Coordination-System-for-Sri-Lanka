import {
  submitGroundReport,
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
  submitAdditionalInfo,
  linkReportToHazardEvent,
} from '@/services/groundReportService';
import { addDoc, updateDoc } from 'firebase/firestore';
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
  });
});
