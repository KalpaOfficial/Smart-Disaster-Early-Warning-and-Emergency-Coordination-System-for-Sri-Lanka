import { addDoc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth } from '@/services/firebase';
import {
  createHazardEvent,
  updateHazardEvent,
  setHazardEventStatus,
  getHazardEvent,
  getActiveEvents,
  subscribeToHazardEvents,
} from '@/services/hazardEventService';
import { normalizeHazardEvent } from '@/utils/hazardEventForm';
import { requireActiveResourceEvent } from '@/services/resourceAuthorization';
import { installResourceFirestore } from '../helpers/resourceFirestore';

const input = {
  title: '  Kelani river flooding  ',
  description: ' Water is rising near river crossings. ',
  hazardType: 'flood' as const,
  affectedDistricts: ['Colombo', 'Gampaha', 'Colombo'],
  affectedRiverBasins: ['Kelani River Basin'],
  warningLevel: 'Level 3 Warning',
};
let store: ReturnType<typeof installResourceFirestore>;
beforeEach(() => {
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  store = installResourceFirestore({
    'users/dmc': { role: 'dmc_officer' },
    'hazardEvents/event': {
      ...input,
      title: 'Original event',
      status: 'active',
      startDate: '2026-10-01T08:00:00.000Z',
      createdBy: 'original-officer',
      timeline: [{ headline: 'Earlier warning' }],
    },
  });
});

describe('Hazard event management', () => {
  it('creates an active event with normalized areas and the authenticated officer as creator', async () => {
    const id = await createHazardEvent({ ...input, status: 'active' });
    expect(store.records.get(`hazardEvents/${id}`)).toMatchObject({
      title: 'Kelani river flooding',
      description: 'Water is rising near river crossings.',
      affectedDistricts: ['Colombo', 'Gampaha'],
      affectedRiverBasins: ['Kelani River Basin'],
      createdBy: 'dmc',
      status: 'active',
      startDate: expect.any(String),
    });
  });
  it.each(['citizen', 'volunteer', 'district_officer'])(
    'rejects %s mutations even if the UI is bypassed',
    async role => {
      store.seed('users/dmc', { role });
      await expect(createHazardEvent({ ...input, status: 'active' })).rejects.toThrow('Only DMC');
      await expect(updateHazardEvent('event', input)).rejects.toThrow('Only DMC');
      await expect(setHazardEventStatus('event', 'closed')).rejects.toThrow('Only DMC');
      expect(addDoc).not.toHaveBeenCalled();
      expect(updateDoc).not.toHaveBeenCalled();
    }
  );
  it('rejects unsigned and missing-profile users', async () => {
    Object.assign(auth, { currentUser: null });
    await expect(createHazardEvent({ ...input, status: 'active' })).rejects.toThrow('Sign in');
    Object.assign(auth, { currentUser: { uid: 'unknown' } });
    await expect(setHazardEventStatus('event', 'closed')).rejects.toThrow('Only DMC');
  });
  it('does not accept invalid fields or an initially closed event', async () => {
    await expect(createHazardEvent({ ...input, title: ' ', status: 'active' })).rejects.toThrow(
      'title'
    );
    await expect(createHazardEvent({ ...input, status: 'closed' })).rejects.toThrow(
      'start as active'
    );
    expect(() => normalizeHazardEvent({ ...input, affectedDistricts: [] })).toThrow('district');
    expect(() => normalizeHazardEvent({ ...input, affectedDistricts: ['Unknown'] })).toThrow(
      'district'
    );
    expect(() => normalizeHazardEvent({ ...input, affectedRiverBasins: ['Unknown'] })).toThrow(
      'river basin'
    );
    expect(() => normalizeHazardEvent({ ...input, description: ' '.repeat(10) })).toThrow(
      'description'
    );
    expect(() => normalizeHazardEvent({ ...input, hazardType: 'invalid' as never })).toThrow(
      'hazard type'
    );
    expect(() => normalizeHazardEvent({ ...input, warningLevel: 'invalid' })).toThrow(
      'alert level'
    );
    expect(addDoc).not.toHaveBeenCalled();
  });
  it('edits only event details, preserving status, creation metadata and linked history', async () => {
    await updateHazardEvent('event', {
      ...input,
      status: 'closed',
      createdBy: 'spoofed',
      timeline: [],
    } as typeof input);
    expect(store.records.get('hazardEvents/event')).toMatchObject({
      title: 'Kelani river flooding',
      createdBy: 'original-officer',
      status: 'active',
      startDate: '2026-10-01T08:00:00.000Z',
      timeline: [{ headline: 'Earlier warning' }],
      updatedBy: 'dmc',
    });
  });
  it('closes and reopens an event, recording the officer and keeping resource selectors consistent', async () => {
    await setHazardEventStatus('event', 'closed');
    expect(store.records.get('hazardEvents/event')).toMatchObject({
      status: 'closed',
      closedBy: 'dmc',
      closedAt: expect.any(String),
      updatedBy: 'dmc',
    });
    await expect(requireActiveResourceEvent('event', 'Colombo')).rejects.toThrow(
      'no longer active'
    );
    await expect(setHazardEventStatus('event', 'closed')).rejects.toThrow('already closed');
    await updateHazardEvent('event', input);
    expect(store.records.get('hazardEvents/event')?.status).toBe('closed');
    await setHazardEventStatus('event', 'active');
    await expect(requireActiveResourceEvent('event', 'Colombo')).resolves.toBeUndefined();
    expect(store.records.get('hazardEvents/event')).toMatchObject({
      status: 'active',
      closedAt: null,
      closedBy: null,
    });
  });
  it('rejects missing events and invalid statuses without creating partial records', async () => {
    await expect(updateHazardEvent('missing', input)).rejects.toThrow('no longer exists');
    await expect(setHazardEventStatus('missing', 'closed')).rejects.toThrow('no longer exists');
    await expect(setHazardEventStatus('event', 'unknown' as never)).rejects.toThrow(
      'Active or Closed'
    );
    expect(updateDoc).not.toHaveBeenCalled();
  });
  it('preserves stored event status when a transaction commit fails', async () => {
    store.failNextCommit(new Error('Connection lost'));
    await expect(setHazardEventStatus('event', 'closed')).rejects.toThrow('Connection lost');
    expect(store.records.get('hazardEvents/event')?.status).toBe('active');
  });
  it('returns river basins, alert level and the original date in event details', async () => {
    expect(await getHazardEvent('event')).toMatchObject({
      warningLevel: 'Level 3 Warning',
      affectedRiverBasins: ['Kelani River Basin'],
      startDate: '2026-10-01T08:00:00.000Z',
    });
  });
  it('maps active events with complete fields for the warning and verification selectors', async () => {
    (getDocs as jest.Mock).mockResolvedValueOnce({
      docs: [{ id: 'event', data: () => store.records.get('hazardEvents/event') }],
    });
    expect(await getActiveEvents()).toEqual([
      expect.objectContaining({
        id: 'event',
        status: 'active',
        affectedDistricts: ['Colombo', 'Gampaha', 'Colombo'],
        affectedRiverBasins: ['Kelani River Basin'],
      }),
    ]);
  });
  it('propagates live changes, listener errors and unsubscribe', () => {
    const change = jest.fn(),
      error = jest.fn(),
      stop = jest.fn();
    (onSnapshot as jest.Mock).mockImplementationOnce((_query, next, failure) => {
      next({ docs: [{ id: 'event', data: () => store.records.get('hazardEvents/event') }] });
      failure(new Error('Offline'));
      return stop;
    });
    subscribeToHazardEvents(change, error)();
    expect(change).toHaveBeenCalledWith([expect.objectContaining({ id: 'event' })]);
    expect(error).toHaveBeenCalledWith(expect.any(Error));
    expect(stop).toHaveBeenCalledTimes(1);
  });
});
