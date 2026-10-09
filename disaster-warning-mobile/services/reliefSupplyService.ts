/**
 * Relief supply tracking service — Pure Cloud Firestore CRUD.
 * Implements UC03 relief supplies: inventory tracking, distribution logging, and overdraft checks.
 * No mock data or local fallbacks.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type {
  ReliefSupply,
  CreateReliefSupplyData,
  Distribution,
  CreateDistributionData,
  SupplyType,
} from '@/types/resources';

const SUPPLY_COLLECTION = 'reliefSupplies';
const DIST_COLLECTION = 'distributions';

function mapSupplyDoc(docSnap: QueryDocumentSnapshot<DocumentData>): ReliefSupply {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    itemName: d.itemName || '',
    type: d.type || 'food',
    totalQuantity: d.totalQuantity || 0,
    remainingQuantity: d.remainingQuantity !== undefined ? d.remainingQuantity : d.totalQuantity || 0,
    unit: d.unit || 'packs',
    organisationType: d.organisationType || 'ngo',
    organisationName: d.organisationName || '',
    district: d.district || '',
    hazardEventId: d.hazardEventId || '',
    createdBy: d.createdBy || '',
    createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString(),
  };
}

function mapDistDoc(docSnap: QueryDocumentSnapshot<DocumentData>): Distribution {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    supplyId: d.supplyId || '',
    supplyName: d.supplyName || '',
    quantity: d.quantity || 0,
    unit: d.unit || 'packs',
    destinationDistrict: d.destinationDistrict || '',
    destinationLocation: d.destinationLocation || '',
    details: d.details || '',
    distributedBy: d.distributedBy || '',
    hazardEventId: d.hazardEventId || '',
    distributedAt: d.distributedAt?.toDate?.()?.toISOString() || new Date().toISOString(),
  };
}

/**
 * Get all relief supplies from Cloud Firestore, optionally filtered by hazard event.
 */
export async function getSupplies(hazardEventId?: string): Promise<ReliefSupply[]> {
  let q;
  if (hazardEventId) {
    q = query(
      collection(db, SUPPLY_COLLECTION),
      where('hazardEventId', '==', hazardEventId),
    );
  } else {
    q = query(collection(db, SUPPLY_COLLECTION));
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapSupplyDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get relief supplies filtered by commodity category.
 */
export async function getSuppliesByType(
  type: SupplyType,
  hazardEventId?: string,
): Promise<ReliefSupply[]> {
  let q;
  if (hazardEventId) {
    q = query(
      collection(db, SUPPLY_COLLECTION),
      where('type', '==', type),
      where('hazardEventId', '==', hazardEventId),
    );
  } else {
    q = query(collection(db, SUPPLY_COLLECTION), where('type', '==', type));
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapSupplyDoc);
}

/**
 * Listen to real-time relief supply updates in Cloud Firestore.
 */
export function onSuppliesChanged(
  hazardEventId: string | undefined,
  callback: (supplies: ReliefSupply[]) => void,
): Unsubscribe {
  let q;
  if (hazardEventId) {
    q = query(
      collection(db, SUPPLY_COLLECTION),
      where('hazardEventId', '==', hazardEventId),
    );
  } else {
    q = query(collection(db, SUPPLY_COLLECTION));
  }

  return onSnapshot(q, (snapshot) => {
    const supplies = snapshot.docs.map(mapSupplyDoc);
    callback(supplies);
  });
}

/**
 * Create a new relief supply record in Cloud Firestore.
 */
export async function createSupply(
  data: CreateReliefSupplyData,
  userId: string,
  hazardEventId: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, SUPPLY_COLLECTION), {
    ...data,
    remainingQuantity: data.totalQuantity,
    hazardEventId,
    createdBy: userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Distribute a relief supply — validates quantity, creates distribution record in Cloud Firestore,
 * and decrements remaining quantity (UC03 steps 57–61).
 */
export async function distributeSupply(
  data: CreateDistributionData,
  userId: string,
  hazardEventId: string,
): Promise<string> {
  // 1. Fetch current supply document from Firestore
  const supplyDocRef = doc(db, SUPPLY_COLLECTION, data.supplyId);
  const supplySnap = await getDoc(supplyDocRef);

  if (!supplySnap.exists()) {
    throw new Error('Supply item does not exist in inventory');
  }

  const supplyData = supplySnap.data();
  const currentRemaining: number =
    supplyData.remainingQuantity !== undefined
      ? supplyData.remainingQuantity
      : supplyData.totalQuantity;

  // 2. Validate sufficient remaining quantity
  if (data.quantity > currentRemaining) {
    throw new Error(
      `Insufficient supplies. Requested: ${data.quantity}, Available: ${currentRemaining}`,
    );
  }

  // 3. Create distribution record in Firestore
  const distDocRef = await addDoc(collection(db, DIST_COLLECTION), {
    ...data,
    distributedBy: userId,
    hazardEventId,
    distributedAt: serverTimestamp(),
  });

  // 4. Decrement remaining quantity in Firestore
  const newRemaining = currentRemaining - data.quantity;
  await updateDoc(supplyDocRef, {
    remainingQuantity: newRemaining,
    updatedAt: serverTimestamp(),
  });

  return distDocRef.id;
}

/**
 * Get distribution transaction records from Cloud Firestore.
 */
export async function getDistributions(supplyId?: string): Promise<Distribution[]> {
  let q;
  if (supplyId) {
    q = query(
      collection(db, DIST_COLLECTION),
      where('supplyId', '==', supplyId),
    );
  } else {
    q = query(collection(db, DIST_COLLECTION));
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapDistDoc);
  return items.sort((a, b) => new Date(b.distributedAt).getTime() - new Date(a.distributedAt).getTime());
}
