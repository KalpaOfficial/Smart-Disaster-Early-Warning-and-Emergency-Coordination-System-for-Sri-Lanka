import { auth } from '@/services/firebase';
import { doc, getDocs, query, where, setDoc, writeBatch } from 'firebase/firestore';
import { installResourceFirestore } from '../helpers/resourceFirestore';
import type { HazardEvent } from '@/types/resources';
export const event: HazardEvent = {
  id: 'closed',
  title: 'Completed flood',
  status: 'closed',
  hazardType: 'flood',
  affectedDistricts: ['Ratnapura', 'Kalutara'],
  startDate: '2026-10-01',
  description: 'Flood response',
};
export const allCriteria = {
  selectedMetrics: [
    'alert_timeline',
    'citizens_reached',
    'shelter_occupancy',
    'resource_distribution',
  ] as ('alert_timeline' | 'citizens_reached' | 'shelter_occupancy' | 'resource_distribution')[],
  district: 'all',
};
export function setupReporting() {
  Object.assign(auth, { currentUser: { uid: 'dmc' } });
  const { records } = installResourceFirestore({
    'users/dmc': { role: 'dmc_officer' },
    'hazardEvents/closed': { ...event },
    'warnings/w1': {
      eventId: 'closed',
      status: 'delivered',
      severity: 'advisory',
      headline: 'Rain alert',
      resolvedDistricts: ['Ratnapura'],
      createdAt: '2026-10-01T08:00:00Z',
      channelResults: [
        { channel: 'push', recipientCount: 2, deliveredCount: 2, status: 'Success' },
        { channel: 'sms', recipientCount: 2, deliveredCount: 2, status: 'Success' },
      ],
    },
    'warnings/w2': {
      eventId: 'closed',
      status: 'partially_failed',
      severity: 'evacuation',
      headline: 'Evacuate safely',
      previousWarningId: 'w1',
      resolvedDistricts: ['Kalutara'],
      createdAt: '2026-10-02T08:00:00Z',
      channelResults: [
        { channel: 'push', recipientCount: 2, deliveredCount: 1, status: 'Partial' },
      ],
    },
    'warnings/other': {
      eventId: 'other',
      status: 'delivered',
      createdAt: '2026-10-01',
      resolvedDistricts: ['Ratnapura'],
    },
    'shelters/s1': {
      hazardEventId: 'closed',
      district: 'Ratnapura',
      occupancyHistory: [
        {
          timestamp: '2026-10-01T09:00:00Z',
          occupancy: 20,
          capacity: 100,
          hazardEventId: 'closed',
          district: 'Ratnapura',
        },
        {
          timestamp: '2026-10-02T09:00:00Z',
          occupancy: 50,
          capacity: 100,
          hazardEventId: 'closed',
          district: 'Ratnapura',
        },
      ],
    },
    'distributions/d1': {
      hazardEventId: 'closed',
      destinationDistrict: 'Ratnapura',
      distributedAt: '2026-10-02T12:00:00Z',
      supplyName: 'Food rations',
      supplyType: 'food',
      quantity: 12,
      unit: 'packs',
    },
    'distributions/d2': {
      hazardEventId: 'closed',
      destinationDistrict: 'Kalutara',
      distributedAt: '2026-10-01T12:00:00Z',
      supplyName: 'Drinking water',
      supplyType: 'water',
      quantity: 20,
      unit: 'litres',
    },
    'donorOrganisations/donor': { name: 'Relief Partner', email: 'relief@example.org' },
  });
  (doc as jest.Mock).mockImplementation((source, ...segments: string[]) => {
    const path = source?.path ? [source.path, ...segments].join('/') : segments.join('/');
    return { path, id: path.split('/').pop() };
  });
  (where as jest.Mock).mockImplementation((field, operator, value) => ({ field, operator, value }));
  (query as jest.Mock).mockImplementation((ref, ...filters) => ({ ...ref, filters }));
  (getDocs as jest.Mock).mockImplementation(async ({ path, filters = [] }) => ({
    docs: [...records.entries()]
      .filter(
        ([key, data]) =>
          key.startsWith(path + '/') &&
          key.split('/').length === path.split('/').length + 1 &&
          filters.every((f: { field: string; value: unknown }) => data[f.field] === f.value)
      )
      .map(([key, data]) => ({ id: key.split('/').pop(), data: () => structuredClone(data) })),
  }));
  (setDoc as jest.Mock).mockImplementation(async (ref, data) => {
    records.set(ref.path, structuredClone(data));
  });
  (writeBatch as jest.Mock).mockImplementation(() => {
    const writes: { path: string; data: Record<string, unknown>; update: boolean }[] = [];
    return {
      set: jest.fn((ref, data) => writes.push({ path: ref.path, data, update: false })),
      update: jest.fn((ref, data) => writes.push({ path: ref.path, data, update: true })),
      commit: jest.fn(async () => {
        if (writes.some(w => w.update && !records.has(w.path))) throw new Error('Missing report');
        for (const w of writes)
          records.set(
            w.path,
            structuredClone({ ...(w.update ? records.get(w.path) : {}), ...w.data })
          );
      }),
    };
  });
  return records;
}
