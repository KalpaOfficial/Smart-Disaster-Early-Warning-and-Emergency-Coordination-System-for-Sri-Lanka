import { submitGroundReport } from '@/services/groundReportService';
import { queueOfflineReport } from '@/services/offlineQueueService';
import { getReportPermissions } from '@/constants/reportPermissions';
import { validateReportForm } from '@/utils/reportForm';
import type { CreateGroundReportData } from '@/types/groundReport';
import type { UserRole } from '@/types/auth';

it.each([undefined, null, 'unknown'])(
  'denies submission and review capabilities for an unrecognized role: %s',
  role => {
    expect(getReportPermissions(role as UserRole | null | undefined)).toEqual({
      canSubmit: false,
      canVerify: false,
      canSeeQueue: false,
      canSeeOwnReports: false,
      canViewVerifiedReports: true,
    });
  }
);

describe('Single-page hazard report', () => {
  const validForm: CreateGroundReportData = {
    observationType: 'rising_water',
    description: 'Water is covering the road near the bridge.',
    photoUri: 'file:///photo.jpg',
    location: { latitude: 6.9271, longitude: 79.8612 },
    locationName: 'Kelani bridge',
    district: 'Colombo',
    isManualLocation: false,
    captureTime: '2026-10-11T08:00:00Z',
  };
  describe('Complete form validation', () => {
    it('reports every missing field in one submission attempt', () => {
      expect(Object.keys(validateReportForm({}, false))).toEqual([
        'observationType',
        'description',
        'photo',
        'locationName',
        'district',
        'location',
      ]);
    });
    it('accepts a complete report with a confirmed location', () => {
      expect(validateReportForm(validForm, true)).toEqual({});
    });
    it('requires an explicit location rather than accepting the initial Colombo coordinates', () => {
      expect(validateReportForm(validForm, false).location).toBeDefined();
    });
    it('rejects invalid coordinates and districts', () => {
      expect(
        validateReportForm(
          { ...validForm, district: 'Unknown', location: { latitude: NaN, longitude: 181 } },
          true
        )
      ).toMatchObject({ district: expect.any(String), location: expect.any(String) });
    });
    it('rejects a description outside the allowed length', () => {
      expect(
        validateReportForm({ ...validForm, description: '  water  ' }, true).description
      ).toBeDefined();
      expect(
        validateReportForm({ ...validForm, description: 'x'.repeat(1001) }, true).description
      ).toBeDefined();
    });
    it('requires a hazard category and attached photo', () => {
      const result = validateReportForm(
        { ...validForm, observationType: undefined, photoUri: '' },
        true
      );
      expect(result).toMatchObject({
        observationType: expect.any(String),
        photo: expect.any(String),
      });
    });
  });

  describe('Submission Strategy (Online vs Offline)', () => {
    const validData: CreateGroundReportData = {
      observationType: 'landslide_crack',
      description: 'Dangerous embankment crack detected near railway line.',
      photoUri: 'file:///cache/crack.jpg',
      location: { latitude: 6.9, longitude: 80.5 },
      locationName: 'Kotagala Track Km 112',
      district: 'Nuwara Eliya',
      isManualLocation: false,
      captureTime: '2026-10-09T08:00:00.000Z',
    };

    const citizenUser = {
      id: 'cit-99',
      fullName: 'Sunil Silva',
      role: 'citizen' as const,
    };

    it('submits directly to Firestore when device is online', async () => {
      const res = await submitGroundReport(
        validData,
        'https://storage.firebase/uploaded.jpg',
        'path.jpg',
        citizenUser
      );
      expect(res.id).toBeDefined();
      expect(res.referenceNumber).toMatch(/^GR-\d{8}-\d{4}$/);
    });

    it('routes submission into offline queue when device is offline', async () => {
      const queuedItem = await queueOfflineReport(validData, citizenUser);
      expect(queuedItem.queueId).toBeDefined();
      expect(queuedItem.submitterId).toBe(citizenUser.id);
      expect(queuedItem.reportData.observationType).toBe('landslide_crack');
    });

    it('verifies submit screen blocks officer roles before showing the form', () => {
      expect(getReportPermissions('dmc_officer').canSubmit).toBe(false);
      expect(getReportPermissions('district_officer').canSubmit).toBe(false);
      expect(getReportPermissions('citizen').canSubmit).toBe(true);
      expect(getReportPermissions('volunteer').canSubmit).toBe(true);
    });
  });
});
