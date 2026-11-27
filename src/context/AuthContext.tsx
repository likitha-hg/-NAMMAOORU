import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
} from '../firebase';
import {
  ApprovalStatus,
  DEFAULT_NOTIFICATION_PREFERENCES,
  LanguageOption,
  NotificationPreferences,
  RoleAccessRequest,
  UserProfileRecord,
  UserRole,
} from '../types/civic';

export interface PrivilegedRoleRequestInput {
  requestedRole: UserRole.GOVERNMENT | UserRole.NGO | UserRole.ADMIN;
  organisationName: string;
  departmentId: string;
  organisationId: string;
  justification: string;
}

export interface EmailPrivilegedSignupInput extends PrivilegedRoleRequestInput {
  displayName: string;
  email: string;
  password: string;
  neighbourhood: string;
}

interface AuthContextValue {
  firebaseUser: User | null;
  userProfile: UserProfileRecord | null;
  roleRequest: RoleAccessRequest | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  sessionMessage: string | null;
  clearAuthError: () => void;
  clearSessionMessage: () => void;
  signInWithGoogle: () => Promise<UserProfileRecord | null>;
  signInWithEmail: (email: string, password: string) => Promise<UserProfileRecord | null>;
  registerCitizenWithEmail: (
    displayName: string,
    email: string,
    password: string,
    neighbourhood: string
  ) => Promise<UserProfileRecord | null>;
  registerAndRequestRoleWithEmail: (input: EmailPrivilegedSignupInput) => Promise<void>;
  submitRoleAccessRequest: (input: PrivilegedRoleRequestInput) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  refreshEmailVerification: () => Promise<boolean>;
  updateOwnProfilePreferences: (updates: {
    displayName?: string;
    neighbourhood?: string;
    preferredLanguage?: LanguageOption;
    phoneNumber?: string;
    address?: string;
    notificationPreferences?: NotificationPreferences;
  }) => Promise<void>;
  changeAccountPassword: (newPassword: string) => Promise<void>;
  signOutUser: (reason?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function mapFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code: unknown }).code)
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Email/Password authentication is not yet enabled in this Firebase project. Please sign in with Google, or enable Email/Password in Firebase Console → Authentication → Sign-in method.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials or reset your password.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in instead.';
    case 'auth/weak-password':
      return 'Password is too weak. Please choose a stronger password with at least 8 characters.';
    case 'auth/too-many-requests':
      return 'Too many sign-in attempts. Please wait a few minutes before trying again.';
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before completing authentication.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the sign-in popup. Please allow popups for this site and try again.';
    case 'auth/user-disabled':
      return 'This account has been disabled. Contact a Platform Administrator for assistance.';
    case 'auth/user-token-expired':
    case 'auth/invalid-user-token':
      return 'Your session has expired. Please sign in again.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connection and retry.';
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return 'Authentication failed. Please try again.';
  }
}

function mapDocToUserProfile(uid: string, data: Record<string, unknown>): UserProfileRecord {
  const rawRole = String(data.role ?? UserRole.CITIZEN) as UserRole;
  const role = Object.values(UserRole).includes(rawRole) ? rawRole : UserRole.CITIZEN;
  const rawApproval = String(data.approvalStatus ?? 'approved') as ApprovalStatus;
  const approvalStatus: ApprovalStatus =
    rawApproval === 'approved' || rawApproval === 'pending' || rawApproval === 'rejected'
      ? rawApproval
      : 'approved';
  const rawLang = String(data.preferredLanguage ?? LanguageOption.ENGLISH) as LanguageOption;
  const preferredLanguage = Object.values(LanguageOption).includes(rawLang)
    ? rawLang
    : LanguageOption.ENGLISH;

  const rawPrefs = (data.notificationPreferences ?? {}) as Record<string, unknown>;
  const notificationPreferences: NotificationPreferences = {
    statusUpdates:
      typeof rawPrefs.statusUpdates === 'boolean'
        ? rawPrefs.statusUpdates
        : DEFAULT_NOTIFICATION_PREFERENCES.statusUpdates,
    verificationRequests:
      typeof rawPrefs.verificationRequests === 'boolean'
        ? rawPrefs.verificationRequests
        : DEFAULT_NOTIFICATION_PREFERENCES.verificationRequests,
    communityActivities:
      typeof rawPrefs.communityActivities === 'boolean'
        ? rawPrefs.communityActivities
        : DEFAULT_NOTIFICATION_PREFERENCES.communityActivities,
    departmentProgress:
      typeof rawPrefs.departmentProgress === 'boolean'
        ? rawPrefs.departmentProgress
        : DEFAULT_NOTIFICATION_PREFERENCES.departmentProgress,
  };

  return {
    uid,
    displayName: String(data.displayName ?? 'NAMMAOORU User'),
    email: String(data.email ?? ''),
    phoneNumber: String(data.phoneNumber ?? ''),
    address: String(data.address ?? ''),
    role,
    approvalStatus,
    departmentId: String(data.departmentId ?? ''),
    departmentName: String(data.departmentName ?? ''),
    organisationId: String(data.organisationId ?? ''),
    organisationName: String(data.organisationName ?? ''),
    neighbourhood: String(data.neighbourhood ?? 'Indiranagar'),
    preferredLanguage,
    notificationPreferences,
  };
}

function mapDocToRoleRequest(uid: string, data: Record<string, unknown>): RoleAccessRequest {
  const rawRole = String(data.requestedRole ?? UserRole.GOVERNMENT);
  const requestedRole =
    rawRole === UserRole.NGO || rawRole === UserRole.ADMIN
      ? rawRole
      : UserRole.GOVERNMENT;
  const rawStatus = String(data.status ?? 'pending') as ApprovalStatus;
  const status: ApprovalStatus =
    rawStatus === 'approved' || rawStatus === 'rejected' ? rawStatus : 'pending';

  return {
    uid,
    displayName: String(data.displayName ?? ''),
    email: String(data.email ?? ''),
    requestedRole,
    organisationName: String(data.organisationName ?? ''),
    departmentId: String(data.departmentId ?? ''),
    organisationId: String(data.organisationId ?? ''),
    justification: String(data.justification ?? ''),
    status,
    reviewedBy: String(data.reviewedBy ?? ''),
  };
}

async function ensureUserProfileDocument(
  fbUser: User,
  overrides?: { displayName?: string; neighbourhood?: string }
): Promise<UserProfileRecord> {
  const userRef = doc(db, 'users', fbUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    const existing = mapDocToUserProfile(fbUser.uid, snap.data() as Record<string, unknown>);
    if (
      fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL &&
      fbUser.emailVerified &&
      existing.role === UserRole.ADMIN
    ) {
      const adminRef = doc(db, 'admins', fbUser.uid);
      const adminSnap = await getDoc(adminRef);
      if (!adminSnap.exists()) {
        await setDoc(adminRef, {
          uid: fbUser.uid,
          email: fbUser.email,
          grantedBy: 'bootstrap',
          createdAt: serverTimestamp(),
        });
      }
    }
    return existing;
  }

  const isBootstrappedAdmin =
    fbUser.email === BOOTSTRAPPED_ADMIN_EMAIL && fbUser.emailVerified === true;

  const displayName = (
    overrides?.displayName?.trim() ||
    fbUser.displayName?.trim() ||
    fbUser.email?.split('@')[0] ||
    'Bengaluru Resident'
  ).slice(0, 120);

  const neighbourhood = (overrides?.neighbourhood?.trim() || 'Indiranagar').slice(0, 80);

  // Strictly enforce least-privilege: new non-bootstrap accounts ALWAYS start as Citizen.
  const initialRecord = {
    uid: fbUser.uid,
    displayName,
    email: fbUser.email || '',
    phoneNumber: '',
    address: '',
    role: isBootstrappedAdmin ? UserRole.ADMIN : UserRole.CITIZEN,
    approvalStatus: 'approved' as ApprovalStatus,
    departmentId: '',
    departmentName: '',
    organisationId: '',
    organisationName: isBootstrappedAdmin ? 'NAMMAOORU Platform Administration' : '',
    neighbourhood,
    preferredLanguage: LanguageOption.ENGLISH,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(userRef, initialRecord);

  if (isBootstrappedAdmin) {
    await setDoc(doc(db, 'admins', fbUser.uid), {
      uid: fbUser.uid,
      email: fbUser.email || '',
      grantedBy: 'bootstrap',
      createdAt: serverTimestamp(),
    });
  }

  return {
    uid: initialRecord.uid,
    displayName: initialRecord.displayName,
    email: initialRecord.email,
    phoneNumber: initialRecord.phoneNumber,
    address: initialRecord.address,
    role: initialRecord.role,
    approvalStatus: initialRecord.approvalStatus,
    departmentId: initialRecord.departmentId,
    departmentName: initialRecord.departmentName,
    organisationId: initialRecord.organisationId,
    organisationName: initialRecord.organisationName,
    neighbourhood: initialRecord.neighbourhood,
    preferredLanguage: initialRecord.preferredLanguage,
    notificationPreferences: initialRecord.notificationPreferences,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfileRecord | null>(null);
  const [roleRequest, setRoleRequest] = useState<RoleAccessRequest | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const clearAuthError = useCallback(() => setAuthError(null), []);
  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  useEffect(() => {
    let unsubProfile: (() => void) | null = null;
    let unsubRequest: (() => void) | null = null;

    const cleanupListeners = () => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }
      if (unsubRequest) {
        unsubRequest();
        unsubRequest = null;
      }
    };

    const unsubAuth = onAuthStateChanged(auth, async (fbUser) => {
      cleanupListeners();

      if (!fbUser) {
        setFirebaseUser(null);
        setUserProfile(null);
        setRoleRequest(null);
        setAuthReady(true);
        return;
      }

      try {
        // Verify active session token validity
        await fbUser.getIdTokenResult();
        setFirebaseUser(fbUser);

        const profile = await ensureUserProfileDocument(fbUser);
        setUserProfile(profile);

        const userRef = doc(db, 'users', fbUser.uid);
        unsubProfile = onSnapshot(
          userRef,
          (snap) => {
            if (snap.exists()) {
              setUserProfile(
                mapDocToUserProfile(fbUser.uid, snap.data() as Record<string, unknown>)
              );
            }
          },
          (err) => {
            console.error('Profile listener error:', err);
          }
        );

        const reqRef = doc(db, 'roleRequests', fbUser.uid);
        unsubRequest = onSnapshot(
          reqRef,
          (snap) => {
            if (snap.exists()) {
              setRoleRequest(
                mapDocToRoleRequest(fbUser.uid, snap.data() as Record<string, unknown>)
              );
            } else {
              setRoleRequest(null);
            }
          },
          (err) => {
            console.error('RoleRequest listener error:', err);
          }
        );
      } catch (err) {
        const code =
          typeof err === 'object' && err !== null && 'code' in err
            ? String((err as { code: unknown }).code)
            : '';
        if (code === 'auth/user-token-expired' || code === 'auth/invalid-user-token') {
          await signOut(auth);
          setSessionMessage('Your session expired. Please sign in again to continue.');
        } else {
          setAuthError(mapFirebaseAuthError(err));
        }
        setFirebaseUser(null);
        setUserProfile(null);
        setRoleRequest(null);
      } finally {
        setAuthReady(true);
      }
    });

    return () => {
      cleanupListeners();
      unsubAuth();
    };
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<UserProfileRecord | null> => {
    setAuthBusy(true);
    setAuthError(null);
    setSessionMessage(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      const profile = await ensureUserProfileDocument(cred.user);
      setFirebaseUser(cred.user);
      setUserProfile(profile);
      return profile;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return null;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signInWithEmail = useCallback(
    async (email: string, password: string): Promise<UserProfileRecord | null> => {
      setAuthBusy(true);
      setAuthError(null);
      setSessionMessage(null);
      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const profile = await ensureUserProfileDocument(cred.user);
        setFirebaseUser(cred.user);
        setUserProfile(profile);
        return profile;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
        return null;
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const registerCitizenWithEmail = useCallback(
    async (
      displayName: string,
      email: string,
      password: string,
      neighbourhood: string
    ): Promise<UserProfileRecord | null> => {
      setAuthBusy(true);
      setAuthError(null);
      setSessionMessage(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 120) });
        }
        const profile = await ensureUserProfileDocument(cred.user, {
          displayName,
          neighbourhood,
        });
        try {
          await sendEmailVerification(cred.user);
        } catch (verErr) {
          console.warn('Email verification notice could not be dispatched:', verErr);
        }
        setFirebaseUser(cred.user);
        setUserProfile(profile);
        return profile;
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
        return null;
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const submitRoleAccessRequest = useCallback(
    async (input: PrivilegedRoleRequestInput): Promise<void> => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setAuthError('You must be signed in to submit a role access request.');
        return;
      }
      setAuthBusy(true);
      setAuthError(null);
      try {
        const reqRef = doc(db, 'roleRequests', currentUser.uid);
        const existingSnap = await getDoc(reqRef);
        if (existingSnap.exists()) {
          const existingStatus = String(existingSnap.data().status ?? '');
          if (existingStatus === 'rejected') {
            await deleteDoc(reqRef);
          } else if (existingStatus === 'pending') {
            setAuthError(
              'You already have a pending access request awaiting Platform Administrator review.'
            );
            return;
          } else if (existingStatus === 'approved') {
            setAuthError('Your previous role request has already been approved.');
            return;
          }
        }

        const displayName = (
          userProfile?.displayName ||
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          'NAMMAOORU Applicant'
        ).slice(0, 120);

        await setDoc(reqRef, {
          uid: currentUser.uid,
          displayName,
          email: currentUser.email || '',
          requestedRole: input.requestedRole,
          organisationName: input.organisationName.trim().slice(0, 120),
          departmentId: input.departmentId.trim().slice(0, 80),
          organisationId: input.organisationId.trim().slice(0, 80),
          justification: input.justification.trim().slice(0, 500),
          status: 'pending',
          reviewedBy: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `roleRequests/${currentUser.uid}`);
      } finally {
        setAuthBusy(false);
      }
    },
    [userProfile]
  );

  const registerAndRequestRoleWithEmail = useCallback(
    async (input: EmailPrivilegedSignupInput): Promise<void> => {
      setAuthBusy(true);
      setAuthError(null);
      setSessionMessage(null);
      try {
        const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
        if (input.displayName.trim()) {
          await updateProfile(cred.user, { displayName: input.displayName.trim().slice(0, 120) });
        }
        const profile = await ensureUserProfileDocument(cred.user, {
          displayName: input.displayName,
          neighbourhood: input.neighbourhood,
        });
        setFirebaseUser(cred.user);
        setUserProfile(profile);

        const reqRef = doc(db, 'roleRequests', cred.user.uid);
        await setDoc(reqRef, {
          uid: cred.user.uid,
          displayName: input.displayName.trim().slice(0, 120),
          email: cred.user.email || '',
          requestedRole: input.requestedRole,
          organisationName: input.organisationName.trim().slice(0, 120),
          departmentId: input.departmentId.trim().slice(0, 80),
          organisationId: input.organisationId.trim().slice(0, 80),
          justification: input.justification.trim().slice(0, 500),
          status: 'pending',
          reviewedBy: '',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        try {
          await sendEmailVerification(cred.user);
        } catch (verErr) {
          console.warn('Email verification notice could not be dispatched:', verErr);
        }
      } catch (err) {
        setAuthError(mapFirebaseAuthError(err));
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const sendPasswordReset = useCallback(async (email: string): Promise<void> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err) {
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async (): Promise<void> => {
    if (!auth.currentUser) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await sendEmailVerification(auth.currentUser);
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const refreshEmailVerification = useCallback(async (): Promise<boolean> => {
    if (!auth.currentUser) return false;
    setAuthBusy(true);
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);
      setFirebaseUser(auth.currentUser);
      return auth.currentUser.emailVerified;
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const updateOwnProfilePreferences = useCallback(
    async (updates: {
      displayName?: string;
      neighbourhood?: string;
      preferredLanguage?: LanguageOption;
      phoneNumber?: string;
      address?: string;
      notificationPreferences?: NotificationPreferences;
    }): Promise<void> => {
      const currentUser = auth.currentUser;
      if (!currentUser) return;
      const payload: Record<string, unknown> = {
        updatedAt: serverTimestamp(),
      };
      if (updates.displayName && updates.displayName.trim().length > 0) {
        payload.displayName = updates.displayName.trim().slice(0, 120);
      }
      if (updates.neighbourhood && updates.neighbourhood.trim().length > 0) {
        payload.neighbourhood = updates.neighbourhood.trim().slice(0, 80);
      }
      if (updates.preferredLanguage) {
        payload.preferredLanguage = updates.preferredLanguage;
      }
      if (typeof updates.phoneNumber === 'string') {
        payload.phoneNumber = updates.phoneNumber.trim().slice(0, 25);
      }
      if (typeof updates.address === 'string') {
        payload.address = updates.address.trim().slice(0, 240);
      }
      if (updates.notificationPreferences) {
        payload.notificationPreferences = {
          statusUpdates: Boolean(updates.notificationPreferences.statusUpdates),
          verificationRequests: Boolean(updates.notificationPreferences.verificationRequests),
          communityActivities: Boolean(updates.notificationPreferences.communityActivities),
          departmentProgress: Boolean(updates.notificationPreferences.departmentProgress),
        };
      }
      try {
        await updateDoc(doc(db, 'users', currentUser.uid), payload);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${currentUser.uid}`);
      }
    },
    []
  );

  const changeAccountPassword = useCallback(async (newPassword: string): Promise<void> => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('You must be signed in to change your password.');
    }
    if (newPassword.length < 8) {
      throw new Error('Please choose a new password with at least 8 characters.');
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      await updatePassword(currentUser, newPassword);
    } catch (err) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      if (code === 'auth/requires-recent-login') {
        throw new Error(
          'For your security, please sign out and sign in again (or use the password reset email option) before changing your password.'
        );
      }
      const msg = mapFirebaseAuthError(err);
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const signOutUser = useCallback(async (reason?: string): Promise<void> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signOut(auth);
      setFirebaseUser(null);
      setUserProfile(null);
      setRoleRequest(null);
      if (reason) {
        setSessionMessage(reason);
      }
    } catch (err) {
      setAuthError(mapFirebaseAuthError(err));
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      userProfile,
      roleRequest,
      authReady,
      authBusy,
      authError,
      sessionMessage,
      clearAuthError,
      clearSessionMessage,
      signInWithGoogle,
      signInWithEmail,
      registerCitizenWithEmail,
      registerAndRequestRoleWithEmail,
      submitRoleAccessRequest,
      sendPasswordReset,
      resendVerificationEmail,
      refreshEmailVerification,
      updateOwnProfilePreferences,
      changeAccountPassword,
      signOutUser,
    }),
    [
      firebaseUser,
      userProfile,
      roleRequest,
      authReady,
      authBusy,
      authError,
      sessionMessage,
      clearAuthError,
      clearSessionMessage,
      signInWithGoogle,
      signInWithEmail,
      registerCitizenWithEmail,
      registerAndRequestRoleWithEmail,
      submitRoleAccessRequest,
      sendPasswordReset,
      resendVerificationEmail,
      refreshEmailVerification,
      updateOwnProfilePreferences,
      changeAccountPassword,
      signOutUser,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
