import React from 'react';
import { Play, X } from 'lucide-react';

export type ProblemIllustrationType =
  | 'roads'
  | 'drainage'
  | 'waste'
  | 'footpaths'
  | 'streetlights'
  | 'public-spaces';

export const ProblemIllustration: React.FC<{ type: ProblemIllustrationType }> = ({ type }) => {
  switch (type) {
    case 'roads':
      return (
        <svg
          viewBox="0 0 320 180"
          className="h-full w-full bg-[#F3F5F4]"
          role="img"
          aria-label="Illustration of an Indian urban road with a pothole needing repair"
        >
          <rect width="320" height="180" fill="#EDF5F0" />
          {/* Trees & compound wall */}
          <rect x="0" y="34" width="320" height="58" fill="#E2E8E4" />
          <circle cx="52" cy="40" r="28" fill="#BBF7D0" />
          <circle cx="145" cy="30" r="32" fill="#86EFAC" opacity="0.6" />
          <circle cx="272" cy="38" r="26" fill="#BBF7D0" />
          {/* Asphalt road */}
          <polygon points="0,92 320,92 320,180 0,180" fill="#374151" />
          <line x1="0" y1="92" x2="320" y2="92" stroke="#D1D5DB" strokeWidth="6" />
          {/* Road markings */}
          <line
            x1="20"
            y1="132"
            x2="300"
            y2="132"
            stroke="#F9FAFB"
            strokeWidth="3"
            strokeDasharray="18 14"
            opacity="0.7"
          />
          {/* Pothole */}
          <ellipse cx="158" cy="145" rx="34" ry="13" fill="#1F2937" stroke="#9CA3AF" strokeWidth="2" />
          <ellipse cx="156" cy="147" rx="22" ry="7" fill="#6B7280" opacity="0.55" />
          {/* Warning cone */}
          <polygon points="212,140 222,112 232,140" fill="#D97706" />
          <rect x="208" y="140" width="28" height="4" rx="1.5" fill="#92400E" />
          <line x1="217" y1="126" x2="227" y2="126" stroke="#FFFFFF" strokeWidth="3" />
        </svg>
      );

    case 'drainage':
      return (
        <svg
          viewBox="0 0 320 180"
          className="h-full w-full bg-[#F3F5F4]"
          role="img"
          aria-label="Illustration of a blocked neighbourhood stormwater drain grate"
        >
          <rect width="320" height="180" fill="#EDF5F0" />
          {/* Footpath & kerb */}
          <rect x="0" y="0" width="320" height="84" fill="#E5E7EB" />
          <rect x="0" y="80" width="320" height="14" fill="#D1D5DB" />
          {/* Road edge */}
          <rect x="0" y="94" width="320" height="86" fill="#4B5563" />
          {/* Stormwater drain grate */}
          <rect x="96" y="102" width="128" height="36" rx="3" fill="#1F2937" stroke="#9CA3AF" strokeWidth="2" />
          {[112, 130, 148, 166, 184, 202].map((x) => (
            <rect key={x} x={x} y="108" width="8" height="24" rx="1" fill="#111827" />
          ))}
          {/* Pooled water & leaves */}
          <ellipse cx="160" cy="138" rx="74" ry="18" fill="#93C5FD" opacity="0.45" />
          <ellipse cx="128" cy="120" rx="9" ry="4" fill="#92400E" transform="rotate(-15 128 120)" />
          <ellipse cx="178" cy="126" rx="10" ry="4" fill="#78350F" transform="rotate(20 178 126)" />
          <ellipse cx="152" cy="116" rx="8" ry="3.5" fill="#B45309" />
        </svg>
      );

    case 'waste':
      return (
        <svg
          viewBox="0 0 320 180"
          className="h-full w-full bg-[#F3F5F4]"
          role="img"
          aria-label="Illustration of uncollected neighbourhood waste beside dual community bins"
        >
          <rect width="320" height="180" fill="#EDF5F0" />
          <rect x="0" y="126" width="320" height="54" fill="#D1D5DB" />
          {/* Compound wall */}
          <rect x="0" y="54" width="320" height="72" fill="#F3F4F6" />
          <line x1="0" y1="54" x2="320" y2="54" stroke="#CBD5E1" strokeWidth="4" />
          {/* Green wet-waste bin */}
          <rect x="86" y="74" width="46" height="62" rx="4" fill="#166534" />
          <rect x="82" y="68" width="54" height="8" rx="2" fill="#14532D" />
          {/* Blue dry-waste bin */}
          <rect x="148" y="74" width="46" height="62" rx="4" fill="#1D4ED8" />
          <rect x="144" y="68" width="54" height="8" rx="2" fill="#1E40AF" />
          {/* Overflowing bags */}
          <circle cx="222" cy="122" r="16" fill="#4B5563" />
          <circle cx="242" cy="128" r="13" fill="#6B7280" />
          <path d="M214,108 L222,102 L230,108" stroke="#374151" strokeWidth="3" fill="none" />
        </svg>
      );

    case 'footpaths':
      return (
        <svg
          viewBox="0 0 320 180"
          className="h-full w-full bg-[#F3F5F4]"
          role="img"
          aria-label="Illustration of uneven concrete footpath slabs along a shaded street"
        >
          <rect width="320" height="180" fill="#EDF5F0" />
          {/* Tree canopy shadow */}
          <circle cx="72" cy="24" r="36" fill="#86EFAC" opacity="0.55" />
          <rect x="66" y="42" width="12" height="56" fill="#78350F" opacity="0.7" />
          {/* Footpath surface */}
          <polygon points="0,84 320,84 320,148 0,148" fill="#E5E7EB" />
          <rect x="0" y="148" width="320" height="32" fill="#4B5563" />
          {/* Slabs */}
          <rect x="20" y="92" width="66" height="44" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.5" />
          <rect x="92" y="92" width="66" height="44" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.5" />
          {/* Tilted / broken slab */}
          <polygon points="164,96 230,88 232,134 166,142" fill="#D1D5DB" stroke="#991B1B" strokeWidth="1.5" />
          <path d="M188,94 L198,115 L186,136" stroke="#6B7280" strokeWidth="2" fill="none" />
          <rect x="238" y="92" width="66" height="44" fill="#F3F4F6" stroke="#9CA3AF" strokeWidth="1.5" />
        </svg>
      );

    case 'streetlights':
      return (
        <svg
          viewBox="0 0 320 180"
          className="h-full w-full bg-[#1E293B]"
          role="img"
          aria-label="Illustration of a dim evening residential street with an unlit streetlamp"
        >
          <rect width="320" height="180" fill="#1E293B" />
          {/* Evening homes */}
          <rect x="20" y="68" width="76" height="66" fill="#334155" />
          <rect x="34" y="84" width="18" height="20" fill="#FDE68A" opacity="0.85" />
          <rect x="224" y="60" width="76" height="74" fill="#334155" />
          <rect x="242" y="82" width="18" height="20" fill="#FDE68A" opacity="0.85" />
          {/* Street surface */}
          <rect x="0" y="134" width="320" height="46" fill="#0F172A" />
          {/* Unlit Streetlamp Pole */}
          <rect x="155" y="34" width="8" height="104" fill="#64748B" />
          <path d="M159,36 Q178,28 194,38" stroke="#64748B" strokeWidth="5" fill="none" strokeLinecap="round" />
          <rect x="184" y="38" width="18" height="7" rx="3" fill="#475569" />
          {/* Subtle dark shadow pool */}
          <ellipse cx="188" cy="148" rx="46" ry="12" fill="#020617" opacity="0.65" />
        </svg>
      );

    case 'public-spaces':
      return (
        <svg
          viewBox="0 0 320 180"
          className="h-full w-full bg-[#F3F5F4]"
          role="img"
          aria-label="Illustration of a neighbourhood park bench and gate needing maintenance"
        >
          <rect width="320" height="180" fill="#EDF5F0" />
          {/* Park lawn */}
          <rect x="0" y="108" width="320" height="72" fill="#BBF7D0" />
          {/* Park foliage */}
          <circle cx="58" cy="64" r="38" fill="#86EFAC" />
          <circle cx="264" cy="68" r="34" fill="#86EFAC" />
          {/* Park path */}
          <polygon points="88,180 124,108 196,108 232,180" fill="#E5E7EB" />
          {/* Bench needing repair */}
          <rect x="112" y="96" width="96" height="9" rx="2" fill="#92400E" />
          <rect x="116" y="110" width="88" height="7" rx="2" fill="#78350F" transform="rotate(-3 160 113)" />
          <rect x="122" y="115" width="6" height="18" fill="#374151" />
          <rect x="192" y="115" width="6" height="18" fill="#374151" />
        </svg>
      );
  }
};

interface ExplainerModalProps {
  open: boolean;
  onClose: () => void;
  posterSrc: string;
  onTryReporting: () => void;
}

export const ExplainerVideoModal: React.FC<ExplainerModalProps> = ({
  open,
  onClose,
  posterSrc,
  onTryReporting,
}) => {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2420]/60 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="explainer-modal-title"
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#E2E8E4] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#E2E8E4] px-6 py-4">
          <div>
            <p className="text-xs font-semibold text-[#14532D]">
              NAMMAOORU Walkthrough Preview
            </p>
            <h2
              id="explainer-modal-title"
              className="font-display text-lg font-semibold text-[#1C2420]"
            >
              How Communities &amp; Departments Coordinate Action
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#526058] hover:bg-[#F6F8F7] hover:text-[#1C2420]"
            aria-label="Close video preview"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="relative overflow-hidden rounded-xl border border-[#E2E8E4] bg-[#0B2E19] aspect-video">
            <img
              src={posterSrc}
              alt="Bengaluru citizens and municipal engineer reviewing neighbourhood improvements"
              className="h-full w-full object-cover opacity-55"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-white">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 bg-[#14532D]/90">
                <Play className="h-6 w-6 translate-x-0.5" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-lg font-semibold">
                Explainer Video Slot Ready for Production Media
              </p>
              <p className="mt-1.5 max-w-md text-sm text-white/90">
                No live video file is bundled in this frontend prototype. Connect a recorded Bengaluru walkthrough MP4/WebM here in the next stage.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-sm">
            <div className="rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3.5">
              <p className="text-xs font-semibold text-[#14532D]">0:00 – 0:30 · Report</p>
              <p className="mt-1 text-xs text-[#29322D]">
                Citizen captures a photo, voice note, or text report in Kannada, English, or Hindi.
              </p>
            </div>
            <div className="rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3.5">
              <p className="text-xs font-semibold text-[#14532D]">0:30 – 1:10 · Route</p>
              <p className="mt-1 text-xs text-[#29322D]">
                Departments review ward queues while local NGOs see complementary community drives.
              </p>
            </div>
            <div className="rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3.5">
              <p className="text-xs font-semibold text-[#14532D]">1:10 – 1:45 · Verify</p>
              <p className="mt-1 text-xs text-[#29322D]">
                Before-and-after street evidence is shared so residents confirm or reopen outcomes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E2E8E4] bg-[#F6F8F7] px-6 py-3.5">
          <span className="text-xs text-[#526058]">
            You can test every step interactively across the four role views.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#E2E8E4] bg-white px-4 py-2 text-xs font-medium text-[#1C2420] hover:bg-[#F3F5F4]"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onTryReporting();
              }}
              className="rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534]"
            >
              Try Citizen Reporting
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
