import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function requireDmcActor(expectedUid?: string): Promise<string> {
  const user = auth.currentUser;
  if (!user || (expectedUid && user.uid !== expectedUid))
    throw new Error('Unauthorized: Sign in with the issuing DMC officer account.');
  const profile = await getDoc(doc(db, 'users', user.uid));
  if (!profile.exists() || profile.data().role !== 'dmc_officer')
    throw new Error('Only DMC officers can issue warnings or review ground reports.');
  return user.uid;
}
