import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

export const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId,
  measurementId: firebaseConfigJson.measurementId,
};

// Initialize Firebase App
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth & Google Auth Provider
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// Initialize Firestore (pointing to configured databaseId)
const dbId =
  firebaseConfigJson.firestoreDatabaseId &&
  firebaseConfigJson.firestoreDatabaseId !== '(default)'
    ? firebaseConfigJson.firestoreDatabaseId
    : undefined;

export const db = dbId ? getFirestore(app, dbId) : getFirestore(app);

// Test connection on boot per Firebase guidelines
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline. Verify your network or Firebase configuration.');
    }
  }
}

// Run connection test non-blocking
testConnection().catch(() => {});
