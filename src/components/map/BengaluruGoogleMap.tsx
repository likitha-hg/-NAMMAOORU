import React, { useEffect, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useMap,
} from '@vis.gl/react-google-maps';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { BENGALURU_CENTER, BENGALURU_NEIGHBOURHOOD_LATLNG } from '../../data/mockData';
import { useGoogleMapsApiKey } from '../../hooks/useGoogleMapsApiKey';
import { CivicReport } from '../../types/civic';
import { StatusIndicator } from '../ui/StatusIndicator';
import { getCategoryMapStyle, getStatusBadgeDotColor } from './mapCategoryStyles';

const GMP_ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];
const MAP_LIBRARIES: ('marker')[] = ['marker'];

interface BengaluruGoogleMapProps {
  reports: CivicReport[];
  selectedReport: CivicReport | null;
  activeNeighbourhoodFilter: string;
  onSelectReport: (reportId: string) => void;
  onOpenReportModal: (reportId: string) => void;
  embedded?: boolean;
  heightClass?: string;
  userLocation?: { lat: number; lng: number } | null;
  /** Optional explicit viewport focus for City -> Zone -> Ward -> Locality drill-down */
  focusCenter?: { lat: number; lng: number; zoom?: number } | null;
}

export function getReportLatLng(report: CivicReport): { lat: number; lng: number } | null {
  if (
    typeof report.lat === 'number' &&
    typeof report.lng === 'number' &&
    Number.isFinite(report.lat) &&
    Number.isFinite(report.lng)
  ) {
    return { lat: report.lat, lng: report.lng };
  }
  const fallback = BENGALURU_NEIGHBOURHOOD_LATLNG[report.neighbourhood];
  return fallback ?? null;
}

const MapViewportController: React.FC<{
  neighbourhoodFilter: string;
  selectedReport: CivicReport | null;
  userLocation?: { lat: number; lng: number } | null;
  focusCenter?: { lat: number; lng: number; zoom?: number } | null;
}> = ({ neighbourhoodFilter, selectedReport, userLocation, focusCenter }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedReport) {
      const pos = getReportLatLng(selectedReport);
      if (pos) {
        map.panTo(pos);
        const currentZoom = map.getZoom() ?? 11;
        if (currentZoom < 13) {
          map.setZoom(14);
        }
      }
      return;
    }
    if (userLocation) {
      map.panTo(userLocation);
      map.setZoom(14);
      return;
    }
    if (focusCenter) {
      map.panTo({ lat: focusCenter.lat, lng: focusCenter.lng });
      map.setZoom(focusCenter.zoom ?? 13);
      return;
    }
    if (neighbourhoodFilter !== 'ALL' && BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhoodFilter]) {
      map.panTo(BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhoodFilter]);
      map.setZoom(13);
    } else {
      map.panTo(BENGALURU_CENTER);
      map.setZoom(11);
    }
  }, [
    map,
    neighbourhoodFilter,
    selectedReport,
    userLocation,
    focusCenter?.lat,
    focusCenter?.lng,
    focusCenter?.zoom,
  ]);

  return null;
};

export const BengaluruGoogleMap: React.FC<BengaluruGoogleMapProps> = ({
  reports,
  selectedReport,
  activeNeighbourhoodFilter,
  onSelectReport,
  onOpenReportModal,
  embedded = false,
  heightClass = 'h-[300px] sm:h-[380px] lg:h-[460px]',
  userLocation = null,
  focusCenter = null,
}) => {
  const { apiKey, loading: keyLoading, configError, authFailed } = useGoogleMapsApiKey();
  const [mapLoadError, setMapLoadError] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);

  const containerChrome = embedded
    ? `${heightClass} w-full overflow-hidden bg-[#EDF5F0]`
    : `${heightClass} w-full overflow-hidden rounded-xl border border-[#E2E8E4] bg-[#EDF5F0]`;

  if (keyLoading) {
    return (
      <div
        className={`flex ${heightClass} w-full flex-col items-center justify-center bg-[#F6F8F7] p-6 text-center ${
          embedded ? '' : 'rounded-xl border border-[#E2E8E4]'
        }`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-[#14532D]" aria-hidden="true" />
        <p className="mt-2 text-xs font-medium text-[#526058]">Loading interactive Bengaluru map...</p>
      </div>
    );
  }

  if (configError || !apiKey) {
    return (
      <div
        className={`flex ${heightClass} w-full flex-col items-center justify-center bg-[#F6F8F7] p-6 text-center ${
          embedded ? '' : 'rounded-xl border border-[#E2E8E4]'
        }`}
      >
        <AlertCircle className="h-7 w-7 text-[#14532D]" aria-hidden="true" />
        <h3 className="mt-3 font-display text-base font-semibold text-[#1C2420]">
          Google Maps Configuration Pending
        </h3>
        <p className="mt-1 max-w-md text-xs text-[#526058]">
          {configError ||
            'The interactive Bengaluru map requires GOOGLE_MAPS_API_KEY to be configured in the environment. You can still browse and inspect civic reports from the list beside this panel.'}
        </p>
      </div>
    );
  }

  const effectiveError = authFailed
    ? 'Google Maps authentication failed. Please check that GOOGLE_MAPS_API_KEY has Maps JavaScript API enabled and allows this domain.'
    : mapLoadError;

  const mappableReports = reports
    .map((report) => ({ report, pos: getReportLatLng(report) }))
    .filter((entry): entry is { report: CivicReport; pos: { lat: number; lng: number } } =>
      entry.pos !== null
    );

  const selectedPos = selectedReport ? getReportLatLng(selectedReport) : null;

  return (
    <APIProvider
      key={`gmap-${retryCount}`}
      apiKey={apiKey}
      libraries={MAP_LIBRARIES}
      language="en"
      region="IN"
      onError={() =>
        setMapLoadError(
          'Unable to load Google Maps right now. Please check your network connection or API key restrictions.'
        )
      }
    >
      <div className={`relative ${containerChrome}`}>
        {effectiveError ? (
          <div
            role="alert"
            className="flex h-full w-full flex-col items-center justify-center bg-[#F6F8F7] p-6 text-center"
          >
            <AlertCircle className="h-7 w-7 text-[#B91C1C]" aria-hidden="true" />
            <p className="mt-2 max-w-md text-xs font-medium text-[#991B1B]">{effectiveError}</p>
            {!authFailed && (
              <button
                type="button"
                onClick={() => {
                  setMapLoadError('');
                  setRetryCount((c) => c + 1);
                }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-white px-3 py-1.5 text-xs font-semibold text-[#14532D] hover:bg-[#EDF5F0]"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Retry Map</span>
              </button>
            )}
          </div>
        ) : (
          <GoogleMap
            defaultCenter={BENGALURU_CENTER}
            defaultZoom={11}
            mapId="DEMO_MAP_ID"
            gestureHandling="greedy"
            streetViewControl={false}
            mapTypeControl={false}
            fullscreenControl={true}
            internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
            className="h-full w-full"
          >
            <MapViewportController
              neighbourhoodFilter={activeNeighbourhoodFilter}
              selectedReport={selectedReport}
              userLocation={userLocation}
              focusCenter={focusCenter}
            />

            {userLocation && (
              <AdvancedMarker
                position={userLocation}
                title="Your Current Location"
                zIndex={40}
              >
                <div className="relative flex h-5 w-5 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#2563EB]/40" />
                  <span className="relative inline-flex h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2563EB] shadow-md" />
                </div>
              </AdvancedMarker>
            )}

            {mappableReports.map(({ report, pos }) => {
              const isSelected = selectedReport?.id === report.id;
              const catStyle = getCategoryMapStyle(report.category);
              const statusDotColor = getStatusBadgeDotColor(report.status);

              return (
                <AdvancedMarker
                  key={report.id}
                  position={pos}
                  title={`${report.title} · ${report.category} (${report.neighbourhood})`}
                  onClick={() => onSelectReport(report.id)}
                  zIndex={isSelected ? 60 : report.isSampleDemo ? 15 : 35}
                >
                  <div
                    className={`relative flex items-center justify-center rounded-full shadow-md transition-transform cursor-pointer ${
                      isSelected
                        ? 'h-10 w-10 scale-110 ring-4 ring-[#14532D]/30'
                        : 'h-8 w-8 hover:scale-110'
                    }`}
                    style={{
                      backgroundColor: catStyle.bg,
                      border: `2.5px solid ${report.isSampleDemo ? '#FFFFFF' : '#FDE047'}`,
                    }}
                  >
                    {catStyle.renderIcon(isSelected ? 'h-4 w-4 text-white' : 'h-3.5 w-3.5 text-white')}
                    <span
                      className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border border-white"
                      style={{ backgroundColor: statusDotColor }}
                      aria-hidden="true"
                    />
                  </div>
                </AdvancedMarker>
              );
            })}

            {selectedReport && selectedPos && (
              <InfoWindow
                position={selectedPos}
                pixelOffset={[0, -38]}
                onCloseClick={() => onSelectReport('')}
              >
                <div className="max-w-[270px] space-y-2 p-1 text-[#1C2420]">
                  <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                    <span className="font-mono font-semibold text-[#1C2420] tabular-nums">
                      {selectedReport.id}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                        selectedReport.isSampleDemo
                          ? 'bg-[#F3F5F4] text-[#526058]'
                          : 'bg-[#EDF5F0] text-[#14532D]'
                      }`}
                    >
                      {selectedReport.isSampleDemo ? 'Sample Data' : 'Verified Report'}
                    </span>
                  </div>
                  <div>
                    <span
                      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: getCategoryMapStyle(selectedReport.category).softBg,
                        color: getCategoryMapStyle(selectedReport.category).text,
                      }}
                    >
                      {selectedReport.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold leading-snug text-[#1C2420]">
                    {selectedReport.title}
                  </p>
                  <p className="text-[11px] text-[#526058]">
                    {selectedReport.formattedAddress || selectedReport.address}
                  </p>
                  <p className="font-mono text-[10px] text-[#526058] tabular-nums">
                    {selectedPos.lat.toFixed(5)}° N, {selectedPos.lng.toFixed(5)}° E ·{' '}
                    {selectedReport.neighbourhood}
                  </p>
                  <div className="pt-0.5">
                    <StatusIndicator status={selectedReport.status} compact />
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenReportModal(selectedReport.id)}
                    className="mt-1 inline-flex w-full items-center justify-center rounded-md bg-[#14532D] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#166534]"
                  >
                    Open Full Report
                  </button>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        )}
      </div>
    </APIProvider>
  );
};
