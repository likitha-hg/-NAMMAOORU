import React from 'react';
import { FolderOpen } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[#E2E8E4] bg-[#F6F8F7] px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg border border-[#E2E8E4] bg-white text-[#526058]">
        <FolderOpen className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-[#1C2420]">{title}</h3>
      <p className="mt-1.5 max-w-md text-sm text-[#526058]">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center justify-center rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#166534] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] whitespace-nowrap"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
