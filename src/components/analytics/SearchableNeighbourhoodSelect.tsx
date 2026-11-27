import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, MapPin, Search, X } from 'lucide-react';
import {
  BengaluruLocality,
  BengaluruWard,
  BengaluruZone,
} from '../../types/locations';

interface SearchableNeighbourhoodSelectProps {
  localities: BengaluruLocality[];
  zones: BengaluruZone[];
  wards: BengaluruWard[];
  selectedLocalityId: string;
  activeZoneId?: string;
  activeWardId?: string;
  incidentCountsByLocalityId?: Record<string, { total: number; verified: number; sample: number }>;
  onSelectLocality: (locality: BengaluruLocality | null) => void;
  placeholder?: string;
  label?: string;
  id?: string;
}

export const SearchableNeighbourhoodSelect: React.FC<SearchableNeighbourhoodSelectProps> = ({
  localities,
  zones,
  wards,
  selectedLocalityId,
  activeZoneId = 'ALL',
  activeWardId = 'ALL',
  incidentCountsByLocalityId = {},
  onSelectLocality,
  placeholder = 'Search any Bengaluru neighbourhood, ward, zone, or pincode...',
  label = 'Neighbourhood / Locality',
  id = 'searchable-neighbourhood-select',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const zoneMap = useMemo(() => new Map(zones.map((z) => [z.id, z])), [zones]);
  const wardMap = useMemo(() => new Map(wards.map((w) => [w.id, w])), [wards]);

  const selectedLocality = useMemo(
    () => localities.find((l) => l.id === selectedLocalityId) ?? null,
    [localities, selectedLocalityId]
  );

  // Close on click outside or Escape
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  // Filter localities: when typing a search query, search across ALL Bengaluru localities;
  // when empty, scope to selected Zone/Ward if any so browsing feels focused.
  const filteredLocalities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base =
      q.length > 0
        ? localities
        : localities.filter((loc) => {
            if (activeWardId !== 'ALL' && loc.wardId !== activeWardId) return false;
            if (activeZoneId !== 'ALL' && loc.zoneId !== activeZoneId) return false;
            return true;
          });

    if (!q) {
      return [...base].sort((a, b) => a.name.localeCompare(b.name));
    }

    return base
      .filter((loc) => {
        const zone = zoneMap.get(loc.zoneId);
        const ward = wardMap.get(loc.wardId);
        const haystack = [
          loc.name,
          loc.pincode ?? '',
          ...(loc.aliases ?? []),
          ward?.name ?? '',
          ward ? `ward ${ward.wardNumber}` : '',
          zone?.name ?? '',
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      })
      .sort((a, b) => {
        const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
        const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;
        return a.name.localeCompare(b.name);
      });
  }, [localities, query, activeZoneId, activeWardId, zoneMap, wardMap]);

  const handleOpen = () => {
    setOpen(true);
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const selectedWard = selectedLocality ? wardMap.get(selectedLocality.wardId) : null;
  const selectedZone = selectedLocality ? zoneMap.get(selectedLocality.zoneId) : null;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-[#526058]">
          {label}
        </label>
      )}

      <div className="relative mt-1">
        <button
          id={id}
          type="button"
          onClick={() => (open ? setOpen(false) : handleOpen())}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-left text-sm text-[#1C2420] transition-colors hover:border-[#14532D] focus:border-[#14532D] focus:outline-none"
        >
          <span className="flex min-w-0 items-center gap-2">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[#14532D]" aria-hidden="true" />
            <span className="truncate">
              {selectedLocality
                ? `${selectedLocality.name}${selectedWard ? ` · W${selectedWard.wardNumber}` : ''}`
                : activeWardId !== 'ALL'
                  ? `All Localities in Ward (${filteredLocalities.length})`
                  : activeZoneId !== 'ALL'
                    ? `All Localities in Zone (${filteredLocalities.length})`
                    : `All Bengaluru Localities (${localities.length})`}
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {selectedLocality && (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear selected neighbourhood"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectLocality(null);
                  setQuery('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectLocality(null);
                    setQuery('');
                  }
                }}
                className="rounded p-0.5 text-[#526058] hover:bg-[#EDF5F0] hover:text-[#14532D]"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown
              className={`h-4 w-4 text-[#526058] transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </span>
        </button>

        {selectedLocality && selectedZone && (
          <p className="mt-1 text-[11px] text-[#526058] truncate">
            {selectedZone.name} · Ward {selectedWard?.wardNumber} ({selectedWard?.name})
            {selectedLocality.pincode ? ` · ${selectedLocality.pincode}` : ''}
          </p>
        )}

        {open && (
          <div className="absolute left-0 right-0 z-40 mt-1.5 overflow-hidden rounded-xl border border-[#CFE3D5] bg-white shadow-xl">
            <div className="border-b border-[#E2E8E4] bg-[#F6F8F7] p-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#526058]"
                  aria-hidden="true"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholder}
                  aria-label="Search Bengaluru neighbourhood or locality"
                  className="w-full rounded-lg border border-[#E2E8E4] bg-white py-1.5 pl-8 pr-7 text-xs text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Clear search query"
                    className="absolute right-2 top-2 text-[#526058] hover:text-[#1C2420]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 px-1 text-[10px] text-[#526058]">
                {query.trim()
                  ? `Searching all ${localities.length} Bengaluru localities (${filteredLocalities.length} matches)`
                  : `Showing ${filteredLocalities.length} localities · Type to search city-wide`}
              </p>
            </div>

            <ul
              role="listbox"
              aria-label="Bengaluru neighbourhoods"
              className="max-h-64 overflow-y-auto divide-y divide-[#E2E8E4]"
            >
              <li>
                <button
                  type="button"
                  onClick={() => {
                    onSelectLocality(null);
                    setOpen(false);
                    setQuery('');
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs transition-colors ${
                    !selectedLocality
                      ? 'bg-[#EDF5F0] font-semibold text-[#14532D]'
                      : 'text-[#1C2420] hover:bg-[#F6F8F7]'
                  }`}
                >
                  <span>All Localities (Reset neighbourhood)</span>
                  <span className="font-mono text-[11px] text-[#526058] tabular-nums">
                    {localities.length}
                  </span>
                </button>
              </li>

              {filteredLocalities.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-[#526058]">
                  No Bengaluru locality matched &ldquo;{query}&rdquo;. Try a ward name, zone, or pincode.
                </li>
              ) : (
                filteredLocalities.map((loc) => {
                  const ward = wardMap.get(loc.wardId);
                  const zone = zoneMap.get(loc.zoneId);
                  const stats = incidentCountsByLocalityId[loc.id];
                  const isSelected = loc.id === selectedLocalityId;

                  return (
                    <li key={loc.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectLocality(loc);
                          setOpen(false);
                          setQuery('');
                        }}
                        className={`flex w-full items-start justify-between gap-2 px-3 py-2 text-left transition-colors ${
                          isSelected
                            ? 'bg-[#EDF5F0] text-[#14532D]'
                            : 'text-[#1C2420] hover:bg-[#F6F8F7]'
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">
                            {loc.name}
                            {loc.isCustomAdded && (
                              <span className="ml-1.5 rounded bg-[#EDF5F0] px-1 py-0.5 text-[10px] font-medium text-[#14532D]">
                                Added
                              </span>
                            )}
                          </p>
                          <p className="text-[11px] text-[#526058] truncate">
                            {zone?.name ?? 'Bengaluru'} · Ward {ward?.wardNumber ?? '—'} (
                            {ward?.name ?? 'BBMP'})
                            {loc.pincode ? ` · ${loc.pincode}` : ''}
                          </p>
                        </div>
                        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#526058]">
                          {stats && stats.total > 0 ? (
                            <span className="rounded bg-[#EDF5F0] px-1.5 py-0.5 font-semibold text-[#14532D]">
                              {stats.total}
                            </span>
                          ) : (
                            '0'
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
