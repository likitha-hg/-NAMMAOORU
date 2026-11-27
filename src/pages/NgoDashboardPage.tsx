import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Handshake,
  MapPin,
  Play,
  ShieldAlert,
  Upload,
  XCircle,
} from 'lucide-react';
import { DemoNotice } from '../components/ui/DemoNotice';
import { EmptyState } from '../components/ui/EmptyState';
import { NgoStatusLabel } from '../components/ui/StatusIndicator';
import { useCivic } from '../context/CivicContext';
import { NgoActivityStatus } from '../types/civic';

export const NgoDashboardPage: React.FC<{ mode?: 'dashboard' | 'workspace' }> = ({
  mode = 'dashboard',
}) => {
  const { ngoActivities, updateNgoActivityStatus, openReportDetail } = useCivic();
  const [filterTab, setFilterTab] = useState<'ALL' | NgoActivityStatus>('ALL');
  const [evidenceInputs, setEvidenceInputs] = useState<Record<string, string>>({});

  const availableCount = ngoActivities.filter(
    (a) => a.status === NgoActivityStatus.AVAILABLE
  ).length;
  const acceptedCount = ngoActivities.filter(
    (a) => a.status === NgoActivityStatus.ACCEPTED
  ).length;
  const ongoingCount = ngoActivities.filter(
    (a) => a.status === NgoActivityStatus.ONGOING
  ).length;
  const completedCount = ngoActivities.filter(
    (a) => a.status === NgoActivityStatus.COMPLETED
  ).length;

  const filtered = ngoActivities.filter((a) => {
    if (filterTab === 'ALL') return true;
    return a.status === filterTab;
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#14532D]">
          <Handshake className="h-3.5 w-3.5" aria-hidden="true" />
          Hasiru Namma Bengaluru Trust (Demonstration NGO View)
        </p>
        <h1 className="mt-1 font-display text-2xl font-bold text-[#1C2420]">
          {mode === 'workspace'
            ? 'NGO Activity & Opportunity Management'
            : 'NGO & Community Organisation Dashboard'}
        </h1>
        <p className="text-sm text-[#526058]">
          Discover neighbourhood initiatives, coordinate clean-up or plantation drives, and record community completion notes.
        </p>
      </div>

      {/* Independence Guardrail Banner */}
      <div className="flex items-start gap-3 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] px-4 py-3 text-sm text-[#14532D]">
        <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-[#29322D]">
          <strong className="font-semibold text-[#14532D]">
            Separate Civic & Community Accountability:{' '}
          </strong>
          NGO activity completion is tracked independently from official government issue resolution. Completing a clean-up drive here will never automatically mark a related civic report as officially resolved.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Available Opportunities</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#14532D] tabular-nums">
            {availableCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Open for NGO adoption</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Accepted Activities</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1E40AF] tabular-nums">
            {acceptedCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Scheduled with volunteers</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Ongoing Activities</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#92400E] tabular-nums">
            {ongoingCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Currently underway</p>
        </div>
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Completed Activities</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
            {completedCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Community drives closed</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'ALL', label: `All (${ngoActivities.length})` },
          { key: NgoActivityStatus.AVAILABLE, label: 'Discover Opportunities' },
          { key: NgoActivityStatus.ACCEPTED, label: 'Accepted' },
          { key: NgoActivityStatus.ONGOING, label: 'Ongoing' },
          { key: NgoActivityStatus.COMPLETED, label: 'Completed' },
          { key: NgoActivityStatus.DECLINED, label: 'Declined' },
        ].map((tab) => {
          const active = filterTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setFilterTab(tab.key as typeof filterTab)}
              className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
                  : 'border-[#E2E8E4] bg-white text-[#526058] hover:text-[#1C2420]'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No activities in this category"
          description="Switch to All to explore available opportunities, ongoing clean-ups, or completed drives."
          actionLabel="Show All Activities"
          onAction={() => setFilterTab('ALL')}
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((act) => {
            const noteVal = evidenceInputs[act.id] ?? '';

            return (
              <div
                key={act.id}
                className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#526058]">
                      <span className="font-mono tabular-nums text-[#1C2420]">{act.id}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#14532D]">{act.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Organiser: {act.organiser}</span>
                    </div>
                    <h2 className="font-display text-lg font-semibold text-[#1C2420]">
                      {act.title}
                    </h2>
                    <p className="text-sm text-[#29322D]">{act.description}</p>
                  </div>

                  <NgoStatusLabel status={act.status} />
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs text-[#526058]">
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                    {act.neighbourhood} — {act.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5 tabular-nums">
                    <Calendar className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                    {act.date} · {act.timeWindow}
                  </span>
                  {act.relatedReportId && (
                    <button
                      type="button"
                      onClick={() => openReportDetail(act.relatedReportId!)}
                      className="font-medium text-[#14532D] hover:underline"
                    >
                      Related civic report: {act.relatedReportId} (Independent status)
                    </button>
                  )}
                </div>

                {act.evidenceNote && (
                  <div className="rounded-lg bg-[#F6F8F7] px-3.5 py-2.5 text-xs text-[#29322D]">
                    <strong className="font-semibold text-[#1C2420]">
                      Evidence / Field Note:{' '}
                    </strong>
                    {act.evidenceNote}
                  </div>
                )}

                {/* Activity Management Controls */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#E2E8E4] pt-3">
                  {act.status === NgoActivityStatus.AVAILABLE && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateNgoActivityStatus(act.id, NgoActivityStatus.ACCEPTED)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#166534] whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Accept Opportunity</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateNgoActivityStatus(act.id, NgoActivityStatus.DECLINED)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-xs font-medium text-[#526058] hover:bg-[#F6F8F7] whitespace-nowrap"
                      >
                        <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Decline Opportunity</span>
                      </button>
                    </div>
                  )}

                  {act.status === NgoActivityStatus.ACCEPTED && (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateNgoActivityStatus(act.id, NgoActivityStatus.ONGOING)
                        }
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#166534] whitespace-nowrap"
                      >
                        <Play className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Start Ongoing Activity</span>
                      </button>
                    </div>
                  )}

                  {act.status === NgoActivityStatus.ONGOING && (
                    <div className="flex flex-1 flex-col sm:flex-row sm:items-center gap-2">
                      <div className="relative flex-1">
                        <Upload
                          className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#526058]"
                          aria-hidden="true"
                        />
                        <input
                          type="text"
                          value={noteVal}
                          onChange={(e) =>
                            setEvidenceInputs((prev) => ({
                              ...prev,
                              [act.id]: e.target.value,
                            }))
                          }
                          placeholder="Evidence upload placeholder: add completion summary..."
                          className="w-full rounded-lg border border-[#E2E8E4] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          updateNgoActivityStatus(
                            act.id,
                            NgoActivityStatus.COMPLETED,
                            noteVal.trim() ||
                              'Community drive completed with photo evidence placeholder logged.'
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-medium text-white hover:bg-[#166534] whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Mark Activity Completed</span>
                      </button>
                    </div>
                  )}

                  {act.status === NgoActivityStatus.COMPLETED && (
                    <span className="text-xs font-medium text-[#14532D]">
                      Community initiative completed (official civic report statuses unaffected)
                    </span>
                  )}

                  {act.status === NgoActivityStatus.DECLINED && (
                    <button
                      type="button"
                      onClick={() =>
                        updateNgoActivityStatus(act.id, NgoActivityStatus.AVAILABLE)
                      }
                      className="rounded-lg border border-[#E2E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#1C2420] hover:bg-[#F6F8F7]"
                    >
                      Restore to Available
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DemoNotice description="NGO opportunity workflows and evidence placeholders run locally in this frontend prototype without external NGO or municipal integrations." />
    </div>
  );
};
