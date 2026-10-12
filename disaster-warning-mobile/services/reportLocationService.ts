import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { SRI_LANKAN_DISTRICTS } from '@/constants/districts';
import type { GeoLocation } from '@/types/groundReport';

/** Ask for a new fix on every invocation; Expo's web adapter otherwise permits cached fixes. */
export async function getFreshCurrentLocation(): Promise<GeoLocation> {
  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation)
      throw new Error('Location is unavailable in this browser. Enter coordinates manually.');
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        position =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
          }),
        error =>
          reject(
            new Error(
              error.code === 1
                ? 'Allow location access, or enter coordinates manually.'
                : 'Could not get a fresh location. Try again or enter coordinates manually.'
            )
          ),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    });
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted')
    throw new Error('Allow location access, or enter coordinates manually.');
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error('Location request timed out. Try again or enter coordinates manually.')
            ),
          20000
        );
      }),
    ]);
    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
    };
  } finally {
    clearTimeout(timer);
  }
}

function formatLocationName(parts: (string | null | undefined)[]): string {
  return [
    ...new Set(parts.filter((part): part is string => !!part?.trim()).map(part => part.trim())),
  ].join(', ');
}

export function matchSriLankanDistrict(values: string[]): string | undefined {
  for (const value of values) {
    const normalized = value
      .toLowerCase()
      .replace(/district|division|municipal|council/g, '')
      .replace(/[^a-z]/g, '');
    const district = SRI_LANKAN_DISTRICTS.find(
      d => d.toLowerCase().replace(/[^a-z]/g, '') === normalized
    );
    if (district) return district;
  }
  return undefined;
}

export async function resolveReportLocation(
  location: GeoLocation,
  signal?: AbortSignal
): Promise<{ district?: string; name?: string }> {
  if (Platform.OS === 'web') {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${location.latitude}&lon=${location.longitude}&addressdetails=1&accept-language=en`,
      { signal, cache: 'no-store', headers: { Accept: 'application/json' } }
    );
    if (!response.ok) throw new Error('Location lookup unavailable');
    const data = await response.json();
    const address = data.address || {};
    return {
      district: matchSriLankanDistrict(
        [
          address.state_district,
          address.county,
          address.district,
          address.city,
          address.town,
        ].filter(Boolean)
      ),
      name:
        formatLocationName([
          data.name || address.amenity || address.building || address.tourism || address.shop,
          [
            address.house_number,
            address.road || address.pedestrian || address.footway || address.path,
          ]
            .filter(Boolean)
            .join(' '),
          address.neighbourhood || address.suburb,
          address.city || address.town || address.village,
        ]) || data.display_name?.split(',').slice(0, 3).join(', '),
    };
  }
  const places = await Location.reverseGeocodeAsync(location);
  const place = places[0];
  if (!place) return {};
  return {
    district: matchSriLankanDistrict(
      [place.subregion, place.district, place.city, place.region].filter((v): v is string => !!v)
    ),
    name: formatLocationName([
      place.name,
      [place.streetNumber, place.street].filter(Boolean).join(' '),
      place.city,
    ]),
  };
}
