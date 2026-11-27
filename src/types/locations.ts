export interface BengaluruCityMeta {
  id: string;
  name: string;
  state: string;
  authority: string;
  center: { lat: number; lng: number };
  datasetVersion: string;
}

export interface BengaluruZone {
  id: string;
  cityId: string;
  name: string;
  code: string;
  center: { lat: number; lng: number };
  defaultZoom: number;
}

export interface BengaluruWard {
  id: string;
  cityId: string;
  zoneId: string;
  wardNumber: number;
  name: string;
  center: { lat: number; lng: number };
  defaultZoom: number;
}

export interface BengaluruLocality {
  id: string;
  cityId: string;
  zoneId: string;
  wardId: string;
  name: string;
  pincode?: string;
  aliases?: string[];
  center: { lat: number; lng: number };
  isCustomAdded?: boolean;
}

export interface BengaluruLocationDataset {
  city: BengaluruCityMeta;
  zones: BengaluruZone[];
  wards: BengaluruWard[];
  localities: BengaluruLocality[];
}

export interface ResolvedLocationHierarchy {
  cityId: string;
  cityName: string;
  zoneId: string;
  zoneName: string;
  wardId: string;
  wardName: string;
  wardNumber: number;
  localityId: string;
  localityName: string;
  center: { lat: number; lng: number };
}

export interface NewLocalityInput {
  name: string;
  zoneId: string;
  wardId: string;
  pincode?: string;
  lat: number;
  lng: number;
  aliases?: string[];
}
