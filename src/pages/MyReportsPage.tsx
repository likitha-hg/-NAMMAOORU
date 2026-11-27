import React, { useState } from 'react';
import {
  CheckCircle2,
  Eye,
  FilePlus2,
  FlaskConical,
  RotateCcw,
} from 'lucide-react';
import { DemoNotice } from '../components/ui/DemoNotice';
import { EmptyState } from '../components/ui/EmptyState';
import { PriorityText, StatusIndicator } from '../components/ui/StatusIndicator';
import { useCivic } from '../context/CivicContext';
import { CivicReport, ReportStatus } from '../types/civic';

type CitizenFilter = 'ALL' | 'ACTIVE' | 'NEEDS_VERIFICATION' | 'CLOSED';

export const MyReportsPage: React.FC = () => {
  const {
    reports,
    sampleReports,
    openReportDetail,
    verifyOrDisputeReport,
    navigateTo,
  } = useCivic();

  const [filter, setFilter] = useState<CitizenFilter>('ALL');
  const [showDemoSamples, setShowDemoSamples] = useState<boolean>(false);

  // Strictly personal Firestore reports belonging to the authenticated citizen
  const myPersonalReports = reports;

  // Clearly labelled sample records for testing Verify / Dispute workflow
  const demoUserSamples = sampleReports.filter((r) => r.isUserSubmitted);

  const filterList = (list: CivicReport[]) =>
    list.filter((r) => {
      if (filter === 'ACTIVE') {
        return [
          ReportStatus.SUBMITTED,
          ReportStatus.UNDER_REVIEW,
          ReportStatus.ASSIGNED,
          ReportStatus.IN_PROGRESS,
          ReportStatus.DISPUTED_REOPENED,
        ].includes(r.status);
      }
      if (filter === 'NEEDS_VERIFICATION') {
        return (
          r.status === ReportStatus.AWAITING_VERIFICATION ||
          r.status === ReportStatus.RESOLUTION_REPORTED
        );
      }
      if (filter === 'CLOSED') {
        return r.status === ReportStatus.CITIZEN_VERIFIED;
      }
      return true;
    });

  const filteredPersonal = filterList(myPersonalReports);
  const filteredDemoSamples = filterList(demoUserSamples);

  const tabs: { id: CitizenFilter; label: string; count: number }[] = [
    { id: 'ALL', label: 'All Reports', count: myPersonalReports.length },
    {
      id: 'ACTIVE',
      label: 'Active',
      count: myPersonalReports.filter((r) =>
        [
          ReportStatus.SUBMITTED,
          ReportStatus.UNDER_REVIEW,
          ReportStatus.ASSIGNED,
          ReportStatus.IN_PROGRESS,
          ReportStatus.DISPUTED_REOPENED,
        ].includes(r.status)
      ).length,
    },
    {
      id: 'NEEDS_VERIFICATION',
      label: 'Needs Verification',
      count: myPersonalReports.filter(
        (r) =>
          r.status === ReportStatus.AWAITING_VERIFICATION ||
          r.status === ReportStatus.RESOLUTION_REPORTED
      ).length,
    },
    {
      id: 'CLOSED',
      label: 'Verified and Closed',
      count: myPersonalReports.filter((r) => r.status === ReportStatus.CITIZEN_VERIFIED).length,
    },
  ];

  const renderReportCard = (report: CivicReport) => {
    const needsVerification =
      report.status === ReportStatus.AWAITING_VERIFICATION ||
      report.status === ReportStatus.RESOLUTION_REPORTED;

    return (
      <article
        key={report.id}
        className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#526058]">
              <span className="font-mono font-medium text-[#1C2420] tabular-nums">
                {report.id}
              </span>
              <span aria-hidden="true">·</span>
              <span>{report.category}</span>
              <span aria-hidden="true">·</span>
              <span>{report.neighbourhood}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{report.dateSubmitted}</span>
              {report.isSampleDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="rounded bg-[#F3F5F4] px-1.5 py-0.5 text-[11px] font-semibold text-[#526058]">
                    Demonstration Sample
                  </span>
                </>
              )}
            </div>
            <h2 className="font-display text-base sm:text-lg font-semibold text-[#1C2420]">
              {report.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <PriorityText priority={report.priority} />
            <StatusIndicator status={report.status} />
          </div>
        </div>

        <p className="text-sm text-[#29322D] leading-relaxed">{report.description}</p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E2E8E4] pt-4">
          <div className="text-xs text-[#526058]">
            <span>Suggested department: </span>
            <span className="font-medium text-[#1C2420]">{report.suggestedDepartment}</span>
            <span className="mx-2" aria-hidden="true">
              ·
            </span>
            <span>{report.statusHistory.length} timeline updates</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {needsVerification && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    void verifyOrDisputeReport(
                      report.id,
                      'verify',
                      'Citizen verified the resolution from My Reports.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Verify Resolution</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void verifyOrDisputeReport(
                      report.id,
                      'dispute',
                      'Issue still visible on site; reopened by citizen.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-3.5 py-2 text-xs font-semibold text-[#991B1B] transition-colors hover:bg-[#FEF2F2] whitespace-nowrap"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Dispute / Reopen</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => openReportDetail(report.id)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-xs font-medium text-[#1C2420] transition-colors hover:border-[#14532D] hover:text-[#14532D] whitespace-nowrap"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>View Details</span>
            </button>
          </div>
        </div>
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1C2420]">My Reports</h1>
          <p className="text-sm text-[#526058]">
            Manage civic issues submitted from your authenticated Citizen account, inspect status history and resolution evidence, and verify or dispute completed work.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigateTo('report')}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
        >
          <FilePlus2 className="h-4 w-4" aria-hidden="true" />
          <span>Report New Problem</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter personal reports">
          {tabs.map((tab) => {
            const active = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(tab.id)}
                className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
                    : 'border-[#E2E8E4] bg-white text-[#526058] hover:text-[#1C2420]'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowDemoSamples((prev) => !prev)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            showDemoSamples
              ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
              : 'border-[#E2E8E4] bg-white text-[#526058] hover:text-[#1C2420]'
          }`}
        >
          <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
          <span>
            {showDemoSamples
              ? 'Hide Demonstration Sample Lifecycle'
              : 'Preview Verification Lifecycle (Samples)'}
          </span>
        </button>
      </div>

      {/* Authenticated Citizen Personal Reports */}
      {filteredPersonal.length === 0 ? (
        <EmptyState
          title={
            myPersonalReports.length === 0
              ? 'You have not submitted any civic reports yet'
              : 'No personal reports match this filter'
          }
          description={
            myPersonalReports.length === 0
              ? 'Submit your first neighbourhood issue using a photograph, voice note, or description. Only reports belonging to your account appear here.'
              : 'Switch to All Reports to view all of your submitted civic issues.'
          }
          actionLabel={myPersonalReports.length === 0 ? 'Report a Civic Problem' : 'Show All Reports'}
          onAction={() =>
            myPersonalReports.length === 0 ? navigateTo('report') : setFilter('ALL')
          }
        />
      ) : (
        <div className="space-y-4">{filteredPersonal.map(renderReportCard)}</div>
      )}

      {/* Optional Clearly Labelled Demonstration Lifecycle Section */}
      {showDemoSamples && (
        <section className="space-y-4 border-t border-[#E2E8E4] pt-6">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold text-[#1C2420]">
              Bengaluru Pilot Sample Reports (Interactive Verification Preview)
            </h2>
            <p className="text-xs text-[#526058]">
              These clearly labelled demonstration records are separate from your personal Firestore submissions so you can test the &ldquo;Verify Resolution&rdquo; and &ldquo;Dispute / Reopen&rdquo; steps immediately.
            </p>
          </div>
          {filteredDemoSamples.length === 0 ? (
            <p className="rounded-lg border border-[#E2E8E4] bg-white p-4 text-xs text-[#526058]">
              No demonstration samples match the selected filter tab.
            </p>
          ) : (
            <div className="space-y-4">{filteredDemoSamples.map(renderReportCard)}</div>
          )}
        </section>
      )}

      <DemoNotice description="My Reports strictly isolates your private reports via Firebase Authentication and Firestore Security Rules. Other citizens and NGOs cannot read your personal reports." />
    </div>
  );
};
