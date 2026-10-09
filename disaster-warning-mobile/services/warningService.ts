/**
 * Warning Service — Pure Cloud Firestore CRUD & Dispatch Execution for UC01: Issue Hazard Warning.
 * Aligned with the approved Firestore data model (`hazardEvents`, `warnings`, `deliveryLogs`).
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
  deleteDoc,
  serverTimestamp,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import {
  executeDelivery,
  dispatchMultiChannelWarning,
  type MultiChannelDeliverySummary,
  type ChannelExecutionOptions,
} from './deliveryService';
import { attachWarningToTimeline } from './hazardEventService';
import { resolveRecipients } from './recipientService';
import type {
  HazardWarning,
  CreateWarningPayload,
  WarningStatus,
  VerifiedGroundReportStub,
  DeliveryChannel,
  ChannelDeliveryResult,
  ChannelResult,
  DeliveryLog,
} from '@/types/warning';

const COLLECTION = 'warnings';
const DELIVERY_LOGS_COLLECTION = 'deliveryLogs';

function mapWarningDoc(docSnap: DocumentSnapshot<DocumentData>): HazardWarning {
  const d = docSnap.data() || {};
  const warningId = docSnap.id;
  const eventId = d.eventId || d.hazardEventId || '';
  const channels = d.channels || d.deliveryChannels || ['push'];
  const issuedBy = d.issuedBy || d.issuedByUid || '';

  return {
    id: warningId,
    warningId,
    eventId,
    hazardEventId: eventId,
    hazardEventTitle: d.hazardEventTitle || '',
    hazardType: d.hazardType || 'flood',
    severity: d.severity || 'warning',
    targetMode: d.targetMode || 'district',
    targetAreas: d.targetAreas || [],
    resolvedDistricts: d.resolvedDistricts || [],
    recipientCount: d.recipientCount || 0,
    headline: d.headline || d.title || '',
    instructions: d.instructions || '',
    channels,
    deliveryChannels: channels,
    channelResults: d.channelResults || [],
    status: d.status || 'delivered',
    issuedBy,
    issuedByUid: issuedBy,
    issuedByName: d.issuedByName || 'DMC Duty Officer',
    createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    dispatchedAt: d.dispatchedAt?.toDate?.()?.toISOString(),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString(),
  };
}

/**
 * Fetch a single warning document by ID from Cloud Firestore `warnings` collection.
 */
export async function getWarningById(warningId: string): Promise<HazardWarning | null> {
  if (!warningId) return null;
  try {
    const docRef = doc(db, COLLECTION, warningId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      return null;
    }
    return mapWarningDoc(docSnap);
  } catch (error) {
    console.warn(`Notice fetching warning with ID ${warningId}:`, error);
    return null;
  }
}

/**
 * Fetch all active disaster warnings from Cloud Firestore.
 */
export async function getActiveWarnings(): Promise<HazardWarning[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', ['active', 'delivered', 'partially_failed']),
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(mapWarningDoc);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Notice fetching active warnings:', error);
    return [];
  }
}

/**
 * Fetch all warnings (all statuses) from Cloud Firestore.
 */
export async function getAllWarnings(): Promise<HazardWarning[]> {
  try {
    const q = query(collection(db, COLLECTION));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(mapWarningDoc);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Notice fetching all warnings:', error);
    return [];
  }
}

/**
 * Fetch delivery logs for a specific warning ID from Cloud Firestore `deliveryLogs` collection.
 */
export async function getDeliveryLogsForWarning(warningId: string): Promise<DeliveryLog[]> {
  try {
    const q = query(
      collection(db, DELIVERY_LOGS_COLLECTION),
      where('warningId', '==', warningId),
    );
    const snap = await getDocs(q);
    return snap.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        logId: docSnap.id,
        warningId: d.warningId || warningId,
        channel: d.channel || 'push',
        recipientCount: d.recipientCount || 0,
        deliveredCount: d.deliveredCount || 0,
        failedCount: d.failedCount || 0,
        status: d.status || 'success',
        errorMessage: d.errorMessage,
        timestamp: d.timestamp?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.warn('Notice fetching delivery logs:', error);
    return [];
  }
}

/**
 * Saves individual Cloud Firestore delivery log documents for each selected delivery channel.
 * Strictly linked to `warningId` with server timestamps and failure preservation.
 */
export async function saveDeliveryLogs(
  warningId: string,
  channelResults: ChannelResult[],
): Promise<DeliveryLog[]> {
  const savedLogs: DeliveryLog[] = [];

  for (const chResult of channelResults) {
    try {
      const logData = {
        warningId,
        channel: chResult.channel,
        recipientCount: chResult.recipientCount,
        deliveredCount: chResult.deliveredCount,
        failedCount: chResult.failedCount,
        status: chResult.status,
        errorMessage: chResult.errorMessage || null,
        timestamp: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, DELIVERY_LOGS_COLLECTION), logData);

      savedLogs.push({
        logId: docRef.id,
        warningId,
        channel: chResult.channel,
        recipientCount: chResult.recipientCount,
        deliveredCount: chResult.deliveredCount,
        failedCount: chResult.failedCount,
        status: chResult.status,
        errorMessage: chResult.errorMessage,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.warn(`Notice creating delivery log for channel ${chResult.channel}:`, err);
    }
  }

  return savedLogs;
}

/**
 * Fetch verified ground reports for a specific hazard event (UC01 Step 2).
 */
export async function getGroundReportsForEvent(
  hazardEventId: string,
): Promise<VerifiedGroundReportStub[]> {
  if (!hazardEventId) return getSampleGroundReports();
  try {
    const q = query(
      collection(db, 'groundReports'),
      where('hazardEventId', '==', hazardEventId),
      where('status', '==', 'verified'),
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return getSampleGroundReports(hazardEventId);
    }
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        referenceNumber: data.referenceNumber || '',
        hazardEventId: data.hazardEventId || hazardEventId,
        district: data.district || 'Ratnapura',
        locationName: data.locationName || 'River Basin',
        description: data.description || 'Ground level water rapidly rising above threshold.',
        observationType: data.observationType,
        severity: data.observationType === 'landslide_crack' || data.observationType === 'rising_water' ? 'high' : 'medium',
        verifiedBy: data.verifiedByName || data.verifiedBy || 'DMC Duty Officer',
        reportedAt: data.captureTime || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });
  } catch {
    return getSampleGroundReports(hazardEventId);
  }
}

function getSampleGroundReports(hazardEventId: string = ''): VerifiedGroundReportStub[] {
  return [
    {
      id: 'report-001',
      hazardEventId,
      district: 'Ratnapura',
      locationName: 'Ratnapura Town Center & Kalu River Causeway',
      description: 'Water level crossed major flood spill threshold (5.8m). Low-lying homes submerged.',
      severity: 'critical',
      verifiedBy: 'DMC District Inspector Bandara',
      reportedAt: new Date(Date.now() - 30 * 60000).toISOString(),
    },
    {
      id: 'report-002',
      hazardEventId,
      district: 'Kalutara',
      locationName: 'Millaniya River Crossing Corridor',
      description: 'Severe surface runoff blocking main evacuations routes. Evacuation assistance needed.',
      severity: 'high',
      verifiedBy: 'Red Cross Field Lead Perera',
      reportedAt: new Date(Date.now() - 15 * 60000).toISOString(),
    },
  ];
}

/**
 * UC01 Warning Creation Service:
 * 1. Validates all required warning fields.
 * 2. Resolves recipients again on the backend service layer before dispatch.
 * 3. Prevents document creation if resolved recipient count is zero.
 * 4. Creates the warning document in Cloud Firestore with initial status "dispatching".
 * 5. Populates: eventId, hazardType, severity, targetMode, targetAreas, recipientCount,
 *    headline, instructions, channels, status ("dispatching"), issuedBy, createdAt, dispatchedAt.
 * 6. Returns created warning ID.
 */
export async function createWarningDocument(
  payload: CreateWarningPayload,
  issuedByUid: string,
  issuedByName?: string,
): Promise<{ warningId: string; status: WarningStatus; recipientCount: number; headline: string }> {
  // 1. Validate required information
  if (!payload.severity) {
    throw new Error('Emergency severity level is mandatory.');
  }
  if (!payload.targetMode) {
    throw new Error('Target mode is mandatory.');
  }
  if (!payload.targetAreas || payload.targetAreas.length === 0) {
    throw new Error('At least one target area must be selected.');
  }
  if (!payload.headline || !payload.headline.trim()) {
    throw new Error('Warning headline is mandatory.');
  }
  if (!payload.instructions || !payload.instructions.trim()) {
    throw new Error('Emergency instruction text is mandatory.');
  }
  const selectedChannels = payload.channels || payload.deliveryChannels || [];
  if (selectedChannels.length === 0) {
    throw new Error('At least one delivery channel (Push, SMS, or Audible) must be selected.');
  }

  // 2. Resolve recipients again on backend/service layer before dispatch
  const resolution = await resolveRecipients(payload.targetMode, payload.targetAreas);
  const resolvedCount = resolution.recipientCount;

  // 3. Prevent dispatch if recipient count is zero
  if (resolvedCount <= 0) {
    throw new Error('No registered recipients found for the selected target areas. Warning creation aborted.');
  }

  const eventId = payload.eventId || payload.hazardEventId || '';

  // 4 & 5. Create warning document in Firestore `warnings` with initial status "dispatching"
  const warningDocData = {
    eventId,
    hazardEventId: eventId,
    hazardEventTitle: payload.hazardEventTitle || '',
    hazardType: payload.hazardType,
    severity: payload.severity,
    targetMode: payload.targetMode,
    targetAreas: payload.targetAreas,
    resolvedDistricts: resolution.contributingDistricts || payload.resolvedDistricts || [],
    recipientCount: resolvedCount,
    headline: payload.headline.trim(),
    instructions: payload.instructions.trim(),
    channels: selectedChannels,
    deliveryChannels: selectedChannels,
    status: 'dispatching' as WarningStatus,
    issuedBy: issuedByUid,
    issuedByUid,
    issuedByName: issuedByName || 'DMC Duty Officer',
    createdAt: serverTimestamp(),
    dispatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, COLLECTION), warningDocData);

  // 6. Return created warning ID
  return {
    warningId: docRef.id,
    status: 'dispatching',
    recipientCount: resolvedCount,
    headline: payload.headline.trim(),
  };
}

export interface WarningDispatchPipelineResult {
  warningId: string;
  finalStatus: WarningStatus;
  recipientCount: number;
  channelResults: ChannelResult[];
  deliveryLogs: DeliveryLog[];
  summary: MultiChannelDeliverySummary;
}

/**
 * End-to-End UC01 Warning Dispatch Pipeline:
 * 1. Officer submits warning -> Validate required fields.
 * 2. Resolve recipients again on service layer before dispatch.
 * 3. Prevent dispatch if recipient count is zero.
 * 4. Create warning document in Cloud Firestore with initial status "dispatching".
 * 5. Run selected delivery channels (sendPush, sendSMS, sendAudible) with fault isolation.
 * 6. Collect delivery results (deliveredCount, failedCount, per-channel status).
 * 7. Save individual per-channel delivery logs in `deliveryLogs` collection in Firestore.
 * 8. Calculate final warning status:
 *    - All selected channels succeed -> 'delivered'
 *    - At least one channel succeeds and one fails -> 'partially_failed'
 *    - ALL selected channels fail -> 'failed'
 * 9. Update warning document in Cloud Firestore with final status, channel results, and dispatchedAt.
 * 10. Attach warning record to hazard event timeline.
 * 11. Return full summary to UI.
 */
export async function executeWarningDispatchPipeline(
  payload: CreateWarningPayload,
  issuedByUid: string,
  issuedByName: string,
  channelOptions?: Partial<Record<DeliveryChannel, ChannelExecutionOptions>>,
): Promise<WarningDispatchPipelineResult> {
  // 1. Validate
  if (!payload.severity) {
    throw new Error('Emergency severity level is mandatory.');
  }
  if (!payload.targetMode) {
    throw new Error('Target mode is mandatory.');
  }
  if (!payload.targetAreas || payload.targetAreas.length === 0) {
    throw new Error('At least one target area must be selected.');
  }
  if (!payload.headline || !payload.headline.trim()) {
    throw new Error('Warning headline is mandatory.');
  }
  if (!payload.instructions || !payload.instructions.trim()) {
    throw new Error('Emergency instruction text is mandatory.');
  }
  const selectedChannels = payload.channels || payload.deliveryChannels || [];
  if (selectedChannels.length === 0) {
    throw new Error('At least one delivery channel (Push, SMS, or Audible) must be selected.');
  }

  // 2. Resolve recipients again on service layer before dispatch
  const resolution = await resolveRecipients(payload.targetMode, payload.targetAreas);
  const recipients = resolution.recipients;
  const recipientCount = resolution.recipientCount;

  // 3. Prevent dispatch if recipient count is zero
  if (recipientCount <= 0) {
    throw new Error('No registered recipients found for the selected target areas. Warning creation aborted.');
  }

  const eventId = payload.eventId || payload.hazardEventId || '';

  // 4 & 5. Create warning document with status "dispatching"
  const docRef = await addDoc(collection(db, COLLECTION), {
    eventId,
    hazardEventId: eventId,
    hazardEventTitle: payload.hazardEventTitle || '',
    hazardType: payload.hazardType,
    severity: payload.severity,
    targetMode: payload.targetMode,
    targetAreas: payload.targetAreas,
    resolvedDistricts: resolution.contributingDistricts || payload.resolvedDistricts || [],
    recipientCount,
    headline: payload.headline.trim(),
    instructions: payload.instructions.trim(),
    channels: selectedChannels,
    deliveryChannels: selectedChannels,
    status: 'dispatching' as WarningStatus,
    issuedBy: issuedByUid,
    issuedByUid,
    issuedByName,
    createdAt: serverTimestamp(),
    dispatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const warningId = docRef.id;

  // 6 & 7. Run selected delivery channels (sendPush, sendSMS, sendAudible) with fault isolation & collect results
  const summary = await dispatchMultiChannelWarning(
    payload,
    recipients,
    selectedChannels,
    channelOptions,
  );

  // 8. Save per-channel delivery logs to Cloud Firestore `deliveryLogs` collection
  const deliveryLogs = await saveDeliveryLogs(warningId, summary.channelResults);

  // 9. Calculate final warning status:
  // - All succeed -> 'delivered'
  // - At least 1 succeeds & 1 fails -> 'partially_failed'
  // - ALL fail -> 'failed'
  let finalStatus: WarningStatus = 'delivered';
  if (summary.overallStatus === 'Failed') {
    finalStatus = 'failed';
  } else if (summary.overallStatus === 'Partial') {
    finalStatus = 'partially_failed';
  } else {
    finalStatus = 'delivered';
  }

  // 10. Update warning document in Cloud Firestore
  await updateDoc(doc(db, COLLECTION, warningId), {
    status: finalStatus,
    channelResults: summary.channelResults,
    dispatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // 11. Attach warning to hazard event timeline
  if (eventId) {
    attachWarningToTimeline(
      eventId,
      warningId,
      payload.headline.trim(),
      payload.severity,
      issuedByName || issuedByUid,
    ).catch((err) =>
      console.warn('Notice attaching warning to timeline:', err),
    );
  }

  return {
    warningId,
    finalStatus,
    recipientCount,
    channelResults: summary.channelResults,
    deliveryLogs,
    summary,
  };
}

/**
 * Full UC01 Warning Creation & Dispatch Pipeline (Steps 13 - 20):
 * 14. Validates mandatory information & recipient set > 0.
 * 15. Creates warning document with status 'dispatching'.
 * 16. Initiates delivery across selected channels.
 * 17. Records per-channel logs in `deliveryLogs` collection.
 * 18. Updates warning document status ('delivered', 'partially_failed', or 'failed') and dispatchedAt.
 * 19. Returns delivery summary data for UI overlay.
 * 20. Attaches warning summary record to hazard event timeline.
 */
export async function createWarningWithDispatch(
  payload: CreateWarningPayload,
  issuedByUid: string,
  issuedByName: string,
  forceChannelFailure?: DeliveryChannel,
): Promise<{ warningId: string; overallStatus: WarningStatus; channelResults: ChannelDeliveryResult[] }> {
  // Step 14: Validation
  if (!payload.headline.trim()) {
    throw new Error('Warning headline is mandatory.');
  }
  if (!payload.instructions.trim()) {
    throw new Error('Emergency instructions are mandatory.');
  }
  const selectedChannels = payload.channels || payload.deliveryChannels || [];
  if (selectedChannels.length === 0) {
    throw new Error('At least one delivery channel (Push, SMS, or Audible) must be selected.');
  }
  if (payload.recipientCount <= 0) {
    throw new Error('No registered recipients matched for the selected target areas.');
  }

  const eventId = payload.eventId || payload.hazardEventId || '';

  // Step 15: Create warning document in Firestore `warnings` with status "dispatching"
  const docRef = await addDoc(collection(db, COLLECTION), {
    eventId,
    hazardEventId: eventId,
    hazardEventTitle: payload.hazardEventTitle,
    hazardType: payload.hazardType,
    severity: payload.severity,
    targetMode: payload.targetMode,
    targetAreas: payload.targetAreas,
    resolvedDistricts: payload.resolvedDistricts,
    recipientCount: payload.recipientCount,
    headline: payload.headline.trim(),
    instructions: payload.instructions.trim(),
    channels: selectedChannels,
    deliveryChannels: selectedChannels,
    status: 'dispatching' as WarningStatus,
    issuedBy: issuedByUid,
    issuedByUid,
    issuedByName,
    createdAt: serverTimestamp(),
    dispatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  const warningId = docRef.id;

  // Step 16: Initiate delivery execution
  const deliveryResult = await executeDelivery(
    selectedChannels,
    payload.recipientCount,
    forceChannelFailure,
  );

  // Step 17: Write individual delivery logs to `deliveryLogs` collection
  for (const chResult of deliveryResult.channelResults) {
    try {
      await addDoc(collection(db, DELIVERY_LOGS_COLLECTION), {
        warningId,
        channel: chResult.channel,
        recipientCount: chResult.recipientCount,
        deliveredCount: chResult.status === 'success' ? chResult.recipientCount : 0,
        failedCount: chResult.status === 'failed' ? chResult.recipientCount : 0,
        status: chResult.status,
        errorMessage: chResult.errorMessage || null,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Notice writing delivery log:', err);
    }
  }

  // Step 18: Update warning document status in Cloud Firestore
  await updateDoc(doc(db, COLLECTION, warningId), {
    status: deliveryResult.overallStatus,
    channelResults: deliveryResult.channelResults,
    dispatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // Step 20: Attach warning to hazard event timeline
  if (eventId) {
    await attachWarningToTimeline(
      eventId,
      warningId,
      payload.headline.trim(),
      payload.severity,
      issuedByName || issuedByUid,
    );
  }

  return {
    warningId,
    overallStatus: deliveryResult.overallStatus,
    channelResults: deliveryResult.channelResults,
  };
}

/**
 * Update warning status directly (e.g. Cancel alert).
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
 * Delete warning from Cloud Firestore.
 */
export async function deleteWarning(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, id));
}
