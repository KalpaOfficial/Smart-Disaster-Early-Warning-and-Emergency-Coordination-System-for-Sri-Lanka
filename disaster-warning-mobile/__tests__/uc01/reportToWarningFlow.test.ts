import { auth } from '@/services/firebase';
import { getDocs, query, where } from 'firebase/firestore';
import {
  submitGroundReport,
  requestAdditionalInfo,
  submitAdditionalInfo,
  verifyReport,
} from '@/services/groundReportService';
import {
  getGroundReportsForEvent,
  executeWarningDispatchPipeline,
  getActiveWarnings,
} from '@/services/warningService';
import { getUnreadReportNotifications } from '@/services/reportNotificationService';
import { installResourceFirestore } from '../helpers/resourceFirestore';

it('runs citizen submission → clarification → verification → official warning with the actual services', async () => {
  const store = installResourceFirestore({
    'users/dmc': { role: 'dmc_officer', district: 'Colombo' },
    'users/citizen': { role: 'citizen', district: 'Colombo', fullName: 'Citizen' },
    'users/volunteer': { role: 'volunteer', district: 'Colombo', fullName: 'Volunteer' },
    'users/district': { role: 'district_officer', district: 'Colombo' },
    'hazardEvents/event': {
      status: 'active',
      hazardType: 'flood',
      title: 'Kelani flood',
      warningLevel: 'Level 1 Advisory',
      timeline: [],
    },
  });
  (where as jest.Mock).mockImplementation((field, operator, value) => ({ field, operator, value }));
  (query as jest.Mock).mockImplementation((source, ...filters) => ({
    ...source,
    filters: [...(source.filters || []), ...filters],
  }));
  (getDocs as jest.Mock).mockImplementation(async ({ path, filters = [] }) => ({
    docs: [...store.records.entries()]
      .filter(
        ([key]) => key.startsWith(path + '/') && key.slice(path.length + 1).indexOf('/') === -1
      )
      .filter(([, data]) =>
        filters.every(
          ({ field, operator, value }: { field: string; operator: string; value: unknown }) =>
            operator === 'in' ? (value as unknown[]).includes(data[field]) : data[field] === value
        )
      )
      .map(([key, data]) => ({ id: key.split('/').at(-1), data: () => data })),
  }));
  Object.assign(auth, { currentUser: { uid: 'citizen' } });
  const report = await submitGroundReport(
    {
      observationType: 'rising_water',
      description: 'Water is rising near the river bridge.',
      photoUri: 'file://photo',
      location: { latitude: 6.9, longitude: 79.9 },
      locationName: 'River bridge',
      district: 'Colombo',
      captureTime: '2026-10-12T01:00:00Z',
      isManualLocation: false,
    },
    'https://photos/evidence',
    null,
    { id: 'citizen', role: 'citizen', fullName: 'Citizen' }
  );
  expect(await getGroundReportsForEvent('event')).toEqual([]);
  const officer = { uid: 'dmc', name: 'Officer', role: 'dmc_officer' as const };
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  await requestAdditionalInfo(report.id, officer, 'Please confirm the depth.');
  expect((await getUnreadReportNotifications('citizen'))[0].status).toBe('info_requested');
  Object.assign(auth, { currentUser: { uid: 'citizen' } });
  await submitAdditionalInfo(report.id, 'The water is about one metre deep.');
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  await verifyReport(report.id, officer, {
    hazardEventId: 'event',
    decisionNote: 'Confirmed evidence.',
  });
  expect((await getGroundReportsForEvent('event')).map(item => item.id)).toEqual([report.id]);
  expect(store.records.get('hazardEvents/event')?.warningLevel).toBe('Level 1 Advisory');
  const outcome = await executeWarningDispatchPipeline(
    {
      eventId: 'event',
      hazardEventTitle: 'Kelani flood',
      hazardType: 'flood',
      severity: 'warning',
      targetMode: 'district',
      targetAreas: ['Colombo'],
      resolvedDistricts: ['Colombo'],
      recipientCount: 999,
      headline: 'Kelani flood warning',
      instructions: 'Move away from river crossings.',
      channels: ['push', 'sms'],
    },
    'dmc',
    'Officer'
  );
  expect(outcome.recipientCount).toBe(2); // Citizen + volunteer; staff are not the public audience.
  expect(outcome.finalStatus).toBe('delivered');
  expect(outcome.deliveryLogs).toHaveLength(2);
  expect((await getActiveWarnings()).map(item => item.id)).toEqual([outcome.warningId]);
  expect((await getUnreadReportNotifications('citizen'))[0]).toMatchObject({
    status: 'verified',
    hazardEventTitle: 'Kelani flood',
    officerName: 'Officer',
  });
  expect(store.records.get('hazardEvents/event')?.timeline).toHaveLength(2);
});
