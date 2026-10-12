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
  onSnapshot,
  runTransaction,
  arrayUnion,
  type DocumentData,
  type DocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import { requireDmcActor } from './workflowAuthorization';
import { normalizeWarning } from '@/utils/warningValidation';
import {
  dispatchMultiChannelWarning,
  type MultiChannelDeliverySummary,
  type ChannelExecutionOptions,
} from './deliveryService';
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

/** Read-only live feed of issued warnings for community accounts. */
export function subscribeToActiveWarnings(
  onWarnings: (warnings: HazardWarning[]) => void,
  onError: (error: Error) => void
) {
  return onSnapshot(
    query(
      collection(db, COLLECTION),
      where('status', 'in', ['active', 'delivered', 'partially_failed'])
    ),
    snapshot =>
      onWarnings(
        snapshot.docs
          .map(mapWarningDoc)
          .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
      ),
    onError
  );
}

function dateIso(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  return (value as { toDate?: () => Date } | null)?.toDate?.()?.toISOString();
}

async function persistWarning(data: DocumentData, payload: CreateWarningPayload) {
  const ref = doc(collection(db, COLLECTION));
  await runTransaction(db, async transaction => {
    const event = await transaction.get(doc(db, 'hazardEvents', payload.eventId));
    if (!event.exists() || event.data().status !== 'active')
      throw new Error('Select an active hazard event.');
    if (event.data().hazardType !== payload.hazardType)
      throw new Error('Hazard type must match the selected event.');
    if (payload.previousWarningId) {
      const previous = await transaction.get(doc(db, COLLECTION, payload.previousWarningId));
      if (
        !previous.exists() ||
        (previous.data().eventId || previous.data().hazardEventId) !== payload.eventId
      )
        throw new Error('The previous warning must belong to the same hazard event.');
      if (!['active', 'delivered', 'partially_failed'].includes(previous.data().status))
        throw new Error('Only issued warnings can be followed up.');
      const levels = ['advisory', 'warning', 'evacuation'];
      if (levels.indexOf(payload.severity) < levels.indexOf(previous.data().severity))
        throw new Error('A follow-up warning cannot lower the previous severity.');
    }
    transaction.set(ref, {
      ...data,
      hazardEventTitle: event.data().title || data.hazardEventTitle,
    });
  });
  return ref;
}

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
    previousWarningId: d.previousWarningId || null,
    status: d.status || 'delivered',
    issuedBy,
    issuedByUid: issuedBy,
    issuedByName: d.issuedByName || 'DMC Duty Officer',
    createdAt: dateIso(d.createdAt) || new Date().toISOString(),
    dispatchedAt: dateIso(d.dispatchedAt),
    updatedAt: dateIso(d.updatedAt),
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
export async function getActiveWarnings(options?: {
  throwOnError?: boolean;
}): Promise<HazardWarning[]> {
  try {
    const q = query(
      collection(db, COLLECTION),
      where('status', 'in', ['active', 'delivered', 'partially_failed'])
    );
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(mapWarningDoc);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn('Notice fetching active warnings:', error);
    if (options?.throwOnError) throw error;
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
 * Fetch all warnings associated with a specific hazard event ID.
 */
export async function getWarningsForEvent(eventId: string): Promise<HazardWarning[]> {
  if (!eventId) return [];
  try {
    const q = query(collection(db, COLLECTION), where('eventId', '==', eventId));
    const snapshot = await getDocs(q);
    const items = snapshot.docs.map(mapWarningDoc);
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch (error) {
    console.warn(`Notice fetching warnings for event ${eventId}:`, error);
    return [];
  }
}

/**
 * Fetch delivery logs for a specific warning ID from Cloud Firestore `deliveryLogs` collection.
 */
export async function getDeliveryLogsForWarning(warningId: string): Promise<DeliveryLog[]> {
  try {
    const q = query(collection(db, DELIVERY_LOGS_COLLECTION), where('warningId', '==', warningId));
    const snap = await getDocs(q);
    return snap.docs.map(docSnap => {
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
        timestamp: dateIso(d.timestamp) || new Date().toISOString(),
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
  channelResults: ChannelResult[]
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
  hazardEventId: string
): Promise<VerifiedGroundReportStub[]> {
  if (!hazardEventId) return [];
  try {
    const q = query(
      collection(db, 'groundReports'),
      where('hazardEventId', '==', hazardEventId),
      where('status', '==', 'verified')
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      return [];
    }
    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        referenceNumber: data.referenceNumber || '',
        hazardEventId: data.hazardEventId || hazardEventId,
        district: data.district || 'Ratnapura',
        locationName: data.locationName || 'River Basin',
        description: data.description || 'Ground level water rapidly rising above threshold.',
        observationType: data.observationType,
        severity:
          data.observationType === 'landslide_crack' || data.observationType === 'rising_water'
            ? 'high'
            : 'medium',
        verifiedBy: data.verifiedByName || data.verifiedBy || 'DMC Duty Officer',
        reportedAt:
          data.captureTime || data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.warn('Notice fetching verified ground reports for event:', error);
    return [];
  }
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
  issuedByName?: string
): Promise<{ warningId: string; status: WarningStatus; recipientCount: number; headline: string }> {
  payload = normalizeWarning(payload);
  await requireDmcActor(issuedByUid);
  const selectedChannels = payload.channels;

  // 2. Resolve recipients again on backend/service layer before dispatch
  const resolution = await resolveRecipients(payload.targetMode, payload.targetAreas);
  const resolvedCount = resolution.recipientCount;

  // 3. Prevent dispatch if recipient count is zero
  if (resolvedCount <= 0) {
    throw new Error('No registered recipients found for the selected target area.');
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
    previousWarningId: payload.previousWarningId || null,
    status: 'dispatching' as WarningStatus,
    issuedBy: issuedByUid,
    issuedByUid,
    issuedByName: issuedByName || 'DMC Duty Officer',
    createdAt: serverTimestamp(),
    dispatchedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await persistWarning(warningDocData, payload);

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
  channelOptions?: Partial<Record<DeliveryChannel, ChannelExecutionOptions>>
): Promise<WarningDispatchPipelineResult> {
  payload = normalizeWarning(payload);
  await requireDmcActor(issuedByUid);
  const selectedChannels = payload.channels;

  // 2. Resolve recipients again on service layer before dispatch
  const resolution = await resolveRecipients(payload.targetMode, payload.targetAreas);
  const recipients = resolution.recipients;
  const recipientCount = resolution.recipientCount;

  // 3. Prevent dispatch if recipient count is zero
  if (recipientCount <= 0) {
    throw new Error('No registered recipients found for the selected target area.');
  }

  const eventId = payload.eventId || payload.hazardEventId || '';

  // 4 & 5. Create warning document with status "dispatching"
  const docRef = await persistWarning(
    {
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
      previousWarningId: payload.previousWarningId || null,
      status: 'dispatching' as WarningStatus,
      issuedBy: issuedByUid,
      issuedByUid,
      issuedByName,
      createdAt: serverTimestamp(),
      dispatchedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    payload
  );

  const warningId = docRef.id;

  // 6 & 7. Run selected delivery channels (sendPush, sendSMS, sendAudible) with fault isolation & collect results
  const summary = await dispatchMultiChannelWarning(
    payload,
    recipients,
    selectedChannels,
    channelOptions
  );

  const finalStatus: WarningStatus =
    summary.overallStatus === 'Failed'
      ? 'failed'
      : summary.overallStatus === 'Partial'
        ? 'partially_failed'
        : 'delivered';
  const timestamp = new Date().toISOString();
  const deliveryLogs: DeliveryLog[] = summary.channelResults.map(result => ({
    logId: warningId + '-' + result.channel,
    warningId,
    ...result,
    timestamp,
  }));
  const timelineEntry = {
    id: 'timeline-warn-' + warningId,
    eventId,
    warningId,
    eventType: 'WARNING_ISSUED',
    type: 'WARNING_ISSUED',
    severity: payload.severity,
    headline: payload.headline,
    summary: payload.headline,
    issuedBy: issuedByName || issuedByUid,
    timestamp,
  };
  try {
    // Persist the final outcome, channel audit and timeline together before returning success.
    await runTransaction(db, async transaction => {
      const eventRef = doc(db, 'hazardEvents', eventId);
      const event = await transaction.get(eventRef);
      if (!event.exists()) throw new Error('Hazard event not found.');
      for (const log of deliveryLogs)
        transaction.set(doc(db, DELIVERY_LOGS_COLLECTION, log.logId), {
          ...log,
          errorMessage: log.errorMessage || null,
          timestamp: serverTimestamp(),
        });
      transaction.update(docRef, {
        status: finalStatus,
        channelResults: summary.channelResults,
        dispatchedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      transaction.update(eventRef, {
        timeline: arrayUnion(timelineEntry),
        updatedAt: serverTimestamp(),
      });
      transaction.set(
        doc(db, 'hazardEvents/' + eventId + '/timeline', timelineEntry.id),
        timelineEntry
      );
    });
  } catch {
    throw new Error(
      'Delivery was attempted for warning ' +
        warningId +
        ', but its audit could not be saved. Do not resend; check the warning record before retrying.'
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
  forceChannelFailure?: DeliveryChannel
): Promise<{
  warningId: string;
  overallStatus: WarningStatus;
  channelResults: ChannelDeliveryResult[];
}> {
  const options: Partial<Record<DeliveryChannel, ChannelExecutionOptions>> = {};
  if (forceChannelFailure) options[forceChannelFailure] = { mockFailure: true };
  const result = await executeWarningDispatchPipeline(payload, issuedByUid, issuedByName, options);
  return {
    warningId: result.warningId,
    overallStatus: result.finalStatus,
    channelResults: result.channelResults,
  };
}

/**
 * Update warning status directly (e.g. Cancel alert).
 */
export async function updateWarningStatus(id: string, status: WarningStatus): Promise<void> {
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
