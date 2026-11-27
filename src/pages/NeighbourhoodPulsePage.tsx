import React from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Info,
  Layers,
} from 'lucide-react';
import { CivicIncidentAnalyticsDashboard } from '../components/analytics/CivicIncidentAnalyticsDashboard';
import { DemoNotice } from '../components/ui/DemoNotice';
import { useCivic } from '../context/CivicContext';

export const NeighbourhoodPulsePage: React.FC = () => {
  const {
    ngoActivities,
    issueClusters,
    openActivityDetail,
    navigateTo,
  } = useCivic();

  const totalVolunteers = ngoActivities.reduce((sum, a) => sum + a.volunteersJoined, 0);

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold text-[#1C2420]">
          Civic Incident Analytics &amp; Neighbourhood Pulse
        </h1>
        <p className="text-sm text-[#526058] max-w-3xl">
          Comprehensive Bengaluru civic analytics across all BBMP zones, wards, and localities. Drill down geographically, filter by category and resolution status, and compare verified citizen reports separately from demonstration baselines.
        </p>
      </div>

      {/* Comprehensive Bengaluru Hierarchical Civic Incident Analytics Dashboard */}
      <CivicIncidentAnalyticsDashboard embedded={true} />

      {/* Explicit Causation vs Proximity Notice */}
      <div className="flex items-start gap-3 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-4 text-xs text-[#29322D]">
        <Info className="h-4 w-4 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
        <p className="leading-relaxed">
          <strong className="text-[#14532D]">How Neighbourhood Grouping Works:</strong> Clusters shown below group nearby reports by geographic proximity and topical similarity so residents and field teams can spot recurring hotspots. Grouping demonstrates <strong>proximity and similarity only—it does not establish proven causation</strong>.
        </p>
      </div>

      {/* Neighbourhood Issue Clusters */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#1C2420]">
              Neighbourhood Issue Clusters (Sample Grouping)
            </h2>
            <p className="text-sm text-[#526058]">
              Example Bengaluru corridors where multiple related civic observations have been grouped for coordinated maintenance planning.
            </p>
          </div>
          <span className="text-xs font-medium text-[#14532D] tabular-nums">
            {totalVolunteers} community volunteers across {ngoActivities.length} drives
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {issueClusters.map((cluster) => (
            <div
              key={cluster.id}
              className="flex flex-col justify-between rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-xs text-[#526058]">
                  <span className="inline-flex items-center gap-1 font-medium text-[#14532D]">
                    <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                    {cluster.category}
                  </span>
                  <span className="tabular-nums">{cluster.timeframe}</span>
                </div>
                <h3 className="font-display text-base font-semibold text-[#1C2420]">
                  {cluster.title}
                </h3>
                <p className="text-sm text-[#29322D] leading-relaxed">{cluster.summary}</p>
              </div>

              <div className="flex items-center justify-between border-t border-[#E2E8E4] pt-3 text-xs">
                <span className="font-medium text-[#1C2420] tabular-nums">
                  {cluster.groupedReportCount} related reports · {cluster.neighbourhood}
                </span>
                <span
                  className={`inline-flex items-center gap-1 font-semibold ${
                    cluster.trendDirection === 'Improving'
                      ? 'text-[#14532D]'
                      : cluster.trendDirection === 'Increasing'
                      ? 'text-[#9A3412]'
                      : 'text-[#526058]'
                  }`}
                >
                  {cluster.trendDirection === 'Improving' ? (
                    <ArrowDownRight className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : cluster.trendDirection === 'Increasing' ? (
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  {cluster.trendDirection}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Community Action Highlights */}
      {ngoActivities.length > 0 && (
        <section className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-semibold text-[#1C2420]">
                Community Action Drives Across Bengaluru
              </h2>
              <p className="text-xs text-[#526058]">
                Citizen and NGO initiatives running alongside municipal resolution workflows.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigateTo('community')}
              className="text-xs font-semibold text-[#14532D] hover:underline whitespace-nowrap"
            >
              Browse All Drives
            </button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ngoActivities.slice(0, 4).map((act) => (
              <button
                key={act.id}
                type="button"
                onClick={() => {
                  openActivityDetail(act.id);
                  navigateTo('community');
                }}
                className="flex items-center justify-between gap-2 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0]/50 px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-[#EDF5F0]"
              >
                <span className="truncate font-medium text-[#14532D]">{act.title}</span>
                <span className="shrink-0 text-[#526058]">{act.neighbourhood}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <DemoNotice description="Real citizen reports from Firestore are always prioritised and explicitly separated from Bengaluru demonstration fallback records. Spatial and thematic groupings reflect proximity and similarity only, never proven causation." />
    </div>
  );
};
