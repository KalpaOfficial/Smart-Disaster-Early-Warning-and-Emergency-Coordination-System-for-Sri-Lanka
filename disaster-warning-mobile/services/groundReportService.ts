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
  serverTimestamp,
  onSnapshot,
  runTransaction,
  arrayUnion,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import type { UploadPhotoResult } from './photoUploadService';
import { auth, db } from './firebase';
import { requireDmcActor } from './workflowAuthorization';
import { validateReportForm } from '@/utils/reportForm';
import type {
  GroundReport,
  CreateGroundReportData,
  GroundReportFilter,
  GroundReportStats,
  ReportStatus,
} from '@/types/groundReport';
import type { UserRole } from '@/types/auth';

const COLLECTION = 'groundReports';

/** Live report summary and verification queue for the DMC dashboard. */
export function subscribeToGroundReports(
  onReports: (reports: GroundReport[]) => void,
  onError: (error: Error) => void
) {
  return onSnapshot(
    collection(db, COLLECTION),
    snapshot => onReports(snapshot.docs.map(mapReportDoc)),
    onError
  );
}

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
    photoUrls:
      Array.isArray(d.photoUrls) && d.photoUrls.length
        ? d.photoUrls
        : d.photoUrl
          ? [d.photoUrl]
          : [],
    photoPaths: Array.isArray(d.photoPaths) ? d.photoPaths : d.photoPath ? [d.photoPath] : [],
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
    updatedAt:
      d.updatedAt?.toDate?.()?.toISOString() ||
      (typeof d.updatedAt === 'string' ? d.updatedAt : createdAtIso),
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
  photos?: UploadPhotoResult[]
): Promise<{ id: string; referenceNumber: string }> {
  // UC02 Phase 7.3: Role-based submission restriction
  if (submitter.role !== 'citizen' && submitter.role !== 'volunteer') {
    throw new Error(
      `Unauthorized: Role '${submitter.role}' cannot submit ground reports. Only citizens and community volunteers can report hazard observations.`
    );
  }

  const errors = validateReportForm(data, true);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  if (!Number.isFinite(Date.parse(data.captureTime)))
    throw new Error('Enter a valid capture time.');
  if (!photoUrl?.trim()) throw new Error('Add a photo of the hazard.');
  const referenceNumber = generateReferenceNumber();
  if ((photos?.length || data.photoUris?.length || 1) > 5)
    throw new Error('A report can include up to 5 photos.');
  if (photos && photos.reduce((size, photo) => size + photo.photoUrl.length, 0) > 750000)
    throw new Error('The photos are too large. Please choose smaller images.');
  // The cover photo is stored again in photoUrls; count both copies against the document limit.
  const safePhotoUrl = photoUrl;
  const evidenceSize =
    safePhotoUrl.length +
    (photos
      ? photos.reduce((size, photo) => size + photo.photoUrl.length, 0)
      : safePhotoUrl.length);
  if (evidenceSize > 900000)
    throw new Error('The photos are too large. Please choose smaller images.');

  const docRef = await addDoc(collection(db, COLLECTION), {
    referenceNumber,
    observationType: data.observationType,
    description: data.description.trim(),
    photoUrl: safePhotoUrl,
    photoUrls: photos?.map(photo => photo.photoUrl) || (safePhotoUrl ? [safePhotoUrl] : []),
    photoPaths: photos?.map(photo => photo.photoPath) || (photoPath ? [photoPath] : []),
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
  const q = query(collection(db, COLLECTION), where('status', '==', 'pending_verification'));
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapReportDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Retrieve all ground reports submitted by a specific citizen or volunteer.
 */
export async function getMyReports(submitterId: string): Promise<GroundReport[]> {
  const q = query(collection(db, COLLECTION), where('submitterId', '==', submitterId));
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
    role?: UserRole;
  },
  payload: {
    hazardEventId?: string | null;
    hazardEventTitle?: string | null;
    decisionNote?: string;
  }
): Promise<void> {
  // UC02 Phase 7.3: Role-based verification restriction
  if (officer.role && officer.role !== 'dmc_officer') {
    throw new Error(
      `Unauthorized: Role '${officer.role}' cannot verify ground reports. Only DMC Duty Officers have verification authority.`
    );
  }

  await requireDmcActor(officer.uid);
  await runTransaction(db, async transaction => {
    const reportRef = doc(db, COLLECTION, reportId);
    const snapshot = await transaction.get(reportRef);
    if (!snapshot.exists()) throw new Error('Report not found.');
    const report = snapshot.data();
    if (!['pending_verification', 'info_requested'].includes(report.status))
      throw new Error('This report has already been reviewed. Refresh to see the latest decision.');
    const eventRef = payload.hazardEventId ? doc(db, 'hazardEvents', payload.hazardEventId) : null;
    const event = eventRef ? await transaction.get(eventRef) : null;
    if (event && (!event.exists() || event.data()?.status !== 'active'))
      throw new Error('Select an active hazard event.');
    transaction.update(reportRef, {
      status: 'verified',
      hazardEventId: payload.hazardEventId || null,
      hazardEventTitle: event?.data()?.title || null,
      verifiedBy: officer.uid,
      verifiedByName: officer.name,
      verificationDecision: payload.decisionNote?.trim() || 'Verified by DMC Duty Officer.',
      verificationTimestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    if (eventRef)
      transaction.update(eventRef, {
        timeline: arrayUnion({
          id: 'timeline-report-' + reportId,
          type: 'ground_report_verified',
          reportId,
          referenceNumber: report.referenceNumber || '',
          observationType: report.observationType || 'other',
          locationName: report.locationName || '',
          district: report.district || '',
          officerName: officer.name,
          headline: 'Ground Report Verified: ' + (report.referenceNumber || reportId),
          timestamp: new Date().toISOString(),
        }),
        updatedAt: serverTimestamp(),
      });
  });
}

/**
 * Retrieve all ground reports associated with a specific hazard event.
 * Useful for reviewing all field observations supporting an active disaster event (UC02 Phase 7.1).
 */
export async function getReportsForHazardEvent(
  hazardEventId: string,
  status: ReportStatus | 'all' = 'verified'
): Promise<GroundReport[]> {
  let q = query(collection(db, COLLECTION), where('hazardEventId', '==', hazardEventId));
  if (status !== 'all') {
    q = query(q, where('status', '==', status));
  }
  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapReportDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Link or unlink an existing ground report to/from a hazard event (UC02 Phase 7.1).
 */
export async function linkReportToHazardEvent(
  reportId: string,
  hazardEventId: string | null,
  _hazardEventTitle: string | null
): Promise<void> {
  await requireDmcActor();
  await runTransaction(db, async transaction => {
    const reportRef = doc(db, COLLECTION, reportId);
    const report = await transaction.get(reportRef);
    if (!report.exists() || report.data().status !== 'verified')
      throw new Error('Only verified reports can be linked to an event.');
    const event = hazardEventId
      ? await transaction.get(doc(db, 'hazardEvents', hazardEventId))
      : null;
    if (event && (!event.exists() || event.data()?.status !== 'active'))
      throw new Error('Select an active hazard event.');
    transaction.update(reportRef, {
      hazardEventId: hazardEventId || null,
      hazardEventTitle: event?.data()?.title || null,
      updatedAt: serverTimestamp(),
    });
  });
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
    role?: UserRole;
  },
  reason: string
): Promise<void> {
  // UC02 Phase 7.3: Role-based rejection restriction
  if (officer.role && officer.role !== 'dmc_officer') {
    throw new Error(
      `Unauthorized: Role '${officer.role}' cannot reject ground reports. Only DMC Duty Officers have verification authority.`
    );
  }

  if (!reason?.trim()) throw new Error('Add a reason before rejecting this report.');
  await requireDmcActor(officer.uid);
  await runTransaction(db, async transaction => {
    const reportRef = doc(db, COLLECTION, reportId);
    const report = await transaction.get(reportRef);
    if (!report.exists()) throw new Error('Report not found.');
    if (!['pending_verification', 'info_requested'].includes(report.data().status))
      throw new Error('This report has already been reviewed. Refresh to see the latest decision.');
    transaction.update(reportRef, {
      status: 'rejected',
      verificationDecision: reason.trim(),
      verifiedBy: officer.uid,
      verifiedByName: officer.name,
      verificationTimestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
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
    role?: UserRole;
  },
  message: string
): Promise<void> {
  // UC02 Phase 7.3: Role-based info request restriction
  if (officer.role && officer.role !== 'dmc_officer') {
    throw new Error(
      `Unauthorized: Role '${officer.role}' cannot request info on ground reports. Only DMC Duty Officers have verification authority.`
    );
  }

  if (!message?.trim()) throw new Error('Write a message explaining what information you need.');
  await requireDmcActor(officer.uid);
  await runTransaction(db, async transaction => {
    const reportRef = doc(db, COLLECTION, reportId);
    const report = await transaction.get(reportRef);
    if (!report.exists()) throw new Error('Report not found.');
    if (!['pending_verification', 'info_requested'].includes(report.data().status))
      throw new Error('This report has already been reviewed. Refresh to see the latest decision.');
    transaction.update(reportRef, {
      status: 'info_requested',
      infoRequestedMessage: message.trim(),
      verifiedBy: officer.uid,
      verifiedByName: officer.name,
      verificationTimestamp: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Submitter provides additional clarification (UC02 Alternate Flow).
 * Returns report to 'pending_verification' queue for re-evaluation.
 */
export async function submitAdditionalInfo(
  reportId: string,
  additionalInfoText: string
): Promise<void> {
  if (!additionalInfoText?.trim()) throw new Error('Enter your clarification before submitting.');
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Sign in as the original submitter to reply.');
  await runTransaction(db, async transaction => {
    const reportRef = doc(db, COLLECTION, reportId);
    const report = await transaction.get(reportRef);
    if (!report.exists()) throw new Error('Report not found.');
    if (report.data().submitterId !== uid)
      throw new Error('Only the original submitter can reply to this report.');
    if (report.data().status !== 'info_requested')
      throw new Error('This report has no outstanding information request.');
    transaction.update(reportRef, {
      additionalInfo: additionalInfoText.trim(),
      status: 'pending_verification',
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Retrieve verified reports linked to a specific hazard event (UC02 Postconditions).
 */
export async function getVerifiedReportsForHazardEvent(
  hazardEventId: string
): Promise<GroundReport[]> {
  const q = query(
    collection(db, COLLECTION),
    where('hazardEventId', '==', hazardEventId),
    where('status', '==', 'verified')
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
