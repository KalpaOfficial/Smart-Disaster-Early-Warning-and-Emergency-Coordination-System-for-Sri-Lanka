import { validateReportForm } from '@/utils/reportForm';
import type { CreateGroundReportData } from '@/types/groundReport';
const valid: CreateGroundReportData = {
  observationType: 'rising_water',
  description: 'River water is rising.',
  photoUri: 'file://photo',
  photoUris: ['file://photo'],
  location: { latitude: 6.9, longitude: 79.9 },
  locationName: 'Bridge',
  district: 'Colombo',
  isManualLocation: false,
  captureTime: '2026-10-12T01:00:00Z',
};
it('accepts a complete report with confirmed GPS or manual location', () => {
  expect(validateReportForm(valid, true)).toEqual({});
  expect(validateReportForm({ ...valid, isManualLocation: true }, true)).toEqual({});
});
it.each(['rising_water', 'blocked_road', 'landslide_crack', 'other'] as const)(
  'accepts the configured %s observation',
  observationType => {
    expect(validateReportForm({ ...valid, observationType }, true)).toEqual({});
  }
);
it.each([
  [{ observationType: 'invalid' }, 'observationType'],
  [{ description: 'water' }, 'description'],
  [{ description: 'x'.repeat(1001) }, 'description'],
  [{ photoUri: '' }, 'photo'],
  [{ photoUris: [] }, 'photo'],
  [{ photoUris: Array(6).fill('photo') }, 'photo'],
  [{ locationName: ' ' }, 'locationName'],
  [{ district: 'invalid' }, 'district'],
  [{ location: { latitude: NaN, longitude: 80 } }, 'location'],
  [{ location: { latitude: 91, longitude: 80 } }, 'location'],
  [{ location: { latitude: 7, longitude: 181 } }, 'location'],
])('rejects invalid report fields %j', (changes, key) => {
  expect(
    validateReportForm({ ...valid, ...changes } as CreateGroundReportData, true)[key as string]
  ).toBeDefined();
});
it('requires explicit location confirmation', () => {
  expect(validateReportForm(valid, false).location).toBeDefined();
});
