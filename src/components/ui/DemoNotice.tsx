import React from 'react';
import { Info } from 'lucide-react';

interface DemoNoticeProps {
  title?: string;
  description: string;
  tone?: 'soft-green' | 'neutral';
}

export const DemoNotice: React.FC<DemoNoticeProps> = ({
  title = 'Sample Demonstration Data',
  description,
  tone = 'soft-green',
}) => {
  const containerClasses =
    tone === 'soft-green'
      ? 'bg-[#EDF5F0] border-[#CFE3D5] text-[#14532D]'
      : 'bg-[#F6F8F7] border-[#E2E8E4] text-[#29322D]';

  return (
    <div
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${containerClasses}`}
      role="note"
    >
      <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
      <div>
        <span className="font-semibold">{title}: </span>
        <span className="text-[#29322D]">{description}</span>
      </div>
    </div>
  );
};
