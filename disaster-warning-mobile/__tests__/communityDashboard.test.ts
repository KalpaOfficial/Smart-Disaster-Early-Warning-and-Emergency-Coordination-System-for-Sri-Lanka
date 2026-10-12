import { getCommunityWarnings, getAvailableCommunityShelters } from '@/utils/communityDashboard';
import { getMobileNavItems, isMobileNavActive, isCommunityRole } from '@/constants/navigation';
import { getActiveWarnings } from '@/services/warningService';
import { getDocs } from 'firebase/firestore';
import type { HazardWarning } from '@/types/warning';
import type { HazardEvent, Shelter } from '@/types/resources';

const event: HazardEvent = {
  id: 'flood',
  title: 'Flood',
  hazardType: 'flood',
  status: 'active',
  affectedDistricts: ['Kalutara', 'Ratnapura'],
  startDate: '2026-10-01',
  description: '',
};
const warning = (id: string, changes: Partial<HazardWarning> = {}): HazardWarning => ({
  id,
  warningId: id,
  eventId: 'flood',
  hazardType: 'flood',
  severity: 'warning',
  targetMode: 'district',
  targetAreas: ['Kalutara'],
  resolvedDistricts: ['Kalutara'],
  recipientCount: 1,
  headline: id,
  instructions: 'Instructions',
  channels: ['push'],
  status: 'delivered',
  issuedBy: 'officer',
  createdAt: '2026-10-11T10:00:00Z',
  ...changes,
});

it('prioritizes an evacuation warning over newer advisories without mutating the source', () => {
  const data = [
    warning('new-advisory', { severity: 'advisory' }),
    warning('old-evacuation', { severity: 'evacuation', createdAt: '2026-10-10T10:00:00Z' }),
  ];
  expect(getCommunityWarnings(data, [event], 'Kalutara').map(w => w.id)).toEqual([
    'old-evacuation',
    'new-advisory',
  ]);
  expect(data[0].id).toBe('new-advisory');
});

it('excludes other districts, closed events and failed or cancelled warnings', () => {
  const data = [
    warning('local'),
    warning('other-area', { targetAreas: ['Colombo'], resolvedDistricts: ['Colombo'] }),
    warning('closed-event', { eventId: 'closed' }),
    warning('failed', { status: 'failed' }),
    warning('cancelled', { status: 'cancelled' }),
  ];
  expect(
    getCommunityWarnings(
      data,
      [event, { ...event, id: 'closed', status: 'closed' }],
      'Kalutara'
    ).map(w => w.id)
  ).toEqual(['local']);
});

it('resolves river-basin targeting and uses nationwide warnings when the user has no district', () => {
  const basin = warning('kalu', {
    targetMode: 'river_basin',
    targetAreas: ['Kalu River Basin'],
    resolvedDistricts: [],
  });
  expect(getCommunityWarnings([basin], [event], 'Ratnapura')).toHaveLength(1);
  expect(getCommunityWarnings([basin], [event], 'Colombo')).toHaveLength(0);
  expect(getCommunityWarnings([basin], [event])).toHaveLength(1);
});

it('counts only open shelters with capacity in the selected district', () => {
  const makeShelter = (
    id: string,
    status: Shelter['status'],
    occupancy: number,
    district = 'Kalutara'
  ) => ({ id, status, currentOccupancy: occupancy, capacity: 100, district }) as Shelter;
  const shelters = [
    makeShelter('open', 'active', 50),
    makeShelter('full', 'active', 100),
    makeShelter('over', 'over_capacity', 120),
    makeShelter('registered', 'registered', 0),
    makeShelter('closed', 'inactive', 0),
    makeShelter('other-district', 'active', 20, 'Colombo'),
  ];
  expect(getAvailableCommunityShelters(shelters, 'Kalutara').map(s => s.id)).toEqual(['open']);
});

it.each(['citizen', 'volunteer'] as const)('provides relevant public navigation for %s', role => {
  expect(isCommunityRole(role)).toBe(true);
  expect(getMobileNavItems(role).map(item => item.label)).toEqual([
    'Home',
    'Warnings',
    'Reports',
    'Shelters',
  ]);
  expect(getMobileNavItems(role).some(item => /seed|rescue|supplies/.test(item.route))).toBe(false);
});

it('preserves operations navigation for staff', () => {
  expect(isCommunityRole('dmc_officer')).toBe(false);
  expect(getMobileNavItems('district_officer').map(item => item.label)).toContain('Rescue');
});

it('highlights tabs for Expo paths with or without route groups and avoids partial matches', () => {
  expect(isMobileNavActive('/reports/abc', '/(app)/reports')).toBe(true);
  expect(isMobileNavActive('/(app)/warnings/flood', '/(app)/warnings')).toBe(true);
  expect(isMobileNavActive('/', '/(app)')).toBe(true);
  expect(isMobileNavActive('/resources/shelters', '/(app)')).toBe(false);
  expect(isMobileNavActive('/reports-extra', '/(app)/reports')).toBe(false);
});

it('propagates warning read failures for the home error state', async () => {
  const failure = new Error('offline');
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    (getDocs as jest.Mock).mockRejectedValueOnce(failure);
    await expect(getActiveWarnings({ throwOnError: true })).rejects.toBe(failure);
    (getDocs as jest.Mock).mockRejectedValueOnce(failure);
    await expect(getActiveWarnings()).resolves.toEqual([]);
  } finally {
    warn.mockRestore();
  }
});
