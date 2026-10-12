import type { CreateGroundReportData } from '@/types/groundReport';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';

export function validateReportForm(
  data: Partial<CreateGroundReportData>,
  locationConfirmed: boolean
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (
    !['rising_water', 'blocked_road', 'landslide_crack', 'other'].includes(
      data.observationType || ''
    )
  )
    errors.observationType = 'Choose the type of hazard.';
  if (!data.description || data.description.trim().length < 10)
    errors.description = 'Describe what you see in at least 10 characters.';
  else if (data.description.length > 1000)
    errors.description = 'Keep the description within 1,000 characters.';
  if (!data.photoUri) errors.photo = 'Add a photo of the hazard.';
  if (
    data.photoUris &&
    (data.photoUris.length < 1 || data.photoUris.length > 5 || data.photoUris.some(uri => !uri))
  )
    errors.photo = 'Add between 1 and 5 photos.';
  if (!data.locationName?.trim()) errors.locationName = 'Enter a street, landmark or place name.';
  if (!SRI_LANKAN_DISTRICTS.some(district => district === data.district))
    errors.district = 'Select your district.';
  const loc = data.location;
  if (
    !locationConfirmed ||
    !loc ||
    !Number.isFinite(loc.latitude) ||
    !Number.isFinite(loc.longitude) ||
    loc.latitude < -90 ||
    loc.latitude > 90 ||
    loc.longitude < -180 ||
    loc.longitude > 180
  )
    errors.location = 'Use your current location or set the hazard coordinates.';
  return errors;
}
