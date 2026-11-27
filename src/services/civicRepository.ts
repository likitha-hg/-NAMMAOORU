import {
  INITIAL_CATEGORIES,
  INITIAL_DEPARTMENTS,
  INITIAL_NGO_ACTIVITIES,
  INITIAL_NGOS,
  INITIAL_NOTIFICATIONS,
  INITIAL_REPORTS,
  INITIAL_USERS,
  SAMPLE_ISSUE_CLUSTERS,
} from '../data/mockData';
import {
  AdminUserRecord,
  CivicCategory,
  CivicNotification,
  CivicReport,
  DepartmentRecord,
  IssueCluster,
  NgoActivity,
  NgoRecord,
} from '../types/civic';

/**
 * Frontend repository layer for NAMMAOORU.
 * Currently serves static sample demonstration data.
 * Designed so a Python FastAPI client (e.g. fetch('/api/v1/...')) can replace
 * these methods without rewriting UI components.
 */
export const civicRepository = {
  getInitialReports: (): CivicReport[] => INITIAL_REPORTS,
  getInitialNgoActivities: (): NgoActivity[] => INITIAL_NGO_ACTIVITIES,
  getInitialNotifications: (): CivicNotification[] => INITIAL_NOTIFICATIONS,
  getInitialCategories: (): CivicCategory[] => INITIAL_CATEGORIES,
  getInitialUsers: (): AdminUserRecord[] => INITIAL_USERS,
  getInitialDepartments: (): DepartmentRecord[] => INITIAL_DEPARTMENTS,
  getInitialNgos: (): NgoRecord[] => INITIAL_NGOS,
  getIssueClusters: (): IssueCluster[] => SAMPLE_ISSUE_CLUSTERS,
};
