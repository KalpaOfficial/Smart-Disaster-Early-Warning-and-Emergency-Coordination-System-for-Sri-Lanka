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
  updateDoc,
  serverTimestamp,
  onSnapshot,
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
    assignedLocation: d.assignedLocation,
    hazardEventId: d.hazardEventId,
    createdBy: d.createdBy || '',
    createdAt: d.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
    lastStatusUpdate: d.lastStatusUpdate?.toDate?.()?.toISOString(),
  };
}

/**
 * Get all rescue teams from Cloud Firestore, optionally filtered by hazard event.
 */
export async function getTeams(hazardEventId?: string): Promise<RescueTeam[]> {
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
  const items = snapshot.docs.map(mapTeamDoc);
  return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Listen to real-time rescue team updates in Cloud Firestore.
 */
export function onTeamsChanged(
  hazardEventId: string | undefined,
  callback: (teams: RescueTeam[]) => void,
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
    const teams = snapshot.docs.map(mapTeamDoc);
    callback(teams);
  });
}

/**
 * Register a new rescue team in Cloud Firestore (UC03 steps 51–52).
 */
export async function createTeam(
  data: CreateRescueTeamData,
  userId: string,
): Promise<string> {
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...data,
    status: 'available' as TeamStatus,
    createdBy: userId,
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
  hazardEventId: string,
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, teamId), {
    status: 'dispatched' as TeamStatus,
    assignedLocation,
    hazardEventId,
    lastStatusUpdate: serverTimestamp(),
  });
}

/**
 * Update rescue team operational status in Cloud Firestore (UC03 steps 55–56).
 */
export async function updateTeamStatus(
  teamId: string,
  status: TeamStatus,
): Promise<void> {
  const updates: Record<string, unknown> = {
    status,
    lastStatusUpdate: serverTimestamp(),
  };
  if (status === 'completed' || status === 'available') {
    updates.assignedLocation = '';
  }

  await updateDoc(doc(db, COLLECTION, teamId), updates);
}
