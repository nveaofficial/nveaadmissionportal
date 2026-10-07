import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import { db, auth } from './config';
import { ensureAuthenticatedUser } from './authService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreUserProfile {
  id: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface FirestoreSavedForm {
  id: string;
  formId?: string;
  userId: string;
  recordNumber: string;
  applicantName?: string;
  answersJson?: string;
  uploadedFilesJson?: string;
  status?: 'draft' | 'submitted' | 'verified';
  submitted?: boolean;
  submittedAt?: string;
  savedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreVerificationRecord {
  id: string;
  userId: string;
  recordNumber: string;
  verificationId: string;
  applicantName?: string;
  interviewSerialNumber?: string;
  verifiedContact?: string;
  verifiedAt: string;
  createdAt?: string;
}

export interface SaveFormDataPayload {
  formId: string;
  recordNumber: string;
  applicantName?: string;
  answers: Record<string, unknown>;
  uploadedFiles?: Record<string, unknown>;
  status?: 'draft' | 'submitted' | 'verified';
  submitted?: boolean;
  submittedAt?: string;
}

/**
 * Creates or updates the user profile document in Firestore upon authentication.
 */
export async function syncUserProfile(user: User): Promise<void> {
  if (!user.uid) return;
  const path = `users/${user.uid}`;
  const userRef = doc(db, 'users', user.uid);
  const now = new Date().toISOString();

  try {
    const existingSnap = await getDoc(userRef);
    if (!existingSnap.exists()) {
      const newProfile: FirestoreUserProfile = {
        id: user.uid,
        email: user.email || 'user@nvea.in',
        displayName: user.displayName || 'Authorized User',
        photoURL: user.photoURL || '',
        createdAt: now,
        lastLoginAt: now,
      };
      await setDoc(userRef, newProfile);
    } else {
      const data = existingSnap.data() as FirestoreUserProfile;
      const updatedProfile: FirestoreUserProfile = {
        id: user.uid,
        email: user.email || data.email || 'user@nvea.in',
        displayName: user.displayName || data.displayName || 'Authorized User',
        photoURL: user.photoURL || data.photoURL || '',
        createdAt: data.createdAt || now,
        lastLoginAt: now,
      };
      await setDoc(userRef, updatedProfile);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
    console.warn('Silent user profile sync notice:', error);
  }
}

/**
 * Saves or updates an admission application in Firestore as the permanent database.
 * Supports flexible parameter order: (formData, userId?) or (userId, formData).
 * Confirms write with Firestore before resolving.
 */
export async function saveFormToFirestore(
  arg1: SaveFormDataPayload | string,
  arg2?: SaveFormDataPayload | string
): Promise<void> {
  const formData: SaveFormDataPayload | undefined =
    typeof arg1 === 'object' && arg1 !== null
      ? (arg1 as SaveFormDataPayload)
      : typeof arg2 === 'object' && arg2 !== null
      ? (arg2 as SaveFormDataPayload)
      : undefined;

  const explicitUserId: string | undefined =
    typeof arg1 === 'string'
      ? arg1
      : typeof arg2 === 'string'
      ? arg2
      : undefined;

  if (!formData || !formData.formId) {
    throw new Error('Valid form data is required for persistent Firestore storage');
  }

  const activeUser = explicitUserId ? null : await ensureAuthenticatedUser();
  const uid = explicitUserId || activeUser?.uid || auth.currentUser?.uid;
  if (!uid) {
    throw new Error('Authentication required for persistent Firestore storage');
  }

  const now = new Date().toISOString();
  const formPath = `forms/${formData.formId}`;
  const userFormPath = `users/${uid}/forms/${formData.formId}`;
  const formRef = doc(db, 'forms', formData.formId);
  const userFormRef = doc(db, 'users', uid, 'forms', formData.formId);

  // Check existing creation time if already saved
  let createdAt = now;
  try {
    const snap = await getDoc(formRef);
    if (snap.exists() && snap.data()?.createdAt) {
      createdAt = String(snap.data().createdAt);
    }
  } catch {
    // proceed with now
  }

  const record: FirestoreSavedForm = {
    id: formData.formId,
    formId: formData.formId,
    userId: uid,
    recordNumber: formData.recordNumber,
    applicantName: formData.applicantName || 'Applicant',
    answersJson: JSON.stringify(formData.answers || {}),
    uploadedFilesJson: JSON.stringify(formData.uploadedFiles || {}),
    status: formData.status || 'draft',
    submitted: Boolean(formData.submitted),
    submittedAt: formData.submittedAt || '',
    savedAt: now,
    createdAt,
    updatedAt: now,
  };

  try {
    await Promise.all([
      setDoc(formRef, record),
      setDoc(userFormRef, record),
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, formPath);
    }
    throw error;
  }
}

/**
 * Loads a specific saved form from Firestore by recordNumber / formId.
 */
export async function loadFormFromFirestore(
  formId: string,
  userId?: string
): Promise<FirestoreSavedForm | null> {
  if (!formId) return null;
  const formPath = `forms/${formId}`;

  try {
    const formRef = doc(db, 'forms', formId);
    const snap = await getDoc(formRef);
    if (snap.exists()) {
      return snap.data() as FirestoreSavedForm;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      handleFirestoreError(error, OperationType.GET, formPath);
    }
  }

  const uid = userId || auth.currentUser?.uid;
  if (uid) {
    const userFormPath = `users/${uid}/forms/${formId}`;
    try {
      const userFormRef = doc(db, 'users', uid, 'forms', formId);
      const snap = await getDoc(userFormRef);
      if (snap.exists()) {
        return snap.data() as FirestoreSavedForm;
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('permission')) {
        handleFirestoreError(error, OperationType.GET, userFormPath);
      }
    }
  }

  return null;
}

/**
 * Loads all saved forms for the authenticated user from Firestore.
 */
export async function loadUserFormsFromFirestore(
  userId?: string
): Promise<FirestoreSavedForm[]> {
  const activeUser = userId ? null : await ensureAuthenticatedUser();
  const uid = userId || activeUser?.uid || auth.currentUser?.uid;
  if (!uid) return [];

  const formsPath = 'forms';
  try {
    const formsCol = collection(db, 'forms');
    const q = query(formsCol, where('userId', '==', uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      return snap.docs.map((d) => d.data() as FirestoreSavedForm);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      handleFirestoreError(error, OperationType.LIST, formsPath);
    }
  }

  const userFormsPath = `users/${uid}/forms`;
  try {
    const userFormsCol = collection(db, 'users', uid, 'forms');
    const snap = await getDocs(userFormsCol);
    return snap.docs.map((d) => d.data() as FirestoreSavedForm);
  } catch (err) {
    if (err instanceof Error && err.message.includes('permission')) {
      handleFirestoreError(err, OperationType.LIST, userFormsPath);
    }
    return [];
  }
}

/**
 * Deletes a saved form from Firestore.
 * Supports flexible parameter order: (formId, userId?) or (userId, formId).
 */
export async function deleteFormFromFirestore(
  arg1: string,
  arg2?: string
): Promise<void> {
  const isArg1Uid = arg1.length > 20 && !arg1.startsWith('NVEA');
  const formId = isArg1Uid && arg2 ? arg2 : arg1;
  const uid = isArg1Uid ? arg1 : arg2 || auth.currentUser?.uid;

  if (!formId) return;

  const formPath = `forms/${formId}`;
  try {
    const promises: Promise<void>[] = [deleteDoc(doc(db, 'forms', formId))];
    if (uid) {
      promises.push(deleteDoc(doc(db, 'users', uid, 'forms', formId)));
    }
    await Promise.allSettled(promises);
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      handleFirestoreError(error, OperationType.DELETE, formPath);
    }
  }
}

export interface SaveVerificationPayload {
  recordNumber: string;
  verificationId: string;
  applicantName?: string;
  interviewSerialNumber?: string;
  verifiedContact?: string;
  verifiedAt: string;
}

/**
 * Saves an official OTP verification certificate record in Firestore under verifications.
 * Supports flexible parameter order: (verData, userId?) or (userId, verData).
 */
export async function saveVerificationToFirestore(
  arg1: SaveVerificationPayload | string,
  arg2?: SaveVerificationPayload | string
): Promise<void> {
  const verData: SaveVerificationPayload | undefined =
    typeof arg1 === 'object' && arg1 !== null
      ? (arg1 as SaveVerificationPayload)
      : typeof arg2 === 'object' && arg2 !== null
      ? (arg2 as SaveVerificationPayload)
      : undefined;

  const explicitUserId: string | undefined =
    typeof arg1 === 'string'
      ? arg1
      : typeof arg2 === 'string'
      ? arg2
      : undefined;

  if (!verData || !verData.verificationId) return;

  const uid =
    explicitUserId ||
    auth.currentUser?.uid ||
    (await ensureAuthenticatedUser())?.uid ||
    'anon';
  const now = new Date().toISOString();

  const record: FirestoreVerificationRecord = {
    id: verData.verificationId,
    userId: uid,
    recordNumber: verData.recordNumber,
    verificationId: verData.verificationId,
    applicantName: verData.applicantName || '',
    interviewSerialNumber: verData.interviewSerialNumber || '',
    verifiedContact: verData.verifiedContact || '',
    verifiedAt: verData.verifiedAt,
    createdAt: now,
  };

  const verPath = `verifications/${verData.verificationId}`;
  try {
    const promises = [setDoc(doc(db, 'verifications', verData.verificationId), record)];
    if (uid && uid !== 'anon') {
      promises.push(setDoc(doc(db, 'users', uid, 'verifications', verData.verificationId), record));
    }
    await Promise.allSettled(promises);
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission')) {
      handleFirestoreError(error, OperationType.WRITE, verPath);
    }
  }
}
