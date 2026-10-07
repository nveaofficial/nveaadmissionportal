import {
  User,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './config';
import { syncUserProfile } from './firestoreService';

let authInitPromise: Promise<User | null> | null = null;

/**
 * Silently ensures that a valid Firebase Auth user session exists in the background
 * without prompting the user or modifying any UI.
 * Uses persistent Firebase Auth state (or silent anonymous sign-in if needed).
 */
export async function ensureAuthenticatedUser(): Promise<User | null> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = new Promise<User | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsubscribe();
        try {
          await syncUserProfile(user);
        } catch {
          // ignore
        }
        resolve(user);
      } else {
        // Attempt silent background anonymous auth to secure Firestore rules
        try {
          const anonCred = await signInAnonymously(auth);
          unsubscribe();
          try {
            await syncUserProfile(anonCred.user);
          } catch {
            // ignore
          }
          resolve(anonCred.user);
        } catch (anonErr) {
          // If anonymous sign-in is disabled in console, continue without throwing
          console.warn('Anonymous auth silent fallback:', anonErr);
          unsubscribe();
          resolve(null);
        }
      }
    });
  });

  return authInitPromise;
}

/**
 * Optional Google Sign-In helper if invoked by Google integration features.
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    const res = await signInWithPopup(auth, googleProvider);
    if (res.user) {
      await syncUserProfile(res.user);
    }
    return res.user;
  } catch (err) {
    console.warn('Google sign-in fallback:', err);
    return null;
  }
}

/**
 * Sign out helper.
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
}
