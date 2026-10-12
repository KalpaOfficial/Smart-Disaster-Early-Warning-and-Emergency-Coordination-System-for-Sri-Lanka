/** Seeds the current UC01-UC04 demo dataset while preserving registered users. */
import { collection, doc, getDocs, getDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { auth, db } from '@/services/firebase';
import type { User } from '@/types/auth';
import { buildSeedDocuments, SEED_VERSION, type SeedDocument, type SeedResult } from './seedData';

export { SEED_DATA, SEED_VERSION, type SeedResult } from './seedData';

async function getRegisteredUsers(): Promise<User[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  return snapshot.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id }) as User);
}

const timestampFields = new Set([
  'startDate',
  'closedAt',
  'createdAt',
  'updatedAt',
  'dispatchedAt',
  'lastStatusUpdate',
  'distributedAt',
  'timestamp',
  'verificationTimestamp',
]);

function firestoreData(document: SeedDocument): Record<string, unknown> {
  // Timeline readers expect ISO strings; service readers expect Firestore timestamps elsewhere.
  if (document.path.includes('/timeline/')) return document.data;
  return Object.fromEntries(
    Object.entries(document.data).map(([key, value]) => [
      key,
      timestampFields.has(key) && typeof value === 'string'
        ? Timestamp.fromDate(new Date(value))
        : value,
    ])
  );
}

export async function seedFirestoreDatabase(): Promise<SeedResult> {
  const users = await getRegisteredUsers();
  const signedInOfficer = users.find(u => u.id === auth.currentUser?.uid);
  if (!signedInOfficer || signedInOfficer.role !== 'dmc_officer') {
    throw new Error('Sign in as a DMC officer to seed the demo dataset.');
  }
  const { documents, result } = buildSeedDocuments(users, new Date(), signedInOfficer.id);
  if (documents.length > 500) {
    throw new Error(
      'This demo dataset exceeds the atomic batch limit. Use a smaller test user set.'
    );
  }
  const batch = writeBatch(db);
  for (const document of documents) batch.set(doc(db, document.path), firestoreData(document));
  // Stable IDs and a single commit prevent duplicate rows and partially seeded modules.
  await batch.commit();
  return result;
}

/** All expected seed documents must exist at the current version, not just any event. */
export async function isDatabaseSeeded(): Promise<boolean> {
  const users = await getRegisteredUsers();
  if (
    !users.some(u => u.role === 'dmc_officer') ||
    !users.some(u => u.role === 'citizen' || u.role === 'volunteer')
  )
    return false;
  const { documents } = buildSeedDocuments(users);
  const checks = await Promise.all(
    documents.map(async document => {
      const snapshot = await getDoc(doc(db, document.path));
      return snapshot.exists() && snapshot.data()?.seedVersion === SEED_VERSION;
    })
  );
  return checks.every(Boolean);
}
