import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  BENGALURU_NEIGHBOURHOOD_LATLNG,
  BENGALURU_NEIGHBOURHOODS,
  INITIAL_CATEGORIES,
  INITIAL_DEPARTMENTS,
  INITIAL_NGO_ACTIVITIES,
  INITIAL_NGOS,
  INITIAL_NOTIFICATIONS,
  INITIAL_REPORTS,
  INITIAL_USERS,
  ROLE_METADATA,
  SAMPLE_ISSUE_CLUSTERS,
} from '../data/mockData';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  OperationType,
  db,
  handleFirestoreError,
} from '../firebase';
import { useAuth } from './AuthContext';
import {
  ActivityParticipation,
  AdminUserRecord,
  AppPage,
  CivicCategory,
  CivicNotification,
  CivicReport,
  DEFAULT_NOTIFICATION_PREFERENCES,
  DepartmentRecord,
  IssueCluster,
  LanguageOption,
  NgoActivity,
  NgoActivityStatus,
  NgoRecord,
  NotificationPreferences,
  NotificationType,
  ReportMethod,
  ReportPriority,
  ReportStatus,
  RoleAccessRequest,
  StatusHistoryEntry,
  UserRole,
} from '../types/civic';

export type AppViewMode = 'landing' | 'login' | 'app';

interface ToastMessage {
  id: string;
  title: string;
  detail: string;
  variant: 'success' | 'info' | 'warning';
}

export interface NewReportInput {
  title: string;
  description: string;
  category: string;
  neighbourhood: string;
  address: string;
  method: ReportMethod;
  language: LanguageOption;
  priority?: ReportPriority;
  suggestedDepartment?: string;
  aiClassificationNote?: string;
  evidenceSummary: string;
  evidenceImageUrl?: string;
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  placeId?: string;
}

export interface PreviewProfileState {
  displayName: string;
  email: string;
  phoneNumber: string;
  address: string;
  neighbourhood: string;
  preferredLanguage: LanguageOption;
  notificationPreferences: NotificationPreferences;
}

interface CivicContextValue {
  viewMode: AppViewMode;
  selectedLoginRole: UserRole;
  pendingPageAfterLogin: AppPage;
  activeRole: UserRole;
  activePage: AppPage;
  isUnlockedPreview: boolean;
  previewProfile: PreviewProfileState;
  preferredLanguage: LanguageOption;
  preferredNeighbourhood: string;
  largeTextMode: boolean;
  /** Reports visible to the active portal (Firestore when authenticated + session submissions / demo fallback) */
  reports: CivicReport[];
  /** Clearly labelled Bengaluru demonstration sample reports */
  sampleReports: CivicReport[];
  /** Combined user + demonstration reports for Neighbourhood Map & Pulse discovery */
  allMapReports: CivicReport[];
  ngoActivities: NgoActivity[];
  activityParticipations: ActivityParticipation[];
  joinedActivityIds: string[];
  notifications: CivicNotification[];
  sampleNotifications: CivicNotification[];
  categories: CivicCategory[];
  users: AdminUserRecord[];
  roleRequests: RoleAccessRequest[];
  departments: DepartmentRecord[];
  ngos: NgoRecord[];
  issueClusters: IssueCluster[];
  selectedReportId: string | null;
  selectedActivityId: string | null;
  toast: ToastMessage | null;
  dataLoading: boolean;
  openRoleLogin: (role: UserRole, targetPage?: AppPage) => void;
  openSignInPage: (role?: UserRole, targetPage?: AppPage) => void;
  switchPortalRole: (role: UserRole) => void;
  enterAuthorizedWorkspace: (targetPage?: AppPage) => void;
  returnToLanding: () => void;
  signOutAndReturn: (reason?: string) => Promise<void>;
  navigateTo: (page: AppPage) => void;
  updatePreviewProfile: (updates: Partial<PreviewProfileState>) => void;
  setPreferredLanguage: (lang: LanguageOption) => void;
  setPreferredNeighbourhood: (neighbourhood: string) => void;
  setLargeTextMode: (enabled: boolean) => void;
  openReportDetail: (reportId: string) => void;
  closeReportDetail: () => void;
  openActivityDetail: (activityId: string) => void;
  closeActivityDetail: () => void;
  openNotificationTarget: (notif: CivicNotification) => void;
  submitCitizenReport: (input: NewReportInput) => Promise<CivicReport | null>;
  updateReportStatus: (
    reportId: string,
    newStatus: ReportStatus,
    note: string,
    actorOverride?: string
  ) => Promise<void>;
  verifyOrDisputeReport: (
    reportId: string,
    decision: 'verify' | 'dispute',
    note: string
  ) => Promise<void>;
  updateNgoActivityStatus: (
    activityId: string,
    newStatus: NgoActivityStatus,
    evidenceNote?: string
  ) => Promise<void>;
  joinCommunityActivity: (activityId: string) => Promise<void>;
  toggleCategoryActive: (categoryId: string) => Promise<void>;
  addCategory: (name: string, defaultDepartment: string) => Promise<void>;
  markNotificationRead: (notificationId: string, read?: boolean) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  approveRoleRequest: (
    request: RoleAccessRequest,
    options?: {
      departmentId?: string;
      departmentName?: string;
      organisationId?: string;
      organisationName?: string;
    }
  ) => Promise<void>;
  rejectRoleRequest: (request: RoleAccessRequest) => Promise<void>;
  seedPilotDataToFirestore: () => Promise<void>;
  showToast: (title: string, detail: string, variant?: 'success' | 'info' | 'warning') => void;
  dismissToast: () => void;
}

const CivicContext = createContext<CivicContextValue | undefined>(undefined);

const NEIGHBOURHOOD_COORDS: Record<string, { x: number; y: number }> = {
  Indiranagar: { x: 65, y: 46 },
  Jayanagar: { x: 45, y: 73 },
  Whitefield: { x: 85, y: 44 },
  Malleshwaram: { x: 35, y: 30 },
  Koramangala: { x: 59, y: 65 },
  'HSR Layout': { x: 65, y: 79 },
  Rajajinagar: { x: 25, y: 41 },
  Yelahanka: { x: 47, y: 17 },
};

const DEPARTMENT_ID_BY_NAME: Record<string, string> = {
  'BBMP Road Infrastructure': 'DEP-01',
  'BBMP Solid Waste Management': 'DEP-02',
  'BWSSB & Stormwater Drains': 'DEP-03',
  'BESCOM Streetlighting Cell': 'DEP-04',
  'BBMP Forest & Horticulture': 'DEP-05',
  'Traffic & Pedestrian Safety Desk': 'DEP-01',
};

function resolveDepartmentId(departmentName: string): string {
  return DEPARTMENT_ID_BY_NAME[departmentName] ?? 'DEP-01';
}

function formatNowLabel(): string {
  const now = new Date();
  return now.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatDateOnly(): string {
  const now = new Date();
  return now.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function mapFirestoreReport(
  docId: string,
  data: Record<string, unknown>,
  currentUid: string,
  photoCache: Record<string, string>
): CivicReport {
  const rawHistory = Array.isArray(data.statusHistory) ? data.statusHistory : [];
  const statusHistory: StatusHistoryEntry[] = rawHistory.map((item) => {
    const entry = (item ?? {}) as Record<string, unknown>;
    return {
      status: String(entry.status ?? ReportStatus.SUBMITTED) as ReportStatus,
      date: String(entry.date ?? ''),
      actor: String(entry.actor ?? ''),
      note: String(entry.note ?? ''),
    };
  });

  const id = String(data.id ?? docId);
  const neighbourhood = String(data.neighbourhood ?? 'Indiranagar');
  const fallbackLatLng = BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhood] ?? {
    lat: 12.9716,
    lng: 77.5946,
  };
  const reporterUid = String(data.reporterUid ?? '');

  return {
    id,
    reporterUid,
    reporterName: String(data.reporterName ?? 'Resident'),
    title: String(data.title ?? ''),
    description: String(data.description ?? ''),
    category: String(data.category ?? 'Roads & Potholes'),
    neighbourhood,
    address: String(data.address ?? ''),
    dateSubmitted: String(data.dateSubmitted ?? ''),
    status: String(data.status ?? ReportStatus.SUBMITTED) as ReportStatus,
    priority: String(data.priority ?? ReportPriority.MEDIUM) as ReportPriority,
    method: String(data.method ?? ReportMethod.TEXT) as ReportMethod,
    language: String(data.language ?? LanguageOption.ENGLISH) as LanguageOption,
    assignedDepartmentId: String(data.assignedDepartmentId ?? ''),
    assignedOfficerUids: Array.isArray(data.assignedOfficerUids)
      ? data.assignedOfficerUids.map(String)
      : [],
    suggestedDepartment: String(data.suggestedDepartment ?? ''),
    aiClassificationNote: String(data.aiClassificationNote ?? ''),
    evidenceSummary: String(data.evidenceSummary ?? ''),
    evidenceImageUrl: photoCache[id],
    mapCoords: {
      x: typeof data.mapX === 'number' ? data.mapX : 50,
      y: typeof data.mapY === 'number' ? data.mapY : 50,
    },
    lat: typeof data.lat === 'number' ? data.lat : fallbackLatLng.lat,
    lng: typeof data.lng === 'number' ? data.lng : fallbackLatLng.lng,
    formattedAddress:
      typeof data.formattedAddress === 'string' && data.formattedAddress.trim()
        ? data.formattedAddress
        : undefined,
    placeId:
      typeof data.placeId === 'string' && data.placeId.trim() ? data.placeId : undefined,
    statusHistory,
    isUserSubmitted: reporterUid === currentUid,
    isSampleDemo: false,
  };
}

function mapFirestoreNgoActivity(docId: string, data: Record<string, unknown>): NgoActivity {
  return {
    id: String(data.id ?? docId),
    title: String(data.title ?? ''),
    category: String(data.category ?? ''),
    neighbourhood: String(data.neighbourhood ?? ''),
    location: String(data.location ?? ''),
    date: String(data.date ?? ''),
    timeWindow: String(data.timeWindow ?? ''),
    organiser: String(data.organiser ?? ''),
    organisationId: String(data.organisationId ?? ''),
    permittedNgoUids: Array.isArray(data.permittedNgoUids)
      ? data.permittedNgoUids.map(String)
      : [],
    visibility: data.visibility === 'ngo_only' ? 'ngo_only' : 'public',
    description: String(data.description ?? ''),
    volunteersJoined: typeof data.volunteersJoined === 'number' ? data.volunteersJoined : 0,
    volunteerGoal: typeof data.volunteerGoal === 'number' ? data.volunteerGoal : 20,
    status: String(data.status ?? NgoActivityStatus.AVAILABLE) as NgoActivityStatus,
    evidenceNote: String(data.evidenceNote ?? ''),
    isSampleDemo: false,
  };
}

function mapFirestoreParticipation(
  docId: string,
  data: Record<string, unknown>
): ActivityParticipation {
  return {
    id: String(data.id ?? docId),
    activityId: String(data.activityId ?? ''),
    activityTitle: String(data.activityTitle ?? ''),
    userUid: String(data.userUid ?? ''),
    userName: String(data.userName ?? ''),
    userEmail: String(data.userEmail ?? ''),
    neighbourhood: String(data.neighbourhood ?? ''),
    status: data.status === 'cancelled' ? 'cancelled' : 'registered',
    createdAtLabel: String(data.createdAtLabel ?? 'Recently'),
  };
}

function mapFirestoreCategory(docId: string, data: Record<string, unknown>): CivicCategory {
  return {
    id: String(data.id ?? docId),
    name: String(data.name ?? ''),
    defaultDepartment: String(data.defaultDepartment ?? ''),
    defaultDepartmentId: String(data.defaultDepartmentId ?? 'DEP-01'),
    active: Boolean(data.active),
    reportCount: typeof data.reportCount === 'number' ? data.reportCount : 0,
  };
}

function mapFirestoreNotification(docId: string, data: Record<string, unknown>): CivicNotification {
  return {
    id: String(data.id ?? docId),
    recipientUid: String(data.recipientUid ?? ''),
    type: String(data.type ?? NotificationType.STATUS_UPDATE) as NotificationType,
    title: String(data.title ?? ''),
    message: String(data.message ?? ''),
    timestamp: String(data.timestampLabel ?? 'Just now'),
    read: Boolean(data.read),
    relatedPage: (String(data.relatedPage ?? 'workspace') || 'workspace') as AppPage,
    relatedReportId: data.relatedReportId ? String(data.relatedReportId) : undefined,
    relatedActivityId: data.relatedActivityId ? String(data.relatedActivityId) : undefined,
    isSampleDemo: false,
  };
}

export const CivicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    firebaseUser,
    userProfile,
    authReady,
    signOutUser,
    updateOwnProfilePreferences,
  } = useAuth();

  const [viewMode, setViewMode] = useState<AppViewMode>('landing');
  const [unlockedRole, setUnlockedRole] = useState<UserRole>(UserRole.CITIZEN);
  const [selectedLoginRole, setSelectedLoginRole] = useState<UserRole>(UserRole.CITIZEN);
  const [pendingPageAfterLogin, setPendingPageAfterLogin] = useState<AppPage>('dashboard');
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const [largeTextMode, setLargeTextMode] = useState<boolean>(false);

  const [previewProfile, setPreviewProfile] = useState<PreviewProfileState>({
    displayName: ROLE_METADATA[UserRole.CITIZEN].demoPersonName,
    email: 'citizen.preview@nammaooru.local',
    phoneNumber: '',
    address: '12th Main, HAL 2nd Stage, Indiranagar, Bengaluru',
    neighbourhood: BENGALURU_NEIGHBOURHOODS[0],
    preferredLanguage: LanguageOption.ENGLISH,
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
  });

  const [firestoreReports, setFirestoreReports] = useState<CivicReport[]>([]);
  const [sessionReports, setSessionReports] = useState<CivicReport[]>([]);
  const [sampleReports, setSampleReports] = useState<CivicReport[]>(() =>
    INITIAL_REPORTS.map((r) => ({ ...r, isSampleDemo: true }))
  );
  const [firestoreActivities, setFirestoreActivities] = useState<NgoActivity[]>([]);
  const [sampleActivities, setSampleActivities] = useState<NgoActivity[]>(() =>
    INITIAL_NGO_ACTIVITIES.map((a) => ({ ...a, isSampleDemo: true }))
  );
  const [firestoreParticipations, setFirestoreParticipations] = useState<ActivityParticipation[]>([]);
  const [sessionParticipations, setSessionParticipations] = useState<ActivityParticipation[]>([]);
  const [firestoreNotifications, setFirestoreNotifications] = useState<CivicNotification[]>([]);
  const [sessionNotifications, setSessionNotifications] = useState<CivicNotification[]>([]);
  const [sampleNotifications, setSampleNotifications] = useState<CivicNotification[]>(() =>
    INITIAL_NOTIFICATIONS.map((n) => ({ ...n, isSampleDemo: true }))
  );
  const [categories, setCategories] = useState<CivicCategory[]>(INITIAL_CATEGORIES);
  const [firestoreUsers, setFirestoreUsers] = useState<AdminUserRecord[]>([]);
  const [roleRequests, setRoleRequests] = useState<RoleAccessRequest[]>([]);
  const [departments] = useState<DepartmentRecord[]>(INITIAL_DEPARTMENTS);
  const [ngos] = useState<NgoRecord[]>(INITIAL_NGOS);
  const [issueClusters] = useState<IssueCluster[]>(SAMPLE_ISSUE_CLUSTERS);
  const [dataLoading, setDataLoading] = useState<boolean>(false);

  const [localPhotoCache, setLocalPhotoCache] = useState<Record<string, string>>({});
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const activeRole: UserRole = unlockedRole;
  const hasLiveRoleAuth = Boolean(
    firebaseUser &&
      userProfile &&
      userProfile.approvalStatus === 'approved' &&
      userProfile.role === activeRole
  );
  const isUnlockedPreview = !hasLiveRoleAuth;

  const preferredLanguage: LanguageOption =
    userProfile?.preferredLanguage ?? previewProfile.preferredLanguage;
  const preferredNeighbourhood: string =
    userProfile?.neighbourhood ?? previewProfile.neighbourhood;

  const isBootstrappedAdmin =
    Boolean(firebaseUser?.emailVerified) &&
    firebaseUser?.email === BOOTSTRAPPED_ADMIN_EMAIL;

  // Reports visible to the active portal
  const reports = useMemo<CivicReport[]>(() => {
    const liveIds = new Set(firestoreReports.map((r) => r.id));
    const uniqueSession = sessionReports.filter((r) => !liveIds.has(r.id));

    if (activeRole === UserRole.CITIZEN) {
      return hasLiveRoleAuth ? [...firestoreReports, ...uniqueSession] : uniqueSession;
    }

    if (activeRole === UserRole.GOVERNMENT || activeRole === UserRole.ADMIN) {
      if (hasLiveRoleAuth && firestoreReports.length > 0) {
        return firestoreReports;
      }
      const sessionIds = new Set(uniqueSession.map((r) => r.id));
      const uniqueSamples = sampleReports.filter((s) => !sessionIds.has(s.id));
      return [...uniqueSession, ...uniqueSamples];
    }

    return hasLiveRoleAuth ? firestoreReports : [];
  }, [activeRole, hasLiveRoleAuth, firestoreReports, sessionReports, sampleReports]);

  const users = useMemo<AdminUserRecord[]>(() => {
    if (hasLiveRoleAuth && isBootstrappedAdmin && firestoreUsers.length > 0) {
      return firestoreUsers;
    }
    return INITIAL_USERS;
  }, [hasLiveRoleAuth, isBootstrappedAdmin, firestoreUsers]);

  // Merge Firestore public NGO activities with clearly labelled Bengaluru pilot activities
  const ngoActivities = useMemo<NgoActivity[]>(() => {
    if (firestoreActivities.length > 0) {
      const existingIds = new Set(firestoreActivities.map((a) => a.id));
      const remainingSamples = sampleActivities.filter((s) => !existingIds.has(s.id));
      return [...firestoreActivities, ...remainingSamples];
    }
    return sampleActivities;
  }, [firestoreActivities, sampleActivities]);

  const activityParticipations = useMemo<ActivityParticipation[]>(() => {
    const liveIds = new Set(firestoreParticipations.map((p) => p.activityId));
    const uniqueSession = sessionParticipations.filter((p) => !liveIds.has(p.activityId));
    return [...firestoreParticipations, ...uniqueSession];
  }, [firestoreParticipations, sessionParticipations]);

  const joinedActivityIds = useMemo<string[]>(() => {
    return activityParticipations
      .filter((p) => p.status === 'registered')
      .map((p) => p.activityId);
  }, [activityParticipations]);

  // Combined notifications: authenticated Firestore + session notifications + Bengaluru sample notifications
  const notifications = useMemo<CivicNotification[]>(() => {
    return [...firestoreNotifications, ...sessionNotifications, ...sampleNotifications];
  }, [firestoreNotifications, sessionNotifications, sampleNotifications]);

  // Combined map/pulse reports: user's submitted reports + clearly labelled Bengaluru demonstration records
  const allMapReports = useMemo<CivicReport[]>(() => {
    const liveIds = new Set(firestoreReports.map((r) => r.id));
    const citizenSession = sessionReports.filter((r) => !liveIds.has(r.id));
    const primary = hasLiveRoleAuth ? [...firestoreReports, ...citizenSession] : citizenSession;
    const primaryIds = new Set(primary.map((r) => r.id));
    const uniqueSamples = sampleReports.filter((s) => !primaryIds.has(s.id));
    return [...primary, ...uniqueSamples];
  }, [hasLiveRoleAuth, firestoreReports, sessionReports, sampleReports]);

  const showToast = useCallback(
    (title: string, detail: string, variant: 'success' | 'info' | 'warning' = 'success') => {
      const id = `toast-${Date.now()}`;
      setToast({ id, title, detail, variant });
      window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current));
      }, 4500);
    },
    []
  );

  const dismissToast = useCallback(() => setToast(null), []);

  // Clear Firestore-backed collections when signed out without ejecting unlocked portal sessions
  useEffect(() => {
    if (!authReady) return;
    if (!firebaseUser || !userProfile || userProfile.approvalStatus !== 'approved') {
      setFirestoreReports([]);
      setFirestoreActivities([]);
      setFirestoreParticipations([]);
      setFirestoreNotifications([]);
      setFirestoreUsers([]);
      setRoleRequests([]);
    }
  }, [authReady, firebaseUser, userProfile]);

  // Role-scoped real-time Firestore subscriptions (only after authentication)
  useEffect(() => {
    if (!authReady || !firebaseUser || !userProfile || userProfile.approvalStatus !== 'approved') {
      return;
    }

    setDataLoading(true);
    const unsubs: (() => void)[] = [];
    const uid = firebaseUser.uid;
    const role = userProfile.role;

    // 1. Categories
    const catQuery =
      role === UserRole.ADMIN && isBootstrappedAdmin
        ? collection(db, 'categories')
        : query(collection(db, 'categories'), where('active', '==', true));

    unsubs.push(
      onSnapshot(
        catQuery,
        (snap) => {
          if (snap.empty) {
            setCategories(INITIAL_CATEGORIES);
          } else {
            setCategories(
              snap.docs.map((d) => mapFirestoreCategory(d.id, d.data() as Record<string, unknown>))
            );
          }
        },
        (err) => {
          console.error('Categories listener error:', err);
        }
      )
    );

    // 2. Reports (strictly role-scoped to satisfy Firestore RBAC rules)
    if (role === UserRole.CITIZEN) {
      const q = query(collection(db, 'reports'), where('reporterUid', '==', uid));
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            setFirestoreReports(
              snap.docs.map((d) =>
                mapFirestoreReport(d.id, d.data() as Record<string, unknown>, uid, localPhotoCache)
              )
            );
            setDataLoading(false);
          },
          (err) => {
            setDataLoading(false);
            handleFirestoreError(err, OperationType.LIST, 'reports');
          }
        )
      );
    } else if (role === UserRole.GOVERNMENT) {
      const q = query(
        collection(db, 'reports'),
        where('assignedOfficerUids', 'array-contains', uid)
      );
      unsubs.push(
        onSnapshot(
          q,
          (snap) => {
            setFirestoreReports(
              snap.docs.map((d) =>
                mapFirestoreReport(d.id, d.data() as Record<string, unknown>, uid, localPhotoCache)
              )
            );
            setDataLoading(false);
          },
          (err) => {
            setDataLoading(false);
            handleFirestoreError(err, OperationType.LIST, 'reports');
          }
        )
      );
    } else if (role === UserRole.ADMIN && isBootstrappedAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'reports'),
          (snap) => {
            setFirestoreReports(
              snap.docs.map((d) =>
                mapFirestoreReport(d.id, d.data() as Record<string, unknown>, uid, localPhotoCache)
              )
            );
            setDataLoading(false);
          },
          (err) => {
            setDataLoading(false);
            handleFirestoreError(err, OperationType.LIST, 'reports');
          }
        )
      );
    } else {
      setFirestoreReports([]);
      setDataLoading(false);
    }

    // 3. NGO Activities
    if (role === UserRole.ADMIN && isBootstrappedAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'ngoActivities'),
          (snap) => {
            setFirestoreActivities(
              snap.docs.map((d) =>
                mapFirestoreNgoActivity(d.id, d.data() as Record<string, unknown>)
              )
            );
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, 'ngoActivities');
          }
        )
      );
    } else if (role === UserRole.NGO) {
      const activityMap = new Map<string, NgoActivity>();
      const syncMerged = () => setFirestoreActivities(Array.from(activityMap.values()));

      unsubs.push(
        onSnapshot(
          query(collection(db, 'ngoActivities'), where('visibility', '==', 'public')),
          (snap) => {
            snap.docs.forEach((d) => {
              activityMap.set(
                d.id,
                mapFirestoreNgoActivity(d.id, d.data() as Record<string, unknown>)
              );
            });
            syncMerged();
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, 'ngoActivities');
          }
        )
      );
      unsubs.push(
        onSnapshot(
          query(
            collection(db, 'ngoActivities'),
            where('permittedNgoUids', 'array-contains', uid)
          ),
          (snap) => {
            snap.docs.forEach((d) => {
              activityMap.set(
                d.id,
                mapFirestoreNgoActivity(d.id, d.data() as Record<string, unknown>)
              );
            });
            syncMerged();
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, 'ngoActivities');
          }
        )
      );
    } else {
      unsubs.push(
        onSnapshot(
          query(collection(db, 'ngoActivities'), where('visibility', '==', 'public')),
          (snap) => {
            setFirestoreActivities(
              snap.docs.map((d) =>
                mapFirestoreNgoActivity(d.id, d.data() as Record<string, unknown>)
              )
            );
          },
          (err) => {
            console.error('ngoActivities listener error:', err);
          }
        )
      );
    }

    // 4. Activity Participations (strictly owner-scoped)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'activityParticipations'), where('userUid', '==', uid)),
        (snap) => {
          setFirestoreParticipations(
            snap.docs.map((d) =>
              mapFirestoreParticipation(d.id, d.data() as Record<string, unknown>)
            )
          );
        },
        (err) => {
          console.error('activityParticipations listener error:', err);
        }
      )
    );

    // 5. Notifications (strictly recipient-scoped)
    unsubs.push(
      onSnapshot(
        query(collection(db, 'notifications'), where('recipientUid', '==', uid)),
        (snap) => {
          setFirestoreNotifications(
            snap.docs.map((d) =>
              mapFirestoreNotification(d.id, d.data() as Record<string, unknown>)
            )
          );
        },
        (err) => {
          handleFirestoreError(err, OperationType.LIST, 'notifications');
        }
      )
    );

    // 6. Admin-only Users & Role Access Requests
    if (role === UserRole.ADMIN && isBootstrappedAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setFirestoreUsers(
              snap.docs.map((d) => {
                const data = d.data() as Record<string, unknown>;
                const approval = String(data.approvalStatus ?? 'approved');
                return {
                  id: d.id,
                  name: String(data.displayName ?? 'User'),
                  email: String(data.email ?? ''),
                  role: String(data.role ?? UserRole.CITIZEN) as UserRole,
                  neighbourhood: String(data.neighbourhood ?? 'Bengaluru'),
                  joinedDate:
                    data.createdAt &&
                    typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function'
                      ? (data.createdAt as { toDate: () => Date })
                          .toDate()
                          .toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })
                      : 'Active',
                  status:
                    approval === 'pending'
                      ? 'Pending Review'
                      : approval === 'rejected'
                      ? 'Rejected'
                      : 'Active',
                  departmentId: String(data.departmentId ?? ''),
                  organisationId: String(data.organisationId ?? ''),
                };
              })
            );
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, 'users');
          }
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'roleRequests'),
          (snap) => {
            setRoleRequests(
              snap.docs.map((d) => {
                const data = d.data() as Record<string, unknown>;
                const rawRole = String(data.requestedRole ?? UserRole.GOVERNMENT);
                return {
                  uid: d.id,
                  displayName: String(data.displayName ?? ''),
                  email: String(data.email ?? ''),
                  requestedRole:
                    rawRole === UserRole.NGO || rawRole === UserRole.ADMIN
                      ? rawRole
                      : UserRole.GOVERNMENT,
                  organisationName: String(data.organisationName ?? ''),
                  departmentId: String(data.departmentId ?? ''),
                  organisationId: String(data.organisationId ?? ''),
                  justification: String(data.justification ?? ''),
                  status:
                    data.status === 'approved' || data.status === 'rejected'
                      ? data.status
                      : 'pending',
                  reviewedBy: String(data.reviewedBy ?? ''),
                };
              })
            );
          },
          (err) => {
            handleFirestoreError(err, OperationType.LIST, 'roleRequests');
          }
        )
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [authReady, firebaseUser, userProfile, isBootstrappedAdmin, localPhotoCache]);

  // Unlocked portal access: clicking any portal enters it directly without requiring sign-in
  const openRoleLogin = useCallback((role: UserRole, targetPage: AppPage = 'dashboard') => {
    setUnlockedRole(role);
    setSelectedLoginRole(role);
    setPendingPageAfterLogin(targetPage);
    setActivePage(targetPage);
    setViewMode('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Optional sign-in page access when a visitor explicitly wants to authenticate
  const openSignInPage = useCallback((role: UserRole = UserRole.CITIZEN, targetPage: AppPage = 'dashboard') => {
    setSelectedLoginRole(role);
    setPendingPageAfterLogin(targetPage);
    setViewMode('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const switchPortalRole = useCallback((role: UserRole) => {
    setUnlockedRole(role);
    setSelectedLoginRole(role);
    setActivePage('dashboard');
    setViewMode('app');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const enterAuthorizedWorkspace = useCallback(
    (targetPage?: AppPage) => {
      const nextRole =
        firebaseUser && userProfile && userProfile.approvalStatus === 'approved'
          ? userProfile.role
          : selectedLoginRole;
      setUnlockedRole(nextRole);
      setActivePage(targetPage ?? pendingPageAfterLogin ?? 'dashboard');
      setViewMode('app');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [firebaseUser, userProfile, selectedLoginRole, pendingPageAfterLogin]
  );

  const returnToLanding = useCallback(() => {
    setViewMode('landing');
    setSelectedReportId(null);
    setSelectedActivityId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const signOutAndReturn = useCallback(
    async (reason?: string) => {
      if (firebaseUser) {
        await signOutUser(reason);
      }
      setViewMode('landing');
      setSelectedReportId(null);
      setSelectedActivityId(null);
      showToast(
        firebaseUser ? 'Signed out' : 'Returned to Landing Page',
        firebaseUser
          ? 'You have been securely signed out of NAMMAOORU.'
          : 'You exited the unlocked portal preview.',
        'info'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [firebaseUser, signOutUser, showToast]
  );

  const navigateTo = useCallback((page: AppPage) => {
    setActivePage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const updatePreviewProfile = useCallback((updates: Partial<PreviewProfileState>) => {
    setPreviewProfile((prev) => ({
      ...prev,
      ...updates,
      notificationPreferences: updates.notificationPreferences
        ? { ...prev.notificationPreferences, ...updates.notificationPreferences }
        : prev.notificationPreferences,
    }));
  }, []);

  const setPreferredLanguage = useCallback(
    (lang: LanguageOption) => {
      updatePreviewProfile({ preferredLanguage: lang });
      if (firebaseUser) {
        void updateOwnProfilePreferences({ preferredLanguage: lang });
      }
    },
    [firebaseUser, updatePreviewProfile, updateOwnProfilePreferences]
  );

  const setPreferredNeighbourhood = useCallback(
    (neighbourhood: string) => {
      updatePreviewProfile({ neighbourhood });
      if (firebaseUser) {
        void updateOwnProfilePreferences({ neighbourhood });
      }
    },
    [firebaseUser, updatePreviewProfile, updateOwnProfilePreferences]
  );

  const openReportDetail = useCallback((reportId: string) => {
    setSelectedReportId(reportId);
  }, []);

  const closeReportDetail = useCallback(() => {
    setSelectedReportId(null);
  }, []);

  const openActivityDetail = useCallback((activityId: string) => {
    setSelectedActivityId(activityId);
  }, []);

  const closeActivityDetail = useCallback(() => {
    setSelectedActivityId(null);
  }, []);

  const markNotificationRead = useCallback(
    async (notificationId: string, read = true): Promise<void> => {
      const isSample = sampleNotifications.some((n) => n.id === notificationId);
      if (isSample) {
        setSampleNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read } : n))
        );
        return;
      }

      const isSession = sessionNotifications.some((n) => n.id === notificationId);
      if (isSession) {
        setSessionNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, read } : n))
        );
        return;
      }

      if (!firebaseUser) return;

      try {
        await updateDoc(doc(db, 'notifications', notificationId), {
          read,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `notifications/${notificationId}`);
      }
    },
    [firebaseUser, sampleNotifications, sessionNotifications]
  );

  const openNotificationTarget = useCallback(
    (notif: CivicNotification) => {
      void markNotificationRead(notif.id, true);
      if (notif.relatedPage) {
        navigateTo(notif.relatedPage);
      }
      if (notif.relatedReportId) {
        setSelectedReportId(notif.relatedReportId);
      } else if (notif.relatedActivityId) {
        setSelectedActivityId(notif.relatedActivityId);
      }
    },
    [markNotificationRead, navigateTo]
  );

  const submitCitizenReport = useCallback(
    async (input: NewReportInput): Promise<CivicReport | null> => {
      const matchedCat = categories.find((c) => c.name === input.category);
      const suggestedDepartment =
        input.suggestedDepartment?.trim() ||
        matchedCat?.defaultDepartment ||
        'BBMP Road Infrastructure';
      const assignedDepartmentId =
        matchedCat?.defaultDepartmentId || resolveDepartmentId(suggestedDepartment);

      const baseCoords = NEIGHBOURHOOD_COORDS[input.neighbourhood] ?? { x: 52, y: 50 };
      const jitterX = Math.max(12, Math.min(88, baseCoords.x + ((reports.length % 5) - 2) * 2.5));
      const jitterY = Math.max(12, Math.min(88, baseCoords.y + ((reports.length % 3) - 1) * 2.5));

      const baseLatLng = BENGALURU_NEIGHBOURHOOD_LATLNG[input.neighbourhood] ?? {
        lat: 12.9716,
        lng: 77.5946,
      };
      const lat =
        typeof input.lat === 'number' && Number.isFinite(input.lat)
          ? Number(input.lat.toFixed(6))
          : baseLatLng.lat;
      const lng =
        typeof input.lng === 'number' && Number.isFinite(input.lng)
          ? Number(input.lng.toFixed(6))
          : baseLatLng.lng;

      const reportId = `BLR-${Date.now().toString().slice(-6)}`;
      const dateSubmitted = formatDateOnly();
      const reporterName = (userProfile?.displayName || previewProfile.displayName).slice(0, 120);
      const historyEntry: StatusHistoryEntry = {
        status: ReportStatus.SUBMITTED,
        date: formatNowLabel(),
        actor: `${reporterName} (Citizen)`,
        note: `Submitted via ${input.method} in ${input.language}. Recorded in NAMMAOORU (pending municipal department routing).`,
      };

      const priority = input.priority ?? ReportPriority.MEDIUM;
      const aiNote =
        input.aiClassificationNote?.trim() ||
        'Structured routing prepared for Bengaluru pilot. Citizen reviewed and confirmed fields prior to submission.';

      const title = input.title.trim().slice(0, 160);
      const description = (
        input.description.trim() ||
        `Submitted via ${input.method} reporting interface for ${input.neighbourhood}.`
      ).slice(0, 2000);
      const address = (input.address.trim() || `${input.neighbourhood}, Bengaluru`).slice(0, 240);
      const formattedAddress = (input.formattedAddress?.trim() || address).slice(0, 240);
      const placeId = input.placeId?.trim().slice(0, 160) || '';

      // Unlocked preview session (not signed into Firebase): store report in active browser session
      if (!firebaseUser || !userProfile) {
        const localReport: CivicReport = {
          id: reportId,
          reporterUid: 'unlocked-preview-citizen',
          reporterName,
          title,
          description,
          category: input.category.slice(0, 80),
          neighbourhood: input.neighbourhood.slice(0, 80),
          address,
          formattedAddress,
          placeId: placeId || undefined,
          dateSubmitted,
          status: ReportStatus.SUBMITTED,
          priority,
          method: input.method,
          language: input.language,
          assignedDepartmentId,
          assignedOfficerUids: [],
          suggestedDepartment: suggestedDepartment.slice(0, 120),
          aiClassificationNote: aiNote.slice(0, 500),
          evidenceSummary: input.evidenceSummary.slice(0, 400),
          evidenceImageUrl: input.evidenceImageUrl,
          mapCoords: { x: jitterX, y: jitterY },
          lat,
          lng,
          statusHistory: [historyEntry],
          isUserSubmitted: true,
          isSampleDemo: false,
        };

        setSessionReports((prev) => [localReport, ...prev]);
        setSessionNotifications((prev) => [
          {
            id: `NOTIF-${Date.now()}`,
            type: NotificationType.SUBMISSION,
            title: `Report ${reportId} recorded on NAMMAOORU`,
            message: `"${title}" (${input.neighbourhood}) was recorded in your current unlocked session. Suggested department: ${suggestedDepartment}.`,
            timestamp: 'Just now',
            read: false,
            relatedPage: 'workspace',
            relatedReportId: reportId,
            isSampleDemo: false,
          },
          ...prev,
        ]);

        showToast(
          `Report ${reportId} recorded`,
          'Saved in your unlocked portal session. Sign in anytime to persist reports to Firestore.',
          'success'
        );
        return localReport;
      }

      const firestorePayload: Record<string, unknown> = {
        id: reportId,
        reporterUid: firebaseUser.uid,
        reporterName,
        title,
        description,
        category: input.category.slice(0, 80),
        neighbourhood: input.neighbourhood.slice(0, 80),
        address,
        formattedAddress,
        dateSubmitted,
        status: ReportStatus.SUBMITTED,
        priority,
        method: input.method,
        language: input.language,
        assignedDepartmentId,
        suggestedDepartment: suggestedDepartment.slice(0, 120),
        aiClassificationNote: aiNote.slice(0, 500),
        evidenceSummary: input.evidenceSummary.slice(0, 400),
        mapX: jitterX,
        mapY: jitterY,
        lat,
        lng,
        assignedOfficerUids: [] as string[],
        statusHistory: [historyEntry],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (placeId) {
        firestorePayload.placeId = placeId;
      }

      try {
        await setDoc(doc(db, 'reports', reportId), firestorePayload);

        if (input.evidenceImageUrl) {
          setLocalPhotoCache((prev) => ({ ...prev, [reportId]: input.evidenceImageUrl! }));
        }

        const notifId = `NOTIF-${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          recipientUid: firebaseUser.uid,
          type: NotificationType.SUBMISSION,
          title: `Report ${reportId} recorded on NAMMAOORU`,
          message: `"${title}" (${input.neighbourhood}) has been saved to your Citizen account. Suggested department: ${suggestedDepartment}.`,
          timestampLabel: 'Just now',
          read: false,
          relatedPage: 'workspace',
          relatedReportId: reportId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        showToast(
          `Report ${reportId} recorded`,
          'Saved to your NAMMAOORU account (platform submission—not an official municipal ticket acknowledgement).',
          'success'
        );

        return {
          id: reportId,
          reporterUid: firebaseUser.uid,
          reporterName,
          title,
          description,
          category: input.category.slice(0, 80),
          neighbourhood: input.neighbourhood.slice(0, 80),
          address,
          formattedAddress,
          placeId: placeId || undefined,
          dateSubmitted,
          status: ReportStatus.SUBMITTED,
          priority,
          method: input.method,
          language: input.language,
          assignedDepartmentId,
          assignedOfficerUids: [],
          suggestedDepartment,
          aiClassificationNote: aiNote.slice(0, 500),
          evidenceSummary: input.evidenceSummary.slice(0, 400),
          evidenceImageUrl: input.evidenceImageUrl,
          mapCoords: { x: jitterX, y: jitterY },
          lat,
          lng,
          statusHistory: [historyEntry],
          isUserSubmitted: true,
          isSampleDemo: false,
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `reports/${reportId}`);
      }
    },
    [firebaseUser, userProfile, previewProfile.displayName, categories, reports.length, showToast]
  );

  const updateReportStatus = useCallback(
    async (
      reportId: string,
      newStatus: ReportStatus,
      note: string,
      actorOverride?: string
    ): Promise<void> => {
      const defaultActor =
        actorOverride ??
        userProfile?.departmentName ??
        userProfile?.organisationName ??
        userProfile?.displayName ??
        `${ROLE_METADATA[activeRole].demoPersonName} (${ROLE_METADATA[activeRole].shortLabel})`;

      // 1. Check session reports (unlocked preview submissions)
      const sessionTarget = sessionReports.find((r) => r.id === reportId);
      if (sessionTarget) {
        setSessionReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status: newStatus,
                  statusHistory: [
                    ...r.statusHistory,
                    {
                      status: newStatus,
                      date: formatNowLabel(),
                      actor: defaultActor,
                      note: note.trim() || `Status updated to ${newStatus}.`,
                    },
                  ],
                }
              : r
          )
        );
        showToast(
          `Updated ${reportId} to "${newStatus}"`,
          'Status updated in your active portal session.',
          'info'
        );
        return;
      }

      // 2. Check live Firestore reports (requires matching authenticated access)
      const realTarget = firestoreReports.find((r) => r.id === reportId);
      if (realTarget && firebaseUser && userProfile && hasLiveRoleAuth) {
        const nextHistory: StatusHistoryEntry[] = [
          ...realTarget.statusHistory,
          {
            status: newStatus,
            date: formatNowLabel(),
            actor: defaultActor,
            note: note.trim() || `Status updated to ${newStatus}.`,
          },
        ];

        try {
          await updateDoc(doc(db, 'reports', reportId), {
            status: newStatus,
            statusHistory: nextHistory,
            updatedAt: serverTimestamp(),
          });

          if (
            newStatus === ReportStatus.CITIZEN_VERIFIED ||
            newStatus === ReportStatus.DISPUTED_REOPENED
          ) {
            const notifId = `NOTIF-${Date.now()}`;
            await setDoc(doc(db, 'notifications', notifId), {
              id: notifId,
              recipientUid: firebaseUser.uid,
              type:
                newStatus === ReportStatus.DISPUTED_REOPENED
                  ? NotificationType.DISPUTED_REOPENED
                  : NotificationType.STATUS_UPDATE,
              title:
                newStatus === ReportStatus.CITIZEN_VERIFIED
                  ? `Report ${reportId} verified & closed`
                  : `Report ${reportId} disputed & reopened`,
              message: note.trim() || `You updated ${reportId} to ${newStatus}.`,
              timestampLabel: 'Just now',
              read: false,
              relatedPage: 'workspace',
              relatedReportId: reportId,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }

          showToast(
            `Updated ${reportId} to "${newStatus}"`,
            'Verified status update saved to Firestore.',
            'info'
          );
          return;
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
        }
      }

      // 3. Fallback: update clearly labelled sample demonstration report in-session
      const demoTarget = sampleReports.find((r) => r.id === reportId);
      if (demoTarget) {
        setSampleReports((prev) =>
          prev.map((r) =>
            r.id === reportId
              ? {
                  ...r,
                  status: newStatus,
                  statusHistory: [
                    ...r.statusHistory,
                    {
                      status: newStatus,
                      date: formatNowLabel(),
                      actor: defaultActor,
                      note: note.trim() || `Status updated to ${newStatus}.`,
                    },
                  ],
                }
              : r
          )
        );
        showToast(
          `Updated ${reportId} to "${newStatus}"`,
          'Updated in your active preview session (demonstration record).',
          'info'
        );
      }
    },
    [
      activeRole,
      firebaseUser,
      userProfile,
      hasLiveRoleAuth,
      sessionReports,
      firestoreReports,
      sampleReports,
      showToast,
    ]
  );

  const verifyOrDisputeReport = useCallback(
    async (reportId: string, decision: 'verify' | 'dispute', note: string): Promise<void> => {
      const nextStatus =
        decision === 'verify'
          ? ReportStatus.CITIZEN_VERIFIED
          : ReportStatus.DISPUTED_REOPENED;
      const defaultNote =
        decision === 'verify'
          ? 'Citizen confirmed the neighbourhood resolution on site.'
          : 'Citizen reported the issue persists and reopened the ticket.';
      const actorName = userProfile?.displayName || previewProfile.displayName;

      await updateReportStatus(
        reportId,
        nextStatus,
        note.trim() || defaultNote,
        `${actorName} (Citizen)`
      );
    },
    [userProfile, previewProfile.displayName, updateReportStatus]
  );

  const updateNgoActivityStatus = useCallback(
    async (
      activityId: string,
      newStatus: NgoActivityStatus,
      evidenceNote?: string
    ): Promise<void> => {
      const liveTarget = firestoreActivities.find((a) => a.id === activityId);
      if (liveTarget && firebaseUser && userProfile && hasLiveRoleAuth) {
        try {
          await updateDoc(doc(db, 'ngoActivities', activityId), {
            status: newStatus,
            evidenceNote: (evidenceNote ?? liveTarget.evidenceNote ?? '').slice(0, 500),
            organisationId: liveTarget.organisationId || userProfile.organisationId || '',
            permittedNgoUids: Array.from(
              new Set([...(liveTarget.permittedNgoUids ?? []), firebaseUser.uid])
            ).slice(0, 20),
            updatedAt: serverTimestamp(),
          });
          showToast(
            `Activity updated to ${newStatus}`,
            'Community activity updated independently of official civic reports.',
            'success'
          );
          return;
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `ngoActivities/${activityId}`);
        }
      }

      setSampleActivities((prev) =>
        prev.map((a) =>
          a.id === activityId
            ? {
                ...a,
                status: newStatus,
                evidenceNote: evidenceNote !== undefined ? evidenceNote : a.evidenceNote,
              }
            : a
        )
      );
      showToast(
        `Activity updated to ${newStatus}`,
        'Community activity updated in your active portal session (independent of official civic reports).',
        'success'
      );
    },
    [firebaseUser, userProfile, hasLiveRoleAuth, firestoreActivities, showToast]
  );

  const joinCommunityActivity = useCallback(
    async (activityId: string): Promise<void> => {
      if (joinedActivityIds.includes(activityId)) {
        showToast(
          'Already registered',
          'Your volunteer participation is already recorded for this community drive.',
          'info'
        );
        return;
      }

      const target = ngoActivities.find((a) => a.id === activityId);
      if (!target) return;

      // Unlocked preview session: record participation locally in-session
      if (!firebaseUser || !userProfile) {
        const participationId = `PART-PREVIEW-${activityId}-${Date.now()}`;
        setSessionParticipations((prev) => [
          ...prev,
          {
            id: participationId,
            activityId: target.id,
            activityTitle: target.title,
            userUid: 'unlocked-preview-citizen',
            userName: previewProfile.displayName,
            userEmail: previewProfile.email,
            neighbourhood: target.neighbourhood,
            status: 'registered',
            createdAtLabel: formatNowLabel(),
          },
        ]);
        setSampleActivities((prev) =>
          prev.map((a) =>
            a.id === activityId ? { ...a, volunteersJoined: a.volunteersJoined + 1 } : a
          )
        );
        setSessionNotifications((prev) => [
          {
            id: `NOTIF-${Date.now()}`,
            type: NotificationType.COMMUNITY_UPDATE,
            title: 'Volunteer registration confirmed',
            message: `You joined "${target.title}" organised by ${target.organiser} (${target.date}, ${target.timeWindow}).`,
            timestamp: 'Just now',
            read: false,
            relatedPage: 'community',
            relatedActivityId: target.id,
            isSampleDemo: false,
          },
          ...prev,
        ]);
        showToast(
          'Volunteer participation recorded',
          `You joined "${target.title}" in your active portal session.`,
          'success'
        );
        return;
      }

      const cleanActId = activityId.replace(/[^a-zA-Z0-9_-]/g, '');
      const cleanUidPart = firebaseUser.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 20);
      const participationId = `PART-${cleanActId}-${cleanUidPart}`;

      try {
        // 1. Always persist an authenticated citizen participation record in Firestore
        await setDoc(doc(db, 'activityParticipations', participationId), {
          id: participationId,
          activityId: target.id,
          activityTitle: target.title.slice(0, 160),
          userUid: firebaseUser.uid,
          userName: userProfile.displayName.slice(0, 120),
          userEmail: (userProfile.email || firebaseUser.email || '').slice(0, 254),
          neighbourhood: target.neighbourhood.slice(0, 80),
          status: 'registered',
          createdAtLabel: formatNowLabel(),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. Increment volunteer count on Firestore activity OR sample activity
        const isLiveFirestoreActivity = firestoreActivities.some((a) => a.id === activityId);
        if (isLiveFirestoreActivity) {
          await updateDoc(doc(db, 'ngoActivities', activityId), {
            volunteersJoined: target.volunteersJoined + 1,
            updatedAt: serverTimestamp(),
          });
        } else {
          setSampleActivities((prev) =>
            prev.map((a) =>
              a.id === activityId ? { ...a, volunteersJoined: a.volunteersJoined + 1 } : a
            )
          );
        }

        // 3. Record an in-app Firestore notification confirming registration
        const notifId = `NOTIF-${Date.now()}`;
        await setDoc(doc(db, 'notifications', notifId), {
          id: notifId,
          recipientUid: firebaseUser.uid,
          type: NotificationType.COMMUNITY_UPDATE,
          title: `Volunteer registration confirmed`,
          message: `You joined "${target.title}" organised by ${target.organiser} (${target.date}, ${target.timeWindow}).`,
          timestampLabel: 'Just now',
          read: false,
          relatedPage: 'community',
          relatedActivityId: target.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        showToast(
          'Volunteer participation recorded',
          `You joined "${target.title}". Note: NGO drives run alongside—not instead of—official municipal repairs.`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `activityParticipations/${participationId}`);
      }
    },
    [
      firebaseUser,
      userProfile,
      previewProfile.displayName,
      previewProfile.email,
      joinedActivityIds,
      ngoActivities,
      firestoreActivities,
      showToast,
    ]
  );

  const toggleCategoryActive = useCallback(
    async (categoryId: string): Promise<void> => {
      const target = categories.find((c) => c.id === categoryId);
      if (!target) return;

      if (userProfile?.role === UserRole.ADMIN && isBootstrappedAdmin) {
        try {
          await setDoc(doc(db, 'categories', categoryId), {
            id: target.id,
            name: target.name,
            defaultDepartment: target.defaultDepartment,
            defaultDepartmentId:
              target.defaultDepartmentId || resolveDepartmentId(target.defaultDepartment),
            active: !target.active,
            reportCount: target.reportCount,
            updatedAt: serverTimestamp(),
          });
          showToast('Category updated', `"${target.name}" status saved.`, 'info');
          return;
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `categories/${categoryId}`);
        }
      }

      setCategories((prev) =>
        prev.map((c) => (c.id === categoryId ? { ...c, active: !c.active } : c))
      );
      showToast('Category updated', `"${target.name}" updated in active preview session.`, 'info');
    },
    [userProfile, isBootstrappedAdmin, categories, showToast]
  );

  const addCategory = useCallback(
    async (name: string, defaultDepartment: string): Promise<void> => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const catId = `cat-${Date.now()}`;
      const deptName = (defaultDepartment.trim() || 'BBMP Road Infrastructure').slice(0, 120);

      if (userProfile?.role === UserRole.ADMIN && isBootstrappedAdmin) {
        try {
          await setDoc(doc(db, 'categories', catId), {
            id: catId,
            name: trimmed.slice(0, 80),
            defaultDepartment: deptName,
            defaultDepartmentId: resolveDepartmentId(deptName),
            active: true,
            reportCount: 0,
            updatedAt: serverTimestamp(),
          });
          showToast('Category added', `"${trimmed}" is now active in civic forms.`, 'success');
          return;
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `categories/${catId}`);
        }
      }

      setCategories((prev) => [
        ...prev,
        {
          id: catId,
          name: trimmed.slice(0, 80),
          defaultDepartment: deptName,
          defaultDepartmentId: resolveDepartmentId(deptName),
          active: true,
          reportCount: 0,
        },
      ]);
      showToast('Category added', `"${trimmed}" added in active preview session.`, 'success');
    },
    [userProfile, isBootstrappedAdmin, showToast]
  );

  const markAllNotificationsRead = useCallback(async (): Promise<void> => {
    const unreadReal = firestoreNotifications.filter((n) => !n.read);
    const hasUnreadSession = sessionNotifications.some((n) => !n.read);
    const hasUnreadSamples = sampleNotifications.some((n) => !n.read);

    if (unreadReal.length === 0 && !hasUnreadSession && !hasUnreadSamples) return;

    if (hasUnreadSamples) {
      setSampleNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
    if (hasUnreadSession) {
      setSessionNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }

    if (unreadReal.length > 0 && firebaseUser) {
      try {
        const batch = writeBatch(db);
        unreadReal.forEach((n) => {
          batch.update(doc(db, 'notifications', n.id), {
            read: true,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'notifications');
      }
    }

    showToast('Notifications cleared', 'All notifications marked as read.', 'info');
  }, [firebaseUser, firestoreNotifications, sessionNotifications, sampleNotifications, showToast]);

  const approveRoleRequest = useCallback(
    async (
      request: RoleAccessRequest,
      options?: {
        departmentId?: string;
        departmentName?: string;
        organisationId?: string;
        organisationName?: string;
      }
    ): Promise<void> => {
      if (!firebaseUser || userProfile?.role !== UserRole.ADMIN) return;

      const deptId =
        request.requestedRole === UserRole.GOVERNMENT
          ? (options?.departmentId || request.departmentId || 'DEP-01').slice(0, 80)
          : '';
      const deptName =
        request.requestedRole === UserRole.GOVERNMENT
          ? (
              options?.departmentName ||
              INITIAL_DEPARTMENTS.find((d) => d.id === deptId)?.name ||
              request.organisationName
            ).slice(0, 120)
          : '';
      const orgId =
        request.requestedRole === UserRole.NGO
          ? (options?.organisationId || request.organisationId || 'NGO-01').slice(0, 80)
          : '';
      const orgName =
        request.requestedRole === UserRole.NGO
          ? (
              options?.organisationName ||
              INITIAL_NGOS.find((n) => n.id === orgId)?.name ||
              request.organisationName
            ).slice(0, 120)
          : request.requestedRole === UserRole.ADMIN
          ? 'NAMMAOORU Platform Administration'
          : '';

      try {
        const batch = writeBatch(db);

        batch.update(doc(db, 'roleRequests', request.uid), {
          status: 'approved',
          reviewedBy: firebaseUser.uid,
          departmentId: deptId,
          organisationId: orgId,
          updatedAt: serverTimestamp(),
        });

        batch.update(doc(db, 'users', request.uid), {
          role: request.requestedRole,
          approvalStatus: 'approved',
          departmentId: deptId,
          departmentName: deptName,
          organisationId: orgId,
          organisationName: orgName,
          updatedAt: serverTimestamp(),
        });

        if (request.requestedRole === UserRole.ADMIN) {
          batch.set(doc(db, 'admins', request.uid), {
            uid: request.uid,
            email: request.email,
            grantedBy: firebaseUser.uid,
            createdAt: serverTimestamp(),
          });
        }

        if (request.requestedRole === UserRole.GOVERNMENT && deptId) {
          reports
            .filter((r) => r.assignedDepartmentId === deptId)
            .forEach((rep) => {
              const nextOfficers = Array.from(
                new Set([...(rep.assignedOfficerUids ?? []), request.uid])
              ).slice(0, 20);
              batch.update(doc(db, 'reports', rep.id), {
                assignedOfficerUids: nextOfficers,
                updatedAt: serverTimestamp(),
              });
            });
        }

        if (request.requestedRole === UserRole.NGO && orgId) {
          firestoreActivities
            .filter((act) => !act.organisationId || act.organisationId === orgId)
            .forEach((act) => {
              const nextNgos = Array.from(
                new Set([...(act.permittedNgoUids ?? []), request.uid])
              ).slice(0, 20);
              batch.update(doc(db, 'ngoActivities', act.id), {
                permittedNgoUids: nextNgos,
                updatedAt: serverTimestamp(),
              });
            });
        }

        const notifId = `NOTIF-${Date.now()}`;
        batch.set(doc(db, 'notifications', notifId), {
          id: notifId,
          recipientUid: request.uid,
          type: NotificationType.STATUS_UPDATE,
          title: 'Role access request approved',
          message: `Your account has been authorized as ${request.requestedRole.toUpperCase()} (${deptName || orgName || 'NAMMAOORU'}).`,
          timestampLabel: 'Just now',
          read: false,
          relatedPage: 'dashboard',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
        showToast(
          'Access request approved',
          `${request.displayName} is now authorized as ${request.requestedRole}.`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `roleRequests/${request.uid}`);
      }
    },
    [firebaseUser, userProfile, reports, firestoreActivities, showToast]
  );

  const rejectRoleRequest = useCallback(
    async (request: RoleAccessRequest): Promise<void> => {
      if (!firebaseUser || userProfile?.role !== UserRole.ADMIN) return;
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'roleRequests', request.uid), {
          status: 'rejected',
          reviewedBy: firebaseUser.uid,
          departmentId: request.departmentId,
          organisationId: request.organisationId,
          updatedAt: serverTimestamp(),
        });

        const notifId = `NOTIF-${Date.now()}`;
        batch.set(doc(db, 'notifications', notifId), {
          id: notifId,
          recipientUid: request.uid,
          type: NotificationType.STATUS_UPDATE,
          title: 'Role access request declined',
          message: `Your request for ${request.requestedRole} access was not approved. You continue to have Citizen access.`,
          timestampLabel: 'Just now',
          read: false,
          relatedPage: 'profile',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
        showToast(
          'Access request rejected',
          `${request.displayName}'s request was declined.`,
          'info'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `roleRequests/${request.uid}`);
      }
    },
    [firebaseUser, userProfile, showToast]
  );

  const seedPilotDataToFirestore = useCallback(async (): Promise<void> => {
    if (!firebaseUser || userProfile?.role !== UserRole.ADMIN || !isBootstrappedAdmin) {
      showToast(
        'Preview records already loaded',
        'Sign in with a verified Platform Administrator account to write seed records to Firestore.',
        'info'
      );
      return;
    }
    try {
      const batch = writeBatch(db);

      INITIAL_CATEGORIES.forEach((cat) => {
        batch.set(doc(db, 'categories', cat.id), {
          id: cat.id,
          name: cat.name,
          defaultDepartment: cat.defaultDepartment,
          defaultDepartmentId: resolveDepartmentId(cat.defaultDepartment),
          active: cat.active,
          reportCount: cat.reportCount,
          updatedAt: serverTimestamp(),
        });
      });

      const orgIdMap: Record<string, string> = {
        'Hasiru Namma Bengaluru Trust': 'NGO-01',
        'Friends of Bengaluru Lakes': 'NGO-02',
        'Bengaluru Canopy Collective': 'NGO-03',
        'Swachh Jayanagar Resident Forum': 'NGO-04',
      };

      INITIAL_NGO_ACTIVITIES.forEach((act) => {
        batch.set(doc(db, 'ngoActivities', act.id), {
          id: act.id,
          title: act.title,
          category: act.category,
          neighbourhood: act.neighbourhood,
          location: act.location,
          date: act.date,
          timeWindow: act.timeWindow,
          organiser: act.organiser,
          organisationId: orgIdMap[act.organiser] ?? 'NGO-01',
          permittedNgoUids: [] as string[],
          description: act.description,
          volunteersJoined: act.volunteersJoined,
          volunteerGoal: act.volunteerGoal,
          status: act.status,
          evidenceNote: act.evidenceNote ?? '',
          visibility: 'public',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      INITIAL_REPORTS.forEach((rep) => {
        batch.set(doc(db, 'reports', rep.id), {
          id: rep.id,
          reporterUid: firebaseUser.uid,
          reporterName: rep.reporterName,
          title: rep.title,
          description: rep.description,
          category: rep.category,
          neighbourhood: rep.neighbourhood,
          address: rep.address,
          dateSubmitted: rep.dateSubmitted,
          status: rep.status,
          priority: rep.priority,
          method: rep.method,
          language: rep.language,
          assignedDepartmentId: resolveDepartmentId(rep.suggestedDepartment),
          suggestedDepartment: rep.suggestedDepartment,
          aiClassificationNote: rep.aiClassificationNote,
          evidenceSummary: rep.evidenceSummary,
          mapX: rep.mapCoords.x,
          mapY: rep.mapCoords.y,
          lat: rep.lat ?? 12.9716,
          lng: rep.lng ?? 77.5946,
          assignedOfficerUids: [] as string[],
          statusHistory: rep.statusHistory,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      });

      await batch.commit();
      showToast(
        'Bengaluru pilot data seeded',
        'Categories, sample civic reports, and NGO activities are now live in Firestore.',
        'success'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'pilot-seed');
    }
  }, [firebaseUser, userProfile, isBootstrappedAdmin, showToast]);

  const value = useMemo<CivicContextValue>(
    () => ({
      viewMode,
      selectedLoginRole,
      pendingPageAfterLogin,
      activeRole,
      activePage,
      isUnlockedPreview,
      previewProfile,
      preferredLanguage,
      preferredNeighbourhood,
      largeTextMode,
      reports,
      sampleReports,
      allMapReports,
      ngoActivities,
      activityParticipations,
      joinedActivityIds,
      notifications,
      sampleNotifications,
      categories,
      users,
      roleRequests,
      departments,
      ngos,
      issueClusters,
      selectedReportId,
      selectedActivityId,
      toast,
      dataLoading,
      openRoleLogin,
      openSignInPage,
      switchPortalRole,
      enterAuthorizedWorkspace,
      returnToLanding,
      signOutAndReturn,
      navigateTo,
      updatePreviewProfile,
      setPreferredLanguage,
      setPreferredNeighbourhood,
      setLargeTextMode,
      openReportDetail,
      closeReportDetail,
      openActivityDetail,
      closeActivityDetail,
      openNotificationTarget,
      submitCitizenReport,
      updateReportStatus,
      verifyOrDisputeReport,
      updateNgoActivityStatus,
      joinCommunityActivity,
      toggleCategoryActive,
      addCategory,
      markNotificationRead,
      markAllNotificationsRead,
      approveRoleRequest,
      rejectRoleRequest,
      seedPilotDataToFirestore,
      showToast,
      dismissToast,
    }),
    [
      viewMode,
      selectedLoginRole,
      pendingPageAfterLogin,
      activeRole,
      activePage,
      isUnlockedPreview,
      previewProfile,
      preferredLanguage,
      preferredNeighbourhood,
      largeTextMode,
      reports,
      sampleReports,
      allMapReports,
      ngoActivities,
      activityParticipations,
      joinedActivityIds,
      notifications,
      sampleNotifications,
      categories,
      users,
      roleRequests,
      departments,
      ngos,
      issueClusters,
      selectedReportId,
      selectedActivityId,
      toast,
      dataLoading,
      openRoleLogin,
      openSignInPage,
      switchPortalRole,
      enterAuthorizedWorkspace,
      returnToLanding,
      signOutAndReturn,
      navigateTo,
      updatePreviewProfile,
      setPreferredLanguage,
      setPreferredNeighbourhood,
      openReportDetail,
      closeReportDetail,
      openActivityDetail,
      closeActivityDetail,
      openNotificationTarget,
      submitCitizenReport,
      updateReportStatus,
      verifyOrDisputeReport,
      updateNgoActivityStatus,
      joinCommunityActivity,
      toggleCategoryActive,
      addCategory,
      markNotificationRead,
      markAllNotificationsRead,
      approveRoleRequest,
      rejectRoleRequest,
      seedPilotDataToFirestore,
      showToast,
      dismissToast,
    ]
  );

  return <CivicContext.Provider value={value}>{children}</CivicContext.Provider>;
};

export function useCivic() {
  const ctx = useContext(CivicContext);
  if (!ctx) {
    throw new Error('useCivic must be used within a CivicProvider');
  }
  return ctx;
}
