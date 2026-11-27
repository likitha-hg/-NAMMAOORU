import React, { useState } from 'react';
import { CheckCircle2, Database, Plus, ShieldCheck, XCircle } from 'lucide-react';
import { CivicIncidentAnalyticsDashboard } from '../components/analytics/CivicIncidentAnalyticsDashboard';
import { NgoStatusLabel, StatusIndicator } from '../components/ui/StatusIndicator';
import { ROLE_METADATA } from '../data/mockData';
import { useCivic } from '../context/CivicContext';
import { NgoActivityStatus, ReportStatus, UserRole } from '../types/civic';

type AdminTab =
  | 'overview'
  | 'users'
  | 'departments'
  | 'ngos'
  | 'reports'
  | 'categories'
  | 'activities';

export const AdminDashboardPage: React.FC<{ mode?: 'dashboard' | 'workspace' }> = ({
  mode = 'dashboard',
}) => {
  const {
    users,
    roleRequests,
    departments,
    ngos,
    reports,
    categories,
    ngoActivities,
    toggleCategoryActive,
    addCategory,
    openReportDetail,
    approveRoleRequest,
    rejectRoleRequest,
    seedPilotDataToFirestore,
  } = useCivic();

  const [activeTab, setActiveTab] = useState<AdminTab>(
    mode === 'workspace' ? 'users' : 'overview'
  );
  const [seeding, setSeeding] = useState(false);
  const [busyReqUid, setBusyReqUid] = useState<string | null>(null);
  const pendingRequests = roleRequests.filter((r) => r.status === 'pending');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDept, setNewCatDept] = useState('');

  const activeIssuesCount = reports.filter(
    (r) => r.status !== ReportStatus.CITIZEN_VERIFIED
  ).length;
  const ongoingActivitiesCount = ngoActivities.filter(
    (a) =>
      a.status === NgoActivityStatus.ONGOING ||
      a.status === NgoActivityStatus.ACCEPTED
  ).length;

  const activityCategoryNames = Array.from(new Set(ngoActivities.map((a) => a.category)));
  const activityByCategory = activityCategoryNames.map((cat) => ({
    category: cat,
    count: ngoActivities.filter((a) => a.category === cat).length,
  }));

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addCategory(newCatName, newCatDept);
    setNewCatName('');
    setNewCatDept('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14532D]">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            NAMMAOORU Bengaluru Pilot Operations · Authorized Administrator
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#1C2420]">
            {mode === 'workspace'
              ? 'Platform Management Console'
              : 'Platform Administrator Dashboard'}
          </h1>
          <p className="text-sm text-[#526058]">
            Manage user role approvals, departments, NGO partners, issue categories, and Bengaluru civic records.
          </p>
        </div>

        <button
          type="button"
          disabled={seeding}
          onClick={async () => {
            setSeeding(true);
            try {
              await seedPilotDataToFirestore();
            } finally {
              setSeeding(false);
            }
          }}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-4 py-2 text-xs font-semibold text-[#14532D] transition-colors hover:bg-[#DCEEE4] disabled:opacity-60 whitespace-nowrap"
        >
          <Database className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{seeding ? 'Seeding Firestore...' : 'Seed Bengaluru Pilot Records'}</span>
        </button>
      </div>

      {/* 5 Overview KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Registered Users</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
            {users.length}
          </p>
          <p className="mt-1 text-xs text-[#526058]">
            {pendingRequests.length} pending approvals
          </p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Total Civic Reports</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
            {reports.length}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Active demo records</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Active Neighbourhood Issues</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#9A3412] tabular-nums">
            {activeIssuesCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Not yet citizen-verified</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Registered NGOs</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#14532D] tabular-nums">
            {ngos.length}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Community partners</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 col-span-2 sm:col-span-1">
          <p className="text-xs font-medium text-[#526058]">Ongoing Activities</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#14532D] tabular-nums">
            {ongoingActivitiesCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Accepted or underway</p>
        </div>
      </div>

      {/* Section Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E2E8E4] pb-3">
        {[
          { key: 'overview', label: 'Analytics' },
          {
            key: 'users',
            label:
              pendingRequests.length > 0
                ? `User Management (${pendingRequests.length} Pending)`
                : 'User Management',
          },
          { key: 'departments', label: 'Department Management' },
          { key: 'ngos', label: 'NGO Management' },
          { key: 'reports', label: 'Civic Report Overview' },
          { key: 'categories', label: 'Category Management' },
          { key: 'activities', label: 'Activity Management' },
        ].map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key as AdminTab)}
              className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'border-[#14532D] bg-[#14532D] text-white'
                  : 'border-[#E2E8E4] bg-white text-[#29322D] hover:bg-[#F6F8F7]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <CivicIncidentAnalyticsDashboard allowAddLocality={true} embedded={true} />

          {/* Community Activities by Category */}
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-[#1C2420]">
                Community Activities by Category
              </h2>
              <span className="text-xs text-[#526058]">NGO &amp; Volunteer Initiatives</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activityByCategory.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between rounded-lg border border-[#E2E8E4] px-3.5 py-2.5 text-sm"
                >
                  <span className="font-medium text-[#1C2420]">{item.category}</span>
                  <span className="font-mono text-xs font-semibold text-[#14532D] tabular-nums">
                    {item.count} initiatives
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          {/* Pending Privileged Role Approvals */}
          <div className="rounded-xl border border-[#CFE3D5] bg-white overflow-hidden">
            <div className="border-b border-[#E2E8E4] bg-[#EDF5F0] px-5 py-3.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-sm font-semibold text-[#14532D]">
                  Pending Role Access Approvals
                </h2>
                <p className="text-xs text-[#29322D]">
                  Review Government Department, NGO, and Administrator account requests before granting permissions.
                </p>
              </div>
              <span className="font-mono text-xs font-semibold text-[#14532D] tabular-nums">
                {pendingRequests.length} pending
              </span>
            </div>

            {pendingRequests.length === 0 ? (
              <p className="px-5 py-4 text-sm text-[#526058]">
                No pending role access requests at this time.
              </p>
            ) : (
              <div className="divide-y divide-[#E2E8E4]">
                {pendingRequests.map((req) => (
                  <div
                    key={req.uid}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-semibold text-[#14532D]">
                          Requested: {ROLE_METADATA[req.requestedRole].label}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#526058]">{req.organisationName}</span>
                      </div>
                      <p className="text-sm font-semibold text-[#1C2420]">
                        {req.displayName}{' '}
                        <span className="font-normal text-[#526058]">({req.email})</span>
                      </p>
                      <p className="text-xs text-[#29322D]">{req.justification}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={busyReqUid === req.uid}
                        onClick={async () => {
                          setBusyReqUid(req.uid);
                          try {
                            await approveRoleRequest(req, {
                              departmentId:
                                req.requestedRole === UserRole.GOVERNMENT
                                  ? req.departmentId || 'DEP-01'
                                  : undefined,
                              organisationId:
                                req.requestedRole === UserRole.NGO
                                  ? req.organisationId || 'NGO-01'
                                  : undefined,
                            });
                          } finally {
                            setBusyReqUid(null);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-60 whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Approve Access</span>
                      </button>
                      <button
                        type="button"
                        disabled={busyReqUid === req.uid}
                        onClick={async () => {
                          setBusyReqUid(req.uid);
                          try {
                            await rejectRoleRequest(req);
                          } finally {
                            setBusyReqUid(null);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-3.5 py-2 text-xs font-semibold text-[#991B1B] hover:bg-[#FEF2F2] disabled:opacity-60 whitespace-nowrap"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#E2E8E4] bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8E4] bg-[#F6F8F7] text-xs font-semibold text-[#526058]">
                  <th className="px-4 py-3">Name &amp; Email</th>
                  <th className="px-4 py-3">Verified Role</th>
                  <th className="px-4 py-3">Neighbourhood / Zone</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Account Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E4]">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1C2420]">{u.name}</p>
                      {u.email && <p className="text-xs text-[#526058]">{u.email}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs capitalize text-[#29322D]">{u.role}</td>
                    <td className="px-4 py-3 text-xs text-[#29322D]">{u.neighbourhood}</td>
                    <td className="px-4 py-3 text-xs text-[#526058] tabular-nums">{u.joinedDate}</td>
                    <td className="px-4 py-3 text-xs font-medium text-[#14532D]">{u.status}</td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-[#526058]">
                      No registered user records loaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="overflow-x-auto rounded-xl border border-[#E2E8E4] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#E2E8E4] bg-[#F6F8F7] text-xs font-semibold text-[#526058]">
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">Jurisdiction</th>
                <th className="px-4 py-3 text-right">Assigned (Sample)</th>
                <th className="px-4 py-3 text-right">Resolved (Sample)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8E4]">
              {departments.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-medium text-[#1C2420]">{d.name}</td>
                  <td className="px-4 py-3 text-xs text-[#526058]">{d.jurisdiction}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs tabular-nums">
                    {d.assignedCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-[#14532D] tabular-nums">
                    {d.resolvedCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'ngos' && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ngos.map((ngo) => (
            <div
              key={ngo.id}
              className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-semibold text-[#1C2420]">
                  {ngo.name}
                </h3>
                <span className="text-xs font-medium text-[#14532D]">{ngo.status}</span>
              </div>
              <p className="text-sm text-[#29322D]">{ngo.focusArea}</p>
              <p className="text-xs text-[#526058]">
                Active wards: {ngo.neighbourhoods.join(', ')} ·{' '}
                <span className="tabular-nums">{ngo.activeInitiatives} initiatives</span>
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="divide-y divide-[#E2E8E4] rounded-xl border border-[#E2E8E4] bg-white">
          {reports.map((rep) => (
            <div
              key={rep.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-[#526058]">
                  <span className="font-mono tabular-nums text-[#1C2420]">{rep.id}</span>
                  <span aria-hidden="true">·</span>
                  <span>{rep.neighbourhood}</span>
                  <span aria-hidden="true">·</span>
                  <span>{rep.category}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-[#1C2420]">{rep.title}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <StatusIndicator status={rep.status} compact />
                <button
                  type="button"
                  onClick={() => openReportDetail(rep.id)}
                  className="rounded-lg border border-[#E2E8E4] px-3 py-1.5 text-xs font-medium text-[#14532D] hover:bg-[#EDF5F0]"
                >
                  Inspect
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="space-y-4">
          <form
            onSubmit={handleAddCategory}
            className="flex flex-col sm:flex-row gap-3 rounded-xl border border-[#E2E8E4] bg-white p-4"
          >
            <input
              type="text"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="New civic category name..."
              className="flex-1 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm focus:border-[#14532D] focus:outline-none"
            />
            <input
              type="text"
              value={newCatDept}
              onChange={(e) => setNewCatDept(e.target.value)}
              placeholder="Default suggested department..."
              className="flex-1 rounded-lg border border-[#E2E8E4] px-3 py-2 text-sm focus:border-[#14532D] focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white hover:bg-[#166534] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Add Sample Category</span>
            </button>
          </form>

          <div className="divide-y divide-[#E2E8E4] rounded-xl border border-[#E2E8E4] bg-white">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-[#1C2420]">{cat.name}</p>
                  <p className="text-xs text-[#526058]">
                    Default routing: {cat.defaultDepartment} ·{' '}
                    <span className="tabular-nums">{cat.reportCount} sample reports</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCategoryActive(cat.id)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                    cat.active
                      ? 'border-[#CFE3D5] bg-[#EDF5F0] text-[#14532D]'
                      : 'border-[#E2E8E4] bg-[#F6F8F7] text-[#526058]'
                  }`}
                >
                  {cat.active ? 'Active in Forms' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'activities' && (
        <div className="divide-y divide-[#E2E8E4] rounded-xl border border-[#E2E8E4] bg-white">
          {ngoActivities.map((act) => (
            <div
              key={act.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4"
            >
              <div>
                <p className="text-xs text-[#526058]">
                  {act.category} · {act.neighbourhood} · {act.organiser}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-[#1C2420]">{act.title}</p>
              </div>
              <NgoStatusLabel status={act.status} />
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
