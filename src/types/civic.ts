export enum UserRole {
  CITIZEN = 'citizen',
  GOVERNMENT = 'government',
  NGO = 'ngo',
  ADMIN = 'admin',
}

export enum ReportStatus {
  SUBMITTED = 'Submitted',
  UNDER_REVIEW = 'Under review',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In progress',
  RESOLUTION_REPORTED = 'Resolution reported',
  AWAITING_VERIFICATION = 'Awaiting citizen verification',
  CITIZEN_VERIFIED = 'Citizen verified',
  DISPUTED_REOPENED = 'Disputed / Reopened',
}

export enum ReportPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum ReportMethod {
  PHOTOGRAPH = 'Photograph',
  VOICE = 'Voice',
  TEXT = 'Text',
}

export enum LanguageOption {
  ENGLISH = 'English',
  KANNADA = 'Kannada',
  HINDI = 'Hindi',
}

export type AppPage =
  | 'dashboard'
  | 'report'
  | 'map'
  | 'community'
  | 'pulse'
  | 'workspace'
  | 'notifications'
  | 'profile';

export interface StatusHistoryEntry {
  status: ReportStatus;
  date: string;
  actor: string;
  note: string;
}

export type ApprovalStatus = 'approved' | 'pending' | 'rejected';

export interface NotificationPreferences {
  statusUpdates: boolean;
  verificationRequests: boolean;
  communityActivities: boolean;
  departmentProgress: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  statusUpdates: true,
  verificationRequests: true,
  communityActivities: true,
  departmentProgress: true,
};

export interface UserProfileRecord {
  uid: string;
  displayName: string;
  email: string;
  phoneNumber: string;
  address: string;
  role: UserRole;
  approvalStatus: ApprovalStatus;
  departmentId: string;
  departmentName: string;
  organisationId: string;
  organisationName: string;
  neighbourhood: string;
  preferredLanguage: LanguageOption;
  notificationPreferences: NotificationPreferences;
}

export interface RoleAccessRequest {
  uid: string;
  displayName: string;
  email: string;
  requestedRole: UserRole.GOVERNMENT | UserRole.NGO | UserRole.ADMIN;
  organisationName: string;
  departmentId: string;
  organisationId: string;
  justification: string;
  status: ApprovalStatus;
  reviewedBy: string;
}

export interface CivicReport {
  id: string;
  title: string;
  description: string;
  category: string;
  neighbourhood: string;
  address: string;
  dateSubmitted: string;
  status: ReportStatus;
  priority: ReportPriority;
  method: ReportMethod;
  language: LanguageOption;
  reporterName: string;
  reporterUid?: string;
  assignedDepartmentId?: string;
  assignedOfficerUids?: string[];
  suggestedDepartment: string;
  aiClassificationNote: string;
  evidenceSummary: string;
  evidenceImageUrl?: string;
  mapCoords: { x: number; y: number };
  lat?: number;
  lng?: number;
  formattedAddress?: string;
  placeId?: string;
  statusHistory: StatusHistoryEntry[];
  isUserSubmitted?: boolean;
  isSampleDemo?: boolean;
}

export enum NgoActivityStatus {
  AVAILABLE = 'Available',
  ACCEPTED = 'Accepted',
  ONGOING = 'Ongoing',
  COMPLETED = 'Completed',
  DECLINED = 'Declined',
}

export interface NgoActivity {
  id: string;
  title: string;
  category: string;
  neighbourhood: string;
  location: string;
  date: string;
  timeWindow: string;
  organiser: string;
  organisationId?: string;
  permittedNgoUids?: string[];
  visibility?: 'public' | 'ngo_only';
  description: string;
  volunteersJoined: number;
  volunteerGoal: number;
  status: NgoActivityStatus;
  relatedReportId?: string;
  evidenceNote?: string;
  isSampleDemo?: boolean;
}

export interface ActivityParticipation {
  id: string;
  activityId: string;
  activityTitle: string;
  userUid: string;
  userName: string;
  userEmail: string;
  neighbourhood: string;
  status: 'registered' | 'cancelled';
  createdAtLabel: string;
}

export enum NotificationType {
  SUBMISSION = 'Report submission confirmation',
  DEPARTMENT_PROGRESS = 'Department progress update',
  ASSIGNMENT_UPDATE = 'Assignment update',
  VERIFICATION_REQUEST = 'Citizen verification request',
  DISPUTED_REOPENED = 'Disputed / reopened report',
  NGO_ANNOUNCEMENT = 'NGO activity announcement',
  COMMUNITY_UPDATE = 'Community activity update',
  STATUS_UPDATE = 'Report status update',
}

export interface CivicNotification {
  id: string;
  recipientUid?: string;
  type: NotificationType;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  targetRole?: UserRole;
  relatedPage?: AppPage;
  relatedReportId?: string;
  relatedActivityId?: string;
  isSampleDemo?: boolean;
}

export interface CivicCategory {
  id: string;
  name: string;
  defaultDepartment: string;
  defaultDepartmentId?: string;
  active: boolean;
  reportCount: number;
}

export interface AdminUserRecord {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  neighbourhood: string;
  joinedDate: string;
  status: 'Active' | 'Pending Review' | 'Rejected';
  departmentId?: string;
  organisationId?: string;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  jurisdiction: string;
  assignedCount: number;
  resolvedCount: number;
}

export interface NgoRecord {
  id: string;
  name: string;
  focusArea: string;
  neighbourhoods: string[];
  activeInitiatives: number;
  status: 'Verified Partner' | 'Onboarding';
}

export interface IssueCluster {
  id: string;
  title: string;
  neighbourhood: string;
  category: string;
  groupedReportCount: number;
  timeframe: string;
  summary: string;
  trendDirection: 'Increasing' | 'Steady' | 'Improving';
}

export interface RoleMeta {
  id: UserRole;
  label: string;
  shortLabel: string;
  subtitle: string;
  workspaceNavLabel: string;
  demoPersonName: string;
  demoOrganisation: string;
  primaryNeighbourhood: string;
}

export interface DynamicFollowUpQuestion {
  id: string;
  field: 'title' | 'category' | 'neighbourhood' | 'address' | 'description' | 'safety_impact' | 'duration';
  question: string;
  reason: string;
  placeholder: string;
}

export interface GeminiReportAnalysis {
  detectedLanguage: LanguageOption;
  transcription?: string;
  extracted: {
    title: string;
    category: string;
    neighbourhood: string;
    address: string;
    description: string;
    duration?: string;
    impactAndSafety?: string;
    suggestedDepartment: string;
    priority: ReportPriority;
    aiSummary: string;
  };
  missingFields: string[];
  followUpQuestions: DynamicFollowUpQuestion[];
  readyForReview: boolean;
  confidenceNote: string;
}

export interface TranscribeAudioResponse {
  transcript: string;
  detectedLanguage: LanguageOption;
  model: string;
}

export type LiveVoiceConnectionState =
  | 'Disconnected'
  | 'Connecting'
  | 'Listening'
  | 'Speaking';

export interface LiveTranscriptEntry {
  id: string;
  speaker: 'citizen' | 'assistant';
  text: string;
  timestamp: string;
}

export interface LiveVoiceExtractedDraft {
  title: string;
  category: string;
  description: string;
  neighbourhood: string;
  address: string;
  duration: string;
  impactAndSafety: string;
  detectedLanguage: LanguageOption;
  suggestedDepartment: string;
  priority: ReportPriority;
  originalStatementSummary: string;
  fieldsNeedingConfirmation: string[];
  aiSummary: string;
}

export interface GeocodeLocationResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  placeId?: string;
  matchedNeighbourhood?: string;
}

export interface MapsGroundingPlaceLink {
  title: string;
  uri: string;
  reviewSnippets?: string[];
}

export interface MapsGroundingResult {
  summary: string;
  places: MapsGroundingPlaceLink[];
  model: string;
}


