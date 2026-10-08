/**
 * Firebase configuration and initialization.
 * Connected directly to Cloud Firebase and Firestore using project credentials.
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Initialise Firebase (prevent re-initialisation in hot reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialise Auth
const auth: Auth = getAuth(app);

// Initialise Firestore with auto-detect long polling to eliminate 10-30s WebChannel stream stalls
let db: Firestore;
try {
  db = initializeFirestore(app, {
    experimentalAutoDetectLongPolling: true,
  });
} catch {
  db = getFirestore(app);
}

export { app, auth, db };
