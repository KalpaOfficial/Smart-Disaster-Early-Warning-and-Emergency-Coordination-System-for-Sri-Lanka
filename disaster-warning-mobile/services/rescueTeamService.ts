import { requireDistrictOfficer, requireActiveResourceEvent } from './resourceAuthorization';
import { validateRescueTeam, validateTeamTransition } from '@/utils/resourceValidation';
/**
 * Rescue team coordination service — Pure Cloud Firestore CRUD.
 * Implements UC03 rescue team coordination: register, dispatch, update status.
 * No mock data or local fallbacks.
 */
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  addDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  type Unsubscribe,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { RescueTeam, CreateRescueTeamData, TeamStatus } from '@/types/resources';

const COLLECTION = 'rescueTeams';

function mapTeamDoc(docSnap: QueryDocumentSnapshot<DocumentData>): RescueTeam {
  const d = docSnap.data();
  return {
    id: docSnap.id,
    name: d.name || '',
    organisationType: d.organisationType || 'armed_forces',
    organisationName: d.organisationName || '',
    memberCount: d.memberCount || 0,
    specialisation: d.specialisation || 'Water / Flood Rescue',
    status: d.status || 'available',
    district: d.district || '',
    assignedLocation: d.assignedLocation || '',
    hazardEventId: d.hazardEventId || '',
    createdBy: d.createdBy || '',
    createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    lastStatusUpdate: d.lastStatusUpdate?.toDate?.()?.toISOString() || '',
  };
}

/**
 * Get all rescue teams from Cloud Firestore, optionally filtered by hazard event.
 */
export async function getTeams(hazardEventId?: string): Promise<RescueTeam[]> {
  let q;
  if (hazardEventId) {
    q = query(collection(db, COLLECTION), where('hazardEventId', '==', hazardEventId));
  } else {
    q = query(collection(db, COLLECTION));
  }

  const snapshot = await getDocs(q);
  const items = snapshot.docs.map(mapTeamDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Listen to real-time rescue team updates in Cloud Firestore.
 */
export function onTeamsChanged(
  hazardEventId: string | undefined,
  callback: (teams: RescueTeam[]) => void
): Unsubscribe {
  let q;
  if (hazardEventId) {
    q = query(collection(db, COLLECTION), where('hazardEventId', '==', hazardEventId));
  } else {
    q = query(collection(db, COLLECTION));
  }

  return onSnapshot(q, snapshot => {
    const teams = snapshot.docs.map(mapTeamDoc);
    callback(teams);
  });
}

/**
 * Register a new rescue team in Cloud Firestore (UC03 steps 51–52).
 */
export async function createTeam(data: CreateRescueTeamData, _userId: string): Promise<string> {
  const officerId = await requireDistrictOfficer();
  validateRescueTeam(data);
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    status: 'available' as TeamStatus,
    createdBy: officerId,
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

/**
 * Dispatch a team to a response location in Cloud Firestore (UC03 steps 53–54).
 */
export async function dispatchTeam(
  teamId: string,
  assignedLocation: string,
  hazardEventId: string
): Promise<void> {
  await requireDistrictOfficer();
  if (!assignedLocation.trim() || !hazardEventId)
    throw new Error('Choose a response location and an active hazard event.');
  const teamRef = doc(db, COLLECTION, teamId);
  await runTransaction(db, async transaction => {
    const team = await transaction.get(teamRef);
    if (!team.exists()) throw new Error('Rescue team not found.');
    if (team.data().status !== 'available')
      throw new Error('Only available rescue teams can be dispatched.');
    await requireActiveResourceEvent(hazardEventId, team.data().district, ref =>
      transaction.get(ref)
    );
    transaction.update(teamRef, {
      status: 'dispatched' as TeamStatus,
      assignedLocation: assignedLocation.trim(),
      hazardEventId,
      lastStatusUpdate: serverTimestamp(),
    });
  });
}

/**
 * Update rescue team operational status in Cloud Firestore (UC03 steps 55–56).
 */
export async function updateTeamStatus(teamId: string, status: TeamStatus): Promise<void> {
  await requireDistrictOfficer();
  await runTransaction(db, async transaction => {
    const ref = doc(db, COLLECTION, teamId);
    const team = await transaction.get(ref);
    if (!team.exists()) throw new Error('Rescue team not found.');
    validateTeamTransition(team.data().status, status);
    const updates: Record<string, unknown> = { status, lastStatusUpdate: serverTimestamp() };
    if (status === 'completed' || status === 'available' || status === 'unavailable') {
      updates.assignedLocation = '';
      if (status !== 'completed') updates.hazardEventId = '';
    }
    transaction.update(ref, updates);
  });
}
