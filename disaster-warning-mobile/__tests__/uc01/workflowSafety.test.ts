import { auth } from '@/services/firebase';
import { addDoc } from 'firebase/firestore';
import * as delivery from '@/services/deliveryService';
import {
  createWarningDocument,
  executeWarningDispatchPipeline,
  getWarningById,
} from '@/services/warningService';
import { resolveRecipients } from '@/services/recipientService';
import { installResourceFirestore } from '../helpers/resourceFirestore';
import type { CreateWarningPayload } from '@/types/warning';
jest.mock('@/services/recipientService', () => ({ resolveRecipients: jest.fn() }));
const payload: CreateWarningPayload = {
  eventId: 'event',
  hazardType: 'flood',
  hazardEventTitle: 'Flood',
  severity: 'warning',
  targetMode: 'district',
  targetAreas: ['Colombo'],
  resolvedDistricts: ['Colombo'],
  recipientCount: 999,
  headline: 'Flood warning',
  instructions: 'Move away from the river.',
  channels: ['push'],
};
let store: ReturnType<typeof installResourceFirestore>;
beforeEach(() => {
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  store = installResourceFirestore({
    'users/dmc': { role: 'dmc_officer' },
    'hazardEvents/event': { status: 'active', hazardType: 'flood', title: 'Flood' },
  });
  (resolveRecipients as jest.Mock).mockResolvedValue({
    recipients: [{ id: 'citizen', role: 'citizen', district: 'Colombo' }],
    recipientCount: 1,
    contributingDistricts: ['Colombo'],
  });
});
it('blocks closed events and unauthorized officer impersonation before writing', async () => {
  store.seed('hazardEvents/event', { status: 'closed' });
  await expect(createWarningDocument(payload, 'dmc')).rejects.toThrow(/active/);
  store.seed('hazardEvents/event', { status: 'active', hazardType: 'flood' });
  store.seed('users/dmc', { role: 'citizen' });
  await expect(executeWarningDispatchPipeline(payload, 'dmc', 'Officer')).rejects.toThrow(
    /Only DMC|Unauthorized/
  );
  expect(addDoc).not.toHaveBeenCalled();
});
it('rejects unsigned or mismatched issuer accounts', async () => {
  Object.assign(auth, { currentUser: null });
  await expect(createWarningDocument(payload, 'dmc')).rejects.toThrow('Unauthorized');
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  await expect(createWarningDocument(payload, 'another-officer')).rejects.toThrow('Unauthorized');
});
it('checks current event status in the creation transaction after audience resolution', async () => {
  (resolveRecipients as jest.Mock).mockImplementationOnce(async () => {
    store.seed('hazardEvents/event', { status: 'closed', hazardType: 'flood' });
    return {
      recipients: [{ id: 'citizen' }],
      recipientCount: 1,
      contributingDistricts: ['Colombo'],
    };
  });
  await expect(createWarningDocument(payload, 'dmc')).rejects.toThrow('active');
  expect([...store.records.keys()].filter(path => path.startsWith('warnings/'))).toEqual([]);
});
it.each([
  { severity: 'invalid' },
  { targetMode: 'invalid' },
  { channels: ['invalid'] },
  { targetAreas: ['not a district'] },
  { eventId: '' },
])('rejects malformed warning fields %j', async changes => {
  await expect(
    createWarningDocument({ ...payload, ...changes } as CreateWarningPayload, 'dmc')
  ).rejects.toThrow();
  expect(addDoc).not.toHaveBeenCalled();
});
it('rejects a follow-up belonging to a different event or lowering severity', async () => {
  store.seed('warnings/previous', {
    eventId: 'other-event',
    severity: 'advisory',
    status: 'delivered',
  });
  await expect(
    createWarningDocument({ ...payload, previousWarningId: 'previous' }, 'dmc')
  ).rejects.toThrow(/same hazard event/);
  store.seed('warnings/previous', {
    eventId: 'event',
    severity: 'evacuation',
    status: 'delivered',
  });
  await expect(
    createWarningDocument({ ...payload, previousWarningId: 'previous' }, 'dmc')
  ).rejects.toThrow(/lower/);
});
it('preserves ISO dates instead of replacing old warning dates with the current time', async () => {
  store.seed('warnings/old', {
    ...payload,
    createdAt: '2026-10-01T01:00:00.000Z',
    dispatchedAt: '2026-10-01T01:01:00.000Z',
    updatedAt: '2026-10-02T01:00:00.000Z',
  });
  const warning = await getWarningById('old');
  expect(warning).toMatchObject({
    createdAt: '2026-10-01T01:00:00.000Z',
    dispatchedAt: '2026-10-01T01:01:00.000Z',
    updatedAt: '2026-10-02T01:00:00.000Z',
  });
});
it('uses the fresh resolved audience rather than the UI estimate and deduplicates channels', async () => {
  await createWarningDocument({ ...payload, channels: ['push', 'push'] }, 'dmc');
  expect(store.records.get('warnings/generated-1')).toMatchObject({
    recipientCount: 1,
    channels: ['push'],
  });
});
it('returns only after the warning, every channel log and event timeline are persisted', async () => {
  const result = await executeWarningDispatchPipeline(
    { ...payload, channels: ['push', 'sms'] },
    'dmc',
    'Duty officer',
    { sms: { mockFailure: true } }
  );
  expect(result.finalStatus).toBe('partially_failed');
  expect(store.records.get(`warnings/${result.warningId}`)?.status).toBe('partially_failed');
  expect(store.records.get(`deliveryLogs/${result.warningId}-push`)).toMatchObject({
    warningId: result.warningId,
    status: 'Success',
    deliveredCount: 1,
  });
  expect(store.records.get(`deliveryLogs/${result.warningId}-sms`)).toMatchObject({
    warningId: result.warningId,
    status: 'Failed',
    failedCount: 1,
  });
  expect(store.records.get('hazardEvents/event')?.timeline).toEqual([
    expect.objectContaining({ warningId: result.warningId }),
  ]);
  expect(
    store.records.get(`hazardEvents/event/timeline/timeline-warn-${result.warningId}`)
  ).toBeDefined();
});
it('does not report completed delivery when the audit commit fails or leave partial logs', async () => {
  const dispatch = jest
    .spyOn(delivery, 'dispatchMultiChannelWarning')
    .mockImplementationOnce(async () => {
      store.failNextCommit(new Error('Audit unavailable'));
      return {
        channelResults: [
          {
            channel: 'push',
            status: 'Success',
            recipientCount: 1,
            deliveredCount: 1,
            failedCount: 0,
          },
        ],
        overallStatus: 'Success',
        totalRecipients: 1,
        totalDelivered: 1,
        totalFailed: 0,
      };
    });
  await expect(executeWarningDispatchPipeline(payload, 'dmc', 'Officer')).rejects.toThrow(
    'Do not resend'
  );
  expect(store.records.get('warnings/generated-1')?.status).toBe('dispatching');
  expect([...store.records.keys()].filter(path => path.startsWith('deliveryLogs/'))).toEqual([]);
  dispatch.mockRestore();
});
