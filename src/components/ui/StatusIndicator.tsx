import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  FileCheck2,
  FolderCheck,
  Inbox,
  Wrench,
} from 'lucide-react';
import { NgoActivityStatus, ReportPriority, ReportStatus } from '../../types/civic';

interface StatusIndicatorProps {
  status: ReportStatus;
  compact?: boolean;
}

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({ status, compact = false }) => {
  const config: Record<
    ReportStatus,
    { icon: React.ReactNode; textClass: string; bgClass: string }
  > = {
    [ReportStatus.SUBMITTED]: {
      icon: <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#374151]',
      bgClass: 'bg-[#F3F4F6]',
    },
    [ReportStatus.UNDER_REVIEW]: {
      icon: <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#1E40AF]',
      bgClass: 'bg-[#EFF6FF]',
    },
    [ReportStatus.ASSIGNED]: {
      icon: <FolderCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#0F766E]',
      bgClass: 'bg-[#F0FDFA]',
    },
    [ReportStatus.IN_PROGRESS]: {
      icon: <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#92400E]',
      bgClass: 'bg-[#FFFBEB]',
    },
    [ReportStatus.RESOLUTION_REPORTED]: {
      icon: <FileCheck2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#166534]',
      bgClass: 'bg-[#EDF5F0]',
    },
    [ReportStatus.AWAITING_VERIFICATION]: {
      icon: <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#9A3412]',
      bgClass: 'bg-[#FFF7ED]',
    },
    [ReportStatus.CITIZEN_VERIFIED]: {
      icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#14532D]',
      bgClass: 'bg-[#DCFCE7]',
    },
    [ReportStatus.DISPUTED_REOPENED]: {
      icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
      textClass: 'text-[#991B1B]',
      bgClass: 'bg-[#FEF2F2]',
    },
  };

  const current = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      } ${current.bgClass} ${current.textClass}`}
    >
      {current.icon}
      <span>{status}</span>
    </span>
  );
};

export const PriorityText: React.FC<{ priority: ReportPriority }> = ({ priority }) => {
  const colorMap: Record<ReportPriority, string> = {
    [ReportPriority.LOW]: 'text-[#526058]',
    [ReportPriority.MEDIUM]: 'text-[#1C2420]',
    [ReportPriority.HIGH]: 'text-[#9A3412] font-semibold',
    [ReportPriority.URGENT]: 'text-[#991B1B] font-semibold',
  };

  return (
    <span className={`text-xs whitespace-nowrap ${colorMap[priority]}`}>
      {priority} priority
    </span>
  );
};

export const NgoStatusLabel: React.FC<{ status: NgoActivityStatus }> = ({ status }) => {
  const map: Record<NgoActivityStatus, { classes: string; icon: React.ReactNode }> = {
    [NgoActivityStatus.AVAILABLE]: {
      classes: 'bg-[#EDF5F0] text-[#14532D]',
      icon: <Inbox className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    },
    [NgoActivityStatus.ACCEPTED]: {
      classes: 'bg-[#EFF6FF] text-[#1E40AF]',
      icon: <FolderCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    },
    [NgoActivityStatus.ONGOING]: {
      classes: 'bg-[#FFFBEB] text-[#92400E]',
      icon: <Wrench className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    },
    [NgoActivityStatus.COMPLETED]: {
      classes: 'bg-[#DCFCE7] text-[#14532D]',
      icon: <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    },
    [NgoActivityStatus.DECLINED]: {
      classes: 'bg-[#F3F4F6] text-[#526058]',
      icon: <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />,
    },
  };

  const current = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 ${current.classes}`}
    >
      {current.icon}
      <span>{status}</span>
    </span>
  );
};
