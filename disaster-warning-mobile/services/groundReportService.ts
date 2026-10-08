/**
 * Ground Report Service — Pure Cloud Firestore Implementation.
 * Implements UC02: Submit and Verify Ground Report business workflows.
 * No mock data or memory-only fallbacks.
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
import type {
  GroundReport,
  CreateGroundReportData,
  GroundReportFilter,
  GroundReportStats,
  ReportStatus,
} from '@/types/groundReport';
import type { UserRole } from '@/types/auth';

const COLLECTION = 'groundReports';
const HAZARD_EVENTS_COLLECTION = 'hazardEvents';

/**
 * Maps a Firestore document snapshot to a GroundReport model.
 */
function mapReportDoc(docSnap: QueryDocumentSnapshot<DocumentData>): GroundReport {
  const d = docSnap.data();

  // Handle captureTime from Timestamp or string
  let captureTimeIso = new Date().toISOString();
  if (d.captureTime?.toDate) {
    captureTimeIso = d.captureTime.toDate().toISOString();
  } else if (typeof d.captureTime === 'string') {
    captureTimeIso = d.captureTime;
  }

  // Handle createdAt from Timestamp or string
  let createdAtIso = new Date().toISOString();
  if (d.createdAt?.toDate) {
    createdAtIso = d.createdAt.toDate().toISOString();
  } else if (typeof d.createdAt === 'string') {
    createdAtIso = d.createdAt;
  }

  // Handle verificationTimestamp
  let verificationTimestampIso: string | null = null;
  if (d.verificationTimestamp?.toDate) {
    verificationTimestampIso = d.verificationTimestamp.toDate().toISOString();
  } else if (typeof d.verificationTimestamp === 'string') {
    verificationTimestampIso = d.verificationTimestamp;
  }

  return {
    id: docSnap.id,
    referenceNumber: d.referenceNumber || `GR-${docSnap.id.substring(0, 8).toUpperCase()}`,
    observationType: d.observationType || 'other',
    description: d.description || '',
    photoUrl: d.photoUrl || '',
    photoPath: d.photoPath || null,
    location: {
      latitude: d.location?.latitude ?? 6.9271,
      longitude: d.location?.longitude ?? 79.8612,
      altitude: d.location?.altitude ?? null,
      accuracy: d.location?.accuracy ?? null,
    },
    locationName: d.locationName || 'Unknown Location',
    district: d.district || 'Colombo',
    isManualLocation: !!d.isManualLocation,
    captureTime: captureTimeIso,
    submitterId: d.submitterId || '',
    submitterName: d.submitterName || 'Anonymous Submitter',
    submitterRole: (d.submitterRole as UserRole) || 'citizen',
    status: (d.status as ReportStatus) || 'pending_verification',
    hazardEventId: d.hazardEventId || null,
    hazardEventTitle: d.hazardEventTitle || null,
    verifiedBy: d.verifiedBy || null,
    verifiedByName: d.verifiedByName || null,
    verificationDecision: d.verificationDecision || null,
    verificationTimestamp: verificationTimestampIso,
    infoRequestedMessage: d.infoRequestedMessage || null,
    additionalInfo: d.additionalInfo || null,
    createdAt: createdAtIso,
    updatedAt: d.updatedAt?.toDate?.()?.toISOString() || createdAtIso,
  };
}

/**
 * Generate a unique human-readable ground report reference number.
 * Format: GR-YYYYMMDD-XXXX (e.g. GR-20261009-4821)
 * (UC02 Main Flow Step 12)
 */
export function generateReferenceNumber(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `GR-${dateStr}-${randomSuffix}`;
}

/**
 * Submit a new ground report to Cloud Firestore (UC02 Main Flow Steps 8-12).
 * Stores the report as 'pending_verification'.
 */
export async function submitGroundReport(
  data: CreateGroundReportData,
  photoUrl: string,
  photoPath: string | null,
  submitter: {
    id: string;
    fullName: string;
    role: UserRole;
  },
): Promise<{ id: string; referenceNumber: string }> {
  const referenceNumber = generateReferenceNumber();

  const docRef = await addDoc(collection(db, COLLECTION), {
    referenceNumber,
    observationType: data.observationType,
    description: data.description.trim(),
    photoUrl,
    photoPath,
    location: {
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      altitude: data.location.altitude ?? null,
      accuracy: data.location.accuracy ?? null,
    },
    locationName: data.locationName.trim(),
    district: data.district,
    isManualLocation: data.isManualLocation,
    captureTime: data.captureTime,
    submitterId: submitter.id,
    submitterName: submitter.fullName,
    submitterRole: submitter.role,
    status: 'pending_verification' as ReportStatus,
    hazardEventId: null,
    hazardEventTitle: null,
    verifiedBy: null,
    verifiedByName: null,
    verificationDecision: null,
    verificationTimestamp: null,
    infoRequestedMessage: null,
    additionalInfo: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return {
    id: docRef.id,
    referenceNumber,
  };
}

/**
 * Get a specific ground report by ID (UC02 Main Flow Step 14).
 */
export async function getReportById(id: string): Promise<GroundReport | null> {
  const snap = await getDoc(doc(db, COLLECTION, id));
  if (!snap.exists()) return null;
  return mapReportDoc(snap as QueryDocumentSnapshot<DocumentData>);
}

/**
 * Retrieve all reports currently pending verification.
 * Primary verification queue used by DMC Duty Officers (UC02 Main Flow Step 13).
 */
export async function getPendingReports(): Promise<GroundReport[]> {
  const q = query(
    collection(db, COLLECTION),
    where('status', '==', 'pending_verification'),
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapReportDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Retrieve all ground reports submitted by a specific citizen or volunteer.
 */
export async function getMyReports(submitterId: string): Promise<GroundReport[]> {
  const q = query(
    collection(db, COLLECTION),
    where('submitterId', '==', submitterId),
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapReportDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Retrieve all ground reports with optional filtering.
 */
export async function getAllReports(filter?: GroundReportFilter): Promise<GroundReport[]> {
  let q = query(collection(db, COLLECTION));

  if (filter?.status && filter.status !== 'all') {
    q = query(q, where('status', '==', filter.status));
  }
  if (filter?.observationType && filter.observationType !== 'all') {
    q = query(q, where('observationType', '==', filter.observationType));
  }
  if (filter?.district && filter.district !== 'all') {
    q = query(q, where('district', '==', filter.district));
  }
  if (filter?.hazardEventId) {
    q = query(q, where('hazardEventId', '==', filter.hazardEventId));
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapReportDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Verify a report by DMC Duty Officer (UC02 Main Flow Steps 17-18, 20).
 * Changes status to 'verified', links report to hazard event as supporting evidence.
 */
export async function verifyReport(
  reportId: string,
  officer: {
    uid: string;
    name: string;
  },
  payload: {
    hazardEventId?: string | null;
    hazardEventTitle?: string | null;
    decisionNote?: string;
  },
): Promise<void> {
  const reportRef = doc(db, COLLECTION, reportId);

  await updateDoc(reportRef, {
    status: 'verified' as ReportStatus,
    hazardEventId: payload.hazardEventId || null,
    hazardEventTitle: payload.hazardEventTitle || null,
    verifiedBy: officer.uid,
    verifiedByName: officer.name,
    verificationDecision: payload.decisionNote?.trim() || 'Verified by DMC Duty Officer.',
    verificationTimestamp: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // If linked to an open hazard event, append report note into the event timeline
  if (payload.hazardEventId) {
    try {
      const eventRef = doc(db, HAZARD_EVENTS_COLLECTION, payload.hazardEventId);
      await updateDoc(eventRef, {
        timeline: arrayUnion({
          id: `timeline-report-${reportId}`,
          type: 'ground_report_verified',
          reportId,
          headline: `Ground Report Verified: ${payload.hazardEventTitle || 'Observation'}`,
          officerName: officer.name,
          timestamp: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Notice linking ground report to event timeline:', err);
    }
  }
}

/**
 * Reject a report by DMC Duty Officer (UC02 Main Flow Steps 17, 19, 20).
 * Changes status to 'rejected' and logs officer rationale.
 * Does NOT influence official warning level.
 */
export async function rejectReport(
  reportId: string,
  officer: {
    uid: string;
    name: string;
  },
  reason: string,
): Promise<void> {
  const reportRef = doc(db, COLLECTION, reportId);

  await updateDoc(reportRef, {
    status: 'rejected' as ReportStatus,
    verifiedBy: officer.uid,
    verifiedByName: officer.name,
    verificationDecision: reason.trim(),
    verificationTimestamp: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Request additional information from submitter (UC02 Alternate Flow).
 * Sets status to 'info_requested' with officer instructions.
 */
export async function requestAdditionalInfo(
  reportId: string,
  officer: {
    uid: string;
    name: string;
  },
  message: string,
): Promise<void> {
  const reportRef = doc(db, COLLECTION, reportId);

  await updateDoc(reportRef, {
    status: 'info_requested' as ReportStatus,
    infoRequestedMessage: message.trim(),
    verifiedBy: officer.uid,
    verifiedByName: officer.name,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Submitter provides additional clarification (UC02 Alternate Flow).
 * Returns report to 'pending_verification' queue for re-evaluation.
 */
export async function submitAdditionalInfo(
  reportId: string,
  additionalInfoText: string,
): Promise<void> {
  const reportRef = doc(db, COLLECTION, reportId);

  await updateDoc(reportRef, {
    additionalInfo: additionalInfoText.trim(),
    status: 'pending_verification' as ReportStatus,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Retrieve verified reports linked to a specific hazard event (UC02 Postconditions).
 */
export async function getVerifiedReportsForHazardEvent(
  hazardEventId: string,
): Promise<GroundReport[]> {
  const q = query(
    collection(db, COLLECTION),
    where('hazardEventId', '==', hazardEventId),
    where('status', '==', 'verified'),
  );
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapReportDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Get aggregate counts for all ground report statuses.
 */
export async function getGroundReportStats(): Promise<GroundReportStats> {
  const snapshot = await getDocs(collection(db, COLLECTION));
  const docs = snapshot.docs;

  let pending = 0;
  let verified = 0;
  let rejected = 0;
  let infoRequested = 0;

  for (const docSnap of docs) {
    const s = docSnap.data().status;
    if (s === 'pending_verification') pending++;
    else if (s === 'verified') verified++;
    else if (s === 'rejected') rejected++;
    else if (s === 'info_requested') infoRequested++;
  }

  return {
    total: docs.length,
    pending,
    verified,
    rejected,
    infoRequested,
    offlineQueued: 0,
  };
}
