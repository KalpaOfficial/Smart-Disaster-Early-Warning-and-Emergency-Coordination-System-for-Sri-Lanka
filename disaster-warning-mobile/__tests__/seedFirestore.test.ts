import { auth } from '@/services/firebase';
import { getDocs, getDoc, writeBatch } from 'firebase/firestore';
import { buildSeedDocuments, SEED_DATA, SEED_VERSION } from '@/utils/seedData';
import { seedFirestoreDatabase, isDatabaseSeeded } from '@/utils/seedFirestore';
import type { User } from '@/types/auth';

jest.mock('firebase/firestore', () => ({
  collection: jest.fn((_db, path) => ({ path })),
  doc: jest.fn((_db, path) => ({ path })),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  writeBatch: jest.fn(),
  Timestamp: { fromDate: (date: Date) => ({ toDate: () => date }) },
}));

const users: User[] = [
  {
    id: 'officer',
    fullName: 'DMC Officer',
    email: 'officer@example.test',
    role: 'dmc_officer',
    district: 'Colombo',
    createdAt: '2026-01-01',
  },
  {
    id: 'coordinator',
    fullName: 'District Officer',
    email: 'district@example.test',
    role: 'district_officer',
    district: 'Ratnapura',
    createdAt: '2026-01-01',
  },
  ...['Ratnapura', 'Kalutara', 'Kandy', 'Kegalle', 'Batticaloa'].map((district, index): User => ({
    id: `citizen-${index}`,
    fullName: `${district} Citizen`,
    email: `citizen${index}@example.test`,
    role: 'citizen',
    district,
    createdAt: '2026-01-01',
  })),
  {
    id: 'volunteer',
    fullName: 'Volunteer',
    email: 'volunteer@example.test',
    role: 'volunteer',
    district: 'Badulla',
    createdAt: '2026-01-01',
  },
];
const now = new Date('2026-10-11T12:00:00Z');
const set = jest.fn();
const commit = jest.fn();

beforeEach(() => {
  Object.assign(auth, { currentUser: { uid: 'officer' } });
  (getDocs as jest.Mock).mockResolvedValue({
    docs: users.map(user => ({ id: user.id, data: () => ({ ...user, id: 'stale-field-id' }) })),
  });
  (getDoc as jest.Mock).mockResolvedValue({
    exists: () => true,
    data: () => ({ seedVersion: SEED_VERSION }),
  });
  (writeBatch as jest.Mock).mockReturnValue({ set, commit });
  commit.mockResolvedValue(undefined);
});

it('covers every persisted app module, every report state and both event statuses', () => {
  const { documents, result } = buildSeedDocuments(users, now);
  expect(new Set(documents.map(d => d.path.split('/')[0]))).toEqual(
    new Set([
      'hazardEvents',
      'warnings',
      'deliveryLogs',
      'groundReports',
      'shelters',
      'rescueTeams',
      'reliefSupplies',
      'distributions',
      'postEventReports',
      'donorDistributions',
    ])
  );
  expect(
    new Set(documents.filter(d => d.path.startsWith('groundReports/')).map(d => d.data.status))
  ).toEqual(new Set(['pending_verification', 'verified', 'rejected', 'info_requested']));
  expect(new Set(SEED_DATA.hazardEvents.map(e => e.status))).toEqual(new Set(['active', 'closed']));
  expect(result.timelines).toBe(documents.filter(d => d.path.includes('/timeline/')).length);
  expect(result.groundReports).toBe(
    SEED_DATA.groundReports.length +
      users.filter(u => u.role === 'citizen' || u.role === 'volunteer').length
  );
});

it('preserves users and uses existing identities for reports, recipients and ownership', () => {
  const before = JSON.stringify(users);
  const { documents } = buildSeedDocuments(users, now);
  expect(JSON.stringify(users)).toBe(before);
  expect(documents.some(d => d.path.startsWith('users/'))).toBe(false);
  for (const d of documents.filter(d => d.path.startsWith('groundReports/'))) {
    const submitter = users.find(u => u.id === d.data.submitterId)!;
    expect(d.data.submitterName).toBe(submitter.fullName);
    expect(d.data.submitterRole).toBe(submitter.role);
    expect(Date.parse(d.data.captureTime as string)).toBeLessThan(
      Date.parse(d.data.createdAt as string)
    );
    if (d.data.status === 'verified') {
      expect(documents.some(e => e.path === `hazardEvents/${d.data.hazardEventId}`)).toBe(true);
      expect(Date.parse(d.data.verificationTimestamp as string)).toBeGreaterThan(
        Date.parse(d.data.createdAt as string)
      );
    }
  }
  for (const user of users.filter(u => u.role === 'citizen' || u.role === 'volunteer')) {
    expect(documents.some(d => d.path === `groundReports/seed-personal-report-${user.id}`)).toBe(
      true
    );
  }
  expect(documents.find(d => d.path.startsWith('shelters/'))?.data.createdBy).toBe('coordinator');
});

it('links warnings, channel counts, escalation chains and identical timeline entries', () => {
  const { documents } = buildSeedDocuments(users, now);
  const byPath = new Map(documents.map(d => [d.path, d.data]));
  for (const w of documents.filter(d => d.path.startsWith('warnings/'))) {
    const data = w.data;
    const recipients = users.filter(u =>
      (data.resolvedDistricts as string[]).includes(u.district!)
    );
    expect(data.recipientUids).toEqual(
      recipients.sort((a, b) => a.id.localeCompare(b.id)).map(u => u.id)
    );
    expect(data.recipientCount).toBe(recipients.length);
    if (data.previousWarningId)
      expect(byPath.get(`warnings/${data.previousWarningId}`)?.eventId).toBe(data.eventId);
    for (const channel of data.channels as string[]) {
      const log = byPath.get(`deliveryLogs/seed-log-${data.id}-${channel}`)!;
      expect(Number(log.deliveredCount) + Number(log.failedCount)).toBe(data.recipientCount);
    }
    const t = byPath.get(`hazardEvents/${data.eventId}/timeline/timeline-warn-${data.id}`)!;
    const embedded = (
      byPath.get(`hazardEvents/${data.eventId}`)!.timeline as { id: string }[]
    ).find(entry => entry.id === t.id);
    expect(embedded).toBeDefined();
    expect(t).toMatchObject(embedded!);
  }
});

it('reconciles every stock balance and links closed-event reports and donor audits', () => {
  const { documents } = buildSeedDocuments(users, now);
  for (const supply of SEED_DATA.reliefSupplies) {
    const distributed = SEED_DATA.distributions.filter(d => d.supplyId === supply.id);
    expect(distributed.reduce((sum, d) => sum + d.quantity, 0) + supply.remainingQuantity).toBe(
      supply.totalQuantity
    );
    expect(
      distributed.every(d => d.unit === supply.unit && d.hazardEventId === supply.hazardEventId)
    ).toBe(true);
  }
  const report = documents.find(d => d.path.startsWith('postEventReports/'))!;
  expect(SEED_DATA.hazardEvents.find(e => e.id === report.data.eventId)?.status).toBe('closed');
  for (const donor of documents.filter(d => d.path.startsWith('donorDistributions/'))) {
    expect(donor.data.reportId).toBe(report.data.id);
    expect(donor.data.status).toBe('FAILED');
    expect(donor.data.fileUrl).toBe('');
  }
});

it('uses stable IDs on repeat builds and refuses incomplete user prerequisites', () => {
  expect(buildSeedDocuments(users, now).documents.map(d => d.path)).toEqual(
    buildSeedDocuments([...users].reverse(), now).documents.map(d => d.path)
  );
  expect(() =>
    buildSeedDocuments(
      users.filter(u => u.role !== 'dmc_officer'),
      now
    )
  ).toThrow('existing DMC officer');
  expect(() =>
    buildSeedDocuments(
      users.filter(u => u.role === 'dmc_officer'),
      now
    )
  ).toThrow('citizen or volunteer');
});

it('commits all modules atomically with service-compatible timestamp fields', async () => {
  await seedFirestoreDatabase();
  expect(writeBatch).toHaveBeenCalledTimes(1);
  expect(commit).toHaveBeenCalledTimes(1);
  const writes = set.mock.calls as [{ path: string }, Record<string, unknown>][];
  expect(writes.some(([ref]) => ref.path.startsWith('users/'))).toBe(false);
  const warning = writes.find(([ref]) => ref.path.startsWith('warnings/'))![1];
  expect(warning.createdAt).toEqual(expect.objectContaining({ toDate: expect.any(Function) }));
  const timeline = writes.find(([ref]) => ref.path.includes('/timeline/'))![1];
  expect(typeof timeline.timestamp).toBe('string');
  const groundReport = writes.find(([ref]) => ref.path.startsWith('groundReports/'))![1];
  expect(typeof groundReport.captureTime).toBe('string');
});

it('rejects non-officers before creating any writes and propagates failed commits', async () => {
  Object.assign(auth, { currentUser: { uid: 'citizen-0' } });
  await expect(seedFirestoreDatabase()).rejects.toThrow('Sign in as a DMC officer');
  expect(writeBatch).not.toHaveBeenCalled();
  Object.assign(auth, { currentUser: { uid: 'officer' } });
  commit.mockRejectedValueOnce(new Error('permission-denied'));
  await expect(seedFirestoreDatabase()).rejects.toThrow('permission-denied');
});

it('checks the complete current seed rather than treating unrelated events as seeded', async () => {
  await expect(isDatabaseSeeded()).resolves.toBe(true);
  (getDoc as jest.Mock).mockImplementation(async (ref: { path: string }) => ({
    exists: () => !ref.path.startsWith('donorDistributions/'),
    data: () => ({ seedVersion: SEED_VERSION }),
  }));
  await expect(isDatabaseSeeded()).resolves.toBe(false);
  (getDoc as jest.Mock).mockResolvedValue({ exists: () => true, data: () => ({ seedVersion: 1 }) });
  await expect(isDatabaseSeeded()).resolves.toBe(false);
});

it('propagates status read failures instead of reporting an empty database', async () => {
  (getDocs as jest.Mock).mockRejectedValueOnce(new Error('offline'));
  await expect(isDatabaseSeeded()).rejects.toThrow('offline');
});

it('records zero-recipient targets as failed delivery rather than successful reach', () => {
  const localUsers = users.filter(u => u.role === 'dmc_officer' || u.district === 'Ratnapura');
  const { documents } = buildSeedDocuments(localUsers, now);
  const warning = documents.find(d => d.path === 'warnings/warning-kegalle-landslide-amber')!.data;
  expect(warning.status).toBe('failed');
  expect(warning.recipientCount).toBe(0);
  const log = documents.find(
    d => d.path === 'deliveryLogs/seed-log-warning-kegalle-landslide-amber-push'
  )!.data;
  expect(log.status).toBe('Failed');
  expect(log.errorMessage).toContain('No registered recipients');
});

it('refuses oversized seeds before writing a partial batch', async () => {
  const manyUsers = [
    ...users,
    ...Array.from({ length: 500 }, (_, index) => ({ ...users[2], id: `extra-${index}` })),
  ];
  (getDocs as jest.Mock).mockResolvedValueOnce({
    docs: manyUsers.map(u => ({ id: u.id, data: () => u })),
  });
  await expect(seedFirestoreDatabase()).rejects.toThrow('atomic batch limit');
  expect(writeBatch).not.toHaveBeenCalled();
});
