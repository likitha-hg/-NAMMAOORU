/**
 * NAMMAOORU Firestore Security Rules Specification Tests (Dirty Dozen)
 *
 * Designed for execution against the Firebase Emulator Suite with
 * @firebase/rules-unit-testing when running locally.
 */

export interface SecurityTestCase {
  id: number;
  name: string;
  actor: {
    uid: string | null;
    email?: string;
    email_verified?: boolean;
    roleInDb?: 'citizen' | 'government' | 'ngo' | 'admin';
    departmentId?: string;
  };
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_SECURITY_CASES: SecurityTestCase[] = [
  {
    id: 1,
    name: 'Self-Assigned Admin Registration',
    actor: { uid: 'attacker-1', email: 'attacker@example.com', email_verified: true },
    operation: 'create',
    path: '/users/attacker-1',
    payload: { uid: 'attacker-1', role: 'admin', approvalStatus: 'approved' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Self-Assigned Department Escalation via Profile Update',
    actor: { uid: 'citizen-1', email: 'citizen1@example.com', email_verified: true, roleInDb: 'citizen' },
    operation: 'update',
    path: '/users/citizen-1',
    payload: { role: 'government', departmentId: 'DEP-01' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Direct Admin Registry Forgery',
    actor: { uid: 'attacker-1', email: 'attacker@example.com', email_verified: true },
    operation: 'create',
    path: '/admins/attacker-1',
    payload: { uid: 'attacker-1', email: 'attacker@example.com', grantedBy: 'attacker-1' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Unverified Email Admin Spoof',
    actor: { uid: 'spoof-1', email: 'devstar3940@gcplab.me', email_verified: false },
    operation: 'get',
    path: '/users/citizen-1',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-Citizen Private Report Read',
    actor: { uid: 'citizen-2', email: 'citizen2@example.com', email_verified: true, roleInDb: 'citizen' },
    operation: 'get',
    path: '/reports/BLR-2026-0412',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Impersonated Report Creation',
    actor: { uid: 'citizen-2', email: 'citizen2@example.com', email_verified: true, roleInDb: 'citizen' },
    operation: 'create',
    path: '/reports/BLR-2026-9999',
    payload: { id: 'BLR-2026-9999', reporterUid: 'citizen-1', status: 'Submitted' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Government Department Cross-Boundary Update',
    actor: { uid: 'gov-dep2', email: 'gov2@example.com', email_verified: true, roleInDb: 'government', departmentId: 'DEP-02' },
    operation: 'update',
    path: '/reports/BLR-2026-0412',
    payload: { status: 'In progress' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Government Officer Forging Citizen Verification',
    actor: { uid: 'gov-dep3', email: 'gov3@example.com', email_verified: true, roleInDb: 'government', departmentId: 'DEP-03' },
    operation: 'update',
    path: '/reports/BLR-2026-0412',
    payload: { status: 'Citizen verified' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'NGO Mutating Official Civic Report',
    actor: { uid: 'ngo-1', email: 'ngo@example.com', email_verified: true, roleInDb: 'ngo' },
    operation: 'update',
    path: '/reports/BLR-2026-0412',
    payload: { status: 'Resolution reported' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Shadow Field Injection on Report Create',
    actor: { uid: 'citizen-1', email: 'citizen1@example.com', email_verified: true, roleInDb: 'citizen' },
    operation: 'create',
    path: '/reports/BLR-2026-8888',
    payload: { id: 'BLR-2026-8888', reporterUid: 'citizen-1', status: 'Submitted', isOfficiallyApproved: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Terminal State Tampering on Citizen-Verified Report',
    actor: { uid: 'gov-dep5', email: 'gov5@example.com', email_verified: true, roleInDb: 'government', departmentId: 'DEP-05' },
    operation: 'update',
    path: '/reports/BLR-2026-0398',
    payload: { status: 'In progress' },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Resource Poisoning & Backdated Timestamp Forgery',
    actor: { uid: 'citizen-1', email: 'citizen1@example.com', email_verified: true, roleInDb: 'citizen' },
    operation: 'create',
    path: '/reports/invalid..id',
    payload: { title: 'A'.repeat(5000), createdAt: '2020-01-01T00:00:00Z' },
    expected: 'PERMISSION_DENIED',
  },
];
