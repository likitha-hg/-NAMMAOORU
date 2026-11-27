import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  Map as GoogleMap,
  MapMouseEvent,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  AlertCircle,
  Compass,
  Crosshair,
  ExternalLink,
  Loader2,
  MapPin,
  Navigation,
  RefreshCw,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import {
  BENGALURU_CENTER,
  BENGALURU_NEIGHBOURHOOD_LATLNG,
  BENGALURU_NEIGHBOURHOODS,
} from '../../data/mockData';
import { useGoogleMapsApiKey } from '../../hooks/useGoogleMapsApiKey';
import {
  fetchMapsGroundingContext,
  geocodeBengaluruAddress,
  reverseGeocodeCoordinates,
} from '../../services/googleMapsService';
import { MapsGroundingResult } from '../../types/civic';

const GMP_ATTRIBUTION_IDS = ['gmp_mcp_codeassist_v1_aistudio'];
const PICKER_LIBRARIES: ('places' | 'marker')[] = ['places', 'marker'];

// Bengaluru pilot bounding rectangle for Places Autocomplete biasing
const BENGALURU_BOUNDS = {
  south: 12.7343,
  west: 77.3791,
  north: 13.1737,
  east: 77.8827,
};

export type LocationSource = 'ward_default' | 'map_pin' | 'places_autocomplete' | 'gps' | 'geocoded';

export interface SelectedLocationPayload {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
  matchedNeighbourhood?: string;
  source: LocationSource;
}

interface ReportLocationPickerProps {
  selectedCoords: { lat: number; lng: number } | null;
  neighbourhood: string;
  address: string;
  formattedAddress: string;
  locationSource: LocationSource;
  category: string;
  onLocationSelected: (payload: SelectedLocationPayload) => void;
}

interface PlacesPredictionPlace {
  displayName?: string | { text?: string } | null;
  formattedAddress?: string | null;
  id?: string | null;
  location?: { lat: () => number; lng: () => number } | null;
  fetchFields: (opts: { fields: string[] }) => Promise<unknown>;
}

interface PlacesAutocompleteSuggestionItem {
  placePrediction?: {
    placeId?: string;
    text: { text: string };
    mainText?: { text: string } | null;
    secondaryText?: { text: string } | null;
    toPlace: () => PlacesPredictionPlace;
  } | null;
}

interface MarkerDragEvent {
  latLng?: { lat: () => number; lng: () => number } | null;
}

/**
 * Modern Places API (New) autocomplete hook using AutocompleteSuggestion + AutocompleteSessionToken.
 * Strictly avoids legacy google.maps.places.Autocomplete / PlacesService.
 */
function usePlacesAutocompleteSuggestions(inputText: string) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<unknown>(null);
  const [suggestions, setSuggestions] = useState<PlacesAutocompleteSuggestionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [placesError, setPlacesError] = useState('');

  useEffect(() => {
    const trimmed = inputText.trim();
    if (!placesLib || trimmed.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } = placesLib as unknown as {
          AutocompleteSessionToken: new () => unknown;
          AutocompleteSuggestion: {
            fetchAutocompleteSuggestions: (
              req: Record<string, unknown>
            ) => Promise<{ suggestions?: PlacesAutocompleteSuggestionItem[] }>;
          };
        };
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new AutocompleteSessionToken();
        }
        setLoading(true);
        setPlacesError('');

        const request = {
          input: trimmed,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ['in'],
          locationBias: BENGALURU_BOUNDS,
          language: 'en',
          region: 'IN',
        };

        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        if (!cancelled) {
          setSuggestions(response.suggestions ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setSuggestions([]);
          const msg =
            err instanceof Error
              ? err.message
              : 'Places Autocomplete is temporarily unavailable.';
          setPlacesError(
            /quota|429|RESOURCE_EXHAUSTED/i.test(msg)
              ? 'Google Places quota reached. Use "Locate" or drop a pin directly on the map.'
              : 'Live place suggestions could not load. Click "Locate" or drop a pin directly on the map.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }, 260);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [placesLib, inputText]);

  const resetSession = useCallback(() => {
    sessionTokenRef.current = null;
    setSuggestions([]);
  }, []);

  return { placesLib, suggestions, loading, placesError, resetSession };
}

function matchWardName(rawText: string): string | undefined {
  const lower = rawText.toLowerCase();
  for (const ward of BENGALURU_NEIGHBOURHOODS) {
    if (lower.includes(ward.toLowerCase())) return ward;
  }
  if (lower.includes('malleswaram')) return 'Malleshwaram';
  if (lower.includes('hsr')) return 'HSR Layout';
  return undefined;
}

const PickerViewportSync: React.FC<{
  target: { lat: number; lng: number };
  zoom: number;
}> = ({ target, zoom }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    map.panTo(target);
    map.setZoom(zoom);
  }, [map, target.lat, target.lng, zoom]);

  return null;
};

interface InnerPickerProps extends ReportLocationPickerProps {
  onMapError: (msg: string) => void;
}

const InnerLocationPicker: React.FC<InnerPickerProps> = ({
  selectedCoords,
  neighbourhood,
  address,
  formattedAddress,
  locationSource,
  category,
  onLocationSelected,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [geocodingBusy, setGeocodingBusy] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorBanner, setErrorBanner] = useState('');

  // Gemini 4 Hydrogen Google Maps Grounding context state
  const [groundingBusy, setGroundingBusy] = useState(false);
  const [groundingError, setGroundingError] = useState('');
  const [groundingResult, setGroundingResult] = useState<MapsGroundingResult | null>(null);

  const { placesLib, suggestions, loading: placesLoading, placesError, resetSession } =
    usePlacesAutocompleteSuggestions(searchQuery);

  const activeCoords =
    selectedCoords ??
    BENGALURU_NEIGHBOURHOOD_LATLNG[neighbourhood] ??
    BENGALURU_CENTER;

  const targetZoom = selectedCoords ? 16 : 13;

  const lookupAddressForCoords = useCallback(
    async (lat: number, lng: number, source: LocationSource) => {
      const roundedLat = Number(lat.toFixed(6));
      const roundedLng = Number(lng.toFixed(6));

      // Update coordinates immediately so the pin never lags
      onLocationSelected({
        lat: roundedLat,
        lng: roundedLng,
        source,
      });

      setGeocodingBusy(true);
      setErrorBanner('');
      setStatusMessage('Looking up readable street address via Google Maps Geocoding...');

      try {
        const result = await reverseGeocodeCoordinates(roundedLat, roundedLng);
        onLocationSelected({
          lat: result.lat,
          lng: result.lng,
          formattedAddress: result.formattedAddress,
          placeId: result.placeId,
          matchedNeighbourhood: result.matchedNeighbourhood,
          source,
        });
        setStatusMessage('Pin coordinates converted to a formatted street address. You can still edit the address below.');
      } catch (err) {
        setStatusMessage('');
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'Could not look up the street address automatically. Your coordinates are saved—please type or adjust the address below.'
        );
      } finally {
        setGeocodingBusy(false);
      }
    },
    [onLocationSelected]
  );

  const handleMapClick = useCallback(
    (e: MapMouseEvent) => {
      const latLng = e.detail.latLng;
      if (!latLng) return;
      setDropdownOpen(false);
      setGroundingResult(null);
      void lookupAddressForCoords(latLng.lat, latLng.lng, 'map_pin');
    },
    [lookupAddressForCoords]
  );

  const handleMarkerDragEnd = useCallback(
    (e: MarkerDragEvent) => {
      const pos = e.latLng;
      if (!pos) return;
      setDropdownOpen(false);
      setGroundingResult(null);
      void lookupAddressForCoords(pos.lat(), pos.lng(), 'map_pin');
    },
    [lookupAddressForCoords]
  );

  const handleSuggestionSelect = useCallback(
    async (suggestion: PlacesAutocompleteSuggestionItem) => {
      if (!placesLib || !suggestion.placePrediction) return;
      setDropdownOpen(false);
      setGeocodingBusy(true);
      setErrorBanner('');
      setStatusMessage('Fetching verified Google Places coordinates and address...');
      setGroundingResult(null);

      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location', 'viewport', 'id'],
        });

        const loc = place.location;
        if (!loc) {
          throw new Error('Selected place did not include map coordinates. Try dropping a pin.');
        }

        const lat = Number(loc.lat().toFixed(6));
        const lng = Number(loc.lng().toFixed(6));
        const rawDisplay = place.displayName;
        const displayName =
          typeof rawDisplay === 'string'
            ? rawDisplay
            : rawDisplay && typeof rawDisplay === 'object' && 'text' in rawDisplay && rawDisplay.text
              ? String(rawDisplay.text)
              : '';
        const formatted = place.formattedAddress
          ? String(place.formattedAddress)
          : displayName || suggestion.placePrediction.text.text;

        const combinedLabel =
          displayName && formatted && !formatted.toLowerCase().includes(displayName.toLowerCase())
            ? `${displayName}, ${formatted}`
            : formatted;

        setSearchQuery(displayName || formatted);
        onLocationSelected({
          lat,
          lng,
          formattedAddress: combinedLabel.slice(0, 240),
          placeId: place.id || undefined,
          matchedNeighbourhood: matchWardName(`${displayName} ${formatted}`),
          source: 'places_autocomplete',
        });
        setStatusMessage('Location selected via Google Places. Drag the pin to fine-tune the exact spot.');
        resetSession();
      } catch (err) {
        setStatusMessage('');
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'Unable to fetch details for that place. Try clicking "Locate" or dropping a pin on the map.'
        );
      } finally {
        setGeocodingBusy(false);
      }
    },
    [placesLib, onLocationSelected, resetSession]
  );

  const handleForwardGeocode = useCallback(
    async (queryText: string) => {
      const cleaned = queryText.trim();
      if (cleaned.length < 2) {
        setErrorBanner('Enter at least 2 characters (e.g., "100 Feet Road Indiranagar") to search.');
        return;
      }
      setDropdownOpen(false);
      setGeocodingBusy(true);
      setErrorBanner('');
      setStatusMessage('Locating address on Bengaluru map...');
      setGroundingResult(null);

      try {
        const result = await geocodeBengaluruAddress(cleaned);
        onLocationSelected({
          lat: result.lat,
          lng: result.lng,
          formattedAddress: result.formattedAddress,
          placeId: result.placeId,
          matchedNeighbourhood: result.matchedNeighbourhood,
          source: 'geocoded',
        });
        setStatusMessage('Address located on map. Drag the pin if you want to refine the exact spot.');
      } catch (err) {
        setStatusMessage('');
        setErrorBanner(
          err instanceof Error
            ? err.message
            : 'Could not locate that address. Try dropping a pin directly on the map.'
        );
      } finally {
        setGeocodingBusy(false);
      }
    },
    [onLocationSelected]
  );

  // Strictly opt-in: browser geolocation permission is only requested when citizen clicks this button
  const handleUseCurrentLocation = useCallback(() => {
    setErrorBanner('');
    setStatusMessage('');
    setGroundingResult(null);

    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setErrorBanner(
        'Location detection is not supported in this browser. Search for a place or drop a pin on the map.'
      );
      return;
    }

    setGpsBusy(true);
    setStatusMessage('Requesting location permission from your browser...');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGpsBusy(false);
        const { latitude, longitude } = position.coords;
        void lookupAddressForCoords(latitude, longitude, 'gps');
      },
      (geoError) => {
        setGpsBusy(false);
        setStatusMessage('');
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setErrorBanner(
            'Location permission was denied. You can still search with Google Places or click/drag the map pin to set your location.'
          );
        } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
          setErrorBanner(
            'Your current location is temporarily unavailable. Please search for your street or drop a pin on the map.'
          );
        } else if (geoError.code === geoError.TIMEOUT) {
          setErrorBanner(
            'Current-location detection timed out. Please try again or drop a pin on the map.'
          );
        } else {
          setErrorBanner(
            'Unable to detect current location. Please search or click directly on the map.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000,
      }
    );
  }, [lookupAddressForCoords]);

  const handleLoadMapsGrounding = useCallback(async () => {
    setGroundingBusy(true);
    setGroundingError('');
    try {
      const result = await fetchMapsGroundingContext({
        lat: activeCoords.lat,
        lng: activeCoords.lng,
        neighbourhood,
        address: formattedAddress || address,
        category,
      });
      setGroundingResult(result);
    } catch (err) {
      setGroundingError(
        err instanceof Error
          ? err.message
          : 'Unable to fetch nearby landmarks via Google Maps Grounding right now.'
      );
    } finally {
      setGroundingBusy(false);
    }
  }, [activeCoords.lat, activeCoords.lng, neighbourhood, formattedAddress, address, category]);

  const sourceLabel: Record<LocationSource, string> = {
    ward_default: 'Ward Center (click map or search to pinpoint)',
    map_pin: 'Pinned on Google Map',
    places_autocomplete: 'Google Places Search',
    gps: 'Current Location (GPS)',
    geocoded: 'Geocoded Address',
  };

  return (
    <div className="space-y-3 rounded-xl border border-[#CFE3D5] bg-[#F6F8F7] p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[#1C2420] inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
            <span>Pin Exact Location on Google Maps</span>
          </p>
          <p className="text-xs text-[#526058]">
            Search a Bengaluru street or landmark, detect your current location, or click/drag the map pin.
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={gpsBusy || geocodingBusy}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#14532D] bg-white px-3 py-2 text-xs font-semibold text-[#14532D] transition-colors hover:bg-[#EDF5F0] disabled:opacity-60 whitespace-nowrap"
        >
          {gpsBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{gpsBusy ? 'Detecting Location...' : 'Use My Current Location'}</span>
        </button>
      </div>

      {/* Google Places Autocomplete Search Input */}
      <div className="relative">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#526058]"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setDropdownOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setDropdownOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleForwardGeocode(searchQuery);
                }
              }}
              placeholder="Search Bengaluru street, cross road, park, or landmark (Google Places)..."
              aria-label="Search Bengaluru street or landmark"
              className="w-full rounded-lg border border-[#E2E8E4] bg-white py-2 pl-9 pr-8 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  resetSession();
                  setDropdownOpen(false);
                }}
                aria-label="Clear search"
                className="absolute right-2.5 top-2.5 text-[#526058] hover:text-[#1C2420]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={geocodingBusy || searchQuery.trim().length < 2}
            onClick={() => void handleForwardGeocode(searchQuery)}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-50 whitespace-nowrap"
          >
            {geocodingBusy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>Locate</span>
          </button>
        </div>

        {/* Autocomplete Dropdown */}
        {dropdownOpen && (placesLoading || suggestions.length > 0) && (
          <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-lg border border-[#CFE3D5] bg-white shadow-lg">
            {placesLoading && suggestions.length === 0 ? (
              <div className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-[#526058]">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-[#14532D]" aria-hidden="true" />
                <span>Searching Bengaluru places...</span>
              </div>
            ) : (
              <ul role="listbox" aria-label="Google Places suggestions" className="divide-y divide-[#E2E8E4] max-h-56 overflow-y-auto">
                {suggestions.map((suggestion, idx) => {
                  const pred = suggestion.placePrediction;
                  if (!pred) return null;
                  const primary = pred.mainText?.text || pred.text.text;
                  const secondary = pred.secondaryText?.text || '';
                  return (
                    <li key={pred.placeId || idx}>
                      <button
                        type="button"
                        onClick={() => void handleSuggestionSelect(suggestion)}
                        className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-[#EDF5F0] transition-colors"
                      >
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#14532D]" aria-hidden="true" />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#1C2420] truncate">{primary}</p>
                          {secondary && (
                            <p className="text-[11px] text-[#526058] truncate">{secondary}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      {placesError && (
        <p className="text-xs text-[#92400E]" role="status">
          {placesError}
        </p>
      )}

      {/* Interactive Google Map Canvas */}
      <div className="relative h-[300px] sm:h-[340px] w-full overflow-hidden rounded-xl border border-[#E2E8E4] bg-[#EDF5F0]">
        <GoogleMap
          defaultCenter={activeCoords}
          defaultZoom={targetZoom}
          mapId="DEMO_MAP_ID"
          gestureHandling="greedy"
          streetViewControl={false}
          mapTypeControl={false}
          fullscreenControl={true}
          onClick={handleMapClick}
          internalUsageAttributionIds={GMP_ATTRIBUTION_IDS}
          className="h-full w-full"
        >
          <PickerViewportSync target={activeCoords} zoom={targetZoom} />

          <AdvancedMarker
            position={activeCoords}
            draggable={true}
            onDragEnd={handleMarkerDragEnd}
            title="Drag pin to exact problem location"
          >
            <div className="relative flex flex-col items-center cursor-grab active:cursor-grabbing">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-[#14532D] shadow-lg ring-4 ring-[#14532D]/25">
                <MapPin className="h-4 w-4 text-white" aria-hidden="true" />
              </div>
              <div className="mt-0.5 rounded bg-[#14532D] px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                Drag or tap map
              </div>
            </div>
          </AdvancedMarker>
        </GoogleMap>
      </div>

      {/* Coordinates & Formatted Address Strip */}
      <div className="rounded-lg border border-[#E2E8E4] bg-white p-3 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1C2420]">
            <Compass className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
            <span>Selected Coordinates:</span>
            <span className="font-mono text-[#14532D] tabular-nums">
              {activeCoords.lat.toFixed(5)}° N, {activeCoords.lng.toFixed(5)}° E
            </span>
          </span>
          <span className="rounded-md bg-[#EDF5F0] px-2 py-0.5 text-[11px] font-medium text-[#14532D]">
            {sourceLabel[locationSource]}
          </span>
        </div>

        {formattedAddress && (
          <p className="text-xs text-[#29322D]">
            <strong className="text-[#1C2420]">Google Maps Address:</strong> {formattedAddress}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[#E2E8E4]">
          {address.trim().length >= 3 ? (
            <button
              type="button"
              disabled={geocodingBusy}
              onClick={() => void handleForwardGeocode(`${address.trim()}, ${neighbourhood}`)}
              className="text-xs font-medium text-[#14532D] hover:underline disabled:opacity-50"
            >
              Sync map pin to typed address
            </button>
          ) : (
            <span className="text-[11px] text-[#526058]">
              Tip: Click anywhere on the map or drag the green pin to update coordinates &amp; address.
            </span>
          )}

          <button
            type="button"
            disabled={groundingBusy}
            onClick={() => void handleLoadMapsGrounding()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#CFE3D5] bg-[#EDF5F0] px-2.5 py-1 text-[11px] font-semibold text-[#14532D] hover:bg-[#DCEEE4] disabled:opacity-60"
          >
            {groundingBusy ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3 w-3" aria-hidden="true" />
            )}
            <span>
              {groundingBusy ? 'Checking Nearby Landmarks...' : 'Verify Nearby Landmarks'}
            </span>
          </button>
        </div>
      </div>

      {/* Status & Error Feedback */}
      {statusMessage && (
        <div className="flex items-center gap-2 text-xs text-[#14532D]" role="status">
          {(geocodingBusy || gpsBusy) && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" aria-hidden="true" />}
          <span>{statusMessage}</span>
        </div>
      )}

      {errorBanner && (
        <div
          className="flex items-start gap-2 rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3 py-2 text-xs text-[#991B1B]"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{errorBanner}</span>
        </div>
      )}

      {groundingError && (
        <div
          className="flex items-start gap-2 rounded-lg border border-[#FCD34D] bg-[#FFFBEB] px-3 py-2 text-xs text-[#92400E]"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
          <span>{groundingError}</span>
        </div>
      )}

      {/* Gemini 4 Hydrogen Google Maps Grounding Results (with mandatory clickable Maps links) */}
      {groundingResult && (
        <div className="rounded-lg border border-[#CFE3D5] bg-white p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Nearby Verified Landmarks &amp; Civic Context (Google Maps)</span>
            </span>
            <button
              type="button"
              onClick={() => setGroundingResult(null)}
              className="text-xs text-[#526058] hover:text-[#1C2420]"
              aria-label="Close nearby landmarks panel"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-[#29322D] whitespace-pre-line">
            {groundingResult.summary}
          </p>
          {groundingResult.places.length > 0 && (
            <div className="space-y-1.5 pt-1 border-t border-[#E2E8E4]">
              <p className="text-[11px] font-semibold text-[#526058]">
                Google Maps Sources:
              </p>
              <ul className="flex flex-wrap gap-1.5">
                {groundingResult.places.map((place) => (
                  <li key={place.uri}>
                    <a
                      href={place.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-[#CFE3D5] bg-[#EDF5F0] px-2.5 py-1 text-[11px] font-medium text-[#14532D] hover:bg-[#DCEEE4]"
                    >
                      <span>{place.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ReportLocationPicker: React.FC<ReportLocationPickerProps> = (props) => {
  const { apiKey, loading: keyLoading, configError, authFailed } = useGoogleMapsApiKey();
  const [mapLoadError, setMapLoadError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  if (keyLoading) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-[#CFE3D5] bg-[#F6F8F7] p-4 text-xs text-[#526058]">
        <Loader2 className="h-4 w-4 animate-spin text-[#14532D]" aria-hidden="true" />
        <span>Loading interactive Google Maps location picker...</span>
      </div>
    );
  }

  if (configError || !apiKey) {
    return (
      <div className="rounded-xl border border-[#E2E8E4] bg-[#F6F8F7] p-4 space-y-2">
        <div className="flex items-start gap-2.5 text-xs text-[#526058]">
          <AlertCircle className="h-4 w-4 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold text-[#1C2420]">Interactive Google Map Unavailable</p>
            <p className="mt-0.5">
              {configError ||
                'GOOGLE_MAPS_API_KEY is required for interactive map pin selection and Places search. You can still select your Bengaluru neighbourhood and enter the street or landmark manually below.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const effectiveError = authFailed
    ? 'Google Maps authentication failed. Please verify that GOOGLE_MAPS_API_KEY has Maps JavaScript API and Places API (New) enabled for this domain. You can still enter your address manually below.'
    : mapLoadError;

  return (
    <APIProvider
      key={`picker-gmap-${retryCount}`}
      apiKey={apiKey}
      libraries={PICKER_LIBRARIES}
      language="en"
      region="IN"
      onError={() =>
        setMapLoadError(
          'Google Maps failed to load. Please check your network connection or API key settings. You can still enter your address manually below.'
        )
      }
    >
      {effectiveError ? (
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-xs text-[#991B1B]"
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
            <p>{effectiveError}</p>
          </div>
          {!authFailed && (
            <button
              type="button"
              onClick={() => {
                setMapLoadError('');
                setRetryCount((c) => c + 1);
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-3 py-1.5 text-xs font-semibold text-[#991B1B] hover:bg-[#FEE2E2] whitespace-nowrap"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Retry</span>
            </button>
          )}
        </div>
      ) : (
        <InnerLocationPicker {...props} onMapError={setMapLoadError} />
      )}
    </APIProvider>
  );
};
