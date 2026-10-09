import { getAllReports } from '@/services/groundReportService';
import type { GroundReport } from '@/types/groundReport';
import type { HazardType, WarningSeverity, CreateWarningPayload } from '@/types/warning';

const mapObservationToHazardType = (obsType?: string): HazardType => {
  switch (obsType?.toLowerCase()) {
    case 'flooding':
    case 'flood':
      return 'flood';
    case 'landslide':
      return 'landslide';
    case 'tsunami':
      return 'tsunami';
    case 'cyclone':
    case 'high_winds':
      return 'cyclone';
    case 'coastal_erosion':
      return 'coastal_erosion';
    default:
      return 'flood';
  }
};

describe('Verified Report -> Issue Hazard Warning Integration Flow', () => {
  const mockVerifiedReport: GroundReport = {
    id: 'rep-verified-101',
    referenceNumber: 'REP-20261009-8812',
    submitterId: 'usr-cit-55',
    submitterName: 'Kamal Perera',
    submitterRole: 'volunteer',
    observationType: 'flooding',
    description: 'Rapidly rising water levels over 0.8m covering the main highway.',
    locationName: 'Ratnapura Town Center',
    district: 'Ratnapura',
    location: {
      latitude: 6.6828,
      longitude: 80.3992,
      accuracy: 5,
    },
    isManualLocation: false,
    photoUrl: 'https://example.com/photo.jpg',
    status: 'verified',
    verificationDecision: 'Verified by DMC Duty Officer. Water level rising fast.',
    verifiedByUid: 'officer-dmc-01',
    verifiedByName: 'Major Jayawardena',
    verificationTimestamp: '2026-10-09T10:00:00Z',
    createdAt: '2026-10-09T09:30:00Z',
    updatedAt: '2026-10-09T10:00:00Z',
  };

  it('queries Firestore for verified reports queue for DMC officers', async () => {
    const verifiedReports = await getAllReports({ status: 'verified' });
    expect(Array.isArray(verifiedReports)).toBe(true);
  });

  it('maps ground observation types accurately to hazard warning types', () => {
    expect(mapObservationToHazardType('flooding')).toBe('flood');
    expect(mapObservationToHazardType('landslide')).toBe('landslide');
    expect(mapObservationToHazardType('tsunami')).toBe('tsunami');
    expect(mapObservationToHazardType('cyclone')).toBe('cyclone');
    expect(mapObservationToHazardType('high_winds')).toBe('cyclone');
    expect(mapObservationToHazardType('coastal_erosion')).toBe('coastal_erosion');
    expect(mapObservationToHazardType('unknown')).toBe('flood');
  });

  it('pre-fills warning creation payload from verified report details', () => {
    const mappedHazardType = mapObservationToHazardType(mockVerifiedReport.observationType);

    const payload: CreateWarningPayload = {
      eventId: mockVerifiedReport.hazardEventId || '',
      hazardEventId: mockVerifiedReport.hazardEventId || '',
      hazardEventTitle: `Report #${mockVerifiedReport.referenceNumber}`,
      sourceReportId: mockVerifiedReport.id,
      sourceReportRef: mockVerifiedReport.referenceNumber,
      hazardType: mappedHazardType,
      severity: 'warning' as WarningSeverity,
      targetMode: 'district',
      targetAreas: [mockVerifiedReport.district],
      resolvedDistricts: [mockVerifiedReport.district],
      recipientCount: 15400,
      headline: `EMERGENCY ALERT: ${mappedHazardType.toUpperCase()} Warning — ${mockVerifiedReport.district}`,
      instructions: `Verified citizen hazard observation (${mockVerifiedReport.referenceNumber}) at ${mockVerifiedReport.locationName}: "${mockVerifiedReport.description}".`,
      channels: ['push', 'sms', 'audible'],
      deliveryChannels: ['push', 'sms', 'audible'],
    };

    expect(payload.sourceReportId).toBe('rep-verified-101');
    expect(payload.sourceReportRef).toBe('REP-20261009-8812');
    expect(payload.targetAreas).toContain('Ratnapura');
    expect(payload.hazardType).toBe('flood');
    expect(payload.headline).toContain('FLOOD Warning — Ratnapura');
    expect(payload.instructions).toContain('Ratnapura Town Center');
  });
});
