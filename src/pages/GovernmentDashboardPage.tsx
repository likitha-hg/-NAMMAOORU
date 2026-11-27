import React, { useState } from 'react';
import { Building2, Search } from 'lucide-react';
import { DemoNotice } from '../components/ui/DemoNotice';
import { EmptyState } from '../components/ui/EmptyState';
import { PriorityText, StatusIndicator } from '../components/ui/StatusIndicator';
import { useCivic } from '../context/CivicContext';
import { ReportStatus } from '../types/civic';

const ALL_STATUSES: ReportStatus[] = [
  ReportStatus.SUBMITTED,
  ReportStatus.UNDER_REVIEW,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.RESOLUTION_REPORTED,
  ReportStatus.AWAITING_VERIFICATION,
  ReportStatus.CITIZEN_VERIFIED,
  ReportStatus.DISPUTED_REOPENED,
];

export const GovernmentDashboardPage: React.FC<{ mode?: 'dashboard' | 'workspace' }> = ({
  mode = 'dashboard',
}) => {
  const { reports, openReportDetail, updateReportStatus } = useCivic();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');

  const assignedCount = reports.filter(
    (r) => r.status === ReportStatus.ASSIGNED || r.status === ReportStatus.IN_PROGRESS
  ).length;
  const newReportsCount = reports.filter((r) => r.status === ReportStatus.SUBMITTED).length;
  const underReviewCount = reports.filter((r) => r.status === ReportStatus.UNDER_REVIEW).length;
  const resolutionReportedCount = reports.filter(
    (r) =>
      r.status === ReportStatus.RESOLUTION_REPORTED ||
      r.status === ReportStatus.AWAITING_VERIFICATION
  ).length;

  const filteredReports = reports.filter((r) => {
    if (statusFilter !== 'All' && r.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        r.id.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.neighbourhood.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14532D]">
            <Building2 className="h-3.5 w-3.5" aria-hidden="true" />
            BBMP Civic Engineering & Sanitation Desk (Demonstration View)
          </p>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#1C2420]">
            {mode === 'workspace' ? 'Assigned Reports Management' : 'Government Department Dashboard'}
          </h1>
          <p className="text-sm text-[#526058]">
            Review citizen reports, update field progress across 8 lifecycle stages, and inspect evidence history.
          </p>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Assigned & In Progress</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
            {assignedCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Active field queues</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">New Reports</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#14532D] tabular-nums">
            {newReportsCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Submitted & awaiting triage</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Reports Under Review</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1E40AF] tabular-nums">
            {underReviewCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Checking ward jurisdiction</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Resolution Reported</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#166534] tabular-nums">
            {resolutionReportedCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Pending citizen verification</p>
        </div>
      </div>

      {/* Search & Status Filter */}
      <div className="flex flex-col sm:flex-row gap-3 rounded-xl border border-[#E2E8E4] bg-white p-4">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#526058]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Report ID, neighbourhood, category, or issue..."
            aria-label="Search department reports"
            className="w-full rounded-lg border border-[#E2E8E4] bg-white py-2 pl-9 pr-3 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
          />
        </div>
        <div className="sm:w-64">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter reports by status"
            className="w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
          >
            <option value="All">All Statuses ({reports.length})</option>
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Management Table (Desktop) & Cards (Mobile) */}
      {filteredReports.length === 0 ? (
        <EmptyState
          title="No civic reports match this filter"
          description="Clear the search input or select All Statuses to inspect incoming demonstration tickets."
          actionLabel="Reset Filter"
          onAction={() => {
            setSearchQuery('');
            setStatusFilter('All');
          }}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-[#E2E8E4] bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#E2E8E4] bg-[#F6F8F7] text-xs font-semibold text-[#526058]">
                  <th className="px-4 py-3">Report ID</th>
                  <th className="px-4 py-3">Problem Description</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Current Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8E4]">
                {filteredReports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-[#F6F8F7]/70">
                    <td className="px-4 py-3.5 font-mono text-xs font-medium text-[#1C2420] tabular-nums whitespace-nowrap">
                      {rep.id}
                    </td>
                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="font-medium text-[#1C2420] line-clamp-1">{rep.title}</p>
                      <p className="text-xs text-[#526058] line-clamp-1">
                        Suggested: {rep.suggestedDepartment}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#29322D] whitespace-nowrap">
                      {rep.category}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#29322D] whitespace-nowrap">
                      {rep.neighbourhood}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#526058] tabular-nums whitespace-nowrap">
                      {rep.dateSubmitted}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <PriorityText priority={rep.priority} />
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <select
                        aria-label={`Change status for ${rep.id}`}
                        value={rep.status}
                        onChange={(e) =>
                          updateReportStatus(
                            rep.id,
                            e.target.value as ReportStatus,
                            `Quick status update to ${e.target.value} in Department table.`
                          )
                        }
                        className="rounded-lg border border-[#E2E8E4] bg-white px-2.5 py-1.5 text-xs font-medium text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                      >
                        {ALL_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openReportDetail(rep.id)}
                        className="rounded-lg border border-[#E2E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#14532D] hover:bg-[#EDF5F0]"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile/Tablet Cards */}
          <div className="space-y-3 lg:hidden">
            {filteredReports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#526058]">
                      <span className="font-mono tabular-nums font-medium text-[#1C2420]">
                        {rep.id}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{rep.neighbourhood}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{rep.dateSubmitted}</span>
                    </div>
                    <h2 className="mt-1 text-sm font-semibold text-[#1C2420]">{rep.title}</h2>
                  </div>
                  <PriorityText priority={rep.priority} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <StatusIndicator status={rep.status} compact />
                  <button
                    type="button"
                    onClick={() => openReportDetail(rep.id)}
                    className="rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] px-3 py-1.5 text-xs font-medium text-[#14532D]"
                  >
                    Manage & Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <DemoNotice description="Status updates made in this department workspace modify local demonstration state only. No real government notifications or external municipal submissions are triggered." />
    </div>
  );
};
