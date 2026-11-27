import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  Compass,
  Filter,
  Globe2,
  Layers,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { BengaluruGoogleMap } from '../map/BengaluruGoogleMap';
import { CATEGORY_MAP_STYLES } from '../map/mapCategoryStyles';
import { StatusIndicator } from '../ui/StatusIndicator';
import { useCivic } from '../../context/CivicContext';
import { useBengaluruLocations } from '../../hooks/useBengaluruLocations';
import { resolveReportHierarchy } from '../../services/locationMasterService';
import { CivicReport, ReportStatus } from '../../types/civic';
import {
  BengaluruLocality,
  ResolvedLocationHierarchy,
} from '../../types/locations';
import { SearchableNeighbourhoodSelect } from './SearchableNeighbourhoodSelect';

type ProvenanceMode = 'AUTO_FALLBACK' | 'VERIFIED_ONLY' | 'ALL_COMBINED';
type TableViewMode = 'HIERARCHY' | 'ALL_LOCALITIES';

interface AreaMetricRow {
  id: string;
  name: string;
  subtitle: string;
  level: 'zone' | 'ward' | 'locality';
  verifiedCount: number;
  sampleCount: number;
  totalCount: number;
  resolvedCount: number;
  openCount: number;
  resolutionRate: number;
  center: { lat: number; lng: number };
  zoneId?: string;
  wardId?: string;
  localityId?: string;
}

interface CivicIncidentAnalyticsDashboardProps {
  /** Show the inline "Add New Bengaluru Locality" manager (e.g. in Admin Dashboard) */
  allowAddLocality?: boolean;
  /** Compact heading style when embedded inside another dashboard tab */
  embedded?: boolean;
}

const RESOLVED_STATUSES = new Set<ReportStatus>([
  ReportStatus.CITIZEN_VERIFIED,
  ReportStatus.RESOLUTION_REPORTED,
  ReportStatus.AWAITING_VERIFICATION,
]);

export const CivicIncidentAnalyticsDashboard: React.FC<
  CivicIncidentAnalyticsDashboardProps
> = ({ allowAddLocality = false, embedded = false }) => {
  const {
    reports,
    sampleReports,
    categories,
    openReportDetail,
    showToast,
  } = useCivic();
  const { dataset, loading, error, reload, addLocality } = useBengaluruLocations();

  // Hierarchical drill-down & filter state
  const [selectedZoneId, setSelectedZoneId] = useState<string>('ALL');
  const [selectedWardId, setSelectedWardId] = useState<string>('ALL');
  const [selectedLocalityId, setSelectedLocalityId] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [provenanceMode, setProvenanceMode] = useState<ProvenanceMode>('AUTO_FALLBACK');
  const [tableViewMode, setTableViewMode] = useState<TableViewMode>('HIERARCHY');
  const [areaSearch, setAreaSearch] = useState<string>('');
  const [selectedMapReportId, setSelectedMapReportId] = useState<string>('');

  // Dynamic "Add New Locality" form state (persists to backend dataset without modifying dashboard code)
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLocName, setNewLocName] = useState('');
  const [newLocZoneId, setNewLocZoneId] = useState('');
  const [newLocWardId, setNewLocWardId] = useState('');
  const [newLocPincode, setNewLocPincode] = useState('');
  const [newLocLat, setNewLocLat] = useState('12.9716');
  const [newLocLng, setNewLocLng] = useState('77.5946');
  const [newLocAliases, setNewLocAliases] = useState('');
  const [addingLocality, setAddingLocality] = useState(false);
  const [addLocalityError, setAddLocalityError] = useState('');

  // Resolve real (verified/submitted) reports and demonstration sample reports to City->Zone->Ward->Locality
  const resolvedDataset = useMemo(() => {
    if (!dataset) {
      return {
        effectiveReports: [] as Array<{
          report: CivicReport;
          hierarchy: ResolvedLocationHierarchy | null;
        }>,
        realCount: 0,
        sampleCount: 0,
        usedSampleFallbackCount: 0,
      };
    }

    const realEntries = reports
      .filter((r) => !r.isSampleDemo)
      .map((report) => ({
        report,
        hierarchy: resolveReportHierarchy(report, dataset),
      }));

    const sampleEntries = sampleReports.map((report) => ({
      report: { ...report, isSampleDemo: true },
      hierarchy: resolveReportHierarchy(report, dataset),
    }));

    // Track which localities already have real citizen/verified incident data
    const localitiesWithRealData = new Set(
      realEntries
        .map((e) => e.hierarchy?.localityId)
        .filter((id): id is string => Boolean(id))
    );

    if (provenanceMode === 'VERIFIED_ONLY') {
      return {
        effectiveReports: realEntries,
        realCount: realEntries.length,
        sampleCount: 0,
        usedSampleFallbackCount: 0,
      };
    }

    if (provenanceMode === 'ALL_COMBINED') {
      return {
        effectiveReports: [...realEntries, ...sampleEntries],
        realCount: realEntries.length,
        sampleCount: sampleEntries.length,
        usedSampleFallbackCount: sampleEntries.length,
      };
    }

    // AUTO_FALLBACK: use demonstration data ONLY where real incident data is unavailable
    const fallbackSamples = sampleEntries.filter((entry) => {
      const locId = entry.hierarchy?.localityId;
      return !locId || !localitiesWithRealData.has(locId);
    });

    return {
      effectiveReports: [...realEntries, ...fallbackSamples],
      realCount: realEntries.length,
      sampleCount: fallbackSamples.length,
      usedSampleFallbackCount: fallbackSamples.length,
    };
  }, [dataset, reports, sampleReports, provenanceMode]);

  // Scoped dropdown lists
  const availableWards = useMemo(() => {
    if (!dataset) return [];
    const list =
      selectedZoneId === 'ALL'
        ? dataset.wards
        : dataset.wards.filter((w) => w.zoneId === selectedZoneId);
    return [...list].sort((a, b) => a.wardNumber - b.wardNumber);
  }, [dataset, selectedZoneId]);

  // Precompute per-locality counts (respecting category & status filters) for the searchable dropdown
  const incidentCountsByLocalityId = useMemo(() => {
    const counts: Record<string, { total: number; verified: number; sample: number }> = {};
    for (const entry of resolvedDataset.effectiveReports) {
      if (categoryFilter !== 'ALL' && entry.report.category !== categoryFilter) continue;
      if (statusFilter !== 'ALL' && entry.report.status !== statusFilter) continue;
      const locId = entry.hierarchy?.localityId;
      if (!locId) continue;
      if (!counts[locId]) {
        counts[locId] = { total: 0, verified: 0, sample: 0 };
      }
      counts[locId].total += 1;
      if (entry.report.isSampleDemo) {
        counts[locId].sample += 1;
      } else {
        counts[locId].verified += 1;
      }
    }
    return counts;
  }, [resolvedDataset.effectiveReports, categoryFilter, statusFilter]);

  // Apply all 5 active filters: Zone, Ward, Neighbourhood, Incident Category, Resolution Status
  const filteredEntries = useMemo(() => {
    return resolvedDataset.effectiveReports.filter(({ report, hierarchy }) => {
      if (categoryFilter !== 'ALL' && report.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && report.status !== statusFilter) return false;
      if (selectedZoneId !== 'ALL' && hierarchy?.zoneId !== selectedZoneId) return false;
      if (selectedWardId !== 'ALL' && hierarchy?.wardId !== selectedWardId) return false;
      if (selectedLocalityId !== 'ALL' && hierarchy?.localityId !== selectedLocalityId) {
        return false;
      }
      return true;
    });
  }, [
    resolvedDataset.effectiveReports,
    categoryFilter,
    statusFilter,
    selectedZoneId,
    selectedWardId,
    selectedLocalityId,
  ]);

  const filteredReports = useMemo(
    () => filteredEntries.map((e) => e.report),
    [filteredEntries]
  );

  // Active hierarchy objects for breadcrumbs & Google Maps viewport focus
  const activeZone = useMemo(
    () => dataset?.zones.find((z) => z.id === selectedZoneId) ?? null,
    [dataset, selectedZoneId]
  );
  const activeWard = useMemo(
    () => dataset?.wards.find((w) => w.id === selectedWardId) ?? null,
    [dataset, selectedWardId]
  );
  const activeLocality = useMemo(
    () => dataset?.localities.find((l) => l.id === selectedLocalityId) ?? null,
    [dataset, selectedLocalityId]
  );

  const mapFocusCenter = useMemo(() => {
    if (!dataset) return null;
    if (activeLocality) {
      return { lat: activeLocality.center.lat, lng: activeLocality.center.lng, zoom: 15 };
    }
    if (activeWard) {
      return {
        lat: activeWard.center.lat,
        lng: activeWard.center.lng,
        zoom: activeWard.defaultZoom || 14,
      };
    }
    if (activeZone) {
      return {
        lat: activeZone.center.lat,
        lng: activeZone.center.lng,
        zoom: activeZone.defaultZoom || 12,
      };
    }
    return {
      lat: dataset.city.center.lat,
      lng: dataset.city.center.lng,
      zoom: 11,
    };
  }, [dataset, activeZone, activeWard, activeLocality]);

  // Scope-level KPI aggregates
  const scopeStats = useMemo(() => {
    const total = filteredReports.length;
    const verifiedReportsCount = filteredReports.filter((r) => !r.isSampleDemo).length;
    const sampleReportsCount = filteredReports.filter((r) => Boolean(r.isSampleDemo)).length;
    const citizenVerifiedCount = filteredReports.filter(
      (r) => r.status === ReportStatus.CITIZEN_VERIFIED
    ).length;
    const resolvedOrPendingVerify = filteredReports.filter((r) =>
      RESOLVED_STATUSES.has(r.status)
    ).length;
    const openCount = total - resolvedOrPendingVerify;
    const resolutionRate = total > 0 ? Math.round((resolvedOrPendingVerify / total) * 100) : 0;

    return {
      total,
      verifiedReportsCount,
      sampleReportsCount,
      citizenVerifiedCount,
      resolvedOrPendingVerify,
      openCount,
      resolutionRate,
    };
  }, [filteredReports]);

  // Compute drill-down or city-wide area breakdown rows (including zero-incident areas so ALL Bengaluru areas are represented!)
  const areaRows = useMemo((): AreaMetricRow[] => {
    if (!dataset) return [];

    // Filter only by category & status for parent-level counting, plus hierarchy scope
    const categoryStatusEntries = resolvedDataset.effectiveReports.filter(({ report }) => {
      if (categoryFilter !== 'ALL' && report.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && report.status !== statusFilter) return false;
      return true;
    });

    const summarize = (entries: typeof categoryStatusEntries) => {
      const verifiedCount = entries.filter((e) => !e.report.isSampleDemo).length;
      const sampleCount = entries.filter((e) => Boolean(e.report.isSampleDemo)).length;
      const totalCount = entries.length;
      const resolvedCount = entries.filter((e) => RESOLVED_STATUSES.has(e.report.status)).length;
      const openCount = totalCount - resolvedCount;
      const resolutionRate =
        totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
      return { verifiedCount, sampleCount, totalCount, resolvedCount, openCount, resolutionRate };
    };

    const zoneMap = new Map(dataset.zones.map((z) => [z.id, z]));
    const wardMap = new Map(dataset.wards.map((w) => [w.id, w]));

    let rows: AreaMetricRow[] = [];

    if (tableViewMode === 'ALL_LOCALITIES') {
      const scopedLocalities = dataset.localities.filter((loc) => {
        if (selectedZoneId !== 'ALL' && loc.zoneId !== selectedZoneId) return false;
        if (selectedWardId !== 'ALL' && loc.wardId !== selectedWardId) return false;
        if (selectedLocalityId !== 'ALL' && loc.id !== selectedLocalityId) return false;
        return true;
      });
      rows = scopedLocalities.map((loc) => {
        const zone = zoneMap.get(loc.zoneId);
        const ward = wardMap.get(loc.wardId);
        const matching = categoryStatusEntries.filter(
          (e) => e.hierarchy?.localityId === loc.id
        );
        return {
          id: loc.id,
          name: loc.name,
          subtitle: `${zone?.name ?? 'Bengaluru'} · Ward ${ward?.wardNumber ?? '—'} (${
            ward?.name ?? 'BBMP'
          })${loc.pincode ? ` · ${loc.pincode}` : ''}`,
          level: 'locality',
          ...summarize(matching),
          center: loc.center,
          zoneId: loc.zoneId,
          wardId: loc.wardId,
          localityId: loc.id,
        };
      });
    } else if (selectedZoneId === 'ALL') {
      // City Overview -> All 8 BBMP Zones
      rows = dataset.zones.map((zone) => {
        const wardCount = dataset.wards.filter((w) => w.zoneId === zone.id).length;
        const locCount = dataset.localities.filter((l) => l.zoneId === zone.id).length;
        const matching = categoryStatusEntries.filter(
          (e) => e.hierarchy?.zoneId === zone.id
        );
        return {
          id: zone.id,
          name: zone.name,
          subtitle: `${zone.code} · ${wardCount} wards · ${locCount} localities`,
          level: 'zone',
          ...summarize(matching),
          center: zone.center,
          zoneId: zone.id,
        };
      });
    } else if (selectedWardId === 'ALL') {
      // Zone Drill-Down -> All Wards in Selected Zone
      const wardsInZone = dataset.wards
        .filter((w) => w.zoneId === selectedZoneId)
        .sort((a, b) => a.wardNumber - b.wardNumber);
      rows = wardsInZone.map((ward) => {
        const locCount = dataset.localities.filter((l) => l.wardId === ward.id).length;
        const matching = categoryStatusEntries.filter(
          (e) => e.hierarchy?.wardId === ward.id
        );
        return {
          id: ward.id,
          name: `Ward ${ward.wardNumber} · ${ward.name}`,
          subtitle: `${activeZone?.name ?? ''} · ${locCount} ${
            locCount === 1 ? 'locality' : 'localities'
          }`,
          level: 'ward',
          ...summarize(matching),
          center: ward.center,
          zoneId: ward.zoneId,
          wardId: ward.id,
        };
      });
    } else {
      // Ward Drill-Down -> All Localities in Selected Ward
      const locsInWard = dataset.localities.filter((l) => {
        if (l.wardId !== selectedWardId) return false;
        if (selectedLocalityId !== 'ALL' && l.id !== selectedLocalityId) return false;
        return true;
      });
      rows = locsInWard.map((loc) => {
        const matching = categoryStatusEntries.filter(
          (e) => e.hierarchy?.localityId === loc.id
        );
        return {
          id: loc.id,
          name: loc.name,
          subtitle: `${activeZone?.name ?? ''} · Ward ${activeWard?.wardNumber ?? '—'}${
            loc.pincode ? ` · Pincode ${loc.pincode}` : ''
          }`,
          level: 'locality',
          ...summarize(matching),
          center: loc.center,
          zoneId: loc.zoneId,
          wardId: loc.wardId,
          localityId: loc.id,
        };
      });
    }

    const q = areaSearch.trim().toLowerCase();
    const searched = q
      ? rows.filter(
          (row) =>
            row.name.toLowerCase().includes(q) || row.subtitle.toLowerCase().includes(q)
        )
      : rows;

    return searched.sort((a, b) => {
      if (b.totalCount !== a.totalCount) return b.totalCount - a.totalCount;
      if (b.verifiedCount !== a.verifiedCount) return b.verifiedCount - a.verifiedCount;
      return a.name.localeCompare(b.name);
    });
  }, [
    dataset,
    resolvedDataset.effectiveReports,
    categoryFilter,
    statusFilter,
    tableViewMode,
    selectedZoneId,
    selectedWardId,
    selectedLocalityId,
    activeZone,
    activeWard,
    areaSearch,
  ]);

  const maxRowTotal = Math.max(...areaRows.map((r) => r.totalCount), 1);

  // Category distribution for active filtered scope
  const categoryBreakdown = useMemo(() => {
    return categories
      .filter((c) => c.active)
      .map((cat) => {
        const inCat = filteredReports.filter((r) => r.category === cat.name);
        const verified = inCat.filter((r) => !r.isSampleDemo).length;
        const sample = inCat.filter((r) => Boolean(r.isSampleDemo)).length;
        const resolved = inCat.filter((r) => RESOLVED_STATUSES.has(r.status)).length;
        return {
          id: cat.id,
          name: cat.name,
          total: inCat.length,
          verified,
          sample,
          resolved,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [categories, filteredReports]);

  const maxCategoryCount = Math.max(...categoryBreakdown.map((c) => c.total), 1);

  // Resolution status distribution for active scope
  const statusBreakdown = useMemo(() => {
    return Object.values(ReportStatus).map((status) => {
      const matching = filteredReports.filter((r) => r.status === status);
      return {
        status,
        total: matching.length,
        verified: matching.filter((r) => !r.isSampleDemo).length,
        sample: matching.filter((r) => Boolean(r.isSampleDemo)).length,
      };
    });
  }, [filteredReports]);

  const selectedMapReport =
    filteredReports.find((r) => r.id === selectedMapReportId) ?? null;

  // Hierarchy handlers
  const handleSelectZone = (zoneId: string) => {
    setSelectedZoneId(zoneId);
    setSelectedWardId('ALL');
    setSelectedLocalityId('ALL');
    setSelectedMapReportId('');
  };

  const handleSelectWard = (wardId: string) => {
    if (wardId === 'ALL') {
      setSelectedWardId('ALL');
      setSelectedLocalityId('ALL');
      setSelectedMapReportId('');
      return;
    }
    const ward = dataset?.wards.find((w) => w.id === wardId);
    if (ward) {
      setSelectedZoneId(ward.zoneId);
      setSelectedWardId(ward.id);
      setSelectedLocalityId('ALL');
      setSelectedMapReportId('');
    }
  };

  const handleSelectLocality = (locality: BengaluruLocality | null) => {
    if (!locality) {
      setSelectedLocalityId('ALL');
      setSelectedMapReportId('');
      return;
    }
    setSelectedZoneId(locality.zoneId);
    setSelectedWardId(locality.wardId);
    setSelectedLocalityId(locality.id);
    setSelectedMapReportId('');
  };

  const handleDrillRow = (row: AreaMetricRow) => {
    setSelectedMapReportId('');
    if (row.level === 'zone' && row.zoneId) {
      setSelectedZoneId(row.zoneId);
      setSelectedWardId('ALL');
      setSelectedLocalityId('ALL');
      setTableViewMode('HIERARCHY');
    } else if (row.level === 'ward' && row.zoneId && row.wardId) {
      setSelectedZoneId(row.zoneId);
      setSelectedWardId(row.wardId);
      setSelectedLocalityId('ALL');
      setTableViewMode('HIERARCHY');
    } else if (row.level === 'locality' && row.zoneId && row.wardId && row.localityId) {
      setSelectedZoneId(row.zoneId);
      setSelectedWardId(row.wardId);
      setSelectedLocalityId(row.localityId);
    }
  };

  const resetAllFilters = () => {
    setSelectedZoneId('ALL');
    setSelectedWardId('ALL');
    setSelectedLocalityId('ALL');
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setAreaSearch('');
    setSelectedMapReportId('');
  };

  const hasFilters =
    selectedZoneId !== 'ALL' ||
    selectedWardId !== 'ALL' ||
    selectedLocalityId !== 'ALL' ||
    categoryFilter !== 'ALL' ||
    statusFilter !== 'ALL';

  const handleCreateLocality = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLocalityError('');
    if (!dataset) return;

    const targetZoneId = newLocZoneId || dataset.zones[0]?.id || '';
    const wardsInTarget = dataset.wards.filter((w) => w.zoneId === targetZoneId);
    const targetWardId = newLocWardId || wardsInTarget[0]?.id || '';

    setAddingLocality(true);
    try {
      const created = await addLocality({
        name: newLocName.trim(),
        zoneId: targetZoneId,
        wardId: targetWardId,
        pincode: newLocPincode.trim() || undefined,
        lat: Number(newLocLat),
        lng: Number(newLocLng),
        aliases: newLocAliases
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      setNewLocName('');
      setNewLocPincode('');
      setNewLocAliases('');
      setShowAddForm(false);
      handleSelectLocality(created.locality);
      showToast(
        'Neighbourhood added to master dataset',
        `${created.locality.name} is now live across analytics, filters, and maps.`,
        'success'
      );
    } catch (err) {
      setAddLocalityError(
        err instanceof Error ? err.message : 'Unable to add locality right now.'
      );
    } finally {
      setAddingLocality(false);
    }
  };

  if (loading && !dataset) {
    return (
      <div className="flex items-center justify-center gap-2.5 rounded-xl border border-[#E2E8E4] bg-white p-10 text-sm text-[#526058]">
        <Loader2 className="h-4 w-4 animate-spin text-[#14532D]" aria-hidden="true" />
        <span>Loading Bengaluru City → Zone → Ward → Locality master dataset...</span>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div
        role="alert"
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-5 text-xs text-[#991B1B]"
      >
        <div className="flex items-start gap-2.5">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <p>{error || 'Unable to load Bengaluru master ward and locality data.'}</p>
        </div>
        <button
          type="button"
          onClick={() => void reload(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-3 py-1.5 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] whitespace-nowrap"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const addFormZoneId = newLocZoneId || dataset.zones[0]?.id || '';
  const addFormWards = dataset.wards
    .filter((w) => w.zoneId === addFormZoneId)
    .sort((a, b) => a.wardNumber - b.wardNumber);

  const currentHierarchyLabel = activeLocality
    ? `${activeLocality.name} (Locality)`
    : activeWard
      ? `Ward ${activeWard.wardNumber} · ${activeWard.name}`
      : activeZone
        ? activeZone.name
        : `${dataset.city.name} City-Wide Overview`;

  return (
    <div className="space-y-6">
      {/* Header & Data Provenance Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end justify-between">
        <div className="space-y-1">
          {!embedded ? (
            <h2 className="font-display text-xl font-bold text-[#1C2420]">
              Civic Incident Analytics · {dataset.city.name}
            </h2>
          ) : (
            <h2 className="font-display text-lg font-bold text-[#1C2420]">
              Bengaluru Civic Incident Analytics
            </h2>
          )}
          <p className="text-xs sm:text-sm text-[#526058]">
            {dataset.city.authority} · {dataset.zones.length} Zones · {dataset.wards.length} Wards ·{' '}
            {dataset.localities.length} Neighbourhoods &amp; Localities (Dataset {dataset.city.datasetVersion})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Data provenance mode"
            className="inline-flex rounded-lg border border-[#E2E8E4] bg-white p-0.5 text-xs"
          >
            {(
              [
                { id: 'AUTO_FALLBACK', label: 'Smart (Real + Sample Fallback)' },
                { id: 'VERIFIED_ONLY', label: 'Verified Only' },
                { id: 'ALL_COMBINED', label: 'All Combined' },
              ] as const
            ).map((mode) => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setProvenanceMode(mode.id)}
                className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  provenanceMode === mode.id
                    ? 'bg-[#14532D] text-white'
                    : 'text-[#526058] hover:text-[#1C2420]'
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>

          {allowAddLocality && (
            <button
              type="button"
              onClick={() => {
                setShowAddForm((prev) => !prev);
                if (!newLocZoneId && dataset.zones[0]) {
                  const defaultZone = activeZone ?? dataset.zones[0];
                  setNewLocZoneId(defaultZone.id);
                  const firstWard =
                    activeWard ??
                    dataset.wards.find((w) => w.zoneId === defaultZone.id);
                  if (firstWard) {
                    setNewLocWardId(firstWard.id);
                    setNewLocLat(firstWard.center.lat.toFixed(5));
                    setNewLocLng(firstWard.center.lng.toFixed(5));
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3 py-1.5 text-xs font-semibold text-[#14532D] hover:bg-[#DCEEE4] whitespace-nowrap"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Add Neighbourhood</span>
            </button>
          )}
        </div>
      </div>

      {/* Expandable Add Locality Panel (Dynamic Backend Master Extension) */}
      {allowAddLocality && showAddForm && (
        <form
          onSubmit={handleCreateLocality}
          className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0]/50 p-4 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[#14532D]">
                Add New Bengaluru Neighbourhood / Locality
              </h3>
              <p className="text-xs text-[#526058]">
                Saved directly to the backend Bengaluru location master dataset and immediately available across filters, drill-downs, and Google Maps.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs font-medium text-[#526058] hover:text-[#1C2420]"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="new-loc-name" className="block text-xs font-medium text-[#526058]">
                Neighbourhood / Locality Name *
              </label>
              <input
                id="new-loc-name"
                type="text"
                required
                value={newLocName}
                onChange={(e) => setNewLocName(e.target.value)}
                placeholder="e.g., Cooke Town or Panathur"
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="new-loc-zone" className="block text-xs font-medium text-[#526058]">
                BBMP Zone *
              </label>
              <select
                id="new-loc-zone"
                value={addFormZoneId}
                onChange={(e) => {
                  const zId = e.target.value;
                  setNewLocZoneId(zId);
                  const firstW = dataset.wards.find((w) => w.zoneId === zId);
                  setNewLocWardId(firstW?.id ?? '');
                  if (firstW) {
                    setNewLocLat(firstW.center.lat.toFixed(5));
                    setNewLocLng(firstW.center.lng.toFixed(5));
                  }
                }}
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              >
                {dataset.zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-loc-ward" className="block text-xs font-medium text-[#526058]">
                BBMP Ward *
              </label>
              <select
                id="new-loc-ward"
                value={newLocWardId || addFormWards[0]?.id || ''}
                onChange={(e) => {
                  const wId = e.target.value;
                  setNewLocWardId(wId);
                  const found = dataset.wards.find((w) => w.id === wId);
                  if (found) {
                    setNewLocLat(found.center.lat.toFixed(5));
                    setNewLocLng(found.center.lng.toFixed(5));
                  }
                }}
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              >
                {addFormWards.map((w) => (
                  <option key={w.id} value={w.id}>
                    Ward {w.wardNumber} · {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="new-loc-pincode" className="block text-xs font-medium text-[#526058]">
                Pincode (Optional)
              </label>
              <input
                id="new-loc-pincode"
                type="text"
                value={newLocPincode}
                onChange={(e) => setNewLocPincode(e.target.value)}
                placeholder="e.g., 560005"
                maxLength={6}
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="new-loc-lat" className="block text-xs font-medium text-[#526058]">
                  Latitude *
                </label>
                <input
                  id="new-loc-lat"
                  type="number"
                  step="any"
                  required
                  value={newLocLat}
                  onChange={(e) => setNewLocLat(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-2.5 py-2 text-xs font-mono text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="new-loc-lng" className="block text-xs font-medium text-[#526058]">
                  Longitude *
                </label>
                <input
                  id="new-loc-lng"
                  type="number"
                  step="any"
                  required
                  value={newLocLng}
                  onChange={(e) => setNewLocLng(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-2.5 py-2 text-xs font-mono text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-loc-aliases" className="block text-xs font-medium text-[#526058]">
                Search Aliases (comma-separated)
              </label>
              <input
                id="new-loc-aliases"
                type="text"
                value={newLocAliases}
                onChange={(e) => setNewLocAliases(e.target.value)}
                placeholder="e.g., Richards Town, Davis Rd"
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              />
            </div>
          </div>

          {addLocalityError && (
            <p className="text-xs font-medium text-[#991B1B]" role="alert">
              {addLocalityError}
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={addingLocality}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-60"
            >
              {addingLocality ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>{addingLocality ? 'Saving...' : 'Save Neighbourhood to Master Dataset'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Hierarchical Drill-Down Breadcrumb (City -> Zone -> Ward -> Neighbourhood) */}
      <nav
        aria-label="Bengaluru location hierarchy drill-down"
        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] px-4 py-2.5 text-xs"
      >
        <div className="flex flex-wrap items-center gap-1.5 text-[#29322D]">
          <Globe2 className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
          <button
            type="button"
            onClick={() => handleSelectZone('ALL')}
            className={`font-semibold transition-colors ${
              !activeZone ? 'text-[#14532D]' : 'text-[#526058] hover:text-[#14532D] hover:underline'
            }`}
          >
            {dataset.city.name} (City Overview)
          </button>

          {activeZone && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-[#526058]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => handleSelectZone(activeZone.id)}
                className={`font-semibold transition-colors ${
                  !activeWard
                    ? 'text-[#14532D]'
                    : 'text-[#526058] hover:text-[#14532D] hover:underline'
                }`}
              >
                {activeZone.name}
              </button>
            </>
          )}

          {activeWard && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-[#526058]" aria-hidden="true" />
              <button
                type="button"
                onClick={() => handleSelectWard(activeWard.id)}
                className={`font-semibold transition-colors ${
                  !activeLocality
                    ? 'text-[#14532D]'
                    : 'text-[#526058] hover:text-[#14532D] hover:underline'
                }`}
              >
                Ward {activeWard.wardNumber} · {activeWard.name}
              </button>
            </>
          )}

          {activeLocality && (
            <>
              <ChevronRight className="h-3.5 w-3.5 text-[#526058]" aria-hidden="true" />
              <span className="font-semibold text-[#14532D]">{activeLocality.name}</span>
            </>
          )}
        </div>

        <span className="text-[11px] font-medium text-[#14532D]">
          {provenanceMode === 'VERIFIED_ONLY'
            ? 'Showing verified/submitted reports only'
            : provenanceMode === 'AUTO_FALLBACK'
              ? `Real data prioritised · ${resolvedDataset.usedSampleFallbackCount} sample fallback records`
              : 'Showing verified + pilot demonstration records'}
        </span>
      </nav>

      {/* 5-Axis Hierarchical Filter Bar */}
      <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#1C2420]">
          <span className="inline-flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
            <span>Filter Civic Analytics</span>
          </span>
          {hasFilters && (
            <button
              type="button"
              onClick={resetAllFilters}
              className="text-xs font-medium text-[#14532D] hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* 1. Zone Filter */}
          <div>
            <label htmlFor="analytics-zone" className="block text-xs font-medium text-[#526058]">
              BBMP Zone
            </label>
            <select
              id="analytics-zone"
              value={selectedZoneId}
              onChange={(e) => handleSelectZone(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">All {dataset.zones.length} Zones</option>
              {dataset.zones.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.name}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Ward Filter */}
          <div>
            <label htmlFor="analytics-ward" className="block text-xs font-medium text-[#526058]">
              BBMP Ward
            </label>
            <select
              id="analytics-ward"
              value={selectedWardId}
              onChange={(e) => handleSelectWard(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">All Wards ({availableWards.length})</option>
              {availableWards.map((ward) => (
                <option key={ward.id} value={ward.id}>
                  W{ward.wardNumber} · {ward.name}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Searchable Neighbourhood / Locality Dropdown */}
          <div className="sm:col-span-2 lg:col-span-1">
            <SearchableNeighbourhoodSelect
              id="analytics-locality-search"
              localities={dataset.localities}
              zones={dataset.zones}
              wards={dataset.wards}
              selectedLocalityId={selectedLocalityId === 'ALL' ? '' : selectedLocalityId}
              activeZoneId={selectedZoneId}
              activeWardId={selectedWardId}
              incidentCountsByLocalityId={incidentCountsByLocalityId}
              onSelectLocality={handleSelectLocality}
            />
          </div>

          {/* 4. Incident Category Filter */}
          <div>
            <label htmlFor="analytics-category" className="block text-xs font-medium text-[#526058]">
              Incident Category
            </label>
            <select
              id="analytics-category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">All Categories</option>
              {categories
                .filter((c) => c.active)
                .map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          {/* 5. Resolution Status Filter */}
          <div>
            <label htmlFor="analytics-status" className="block text-xs font-medium text-[#526058]">
              Resolution Status
            </label>
            <select
              id="analytics-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              {Object.values(ReportStatus).map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Scope KPI Cards (Explicitly Distinguishing Verified vs Sample Data) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Incidents in Scope</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
            {scopeStats.total}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="rounded bg-[#EDF5F0] px-1.5 py-0.5 font-semibold text-[#14532D] tabular-nums">
              {scopeStats.verifiedReportsCount} Verified
            </span>
            <span className="rounded bg-[#F3F5F4] px-1.5 py-0.5 font-medium text-[#526058] tabular-nums">
              {scopeStats.sampleReportsCount} Sample
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Resolution Rate</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#14532D] tabular-nums">
            {scopeStats.resolutionRate}%
          </p>
          <p className="mt-1 text-xs text-[#526058] tabular-nums">
            {scopeStats.resolvedOrPendingVerify} resolved / awaiting check ·{' '}
            {scopeStats.citizenVerifiedCount} verified
          </p>
        </div>

        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Open / Active Issues</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#9A3412] tabular-nums">
            {scopeStats.openCount}
          </p>
          <p className="mt-1 text-xs text-[#526058]">Submitted, assigned, or in progress</p>
        </div>

        <div className="rounded-xl border border-[#E2E8E4] bg-white p-4">
          <p className="text-xs font-medium text-[#526058]">Master Area Coverage</p>
          <p className="mt-2 font-display text-2xl font-bold text-[#1C2420] tabular-nums">
            {dataset.localities.length}
          </p>
          <p className="mt-1 text-xs text-[#526058]">
            Localities across {dataset.zones.length} zones &amp; {dataset.wards.length} wards
          </p>
        </div>
      </div>

      {/* Main Split: Hierarchical Area Breakdown + Integrated Google Map */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Left: Drill-Down Frequency & Resolution Statistics Table */}
        <section className="xl:col-span-7 rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between">
            <div>
              <h3 className="inline-flex items-center gap-1.5 font-display text-base font-semibold text-[#1C2420]">
                <Building2 className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                <span>
                  {tableViewMode === 'ALL_LOCALITIES'
                    ? `All Neighbourhoods & Localities (${areaRows.length})`
                    : selectedZoneId === 'ALL'
                      ? `Zone Breakdown · ${dataset.city.name} (${areaRows.length} Zones)`
                      : selectedWardId === 'ALL'
                        ? `Ward Breakdown · ${activeZone?.name} (${areaRows.length} Wards)`
                        : `Localities in Ward ${activeWard?.wardNumber} (${areaRows.length})`}
                </span>
              </h3>
              <p className="text-xs text-[#526058]">
                Click any row to drill down and pan the map. Verified reports are counted separately from demonstration samples.
              </p>
            </div>

            <div className="inline-flex rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-0.5 text-xs shrink-0 self-start">
              <button
                type="button"
                onClick={() => setTableViewMode('HIERARCHY')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tableViewMode === 'HIERARCHY'
                    ? 'bg-white text-[#14532D] shadow-xs'
                    : 'text-[#526058] hover:text-[#1C2420]'
                }`}
              >
                Hierarchy Drill-Down
              </button>
              <button
                type="button"
                onClick={() => setTableViewMode('ALL_LOCALITIES')}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  tableViewMode === 'ALL_LOCALITIES'
                    ? 'bg-white text-[#14532D] shadow-xs'
                    : 'text-[#526058] hover:text-[#1C2420]'
                }`}
              >
                All Localities ({dataset.localities.length})
              </button>
            </div>
          </div>

          {/* Quick search inside current breakdown list */}
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#526058]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={areaSearch}
              onChange={(e) => setAreaSearch(e.target.value)}
              placeholder="Filter visible zones, wards, or localities by name or pincode..."
              aria-label="Filter visible area analytics"
              className="w-full rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] py-1.5 pl-8 pr-3 text-xs text-[#1C2420] focus:border-[#14532D] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-[#E2E8E4] rounded-lg border border-[#E2E8E4]">
            {areaRows.length === 0 ? (
              <p className="p-6 text-center text-xs text-[#526058]">
                No Bengaluru areas match your filter.
              </p>
            ) : (
              areaRows.map((row) => {
                const barWidth =
                  row.totalCount > 0
                    ? Math.max(Math.round((row.totalCount / maxRowTotal) * 100), 8)
                    : 0;
                const isSelectedLeaf =
                  row.level === 'locality' && row.localityId === selectedLocalityId;

                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => handleDrillRow(row)}
                    className={`w-full p-3.5 text-left transition-colors ${
                      isSelectedLeaf ? 'bg-[#EDF5F0]' : 'bg-white hover:bg-[#F6F8F7]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1C2420] flex items-center gap-1.5">
                          <span className="truncate">{row.name}</span>
                          {row.level !== 'locality' && (
                            <ChevronRight
                              className="h-3.5 w-3.5 shrink-0 text-[#14532D]"
                              aria-hidden="true"
                            />
                          )}
                        </p>
                        <p className="text-[11px] text-[#526058] truncate">{row.subtitle}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] shrink-0">
                        <span className="rounded bg-[#EDF5F0] px-1.5 py-0.5 font-mono font-semibold text-[#14532D] tabular-nums">
                          {row.verifiedCount} verified
                        </span>
                        {row.sampleCount > 0 && (
                          <span className="rounded bg-[#F3F5F4] px-1.5 py-0.5 font-mono text-[#526058] tabular-nums">
                            {row.sampleCount} sample
                          </span>
                        )}
                        <span className="font-mono font-semibold text-[#1C2420] tabular-nums">
                          {row.totalCount > 0 ? `${row.resolutionRate}% res.` : 'No incidents'}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#F3F5F4]">
                        {barWidth > 0 && (
                          <div
                            className={`h-full rounded-full transition-all ${
                              row.verifiedCount > 0 ? 'bg-[#14532D]' : 'bg-[#64748B]'
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        )}
                      </div>
                      <span className="w-16 text-right font-mono text-[11px] text-[#526058] tabular-nums">
                        {row.totalCount} total
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Right: Geographic Google Map Synchronised with Hierarchy & Filters */}
        <section className="xl:col-span-5 rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="inline-flex items-center gap-1.5 font-display text-base font-semibold text-[#1C2420]">
                <Compass className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                <span>Geographic View · {currentHierarchyLabel}</span>
              </h3>
              <p className="text-xs text-[#526058]">
                {filteredReports.length} plotted{' '}
                {filteredReports.length === 1 ? 'incident' : 'incidents'} (gold border = verified report, white border = sample data).
              </p>
            </div>
          </div>

          <BengaluruGoogleMap
            reports={filteredReports}
            selectedReport={selectedMapReport}
            activeNeighbourhoodFilter={activeLocality?.name ?? 'ALL'}
            focusCenter={mapFocusCenter}
            onSelectReport={(id) => setSelectedMapReportId(id)}
            onOpenReportModal={openReportDetail}
            heightClass="h-[320px] sm:h-[380px]"
          />

          {/* Compact interactive category legend */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#29322D]">
            {CATEGORY_MAP_STYLES.map((style) => (
              <button
                key={style.name}
                type="button"
                onClick={() =>
                  setCategoryFilter((prev) => (prev === style.name ? 'ALL' : style.name))
                }
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors ${
                  categoryFilter === style.name
                    ? 'bg-[#EDF5F0] font-semibold text-[#14532D]'
                    : 'hover:bg-[#F6F8F7]'
                }`}
              >
                <span
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full"
                  style={{ backgroundColor: style.bg }}
                >
                  {style.renderIcon('h-2.5 w-2.5 text-white')}
                </span>
                <span>{style.shortLabel}</span>
              </button>
            ))}
          </div>

          {/* Filtered Reports Preview List */}
          {filteredReports.length > 0 ? (
            <div className="border-t border-[#E2E8E4] pt-3 space-y-1.5">
              <p className="text-xs font-semibold text-[#1C2420]">
                Incidents in Active View ({filteredReports.length})
              </p>
              <div className="max-h-40 overflow-y-auto divide-y divide-[#E2E8E4]">
                {filteredReports.slice(0, 8).map((rep) => (
                  <div
                    key={rep.id}
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedMapReportId(rep.id)}
                      className="min-w-0 flex-1 text-left hover:text-[#14532D]"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-medium text-[#1C2420]">{rep.title}</span>
                        <span
                          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                            rep.isSampleDemo
                              ? 'bg-[#F3F5F4] text-[#526058]'
                              : 'bg-[#EDF5F0] text-[#14532D]'
                          }`}
                        >
                          {rep.isSampleDemo ? 'Sample' : 'Verified'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#526058] truncate">
                        {rep.neighbourhood} · {rep.category}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => openReportDetail(rep.id)}
                      className="shrink-0 rounded-md border border-[#E2E8E4] px-2 py-1 text-[11px] font-medium text-[#14532D] hover:bg-[#EDF5F0]"
                    >
                      Inspect
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3 text-xs text-[#526058]">
              No civic reports recorded in {currentHierarchyLabel} matching the active filters.
              {provenanceMode === 'VERIFIED_ONLY' && (
                <span> Switch to &ldquo;Smart&rdquo; mode to view demonstration fallback data where available.</span>
              )}
            </div>
          )}
        </section>
      </div>

      {/* Category Frequency & Resolution Status Distribution for Active Scope */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-[#1C2420]">
                Incident Frequency by Category
              </h3>
              <p className="text-xs text-[#526058]">
                Active scope: {currentHierarchyLabel}
              </p>
            </div>
            <BarChart3 className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
          </div>

          <div className="space-y-3">
            {categoryBreakdown.map((cat) => {
              const pct =
                cat.total > 0 ? Math.max(Math.round((cat.total / maxCategoryCount) * 100), 6) : 0;
              return (
                <div key={cat.id} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-medium text-[#1C2420]">{cat.name}</span>
                    <span className="font-mono tabular-nums text-[#526058]">
                      {cat.total} ({cat.verified} verified · {cat.sample} sample)
                    </span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-[#F3F5F4]">
                    {pct > 0 && (
                      <div
                        className="h-full rounded-full bg-[#166534] transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold text-[#1C2420]">
                Resolution Status Breakdown
              </h3>
              <p className="text-xs text-[#526058]">
                Lifecycle distribution across {filteredReports.length} incidents in scope
              </p>
            </div>
            <TrendingUp className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {statusBreakdown.map((item) => (
              <button
                key={item.status}
                type="button"
                onClick={() =>
                  setStatusFilter((prev) => (prev === item.status ? 'ALL' : item.status))
                }
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  statusFilter === item.status
                    ? 'border-[#14532D] bg-[#EDF5F0]'
                    : 'border-[#E2E8E4] bg-[#F6F8F7] hover:border-[#CFE3D5]'
                }`}
              >
                <div className="min-w-0">
                  <StatusIndicator status={item.status} compact />
                  <p className="mt-1 text-[10px] text-[#526058] tabular-nums">
                    {item.verified} verified · {item.sample} sample
                  </p>
                </div>
                <span className="font-mono text-sm font-bold text-[#14532D] tabular-nums">
                  {item.total}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3 text-[11px] text-[#526058]">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14532D]" aria-hidden="true" />
            <p>
              <strong className="text-[#1C2420]">Data Provenance Guarantee:</strong> Verified citizen submissions from Firestore are always prioritised and explicitly separated from Bengaluru pilot demonstration samples.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};
