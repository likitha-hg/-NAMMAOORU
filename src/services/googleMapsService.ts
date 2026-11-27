import { GeocodeLocationResult, MapsGroundingResult } from '../types/civic';
import { getOptionalFirebaseIdToken } from './geminiCivicService';

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const idToken = await getOptionalFirebaseIdToken();
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }
  return headers;
}

/**
 * Convert latitude/longitude coordinates into a formatted street address via server-side Google Geocoding API proxy.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number
): Promise<GeocodeLocationResult> {
  const headers = await buildAuthHeaders();
  const response = await fetch('/api/maps/reverse-geocode', {
    method: 'POST',
    headers,
    body: JSON.stringify({ lat, lng }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<GeocodeLocationResult>;

  if (!response.ok) {
    throw new Error(
      data.error || `Address lookup failed with status ${response.status}. You can edit the address manually.`
    );
  }

  return data as GeocodeLocationResult;
}

/**
 * Convert a street address or landmark into Bengaluru coordinates and formatted address via server-side Google Geocoding API proxy.
 */
export async function geocodeBengaluruAddress(address: string): Promise<GeocodeLocationResult> {
  const headers = await buildAuthHeaders();
  const response = await fetch('/api/maps/geocode', {
    method: 'POST',
    headers,
    body: JSON.stringify({ address }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<GeocodeLocationResult>;

  if (!response.ok) {
    throw new Error(
      data.error || `Could not locate that address (status ${response.status}). Try dropping a pin on the map.`
    );
  }

  return data as GeocodeLocationResult;
}

/**
 * Retrieve up-to-date nearby Bengaluru landmarks and civic offices grounded in Google Maps via gemini-4-hydrogen.
 */
export async function fetchMapsGroundingContext(params: {
  lat?: number;
  lng?: number;
  neighbourhood?: string;
  address?: string;
  category?: string;
  query?: string;
}): Promise<MapsGroundingResult> {
  const headers = await buildAuthHeaders();
  const response = await fetch('/api/gemini/maps-grounding', {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & Partial<MapsGroundingResult>;

  if (!response.ok) {
    throw new Error(
      data.error || `Google Maps context request failed with status ${response.status}.`
    );
  }

  return data as MapsGroundingResult;
}
