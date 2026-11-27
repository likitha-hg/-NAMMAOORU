import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  FilePlus2,
  Map,
  MapPin,
  Users,
} from 'lucide-react';
import { BengaluruGoogleMap } from '../components/map/BengaluruGoogleMap';
import { CATEGORY_MAP_STYLES } from '../components/map/mapCategoryStyles';
import { NgoStatusLabel, StatusIndicator } from '../components/ui/StatusIndicator';
import { useAuth } from '../context/AuthContext';
import { useCivic } from '../context/CivicContext';
import { NgoActivityStatus, ReportStatus } from '../types/civic';

export const CitizenDashboard: React.FC = () => {
  const { userProfile } = useAuth();
  const {
    reports,
    ngoActivities,
    joinedActivityIds,
    preferredNeighbourhood,
    navigateTo,
    openReportDetail,
    openActivityDetail,
  } = useCivic();

  const [selectedPreviewId, setSelectedPreviewId] = useState<string>('');

  const totalSubmitted = reports.length;
  const beingAddressed = reports.filter((r) =>
    [
      ReportStatus.SUBMITTED,
      ReportStatus.UNDER_REVIEW,
      ReportStatus.ASSIGNED,
      ReportStatus.IN_PROGRESS,
    ].includes(r.status)
  ).length;
  const awaitingVerification = reports.filter(
    (r) =>
      r.status === ReportStatus.AWAITING_VERIFICATION ||
      r.status === ReportStatus.RESOLUTION_REPORTED
  ).length;
  const nearbyActivitiesCount = ngoActivities.filter(
    (a) => a.status !== NgoActivityStatus.DECLINED
  ).length;

  const recentReports = reports.slice(0, 5);
  const featuredActivities = ngoActivities.slice(0, 4);
  const selectedPreviewReport =
    reports.find((r) => r.id === selectedPreviewId) ?? null;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <section className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-medium text-[#14532D]">
              Bengaluru Pilot · {preferredNeighbourhood}
              {userProfile?.displayName ? ` · Welcome, ${userProfile.displayName}` : ''}
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#1C2420] [text-wrap:balance]">
              Welcome to your neighbourhood.
            </h1>
            <p className="text-sm sm:text-base text-[#29322D] leading-relaxed">
              See what&apos;s happening around {preferredNeighbourhood} and across Bengaluru, report local civic issues, and join community action.
            </p>
          </div>
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('report')}
              className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
            >
              <FilePlus2 className="h-4 w-4" aria-hidden="true" />
              <span>Report a Civic Problem</span>
            </button>
          </div>
        </div>
      </section>

      {/* Quick Action Cards */}
      <section aria-label="Quick actions">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={() => navigateTo('report')}
            className="flex flex-col justify-between rounded-xl border border-[#E2E8E4] bg-white p-5 text-left transition-colors hover:border-[#14532D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EDF5F0] text-[#14532D]">
                <FilePlus2 className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-display text-base font-semibold text-[#1C2420]">
                Report a Civic Problem
              </h2>
              <p className="text-sm text-[#526058]">
                Share a photo, voice note, or text description in Kannada, English, or Hindi with exact Google Maps location pinning.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#14532D]">
              <span>Start report</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('map')}
            className="flex flex-col justify-between rounded-xl border border-[#E2E8E4] bg-white p-5 text-left transition-colors hover:border-[#14532D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EDF5F0] text-[#14532D]">
                <Map className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-display text-base font-semibold text-[#1C2420]">
                View Neighbourhood Map
              </h2>
              <p className="text-sm text-[#526058]">
                Explore your civic reports across Bengaluru on an interactive Google Map filtered by ward, category, and status.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#14532D]">
              <span>Open Bengaluru map</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigateTo('community')}
            className="flex flex-col justify-between rounded-xl border border-[#E2E8E4] bg-white p-5 text-left transition-colors hover:border-[#14532D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
          >
            <div className="space-y-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#EDF5F0] text-[#14532D]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </div>
              <h2 className="font-display text-base font-semibold text-[#1C2420]">
                Explore Community Activities
              </h2>
              <p className="text-sm text-[#526058]">
                Join neighbourhood clean-ups, tree plantations, lake restoration, and waste segregation workshops.
              </p>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-[#14532D]">
              <span>Browse activities</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </span>
          </button>
        </div>
      </section>

      {/* Neighbourhood Overview KPIs */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-[#1C2420]">
            Neighbourhood Overview
          </h2>
          <span className="text-xs text-[#526058]">
            Live summary of your authorised civic reports and community participation
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
            <p className="text-xs font-medium text-[#526058]">Your Reports Submitted</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
              {totalSubmitted}
            </p>
            <p className="mt-1 text-xs text-[#526058]">
              Pinned with stored coordinates
            </p>
          </div>

          <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
            <p className="text-xs font-medium text-[#526058]">Issues Being Addressed</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#14532D] tabular-nums">
              {beingAddressed}
            </p>
            <p className="mt-1 text-xs text-[#526058]">Submitted, reviewed, or in progress</p>
          </div>

          <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
            <p className="text-xs font-medium text-[#526058]">Awaiting Verification</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#9A3412] tabular-nums">
              {awaitingVerification}
            </p>
            <p className="mt-1 text-xs text-[#526058]">Needs resident confirmation</p>
          </div>

          <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
            <p className="text-xs font-medium text-[#526058]">Community Activities Nearby</p>
            <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
              {nearbyActivitiesCount}
            </p>
            <p className="mt-1 text-xs text-[#526058]">
              {joinedActivityIds.length} joined by you
            </p>
          </div>
        </div>
      </section>

      {/* Live Google Maps Neighbourhood Preview */}
      <section className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1C2420]">
              Neighbourhood Map Preview
            </h2>
            <p className="text-sm text-[#526058]">
              {reports.length > 0
                ? `Showing ${reports.length} of your civic ${reports.length === 1 ? 'report' : 'reports'} at exact stored coordinates. Click any marker to inspect details.`
                : `Interactive Google Map centred on ${preferredNeighbourhood}, Bengaluru. Submit a civic report with a map pin to see it plotted here.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => navigateTo('map')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
            >
              <Map className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Open Full Neighbourhood Map</span>
            </button>
          </div>
        </div>

        <BengaluruGoogleMap
          reports={reports}
          selectedReport={selectedPreviewReport}
          activeNeighbourhoodFilter={reports.length === 0 ? preferredNeighbourhood : 'ALL'}
          onSelectReport={(id) => setSelectedPreviewId(id)}
          onOpenReportModal={openReportDetail}
          heightClass="h-[280px] sm:h-[340px]"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[#526058]">
            {CATEGORY_MAP_STYLES.map((style) => (
              <span key={style.name} className="inline-flex items-center gap-1.5">
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ backgroundColor: style.bg }}
                >
                  {style.renderIcon('h-2.5 w-2.5 text-white')}
                </span>
                <span>{style.shortLabel}</span>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigateTo('report')}
            className="text-xs font-semibold text-[#14532D] hover:underline whitespace-nowrap"
          >
            + Pin a new civic issue
          </button>
        </div>
      </section>

      {/* Recent Civic Reports */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1C2420]">
              Your Recent Civic Reports
            </h2>
            <p className="text-sm text-[#526058]">
              Track status, stored map locations, and department progress for your submitted reports.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('workspace')}
            className="text-sm font-medium text-[#14532D] hover:underline whitespace-nowrap"
          >
            View My Reports
          </button>
        </div>

        {recentReports.length === 0 ? (
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-6 text-center space-y-3">
            <p className="font-display text-base font-semibold text-[#1C2420]">
              No civic reports submitted yet
            </p>
            <p className="mx-auto max-w-md text-sm text-[#526058]">
              Report a pothole, streetlight outage, waste hotspot, or drainage issue with an interactive Google Map pin to track its resolution.
            </p>
            <button
              type="button"
              onClick={() => navigateTo('report')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534]"
            >
              <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Report Your First Issue</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8E4] rounded-xl border border-[#E2E8E4] bg-white">
            {recentReports.map((report) => (
              <div
                key={report.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 sm:px-5 transition-colors hover:bg-[#F6F8F7]"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm sm:text-base font-semibold text-[#1C2420]">
                      {report.title}
                    </h3>
                    <span className="rounded-md bg-[#EDF5F0] px-2 py-0.5 text-[11px] font-medium text-[#14532D]">
                      Your Report
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#526058]">
                    <span className="font-mono tabular-nums">{report.id}</span>
                    <span aria-hidden="true">·</span>
                    <span>{report.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{report.neighbourhood}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{report.dateSubmitted}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <StatusIndicator status={report.status} />
                  <button
                    type="button"
                    onClick={() => openReportDetail(report.id)}
                    className="rounded-lg border border-[#E2E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#1C2420] transition-colors hover:border-[#14532D] hover:text-[#14532D] whitespace-nowrap"
                  >
                    View Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Nearby Community Activities */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1C2420]">
              Nearby Community Activities
            </h2>
            <p className="text-sm text-[#526058]">
              Neighbourhood clean-ups, waste segregation workshops, tree plantations, and lake restoration.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('community')}
            className="text-sm font-medium text-[#14532D] hover:underline whitespace-nowrap"
          >
            Explore All Activities
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {featuredActivities.map((activity) => {
            const isJoined = joinedActivityIds.includes(activity.id);
            return (
              <div
                key={activity.id}
                className="flex flex-col justify-between rounded-xl border border-[#E2E8E4] bg-white p-5"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#526058]">
                    <span className="font-medium text-[#14532D]">{activity.category}</span>
                    <div className="flex items-center gap-2">
                      {isJoined && (
                        <span className="inline-flex items-center gap-1 font-semibold text-[#14532D]">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          Joined
                        </span>
                      )}
                      <NgoStatusLabel status={activity.status} />
                    </div>
                  </div>
                  <h3 className="font-display text-base font-semibold text-[#1C2420]">
                    {activity.title}
                  </h3>
                  <p className="text-sm text-[#526058] line-clamp-2">{activity.description}</p>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E4] pt-3 text-xs text-[#526058]">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                      {activity.neighbourhood}
                    </span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Calendar className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                      {activity.date}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      openActivityDetail(activity.id);
                      navigateTo('community');
                    }}
                    className="font-medium text-[#14532D] hover:underline whitespace-nowrap"
                  >
                    View details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
