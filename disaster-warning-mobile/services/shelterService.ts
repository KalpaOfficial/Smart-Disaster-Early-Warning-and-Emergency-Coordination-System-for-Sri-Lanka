/**
 * Shelter service — Pure Cloud Firestore CRUD for emergency shelters.
 * Implements UC03 shelter management: register, activate, track occupancy, deactivate.
 * No mock data or local fallbacks.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { Shelter, CreateShelterData, ShelterStatus } from '@/types/resources';

const COLLECTION = 'shelters';

function mapShelterDoc(docSnap: QueryDocumentSnapshot<DocumentData>): Shelter {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    name: d.name || '',
    facilityType: d.facilityType || 'school',
    address: d.address || '',
    district: d.district || '',
    latitude: d.latitude || 0,
    longitude: d.longitude || 0,
    capacity: d.capacity || 0,
    currentOccupancy: d.currentOccupancy || 0,
    facilities: d.facilities || [],
    managerName: d.managerName || '',
    managerContact: d.managerContact || '',
    organisationType: d.organisationType || 'government',
    organisationName: d.organisationName || '',
    status: d.status || 'registered',
    hazardEventId: d.hazardEventId || '',
    createdBy: d.createdBy || '',
    createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString(),
  };
}

/**
 * Get all shelters from Cloud Firestore, optionally filtered by hazard event.
 */
export async function getShelters(hazardEventId?: string): Promise<Shelter[]> {
  let q;
  if (hazardEventId) {
    q = query(
      collection(db, COLLECTION),
      where('hazardEventId', '==', hazardEventId),
    );
  } else {
    q = query(collection(db, COLLECTION));
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapShelterDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Listen to real-time shelter updates in Cloud Firestore. Returns unsubscribe function.
 */
export function onSheltersChanged(
  hazardEventId: string | undefined,
  callback: (shelters: Shelter[]) => void,
): Unsubscribe {
  let q;
  if (hazardEventId) {
    q = query(
      collection(db, COLLECTION),
      where('hazardEventId', '==', hazardEventId),
    );
  } else {
    q = query(collection(db, COLLECTION));
  }

  return onSnapshot(q, (snapshot) => {
    const shelters = snapshot.docs.map(mapShelterDoc);
    callback(shelters);
  });
}

/**
 * Register a new shelter in Cloud Firestore (UC03 steps 41–46).
 */
export async function createShelter(
  data: CreateShelterData,
  userId: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    currentOccupancy: 0,
    status: 'registered' as ShelterStatus,
    hazardEventId: '',
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Activate a shelter for an active hazard event in Cloud Firestore (UC03 step 47).
 */
export async function activateShelter(
  shelterId: string,
  hazardEventId: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, shelterId), {
    status: 'active' as ShelterStatus,
    hazardEventId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update shelter headcount in Cloud Firestore (UC03 steps 48–50).
 */
export async function updateOccupancy(
  shelterId: string,
  occupancy: number,
  capacity: number,
): Promise<void> {
  const isOver = occupancy > capacity;
  const status: ShelterStatus = isOver ? 'over_capacity' : 'active';

  await updateDoc(doc(db, COLLECTION, shelterId), {
    currentOccupancy: occupancy,
    status,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deactivate a shelter in Cloud Firestore.
 */
export async function deactivateShelter(shelterId: string): Promise<void> {
  await updateDoc(doc(db, COLLECTION, shelterId), {
    status: 'inactive' as ShelterStatus,
    hazardEventId: '',
    updatedAt: serverTimestamp(),
  });
}
