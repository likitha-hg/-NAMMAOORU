import React from 'react';
import {
  Construction,
  Droplets,
  Footprints,
  Lightbulb,
  MapPin,
  Trash2,
  Trees,
} from 'lucide-react';
import { ReportStatus } from '../../types/civic';

export interface CategoryMapStyle {
  name: string;
  shortLabel: string;
  bg: string;
  softBg: string;
  text: string;
  renderIcon: (className?: string) => React.ReactNode;
}

export const CATEGORY_MAP_STYLES: CategoryMapStyle[] = [
  {
    name: 'Roads & Potholes',
    shortLabel: 'Roads',
    bg: '#B45309',
    softBg: '#FEF3C7',
    text: '#92400E',
    renderIcon: (cls = 'h-3.5 w-3.5 text-white') =>
      React.createElement(Construction, { className: cls, 'aria-hidden': true }),
  },
  {
    name: 'Waste & Sanitation',
    shortLabel: 'Waste',
    bg: '#15803D',
    softBg: '#DCFCE7',
    text: '#14532D',
    renderIcon: (cls = 'h-3.5 w-3.5 text-white') =>
      React.createElement(Trash2, { className: cls, 'aria-hidden': true }),
  },
  {
    name: 'Streetlights & Power',
    shortLabel: 'Streetlights',
    bg: '#D97706',
    softBg: '#FEF9C3',
    text: '#854D0E',
    renderIcon: (cls = 'h-3.5 w-3.5 text-white') =>
      React.createElement(Lightbulb, { className: cls, 'aria-hidden': true }),
  },
  {
    name: 'Water & Drainage',
    shortLabel: 'Water',
    bg: '#0369A1',
    softBg: '#E0F2FE',
    text: '#075985',
    renderIcon: (cls = 'h-3.5 w-3.5 text-white') =>
      React.createElement(Droplets, { className: cls, 'aria-hidden': true }),
  },
  {
    name: 'Parks & Trees',
    shortLabel: 'Parks',
    bg: '#14532D',
    softBg: '#EDF5F0',
    text: '#14532D',
    renderIcon: (cls = 'h-3.5 w-3.5 text-white') =>
      React.createElement(Trees, { className: cls, 'aria-hidden': true }),
  },
  {
    name: 'Footpaths & Safety',
    shortLabel: 'Footpaths',
    bg: '#B91C1C',
    softBg: '#FEE2E2',
    text: '#991B1B',
    renderIcon: (cls = 'h-3.5 w-3.5 text-white') =>
      React.createElement(Footprints, { className: cls, 'aria-hidden': true }),
  },
];

const FALLBACK_CATEGORY_STYLE: CategoryMapStyle = {
  name: 'Civic Issue',
  shortLabel: 'Other',
  bg: '#334155',
  softBg: '#F1F5F9',
  text: '#1E293B',
  renderIcon: (cls = 'h-3.5 w-3.5 text-white') =>
    React.createElement(MapPin, { className: cls, 'aria-hidden': true }),
};

export function getCategoryMapStyle(categoryName: string): CategoryMapStyle {
  const exact = CATEGORY_MAP_STYLES.find(
    (c) => c.name.toLowerCase() === categoryName.trim().toLowerCase()
  );
  if (exact) return exact;
  const lower = categoryName.toLowerCase();
  if (lower.includes('road') || lower.includes('pothole')) return CATEGORY_MAP_STYLES[0];
  if (lower.includes('waste') || lower.includes('garbage') || lower.includes('sanitation')) {
    return CATEGORY_MAP_STYLES[1];
  }
  if (lower.includes('light') || lower.includes('power') || lower.includes('bescom')) {
    return CATEGORY_MAP_STYLES[2];
  }
  if (lower.includes('water') || lower.includes('drain') || lower.includes('sewage')) {
    return CATEGORY_MAP_STYLES[3];
  }
  if (lower.includes('park') || lower.includes('tree')) return CATEGORY_MAP_STYLES[4];
  if (lower.includes('footpath') || lower.includes('safety') || lower.includes('traffic')) {
    return CATEGORY_MAP_STYLES[5];
  }
  return FALLBACK_CATEGORY_STYLE;
}

export function getStatusBadgeDotColor(status: ReportStatus): string {
  switch (status) {
    case ReportStatus.CITIZEN_VERIFIED:
      return '#16A34A';
    case ReportStatus.AWAITING_VERIFICATION:
    case ReportStatus.RESOLUTION_REPORTED:
      return '#EA580C';
    case ReportStatus.DISPUTED_REOPENED:
      return '#DC2626';
    case ReportStatus.IN_PROGRESS:
    case ReportStatus.ASSIGNED:
      return '#D97706';
    default:
      return '#2563EB';
  }
}
