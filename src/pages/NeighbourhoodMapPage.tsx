import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Compass,
  ExternalLink,
  Filter,
  Layers,
  Loader2,
  LocateFixed,
  MapPin,
  Navigation,
} from 'lucide-react';
import { BengaluruGoogleMap, getReportLatLng } from '../components/map/BengaluruGoogleMap';
import { CATEGORY_MAP_STYLES, getCategoryMapStyle } from '../components/map/mapCategoryStyles';
import { EmptyState } from '../components/ui/EmptyState';
import { PriorityText, StatusIndicator } from '../components/ui/StatusIndicator';
import { BENGALURU_CENTER, BENGALURU_NEIGHBOURHOODS, BENGALURU_NEIGHBOURHOOD_LATLNG } from '../data/mockData';
import { useCivic } from '../context/CivicContext';
import { useBengaluruLocations } from '../hooks/useBengaluruLocations';
import { fetchMapsGroundingContext } from '../services/googleMapsService';
import { findLocalityCoordinates } from '../services/locationMasterService';
import { MapsGroundingResult, ReportStatus } from '../types/civic';

export const NeighbourhoodMapPage: React.FC = () => {
  const {
    reports,
    categories,
    preferredNeighbourhood,
    openReportDetail,
    navigateTo,
  } = useCivic();
  const { dataset: bengaluruLocations } = useBengaluruLocations();

  const allLocalityNames = useMemo(() => {
    if (bengaluruLocations?.localities?.length) {
      return [...bengaluruLocations.localities]
        .map((l) => l.name)
        .sort((a, b) => a.localeCompare(b));
    }
    return [...BENGALURU_NEIGHBOURHOODS];
  }, [bengaluruLocations]);

  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [neighbourhoodFilter, setNeighbourhoodFilter] = useState<string>('ALL');
  const [selectedPinId, setSelectedPinId] = useState<string>(reports[0]?.id ?? '');

  // Opt-in browser geolocation state (only requested on explicit click)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState('');

  // Gemini 4 Hydrogen + Google Maps Grounding state
  const [groundingResult, setGroundingResult] = useState<MapsGroundingResult | null>(null);
  const [isLoadingGrounding, setIsLoadingGrounding] = useState(false);
  const [groundingError, setGroundingError] = useState('');

  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false;
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (neighbourhoodFilter !== 'ALL' && r.neighbourhood !== neighbourhoodFilter) return false;
      return true;
    });
  }, [reports, categoryFilter, statusFilter, neighbourhoodFilter]);

  const activePin =
    filteredReports.find((r) => r.id === selectedPinId) ??
    (selectedPinId === '' ? null : filteredReports[0] ?? null);

  const hasActiveFilters =
    categoryFilter !== 'ALL' || statusFilter !== 'ALL' || neighbourhoodFilter !== 'ALL';

  const resetFilters = () => {
    setCategoryFilter('ALL');
    setStatusFilter('ALL');
    setNeighbourhoodFilter('ALL');
  };

  const handleUseMyLocation = () => {
    setLocationError('');
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setLocationError('Location detection is not supported in this browser.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        setSelectedPinId('');
        setUserLocation({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
      },
      (geoErr) => {
        setIsLocating(false);
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          setLocationError(
            'Location permission was denied. You can still browse all Bengaluru wards and reports on the map.'
          );
        } else if (geoErr.code === geoErr.TIMEOUT) {
          setLocationError('Location request timed out. Please try again or pick a ward filter.');
        } else {
          setLocationError('Current location is currently unavailable.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const handleFetchNearbyContext = async () => {
    setGroundingError('');
    setIsLoadingGrounding(true);

    try {
      const pinCoords = activePin ? getReportLatLng(activePin) : null;
      const wardCoords =
        neighbourhoodFilter !== 'ALL'
          ? findLocalityCoordinates(neighbourhoodFilter, bengaluruLocations) ??
            BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhoodFilter] ??
            BENGALURU_CENTER
          : findLocalityCoordinates(preferredNeighbourhood, bengaluruLocations) ??
            BENGALURU_NEIGHBOURHOOD_LATLNG[preferredNeighbourhood] ??
            BENGALURU_CENTER;

      const targetCoords = pinCoords ?? userLocation ?? wardCoords;
      const targetNeighbourhood =
        activePin?.neighbourhood ??
        (neighbourhoodFilter !== 'ALL' ? neighbourhoodFilter : preferredNeighbourhood);

      const result = await fetchMapsGroundingContext({
        lat: targetCoords.lat,
        lng: targetCoords.lng,
        neighbourhood: targetNeighbourhood,
        address: activePin?.formattedAddress || activePin?.address,
        category: activePin?.category ?? (categoryFilter !== 'ALL' ? categoryFilter : undefined),
      });
      setGroundingResult(result);
    } catch (err) {
      setGroundingError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch nearby civic landmarks right now.'
      );
    } finally {
      setIsLoadingGrounding(false);
    }
  };

  const activePinCoords = activePin ? getReportLatLng(activePin) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-bold text-[#1C2420]">
            Bengaluru Neighbourhood Map
          </h1>
          <p className="text-sm text-[#526058]">
            View your authorised civic reports plotted at their exact stored coordinates across Bengaluru. Filter by category, status, or ward and click any pin for details.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-white px-3.5 py-2 text-xs font-semibold text-[#14532D] hover:bg-[#EDF5F0] disabled:opacity-60 whitespace-nowrap"
          >
            {isLocating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <LocateFixed className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isLocating ? 'Locating...' : 'My Location'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedPinId('');
              setNeighbourhoodFilter(preferredNeighbourhood);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3.5 py-2 text-xs font-semibold text-[#14532D] hover:bg-[#DCEEE4] whitespace-nowrap"
          >
            <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Focus {preferredNeighbourhood}</span>
          </button>
          <button
            type="button"
            onClick={() => navigateTo('report')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#14532D] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#166534] whitespace-nowrap"
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Report New Issue</span>
          </button>
        </div>
      </div>

      {locationError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{locationError}</span>
        </div>
      )}

      {/* Filters */}
      <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#1C2420]">
          <span className="inline-flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
            <span>Filter Your Authorised Reports ({filteredReports.length} of {reports.length})</span>
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-medium text-[#14532D] hover:underline"
            >
              Reset all filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor="map-category" className="block text-xs font-medium text-[#526058]">
              Category
            </label>
            <select
              id="map-category"
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

          <div>
            <label htmlFor="map-status" className="block text-xs font-medium text-[#526058]">
              Status
            </label>
            <select
              id="map-status"
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

          <div>
            <label htmlFor="map-neighbourhood" className="block text-xs font-medium text-[#526058]">
              Neighbourhood
            </label>
            <select
              id="map-neighbourhood"
              value={neighbourhoodFilter}
              onChange={(e) => setNeighbourhoodFilter(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            >
              <option value="ALL">All Bengaluru Localities ({allLocalityNames.length})</option>
              {allLocalityNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Interactive Google Map + Selected Report Side Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#526058]">
              <span className="font-semibold text-[#1C2420]">
                Bengaluru Civic Map ({filteredReports.length}{' '}
                {filteredReports.length === 1 ? 'report marker' : 'report markers'})
              </span>
              {userLocation && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-[#1D4ED8] tabular-nums">
                  <span className="h-2 w-2 rounded-full bg-[#2563EB]" aria-hidden="true" />
                  My GPS: {userLocation.lat.toFixed(4)}° N, {userLocation.lng.toFixed(4)}° E
                </span>
              )}
            </div>

            <BengaluruGoogleMap
              reports={filteredReports}
              selectedReport={activePin}
              activeNeighbourhoodFilter={neighbourhoodFilter}
              focusCenter={
                neighbourhoodFilter !== 'ALL'
                  ? (() => {
                      const c =
                        findLocalityCoordinates(neighbourhoodFilter, bengaluruLocations) ??
                        BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhoodFilter];
                      return c ? { lat: c.lat, lng: c.lng, zoom: 14 } : null;
                    })()
                  : null
              }
              onSelectReport={(id) => setSelectedPinId(id)}
              onOpenReportModal={openReportDetail}
              userLocation={userLocation}
            />

            {/* Category Marker Legend */}
            <div className="space-y-2 pt-1">
              <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[11px] text-[#29322D]">
                {CATEGORY_MAP_STYLES.map((style) => (
                  <button
                    key={style.name}
                    type="button"
                    onClick={() =>
                      setCategoryFilter((prev) => (prev === style.name ? 'ALL' : style.name))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 transition-colors ${
                      categoryFilter === style.name
                        ? 'bg-[#EDF5F0] font-semibold text-[#14532D]'
                        : 'hover:bg-[#F6F8F7]'
                    }`}
                  >
                    <span
                      className="inline-flex h-5 w-5 items-center justify-center rounded-full shadow-xs"
                      style={{ backgroundColor: style.bg }}
                    >
                      {style.renderIcon('h-3 w-3 text-white')}
                    </span>
                    <span>{style.shortLabel}</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-[#526058]">
                Each marker icon and colour indicates the civic problem category, and the top-right status dot reflects current progress. Only reports authorised for your account are displayed.
              </p>
            </div>
          </div>

          {/* Grounding with Google Maps (Gemini 4 Hydrogen) */}
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-[#1C2420]">
                  <Compass className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
                  <span>Nearby Civic Landmarks &amp; Offices</span>
                </h2>
                <p className="mt-0.5 text-xs text-[#526058]">
                  Look up verified Google Maps landmarks and local ward offices near{' '}
                  {activePin
                    ? `${activePin.neighbourhood} (${activePin.title})`
                    : neighbourhoodFilter !== 'ALL'
                      ? neighbourhoodFilter
                      : preferredNeighbourhood}
                  .
                </p>
              </div>
              <button
                type="button"
                onClick={handleFetchNearbyContext}
                disabled={isLoadingGrounding}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3 py-1.5 text-xs font-semibold text-[#14532D] hover:bg-[#DCEEE4] disabled:opacity-60 whitespace-nowrap"
              >
                {isLoadingGrounding ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : (
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{isLoadingGrounding ? 'Checking Google Maps...' : 'Lookup Nearby Places'}</span>
              </button>
            </div>

            {groundingError && (
              <p className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]">
                {groundingError}
              </p>
            )}

            {groundingResult && (
              <div className="rounded-lg border border-[#CFE3D5] bg-[#F6F8F7] p-3.5 space-y-2.5">
                {groundingResult.summary && (
                  <p className="text-xs text-[#29322D] leading-relaxed whitespace-pre-line">
                    {groundingResult.summary}
                  </p>
                )}

                {groundingResult.places.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-[#E2E8E4]">
                    <p className="text-[11px] font-semibold text-[#14532D]">
                      Verified Google Maps Sources
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {groundingResult.places.map((place) => (
                        <li key={place.uri}>
                          <a
                            href={place.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-[#CFE3D5] bg-white px-2.5 py-1 text-[11px] font-medium text-[#14532D] hover:bg-[#EDF5F0]"
                          >
                            <span>{place.title}</span>
                            <ExternalLink className="h-3 w-3" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Report Side Panel + Report List */}
        <div className="space-y-4">
          {activePin ? (
            <div className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs font-medium text-[#526058] tabular-nums">
                    {activePin.id}
                  </span>
                  <span
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold"
                    style={{
                      backgroundColor: getCategoryMapStyle(activePin.category).softBg,
                      color: getCategoryMapStyle(activePin.category).text,
                    }}
                  >
                    {activePin.category}
                  </span>
                </div>
                <h2 className="font-display text-base font-semibold text-[#1C2420]">
                  {activePin.title}
                </h2>
                <p className="text-xs text-[#526058]">{activePin.neighbourhood}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <StatusIndicator status={activePin.status} />
                <PriorityText priority={activePin.priority} />
              </div>

              <p className="text-sm text-[#29322D] leading-relaxed">{activePin.description}</p>

              <div className="rounded-lg bg-[#F6F8F7] p-3 text-xs text-[#29322D] space-y-1.5">
                <p>
                  <strong className="text-[#1C2420]">Location:</strong> {activePin.address}
                </p>
                {activePin.formattedAddress &&
                  activePin.formattedAddress.trim() !== activePin.address.trim() && (
                    <p>
                      <strong className="text-[#1C2420]">Google Maps Address:</strong>{' '}
                      {activePin.formattedAddress}
                    </p>
                  )}
                {activePinCoords && (
                  <p className="font-mono text-[11px] text-[#526058] tabular-nums">
                    <strong className="font-sans text-xs text-[#1C2420]">Coordinates:</strong>{' '}
                    {activePinCoords.lat.toFixed(5)}° N, {activePinCoords.lng.toFixed(5)}° E
                  </p>
                )}
                <p>
                  <strong className="text-[#1C2420]">Suggested Department:</strong>{' '}
                  {activePin.suggestedDepartment}
                </p>
                <p>
                  <strong className="text-[#1C2420]">Reported:</strong> {activePin.dateSubmitted}
                </p>
              </div>

              <button
                type="button"
                onClick={() => openReportDetail(activePin.id)}
                className="w-full rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534]"
              >
                Open Full Report &amp; Timeline
              </button>
            </div>
          ) : reports.length === 0 ? (
            <EmptyState
              title="No civic reports pinned yet"
              description="Submit a problem using the interactive location picker and your report will appear right here as a colour-coded marker."
              actionLabel="Report a Problem"
              onAction={() => navigateTo('report')}
            />
          ) : (
            <EmptyState
              title="No matching reports on map"
              description="Adjust your category, status, or neighbourhood filter to view your submitted civic reports."
              actionLabel="Reset Filters"
              onAction={resetFilters}
            />
          )}

          {/* Authorised Reports List */}
          <div className="rounded-xl border border-[#E2E8E4] bg-white p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1C2420]">
                <Layers className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                <span>Your Mapped Reports ({filteredReports.length})</span>
              </h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-xs font-medium text-[#14532D] hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            {filteredReports.length === 0 ? (
              <p className="py-3 text-xs text-[#526058]">
                {reports.length === 0
                  ? 'Your submitted civic reports will be listed here with their exact coordinates.'
                  : 'No reports match your active filters.'}
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto divide-y divide-[#E2E8E4]">
                {filteredReports.map((rep) => {
                  const isSelected = activePin?.id === rep.id;
                  const catStyle = getCategoryMapStyle(rep.category);
                  return (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => setSelectedPinId(rep.id)}
                      className={`w-full py-2.5 px-2.5 text-left transition-colors rounded-md ${
                        isSelected ? 'bg-[#EDF5F0]' : 'hover:bg-[#F6F8F7]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: catStyle.bg }}
                          aria-hidden="true"
                        />
                        <p className="text-xs font-semibold text-[#1C2420] line-clamp-1">
                          {rep.title}
                        </p>
                      </div>
                      <p className="mt-0.5 pl-4 text-[11px] text-[#526058]">
                        {rep.neighbourhood} · {rep.category} · {rep.status}
                      </p>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
