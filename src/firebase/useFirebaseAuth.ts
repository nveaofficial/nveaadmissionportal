import { useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth, googleProvider } from './config';
import { syncUserProfile } from './firestoreService';

export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        try {
          await syncUserProfile(currentUser);
        } catch {
          // ignore profile sync failure
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<User | null> => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      await syncUserProfile(result.user);
      return result.user;
    } catch (err: unknown) {
      console.error('Google Sign-in failed:', err);
      const msg =
        err instanceof Error ? err.message : 'Google sign-in failed. Please try again.';
      setAuthError(msg);
      return null;
    }
  };

  const signOutUser = async (): Promise<void> => {
    setAuthError(null);
    try {
      await signOut(auth);
      setUser(null);
    } catch (err: unknown) {
      console.error('Sign-out failed:', err);
      const msg = err instanceof Error ? err.message : 'Sign out failed.';
      setAuthError(msg);
    }
  };

  return {
    user,
    loading,
    authError,
    signInWithGoogle,
    signOutUser,
  };
}
