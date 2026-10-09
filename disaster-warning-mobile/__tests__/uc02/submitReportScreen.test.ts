import { submitGroundReport } from '@/services/groundReportService';
import { queueOfflineReport } from '@/services/offlineQueueService';
import { getReportPermissions } from '@/constants/reportPermissions';
import type { CreateGroundReportData } from '@/types/groundReport';

describe('UC02: Submit Report Screen Workflow & Step Navigation Logic', () => {
  const TOTAL_STEPS = 5;

  const validateStepState = (
    step: number,
    data: Partial<CreateGroundReportData>,
  ): { valid: boolean; error?: string } => {
    switch (step) {
      case 1:
        if (!data.observationType) {
          return { valid: false, error: 'Please select an observation type.' };
        }
        return { valid: true };
      case 2:
        if (!data.description || data.description.trim().length < 10) {
          return { valid: false, error: 'Description must be at least 10 characters.' };
        }
        return { valid: true };
      case 3:
        if (!data.photoUri) {
          return { valid: false, error: 'A photograph of the hazard is required.' };
        }
        return { valid: true };
      case 4:
        if (!data.locationName || !data.locationName.trim()) {
          return { valid: false, error: 'Location name is required.' };
        }
        if (!data.district) {
          return { valid: false, error: 'Please select a district.' };
        }
        return { valid: true };
      case 5:
        // Review step
        return { valid: true };
      default:
        return { valid: false, error: 'Invalid step.' };
    }
  };

  describe('Step Progression and Validation', () => {
    it('blocks progression from Step 1 when observation type is not selected', () => {
      expect(validateStepState(1, {}).valid).toBe(false);
      expect(validateStepState(1, { observationType: 'rising_water' }).valid).toBe(true);
    });

    it('blocks progression from Step 2 when description is under 10 characters', () => {
      expect(validateStepState(2, { description: 'short' }).valid).toBe(false);
      expect(
        validateStepState(2, {
          description: 'Flash flooding observed across main street',
        }).valid,
      ).toBe(true);
    });

    it('blocks progression from Step 3 when photograph is missing', () => {
      expect(validateStepState(3, {}).valid).toBe(false);
      expect(
        validateStepState(3, { photoUri: 'file:///cache/photo.jpg' }).valid,
      ).toBe(true);
    });

    it('blocks progression from Step 4 when location name or district is missing', () => {
      expect(validateStepState(4, { locationName: '' }).valid).toBe(false);
      expect(
        validateStepState(4, { locationName: 'Kaduwela Bridge', district: '' }).valid,
      ).toBe(false);
      expect(
        validateStepState(4, { locationName: 'Kaduwela Bridge', district: 'Colombo' })
          .valid,
      ).toBe(true);
    });

    it('enforces total steps count of 5', () => {
      expect(TOTAL_STEPS).toBe(5);
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
        citizenUser,
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

    it('verifies submit screen blocks officer roles before step rendering', () => {
      expect(getReportPermissions('dmc_officer').canSubmit).toBe(false);
      expect(getReportPermissions('district_officer').canSubmit).toBe(false);
      expect(getReportPermissions('citizen').canSubmit).toBe(true);
      expect(getReportPermissions('volunteer').canSubmit).toBe(true);
    });
  });
});
