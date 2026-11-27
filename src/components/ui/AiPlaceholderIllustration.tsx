import React from 'react';
import { Sparkles } from 'lucide-react';

export const AiPlaceholderIllustration: React.FC = () => {
  return (
    <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
        <div className="shrink-0 rounded-lg border border-[#CFE3D5] bg-white p-3">
          <svg
            width="112"
            height="84"
            viewBox="0 0 112 84"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Illustration of future AI-assisted civic report routing"
          >
            <rect x="4" y="6" width="44" height="32" rx="6" fill="#EDF5F0" stroke="#166534" strokeWidth="1.5" />
            <path d="M12 28L21 19L28 26L34 21L41 28" stroke="#14532D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="17" cy="15" r="2.5" fill="#166534" />

            <rect x="4" y="46" width="44" height="32" rx="6" fill="#F6F8F7" stroke="#526058" strokeWidth="1.5" />
            <path d="M14 62H38M14 55H32M14 69H26" stroke="#1C2420" strokeWidth="1.5" strokeLinecap="round" />

            <path d="M52 24H64M52 60H64M64 24V60M64 42H74" stroke="#166534" strokeWidth="1.5" strokeLinecap="round" />
            <circle cx="74" cy="42" r="3" fill="#14532D" />

            <rect x="78" y="16" width="30" height="52" rx="6" fill="#FFFFFF" stroke="#14532D" strokeWidth="1.5" />
            <rect x="83" y="23" width="20" height="5" rx="2" fill="#14532D" />
            <rect x="83" y="34" width="16" height="4" rx="2" fill="#86EFAC" />
            <rect x="83" y="43" width="20" height="4" rx="2" fill="#E2E8E4" />
            <rect x="83" y="52" width="14" height="4" rx="2" fill="#E2E8E4" />
          </svg>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#14532D]">
            <Sparkles className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>AI-Assisted Report Understanding (Future Development Stage)</span>
          </div>
          <p className="text-sm text-[#29322D] leading-relaxed">
            In a later stage, NAMMAOORU will assist citizens by turning uploaded photos, voice recordings, and Kannada, English, or Hindi descriptions into clear problem summaries and suggested department routing.
          </p>
          <p className="text-xs text-[#526058]">
            Prototype notice: Voice recognition, automatic translation, and image analysis are not active in this frontend demonstration.
          </p>
        </div>
      </div>
    </div>
  );
};
