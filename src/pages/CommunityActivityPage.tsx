import React, { useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Users,
  X,
} from 'lucide-react';
import { DemoNotice } from '../components/ui/DemoNotice';
import { EmptyState } from '../components/ui/EmptyState';
import { NgoStatusLabel } from '../components/ui/StatusIndicator';
import { BENGALURU_NEIGHBOURHOODS } from '../data/mockData';
import { useCivic } from '../context/CivicContext';
import { NgoActivityStatus } from '../types/civic';

const ACTIVITY_CATEGORIES = [
  'All Categories',
  'Waste Clean-Up Drive',
  'Tree Plantation Programme',
  'Lake Restoration',
  'Waste Segregation Awareness',
  'Community Awareness Campaign',
];

export const CommunityActivityPage: React.FC = () => {
  const {
    ngoActivities,
    activityParticipations,
    joinedActivityIds,
    selectedActivityId,
    openActivityDetail,
    closeActivityDetail,
    joinCommunityActivity,
  } = useCivic();

  const [categoryFilter, setCategoryFilter] = useState<string>('All Categories');
  const [neighbourhoodFilter, setNeighbourhoodFilter] = useState<string>('ALL');
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const visibleActivities = useMemo(() => {
    return ngoActivities.filter((a) => {
      if (a.status === NgoActivityStatus.DECLINED) return false;
      if (categoryFilter !== 'All Categories' && a.category !== categoryFilter) return false;
      if (neighbourhoodFilter !== 'ALL' && a.neighbourhood !== neighbourhoodFilter) return false;
      return true;
    });
  }, [ngoActivities, categoryFilter, neighbourhoodFilter]);

  const activeModalActivity =
    ngoActivities.find((a) => a.id === selectedActivityId) ?? null;

  const handleJoin = async (activityId: string) => {
    if (joinedActivityIds.includes(activityId) || joiningId) return;
    setJoiningId(activityId);
    try {
      await joinCommunityActivity(activityId);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-[#1C2420]">
            Community Activities
          </h1>
          <p className="text-sm text-[#526058] max-w-3xl">
            Discover neighbourhood clean-ups, tree plantation programmes, lake restoration drives, waste segregation workshops, and community awareness campaigns led by Bengaluru NGOs and resident groups.
          </p>
        </div>

        {activityParticipations.length > 0 && (
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3.5 py-2 text-xs font-semibold text-[#14532D] whitespace-nowrap">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <span>
              You are registered for {joinedActivityIds.length} drive
              {joinedActivityIds.length === 1 ? '' : 's'}
            </span>
          </div>
        )}
      </div>

      {/* Category & Neighbourhood Filters */}
      <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by activity category">
          {ACTIVITY_CATEGORIES.map((cat) => {
            const active = categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
                    : 'border-[#E2E8E4] bg-white text-[#29322D] hover:bg-[#F6F8F7]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E4] pt-3">
          <div className="flex items-center gap-2">
            <label htmlFor="community-ward" className="text-xs font-medium text-[#526058]">
              Neighbourhood:
            </label>
            <select
              id="community-ward"
              value={neighbourhoodFilter}
              onChange={(e) => setNeighbourhoodFilter(e.target.value)}
              className="rounded-lg border border-[#E2E8E4] bg-white px-3 py-1.5 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">All Bengaluru Wards</option>
              {BENGALURU_NEIGHBOURHOODS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-[#526058] tabular-nums">
            Showing {visibleActivities.length} community initiative
            {visibleActivities.length === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Activity Cards */}
      {visibleActivities.length === 0 ? (
        <EmptyState
          title="No community activities match these filters"
          description="Try selecting All Categories or All Bengaluru Wards to browse upcoming citizen drives."
          actionLabel="Reset Filters"
          onAction={() => {
            setCategoryFilter('All Categories');
            setNeighbourhoodFilter('ALL');
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {visibleActivities.map((activity) => {
            const pct = Math.min(
              100,
              Math.round((activity.volunteersJoined / Math.max(activity.volunteerGoal, 1)) * 100)
            );
            const isJoined = joinedActivityIds.includes(activity.id);
            const isCompleted = activity.status === NgoActivityStatus.COMPLETED;

            return (
              <article
                key={activity.id}
                className="flex flex-col justify-between rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4"
              >
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-[#14532D]">
                        {activity.category}
                      </span>
                      {activity.isSampleDemo && (
                        <span className="rounded bg-[#F3F5F4] px-1.5 py-0.5 text-[10px] font-medium text-[#526058]">
                          Pilot Sample
                        </span>
                      )}
                    </div>
                    <NgoStatusLabel status={activity.status} />
                  </div>

                  <h2 className="font-display text-lg font-semibold text-[#1C2420] leading-snug">
                    {activity.title}
                  </h2>

                  <p className="text-sm text-[#29322D] leading-relaxed">{activity.description}</p>

                  <div className="grid grid-cols-1 gap-1.5 pt-1 text-xs text-[#526058]">
                    <p className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-[#14532D]" aria-hidden="true" />
                      <span>
                        {activity.location} ({activity.neighbourhood})
                      </span>
                    </p>
                    <p className="inline-flex items-center gap-1.5 tabular-nums">
                      <Calendar className="h-3.5 w-3.5 shrink-0 text-[#14532D]" aria-hidden="true" />
                      <span>
                        {activity.date} · {activity.timeWindow}
                      </span>
                    </p>
                    <p className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 shrink-0 text-[#14532D]" aria-hidden="true" />
                      <span>Organised by {activity.organiser}</span>
                    </p>
                  </div>
                </div>

                {/* Volunteer Progress & Actions */}
                <div className="space-y-3 border-t border-[#E2E8E4] pt-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-[#1C2420] tabular-nums">
                        {activity.volunteersJoined} / {activity.volunteerGoal} volunteers
                      </span>
                      <span className="text-[#526058] tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EDF5F0]">
                      <div
                        className="h-full rounded-full bg-[#166534] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => openActivityDetail(activity.id)}
                      className="rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-xs font-medium text-[#1C2420] transition-colors hover:border-[#14532D] hover:text-[#14532D] whitespace-nowrap"
                    >
                      View Details
                    </button>

                    {!isCompleted ? (
                      <button
                        type="button"
                        disabled={isJoined || joiningId === activity.id}
                        onClick={() => void handleJoin(activity.id)}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                          isJoined
                            ? 'border border-[#CFE3D5] bg-[#EDF5F0] text-[#14532D] cursor-default'
                            : 'bg-[#14532D] text-white hover:bg-[#166534] disabled:opacity-60'
                        }`}
                      >
                        {isJoined ? (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Joined as Volunteer</span>
                          </>
                        ) : joiningId === activity.id ? (
                          <span>Recording...</span>
                        ) : (
                          <span>Join as Volunteer</span>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs font-medium text-[#14532D]">
                        Completed Community Drive
                      </span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Clear Governance Distinction Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-4 text-xs text-[#29322D]">
        <Info className="h-4 w-4 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-[#14532D]">Independent Community Action:</strong> NGO and resident-led initiatives strengthen Bengaluru neighbourhoods alongside municipal services, but community activities are tracked separately and are never counted as official government department resolutions for civic reports.
        </p>
      </div>

      {/* Activity Detail Modal */}
      {activeModalActivity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2420]/40 p-4 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="activity-modal-title"
        >
          <div className="w-full max-w-xl rounded-xl border border-[#E2E8E4] bg-white shadow-xl overflow-hidden">
            <div className="flex items-start justify-between gap-4 border-b border-[#E2E8E4] px-6 py-4">
              <div>
                <p className="text-xs font-semibold text-[#14532D]">
                  {activeModalActivity.category} · {activeModalActivity.neighbourhood}
                </p>
                <h2
                  id="activity-modal-title"
                  className="mt-1 font-display text-lg font-bold text-[#1C2420]"
                >
                  {activeModalActivity.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeActivityDetail}
                aria-label="Close activity details"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#526058] hover:bg-[#F6F8F7]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm text-[#29322D]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <NgoStatusLabel status={activeModalActivity.status} />
                <span className="text-xs text-[#526058] tabular-nums">
                  {activeModalActivity.volunteersJoined} of {activeModalActivity.volunteerGoal}{' '}
                  volunteers signed up
                </span>
              </div>

              <p className="leading-relaxed">{activeModalActivity.description}</p>

              <div className="rounded-lg bg-[#F6F8F7] p-4 space-y-2 text-xs">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                  <span>
                    <strong>Location:</strong> {activeModalActivity.location},{' '}
                    {activeModalActivity.neighbourhood}
                  </span>
                </p>
                <p className="flex items-center gap-2 tabular-nums">
                  <Clock className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                  <span>
                    <strong>Schedule:</strong> {activeModalActivity.date} ({activeModalActivity.timeWindow})
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                  <span>
                    <strong>Organiser:</strong> {activeModalActivity.organiser}
                  </span>
                </p>
              </div>

              {activeModalActivity.evidenceNote && (
                <div className="rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] p-3.5 text-xs text-[#14532D]">
                  <strong>Coordinator Update:</strong> {activeModalActivity.evidenceNote}
                </div>
              )}

              <p className="text-xs text-[#526058]">
                Note: Joining records your authenticated volunteer participation in NAMMAOORU. Community activities are independent of official municipal repair tickets.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[#E2E8E4] bg-[#F6F8F7] px-6 py-3">
              <button
                type="button"
                onClick={closeActivityDetail}
                className="rounded-lg border border-[#E2E8E4] bg-white px-4 py-2 text-xs font-medium text-[#1C2420] hover:bg-[#F3F5F4]"
              >
                Close
              </button>
              {activeModalActivity.status !== NgoActivityStatus.COMPLETED && (
                <button
                  type="button"
                  disabled={
                    joinedActivityIds.includes(activeModalActivity.id) ||
                    joiningId === activeModalActivity.id
                  }
                  onClick={() => void handleJoin(activeModalActivity.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold ${
                    joinedActivityIds.includes(activeModalActivity.id)
                      ? 'border border-[#CFE3D5] bg-[#EDF5F0] text-[#14532D]'
                      : 'bg-[#14532D] text-white hover:bg-[#166534]'
                  }`}
                >
                  {joinedActivityIds.includes(activeModalActivity.id) ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Joined as Volunteer</span>
                    </>
                  ) : (
                    <span>Join as Volunteer</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <DemoNotice description="Your volunteer registrations are persisted to your authenticated NAMMAOORU account in Firestore. Sample Bengaluru community drives are labelled clearly." />
    </div>
  );
};
