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

export interface EventTimelineEntry {
  id: string;
  eventId: string;
  warningId?: string;
  reportId?: string;
  eventType: string;
  type?: string;
  severity?: string;
  headline: string;
  summary?: string;
  issuedBy?: string;
  timestamp: string;
}

/**
 * Attach an issued warning to the hazard event timeline (UC01 Step 20).
 * Appends entry to `timeline` array on `hazardEvents/{eventId}` document
 * AND writes to `hazardEvents/{eventId}/timeline` subcollection.
 */
export async function attachWarningToTimeline(
  hazardEventId: string,
  warningId: string,
  headline: string,
  severity?: string,
  issuedBy?: string,
): Promise<void> {
  if (!hazardEventId) return;
  try {
    const eventRef = doc(db, COLLECTION, hazardEventId);

    const timelineEntry: EventTimelineEntry = {
      id: `timeline-warn-${warningId}`,
      eventId: hazardEventId,
      warningId,
      eventType: 'WARNING_ISSUED',
      type: 'WARNING_ISSUED',
      severity: severity || 'warning',
      headline: headline.trim(),
      summary: headline.trim(),
      issuedBy: issuedBy || 'DMC Duty Officer',
      timestamp: new Date().toISOString(),
    };

    // 1. Update `timeline` array field on the `hazardEvents` document
    await updateDoc(eventRef, {
      timeline: arrayUnion(timelineEntry),
      updatedAt: serverTimestamp(),
    });

    // 2. Store document in `hazardEvents/{eventId}/timeline` subcollection
    const subcollRef = collection(db, `${COLLECTION}/${hazardEventId}/timeline`);
    await addDoc(subcollRef, timelineEntry);
  } catch (error) {
    console.warn('Notice attaching warning to timeline:', error);
  }
}

/**
 * Fetch timeline entries for a specific hazard event.
 * Retrieves from the `timeline` array on the event document as well as the subcollection.
 */
export async function getEventTimeline(hazardEventId: string): Promise<EventTimelineEntry[]> {
  if (!hazardEventId) return [];
  try {
    const entries: EventTimelineEntry[] = [];

    // Fetch from event document `timeline` array
    const eventSnap = await getDoc(doc(db, COLLECTION, hazardEventId));
    if (eventSnap.exists()) {
      const data = eventSnap.data();
      if (Array.isArray(data.timeline)) {
        entries.push(...data.timeline);
      }
    }

    // Fetch from subcollection
    const subcollRef = collection(db, `${COLLECTION}/${hazardEventId}/timeline`);
    const subSnap = await getDocs(subcollRef);
    subSnap.docs.forEach((d) => {
      const itemData = d.data();
      if (!entries.some((e) => e.id === d.id || e.warningId === itemData.warningId)) {
        entries.push({
          id: d.id,
          eventId: itemData.eventId || hazardEventId,
          warningId: itemData.warningId,
          reportId: itemData.reportId,
          eventType: itemData.eventType || itemData.type || 'WARNING_ISSUED',
          severity: itemData.severity,
          headline: itemData.headline || itemData.summary || '',
          summary: itemData.summary || itemData.headline || '',
          issuedBy: itemData.issuedBy,
          timestamp: itemData.timestamp || new Date().toISOString(),
        });
      }
    });

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  } catch (error) {
    console.warn('Notice fetching event timeline:', error);
    return [];
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

