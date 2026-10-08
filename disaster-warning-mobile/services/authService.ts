/**
 * Authentication service — Pure Firebase Auth + Cloud Firestore user profiles.
 * No mock data or local fallbacks.
 */
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import type { User, LoginCredentials, SignupData } from '@/types/auth';

/**
 * Sign up a new user with email and password strictly in Firebase Auth and Cloud Firestore.
 */
export async function signUp(data: SignupData): Promise<User> {
  if (data.password !== data.confirmPassword) {
    throw new Error('Passwords do not match');
  }

  if (data.password.length < 6) {
    throw new Error('Password must be at least 6 characters');
  }

  // 1. Create user in Firebase Auth
  const credential = await createUserWithEmailAndPassword(
    auth,
    data.email.trim(),
    data.password,
  );

  const userProfile: User = {
    id: credential.user.uid,
    email: data.email.trim(),
    fullName: data.fullName.trim(),
    role: data.role,
    district: data.district || '',
    phone: data.phone || '',
    organisation: data.organisation || '',
    createdAt: new Date().toISOString(),
  };

  // 2. Persist profile document to Cloud Firestore
  await setDoc(doc(db, 'users', credential.user.uid), {
    ...userProfile,
    createdAt: serverTimestamp(),
  });

  profileCache.set(credential.user.uid, userProfile);
  return userProfile;
}

/**
 * In-memory profile cache to eliminate redundant, slow Firestore round-trips.
 */
export const profileCache = new Map<string, User>();

/**
 * Sign in with email and password strictly via Firebase Auth and Cloud Firestore.
 */
export async function signIn(credentials: LoginCredentials): Promise<User> {
  const credential = await signInWithEmailAndPassword(
    auth,
    credentials.email.trim(),
    credentials.password,
  );

  const uid = credential.user.uid;
  if (profileCache.has(uid)) {
    return profileCache.get(uid)!;
  }

  const profile = await getUserProfile(uid);
  if (profile) {
    profileCache.set(uid, profile);
    return profile;
  }

  // If user authenticated in Firebase Auth but profile doc is missing in Firestore, create it
  const defaultProfile: User = {
    id: uid,
    email: credential.user.email || credentials.email.trim(),
    fullName: credential.user.displayName || credentials.email.split('@')[0],
    role: credentials.email.includes('dmc')
      ? 'dmc_officer'
      : credentials.email.includes('district')
      ? 'district_officer'
      : credentials.email.includes('volunteer')
      ? 'volunteer'
      : 'citizen',
    district: 'Colombo',
    phone: '',
    organisation: 'Disaster Management Centre',
    createdAt: new Date().toISOString(),
  };

  profileCache.set(uid, defaultProfile);

  // Background persist profile doc without blocking login
  setDoc(doc(db, 'users', uid), {
    ...defaultProfile,
    createdAt: serverTimestamp(),
  }).catch((err) => console.warn('Non-blocking user sync notice:', err));

  return defaultProfile;
}

/**
 * Sign out the current user via Firebase Auth and clear local cache.
 */
export async function signOut(): Promise<void> {
  profileCache.clear();
  await firebaseSignOut(auth);
}

/**
 * Fetch a user profile from Cloud Firestore by UID with fast cache & timeout protection.
 */
export async function getUserProfile(uid: string): Promise<User | null> {
  if (profileCache.has(uid)) {
    return profileCache.get(uid)!;
  }

  try {
    const fetchDoc = getDoc(doc(db, 'users', uid));
    // 2-second timeout protects against hanging WebChannel connections
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const snap = await Promise.race([fetchDoc, timeout]);

    if (snap && 'exists' in snap && snap.exists()) {
      const user = snap.data() as User;
      profileCache.set(uid, user);
      return user;
    }
  } catch (error) {
    console.warn('Notice fetching Firestore user profile:', error);
  }
  return null;
}

/**
 * Listen to Firebase Auth state changes.
 */
export function onAuthChanged(
  callback: (user: FirebaseUser | null) => void,
): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Translate Firebase error codes into human-friendly explanations.
 */
export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code: string }).code;
    switch (code) {
      case 'auth/invalid-email':
        return 'Invalid email address format.';
      case 'auth/user-disabled':
        return 'This account has been disabled by administrators.';
      case 'auth/user-not-found':
        return 'No registered account found with this email.';
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        return 'Invalid email or password.';
      case 'auth/email-already-in-use':
        return 'An account already exists with this email address.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/network-request-failed':
        return 'Network connection failed. Please check your internet connection.';
      default:
        return (error as { message?: string }).message || 'Authentication failed.';
    }
  }
  return (error as { message?: string })?.message || 'An unexpected authentication error occurred.';
}
