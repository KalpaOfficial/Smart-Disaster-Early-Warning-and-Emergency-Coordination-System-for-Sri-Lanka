import { auth } from '@/services/firebase';
import { addDoc, updateDoc } from 'firebase/firestore';
import {
  verifyReport,
  rejectReport,
  requestAdditionalInfo,
  submitAdditionalInfo,
  submitGroundReport,
} from '@/services/groundReportService';
import { installResourceFirestore } from '../helpers/resourceFirestore';

const officer = { uid: 'dmc', name: 'Duty officer', role: 'dmc_officer' as const };
let store: ReturnType<typeof installResourceFirestore>;
beforeEach(() => {
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  store = installResourceFirestore({
    'users/dmc': { role: 'dmc_officer' },
    'groundReports/report': {
      status: 'pending_verification',
      submitterId: 'citizen',
      referenceNumber: 'GR-TEST',
      district: 'Colombo',
    },
    'hazardEvents/event': {
      status: 'active',
      title: 'Actual event title',
      timeline: [],
      warningLevel: 'Level 1 Advisory',
    },
  });
});
it.each(['verified', 'rejected'])(
  'prevents an officer overwriting a terminal %s report',
  async status => {
    store.seed('groundReports/report', { status, submitterId: 'citizen' });
    await expect(verifyReport('report', officer, {})).rejects.toThrow(/already|review/);
    await expect(rejectReport('report', officer, 'Rejected again')).rejects.toThrow(
      /already|review/
    );
    expect(updateDoc).not.toHaveBeenCalled();
  }
);
it('requires an authenticated DMC profile even when the caller claims to be an officer', async () => {
  store.seed('users/dmc', { role: 'citizen' });
  await expect(verifyReport('report', officer, {})).rejects.toThrow(/Unauthorized|Only DMC/);
  expect(updateDoc).not.toHaveBeenCalled();
});
it('blocks missing or closed events before verification and uses the stored event title', async () => {
  store.seed('hazardEvents/event', { status: 'closed' });
  await expect(verifyReport('report', officer, { hazardEventId: 'event' })).rejects.toThrow(
    /active/
  );
  await expect(verifyReport('report', officer, { hazardEventId: 'missing' })).rejects.toThrow(
    /active/
  );
  expect(store.records.get('groundReports/report')?.status).toBe('pending_verification');
  store.seed('hazardEvents/event', {
    status: 'active',
    title: 'Stored title',
    timeline: [],
    warningLevel: 'Level 1 Advisory',
  });
  await verifyReport('report', officer, {
    hazardEventId: 'event',
    hazardEventTitle: 'Spoofed title',
  });
  expect(store.records.get('groundReports/report')).toMatchObject({
    status: 'verified',
    hazardEventTitle: 'Stored title',
  });
  expect(store.records.get('hazardEvents/event')?.warningLevel).toBe('Level 1 Advisory');
});
it('only the original submitter can reply, and only to an information request', async () => {
  Object.assign(auth, { currentUser: { uid: 'other-citizen' } });
  store.seed('groundReports/report', { status: 'info_requested', submitterId: 'citizen' });
  await expect(submitAdditionalInfo('report', 'Clarification')).rejects.toThrow(/submitter|own/);
  Object.assign(auth, { currentUser: { uid: 'citizen' } });
  await submitAdditionalInfo('report', '  Clarification  ');
  expect(store.records.get('groundReports/report')).toMatchObject({
    status: 'pending_verification',
    additionalInfo: 'Clarification',
  });
  await expect(submitAdditionalInfo('report', 'Again')).rejects.toThrow(/information request/);
});
it('rejects blank rejection, information request and clarification text', async () => {
  await expect(rejectReport('report', officer, ' ')).rejects.toThrow(/reason/);
  await expect(requestAdditionalInfo('report', officer, ' ')).rejects.toThrow(/message/);
  await expect(submitAdditionalInfo('report', ' ')).rejects.toThrow(/clarification/);
  expect(updateDoc).not.toHaveBeenCalled();
});
it('allows only one concurrent final decision and rolls back failed commits', async () => {
  const outcomes = await Promise.allSettled([
    verifyReport('report', officer, {}),
    rejectReport('report', officer, 'Incorrect evidence'),
  ]);
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  store.seed('groundReports/report', { status: 'pending_verification', submitterId: 'citizen' });
  store.failNextCommit(new Error('Commit failed'));
  await expect(verifyReport('report', officer, {})).rejects.toThrow('Commit failed');
  expect(store.records.get('groundReports/report')?.status).toBe('pending_verification');
});
it('implements the information-request loop with officer audit timestamps', async () => {
  await requestAdditionalInfo('report', officer, 'Please confirm water depth.');
  expect(store.records.get('groundReports/report')).toMatchObject({
    status: 'info_requested',
    verifiedBy: 'dmc',
    verificationTimestamp: expect.any(String),
  });
  Object.assign(auth, { currentUser: { uid: 'citizen' } });
  await submitAdditionalInfo('report', 'Water is about one metre deep.');
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  await verifyReport('report', officer, {});
  expect(store.records.get('groundReports/report')?.status).toBe('verified');
});
it('validates malformed reports at the service boundary before persistence', async () => {
  await expect(
    submitGroundReport(
      {
        observationType: 'other',
        description: ' ',
        photoUri: 'file://photo',
        location: { latitude: NaN, longitude: 80 },
        locationName: '',
        district: 'Colombo',
        captureTime: 'invalid',
        isManualLocation: false,
      },
      'https://photo',
      null,
      { id: 'citizen', fullName: 'Citizen', role: 'citizen' }
    )
  ).rejects.toThrow(/Describe|valid/);
  expect(addDoc).not.toHaveBeenCalled();
});
