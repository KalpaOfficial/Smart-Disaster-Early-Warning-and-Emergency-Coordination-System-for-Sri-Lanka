import { Platform } from 'react-native';
import * as Location from 'expo-location';
import {
  getFreshCurrentLocation,
  matchSriLankanDistrict,
  resolveReportLocation,
} from '@/services/reportLocationService';
jest.mock('react-native', () => ({ Platform: { OS: 'web' } }));
jest.mock('expo-location', () => ({
  reverseGeocodeAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { High: 4 },
}));
const originalFetch = globalThis.fetch;
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
  else Reflect.deleteProperty(globalThis, 'navigator');
  jest.useRealTimers();
  jest.resetAllMocks();
  (Platform as { OS: string }).OS = 'web';
});
it('requests fresh browser fixes on every invocation without using cached coordinates', async () => {
  const getCurrentPosition = jest
    .fn()
    .mockImplementationOnce(success =>
      success({ coords: { latitude: 6.68, longitude: 80.4, accuracy: 12, altitude: null } })
    )
    .mockImplementationOnce(success =>
      success({ coords: { latitude: 6.91497, longitude: 79.97361, accuracy: 8, altitude: 10 } })
    );
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { geolocation: { getCurrentPosition } },
  });
  expect(await getFreshCurrentLocation()).toMatchObject({ latitude: 6.68, longitude: 80.4 });
  expect(await getFreshCurrentLocation()).toEqual({
    latitude: 6.91497,
    longitude: 79.97361,
    accuracy: 8,
    altitude: 10,
  });
  expect(getCurrentPosition).toHaveBeenCalledTimes(2);
  expect(getCurrentPosition.mock.calls[1][2]).toEqual({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
});
it('provides actionable feedback when browser location access is denied', async () => {
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      geolocation: {
        getCurrentPosition: (_success: unknown, failure: (error: { code: number }) => void) =>
          failure({ code: 1 }),
      },
    },
  });
  await expect(getFreshCurrentLocation()).rejects.toThrow('Allow location access');
});
it('falls back to manual coordinates when browser geolocation is unavailable', async () => {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: {} });
  await expect(getFreshCurrentLocation()).rejects.toThrow('Enter coordinates manually');
});
it('requests a high accuracy native fix and rejects denied permission before accessing GPS', async () => {
  (Platform as { OS: string }).OS = 'android';
  (Location.requestForegroundPermissionsAsync as jest.Mock)
    .mockResolvedValueOnce({ status: 'denied' })
    .mockResolvedValueOnce({ status: 'granted' });
  await expect(getFreshCurrentLocation()).rejects.toThrow('Allow location access');
  expect(Location.getCurrentPositionAsync).not.toHaveBeenCalled();
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({
    coords: { latitude: 7.29, longitude: 80.63, accuracy: 5, altitude: null },
  });
  expect(await getFreshCurrentLocation()).toMatchObject({ latitude: 7.29, longitude: 80.63 });
  expect(Location.getCurrentPositionAsync).toHaveBeenCalledWith({
    accuracy: Location.Accuracy.High,
  });
});
it('ends a native location request that never produces a fix', async () => {
  jest.useFakeTimers();
  (Platform as { OS: string }).OS = 'ios';
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({
    status: 'granted',
  });
  (Location.getCurrentPositionAsync as jest.Mock).mockReturnValue(new Promise(() => {}));
  const result = expect(getFreshCurrentLocation()).rejects.toThrow('timed out');
  await jest.advanceTimersByTimeAsync(20000);
  await result;
});
it('fetches uncached street and district details for each selected location', async () => {
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      name: 'SLIIT Entrance',
      address: {
        county: 'Colombo District',
        house_number: '12',
        road: 'New Kandy Road',
        suburb: 'Malabe',
        town: 'Malabe',
      },
    }),
  })) as unknown as typeof fetch;
  const controller = new AbortController();
  const location = { latitude: 6.91497, longitude: 79.97361 };
  expect(await resolveReportLocation(location, controller.signal)).toEqual({
    district: 'Colombo',
    name: 'SLIIT Entrance, 12 New Kandy Road, Malabe',
  });
  await resolveReportLocation(location, controller.signal);
  expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  expect(globalThis.fetch).toHaveBeenLastCalledWith(
    expect.stringContaining('lat=6.91497&lon=79.97361'),
    expect.objectContaining({ cache: 'no-store', signal: controller.signal })
  );
});
it('reports failed address lookup and allows empty native results', async () => {
  globalThis.fetch = jest.fn(async () => ({ ok: false })) as unknown as typeof fetch;
  await expect(resolveReportLocation({ latitude: 7, longitude: 80 })).rejects.toThrow(
    'lookup unavailable'
  );
  (Platform as { OS: string }).OS = 'ios';
  (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([]);
  expect(await resolveReportLocation({ latitude: 7, longitude: 80 })).toEqual({});
});
it('matches canonical district names from geocoder administrative areas', () => {
  expect(matchSriLankanDistrict(['Western Province', 'Colombo District'])).toBe('Colombo');
  expect(matchSriLankanDistrict(['Nuwara Eliya District'])).toBe('Nuwara Eliya');
  expect(matchSriLankanDistrict(['Unknown'])).toBeUndefined();
});
it('resolves district and landmark from web coordinates', async () => {
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({
      address: { county: 'Gampaha District', road: 'Main Road', town: 'Kelaniya' },
    }),
  })) as unknown as typeof fetch;
  expect(await resolveReportLocation({ latitude: 6.95, longitude: 79.9 })).toEqual({
    district: 'Gampaha',
    name: 'Main Road, Kelaniya',
  });
});
it('uses native reverse geocoding to detect district', async () => {
  (Platform as { OS: string }).OS = 'ios';
  (Location.reverseGeocodeAsync as jest.Mock).mockResolvedValue([
    { subregion: 'Kandy', name: 'Bridge', city: 'Kandy' },
  ]);
  expect((await resolveReportLocation({ latitude: 7.29, longitude: 80.63 })).district).toBe(
    'Kandy'
  );
});
it('leaves unknown districts for manual selection', async () => {
  globalThis.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ address: { county: 'Unknown Area' } }),
  })) as unknown as typeof fetch;
  expect((await resolveReportLocation({ latitude: 7, longitude: 80 })).district).toBeUndefined();
});
