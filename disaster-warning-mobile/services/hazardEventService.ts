/**
 * Hazard Event service — Pure Cloud Firestore CRUD.
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
  arrayUnion,
  serverTimestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { HazardEvent } from '@/types/resources';

const COLLECTION = 'hazardEvents';

function mapEventDoc(docSnap: QueryDocumentSnapshot<DocumentData>): HazardEvent {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    title: d.title || '',
    hazardType: d.hazardType || 'flood',
    warningLevel: d.warningLevel || 'Level 4 Alert',
    status: d.status || 'active',
    affectedDistricts: d.affectedDistricts || [],
    affectedRiverBasins: d.affectedRiverBasins || [],
    startDate: d.startDate?.toDate?.()?.toISOString() || new Date().toISOString(),
    description: d.description || '',
  };
}

/**
 * Get all active hazard events from Cloud Firestore.
 */
export async function getActiveEvents(): Promise<HazardEvent[]> {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'active'),
  );

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapEventDoc);
  return items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

/**
 * Get all hazard events (active + closed) from Cloud Firestore.
 */
export async function getAllEvents(): Promise<HazardEvent[]> {
  const q = query(collection(db, COLLECTION));
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapEventDoc);
  return items.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

/**
 * Get a specific hazard event by ID from Cloud Firestore.
 */
export async function getHazardEvent(id: string): Promise<HazardEvent | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (snap.exists()) {
    const d = snap.data();
    return {
      id: snap.id,
      title: d.title || '',
      hazardType: d.hazardType || 'flood',
      status: d.status || 'active',
      affectedDistricts: d.affectedDistricts || [],
      startDate: d.startDate?.toDate?.()?.toISOString() || new Date().toISOString(),
      description: d.description || '',
    };
  }
  return null;
}

/**
 * Create a new hazard event in Cloud Firestore.
 */
export async function createHazardEvent(
  data: Omit<HazardEvent, 'id' | 'startDate'>,
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    startDate: serverTimestamp(),
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Attach an issued warning to the hazard event timeline (UC01 Step 20).
 */
export async function attachWarningToTimeline(
  hazardEventId: string,
  warningId: string,
  headline: string,
): Promise<void> {
  if (!hazardEventId) return;
  try {
    const eventRef = doc(db, COLLECTION, hazardEventId);
    await updateDoc(eventRef, {
      timeline: arrayUnion({
        id: `timeline-warn-${warningId}`,
        type: 'warning_issued',
        warningId,
        headline,
        timestamp: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Notice attaching warning to timeline:', error);
  }
}

/**
 * Attach a verified ground observation report to the hazard event timeline (UC02 Phase 7.1).
 */
export async function attachReportToTimeline(
  hazardEventId: string,
  reportId: string,
  reportData: {
    referenceNumber?: string;
    observationType?: string;
    locationName?: string;
    district?: string;
    officerName?: string;
    headline?: string;
  },
): Promise<void> {
  if (!hazardEventId) return;
  try {
    const eventRef = doc(db, COLLECTION, hazardEventId);
    await updateDoc(eventRef, {
      timeline: arrayUnion({
        id: `timeline-report-${reportId}`,
        type: 'ground_report_verified',
        reportId,
        referenceNumber: reportData.referenceNumber || '',
        observationType: reportData.observationType || 'hazard_observation',
        locationName: reportData.locationName || '',
        district: reportData.district || '',
        officerName: reportData.officerName || 'DMC Officer',
        headline: reportData.headline || `Ground Report Verified: ${reportData.referenceNumber || reportId}`,
        timestamp: new Date().toISOString(),
      }),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn('Notice attaching ground report to event timeline:', error);
  }
}

