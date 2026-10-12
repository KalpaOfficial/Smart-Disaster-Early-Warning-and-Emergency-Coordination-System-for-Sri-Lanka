import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { DocumentReference, DocumentSnapshot } from 'firebase/firestore';
export async function requireDistrictOfficer(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in as a District Officer to manage resources.');
  const profile = await getDoc(doc(db, 'users', user.uid));
  if (!profile.exists() || profile.data().role !== 'district_officer')
    throw new Error(
      'Only District Officers can manage shelters, rescue teams and relief supplies.'
    );
  return user.uid;
}

/** Read through the transaction so a concurrent event closure invalidates allocation. */
export async function requireActiveResourceEvent(
  eventId: string,
  district: string,
  read: (ref: DocumentReference) => Promise<DocumentSnapshot> = getDoc
): Promise<void> {
  if (!eventId?.trim()) throw new Error('Select an active hazard event.');
  const event = await read(doc(db, 'hazardEvents', eventId));
  if (!event.exists() || event.data()?.status !== 'active')
    throw new Error('The hazard event is no longer active. Refresh and select another event.');
  if (!event.data()?.affectedDistricts?.includes(district))
    throw new Error(
      `The hazard event does not cover the resource district (${district}). It covers ${event.data()?.affectedDistricts?.join(', ') || 'no districts'}. Select an active event covering ${district}.`
    );
}
