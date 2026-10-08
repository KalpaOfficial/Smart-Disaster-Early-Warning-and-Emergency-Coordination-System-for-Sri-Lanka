/**
 * Warning Service — Pure Cloud Firestore CRUD for UC01: Issue Hazard Warning.
 * Manages location-specific disaster warnings issued by DMC Officers.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { HazardWarning, CreateWarningData, WarningStatus } from '@/types/warning';

const COLLECTION = 'warnings';

function mapWarningDoc(docSnap: QueryDocumentSnapshot<DocumentData>): HazardWarning {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    title: d.title || '',
    hazardType: d.hazardType || 'flood',
    severity: d.severity || 'warning',
    status: d.status || 'active',
    targetDistricts: d.targetDistricts || [],
    instructions: d.instructions || '',
    hazardEventId: d.hazardEventId || '',
    hazardEventTitle: d.hazardEventTitle || '',
    issuedByUid: d.issuedByUid || '',
    issuedByName: d.issuedByName || 'DMC Duty Officer',
    issuedAt: d.issuedAt?.toDate?.()?.toISOString() || d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString(),
  };
}

/**
 * Fetch all active disaster warnings from Cloud Firestore.
 */
export async function getActiveWarnings(): Promise<HazardWarning[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', '==', 'active'),
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(mapWarningDoc);
    return items.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  } catch (error) {
    console.warn('Notice fetching active warnings:', error);
    return [];
  }
}

/**
 * Fetch all warnings (active, cancelled, expired) from Cloud Firestore.
 */
export async function getAllWarnings(): Promise<HazardWarning[]> {
  try {
    const q = query(collection(db, COLLECTION));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(mapWarningDoc);
    return items.sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
  } catch (error) {
    console.warn('Notice fetching all warnings:', error);
    return [];
  }
}

/**
 * Fetch warnings targeting a specific district.
 */
export async function getWarningsByDistrict(district: string): Promise<HazardWarning[]> {
  try {
    const all = await getActiveWarnings();
    if (!district) return all;
    return all.filter((w) =>
      w.targetDistricts.some((d) => d.toLowerCase() === district.toLowerCase()),
    );
  } catch (error) {
    console.warn('Notice fetching district warnings:', error);
    return [];
  }
}

/**
 * Issue a new disaster warning in Cloud Firestore (UC01 Primary Action).
 */
export async function createWarning(
  data: CreateWarningData,
  issuedByUid: string,
  issuedByName: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    status: 'active' as WarningStatus,
    issuedByUid,
    issuedByName,
    issuedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update warning status (e.g. Cancel or Expire a warning).
 */
export async function updateWarningStatus(
  id: string,
  status: WarningStatus,
): Promise<void> {
  const docRef = doc(db, COLLECTION, id);
  await updateDoc(docRef, {
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a warning document from Cloud Firestore.
 */
export async function deleteWarning(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
