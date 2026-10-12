import { filterCommunityWarnings, warningDistricts } from '@/utils/communityWarnings';
import { subscribeToActiveWarnings } from '@/services/warningService';
import { onSnapshot, where } from 'firebase/firestore';
import type { HazardWarning, WarningStatus } from '@/types/warning';

const warning: HazardWarning = {
  id: 'warning-1',
  warningId: 'warning-1',
  eventId: 'flood-1',
  hazardType: 'flood',
  severity: 'warning',
  targetMode: 'river_basin',
  targetAreas: ['Kalu River Basin'],
  resolvedDistricts: [],
  recipientCount: 10,
  headline: 'Flood warning',
  instructions: 'Move to higher ground.',
  channels: ['push'],
  status: 'delivered',
  issuedBy: 'dmc-1',
  createdAt: '2026-10-12T09:00:00Z',
};

it('shows issued warnings while excluding cancelled, failed and still-dispatching records', () => {
  const statuses: WarningStatus[] = [
    'active',
    'delivered',
    'partially_failed',
    'failed',
    'cancelled',
    'dispatching',
  ];
  const records = statuses.map(status => ({ ...warning, id: status, status }));
  expect(filterCommunityWarnings(records, 'all', 'all', '').map(w => w.id)).toEqual([
    'active',
    'delivered',
    'partially_failed',
  ]);
});
it('matches river basin warnings to their underlying districts even without stored resolution', () => {
  expect(warningDistricts(warning)).toEqual(['Ratnapura', 'Kalutara']);
  expect(filterCommunityWarnings([warning], 'Ratnapura', 'all', '')).toHaveLength(1);
  expect(filterCommunityWarnings([warning], 'Colombo', 'all', '')).toHaveLength(0);
});
it('uses direct and resolved districts, severity and search together', () => {
  const direct = {
    ...warning,
    targetMode: 'district' as const,
    targetAreas: ['Colombo'],
    resolvedDistricts: ['Colombo'],
    severity: 'evacuation' as const,
  };
  expect(warningDistricts(direct)).toEqual(['Colombo']);
  expect(filterCommunityWarnings([direct], 'Colombo', 'evacuation', ' higher GROUND ')).toEqual([
    direct,
  ]);
  expect(filterCommunityWarnings([direct], 'Colombo', 'advisory', '')).toEqual([]);
  expect(filterCommunityWarnings([direct], 'Colombo', 'all', 'Kandy')).toEqual([]);
});
it('orders issued warnings newest first', () => {
  expect(
    filterCommunityWarnings(
      [warning, { ...warning, id: 'new', createdAt: '2026-10-12T10:00:00Z' }],
      'all',
      'all',
      ''
    ).map(w => w.id)
  ).toEqual(['new', 'warning-1']);
});
it('subscribes to published warning updates, forwards failures and supports unsubscribe', () => {
  const unsubscribe = jest.fn();
  (onSnapshot as jest.Mock).mockReturnValueOnce(unsubscribe);
  const receive = jest.fn();
  const fail = jest.fn();
  const stop = subscribeToActiveWarnings(receive, fail);
  expect(where).toHaveBeenCalledWith('status', 'in', ['active', 'delivered', 'partially_failed']);
  const calls = (onSnapshot as jest.Mock).mock.calls;
  const [, update, error] = calls[calls.length - 1];
  update({
    docs: [
      {
        id: 'warning-1',
        data: () => ({ ...warning, createdAt: { toDate: () => new Date(warning.createdAt) } }),
      },
    ],
  });
  expect(receive).toHaveBeenCalledWith([
    expect.objectContaining({ id: 'warning-1', headline: 'Flood warning' }),
  ]);
  error(new Error('offline'));
  expect(fail).toHaveBeenCalledWith(expect.any(Error));
  stop();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
