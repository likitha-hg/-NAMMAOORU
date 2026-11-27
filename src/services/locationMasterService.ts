import { CivicReport } from '../types/civic';
import {
  BengaluruLocality,
  BengaluruLocationDataset,
  NewLocalityInput,
  ResolvedLocationHierarchy,
} from '../types/locations';
import { getOptionalFirebaseIdToken } from './geminiCivicService';

type DatasetListener = (dataset: BengaluruLocationDataset) => void;

let cachedDataset: BengaluruLocationDataset | null = null;
let inflightRequest: Promise<BengaluruLocationDataset> | null = null;
const listeners = new Set<DatasetListener>();

function notifyListeners(dataset: BengaluruLocationDataset): void {
  listeners.forEach((fn) => {
    try {
      fn(dataset);
    } catch {
      // Ignore subscriber errors
    }
  });
}

export function subscribeBengaluruLocations(listener: DatasetListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getCachedBengaluruLocations(): BengaluruLocationDataset | null {
  return cachedDataset;
}

export async function fetchBengaluruLocations(
  forceRefresh = false
): Promise<BengaluruLocationDataset> {
  if (cachedDataset && !forceRefresh) {
    return cachedDataset;
  }
  if (!inflightRequest || forceRefresh) {
    inflightRequest = fetch('/api/locations/bengaluru', {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })
      .then(async (resp) => {
        if (!resp.ok) {
          throw new Error(`Failed to load Bengaluru locations (status ${resp.status}).`);
        }
        const data = (await resp.json()) as BengaluruLocationDataset;
        cachedDataset = data;
        notifyListeners(data);
        return data;
      })
      .finally(() => {
        inflightRequest = null;
      });
  }
  return inflightRequest;
}

export async function addBengaluruLocality(
  input: NewLocalityInput
): Promise<{ locality: BengaluruLocality; dataset: BengaluruLocationDataset }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const idToken = await getOptionalFirebaseIdToken();
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const resp = await fetch('/api/locations/bengaluru/localities', {
    method: 'POST',
    headers,
    body: JSON.stringify(input),
  });

  const payload = (await resp.json().catch(() => ({}))) as {
    error?: string;
    locality?: BengaluruLocality;
    dataset?: BengaluruLocationDataset;
  };

  if (!resp.ok || !payload.locality || !payload.dataset) {
    throw new Error(
      payload.error || `Unable to add locality (status ${resp.status}).`
    );
  }

  cachedDataset = payload.dataset;
  notifyListeners(payload.dataset);

  return {
    locality: payload.locality,
    dataset: payload.dataset,
  };
}

function squaredDistance(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

/**
 * Resolves any CivicReport to its City -> Zone -> Ward -> Locality hierarchy
 * using locality name, aliases, address text, or nearest stored coordinates.
 */
export function resolveReportHierarchy(
  report: CivicReport,
  dataset: BengaluruLocationDataset
): ResolvedLocationHierarchy | null {
  if (!dataset.localities.length) return null;

  const zoneMap = new Map(dataset.zones.map((z) => [z.id, z]));
  const wardMap = new Map(dataset.wards.map((w) => [w.id, w]));

  const buildResolved = (loc: BengaluruLocality): ResolvedLocationHierarchy | null => {
    const ward = wardMap.get(loc.wardId);
    const zone = zoneMap.get(loc.zoneId);
    if (!ward || !zone) return null;
    return {
      cityId: dataset.city.id,
      cityName: dataset.city.name,
      zoneId: zone.id,
      zoneName: zone.name,
      wardId: ward.id,
      wardName: ward.name,
      wardNumber: ward.wardNumber,
      localityId: loc.id,
      localityName: loc.name,
      center: loc.center,
    };
  };

  const normNeighbourhood = (report.neighbourhood || '').trim().toLowerCase();
  if (normNeighbourhood) {
    // 1. Exact locality name match
    const exact = dataset.localities.find(
      (l) => l.name.toLowerCase() === normNeighbourhood
    );
    if (exact) return buildResolved(exact);

    // 2. Exact alias match
    const aliasExact = dataset.localities.find((l) =>
      (l.aliases ?? []).some((a) => a.toLowerCase() === normNeighbourhood)
    );
    if (aliasExact) return buildResolved(aliasExact);
  }

  // 3. Substring match across neighbourhood + formattedAddress + address
  const combinedText = `${report.neighbourhood || ''} ${report.formattedAddress || ''} ${
    report.address || ''
  }`.toLowerCase();

  let bestLoc: BengaluruLocality | null = null;
  let bestLen = 0;
  for (const loc of dataset.localities) {
    const terms = [loc.name, ...(loc.aliases ?? [])];
    for (const term of terms) {
      const clean = term.trim().toLowerCase();
      if (clean.length > bestLen && combinedText.includes(clean)) {
        bestLoc = loc;
        bestLen = clean.length;
      }
    }
  }
  if (bestLoc) return buildResolved(bestLoc);

  // 4. Nearest locality by stored lat/lng coordinates
  if (
    typeof report.lat === 'number' &&
    typeof report.lng === 'number' &&
    Number.isFinite(report.lat) &&
    Number.isFinite(report.lng)
  ) {
    let nearest = dataset.localities[0];
    let minDist = squaredDistance({ lat: report.lat, lng: report.lng }, nearest.center);
    for (let i = 1; i < dataset.localities.length; i += 1) {
      const dist = squaredDistance(
        { lat: report.lat, lng: report.lng },
        dataset.localities[i].center
      );
      if (dist < minDist) {
        minDist = dist;
        nearest = dataset.localities[i];
      }
    }
    return buildResolved(nearest);
  }

  return null;
}

export function findLocalityCoordinates(
  localityName: string,
  dataset: BengaluruLocationDataset | null
): { lat: number; lng: number } | null {
  if (!dataset || !localityName) return null;
  const norm = localityName.trim().toLowerCase();
  const match = dataset.localities.find(
    (l) =>
      l.name.toLowerCase() === norm ||
      (l.aliases ?? []).some((a) => a.toLowerCase() === norm)
  );
  return match ? match.center : null;
}
