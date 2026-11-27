import React, { useState } from 'react';
import {
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  FileText,
  MapPin,
  Mic,
  RotateCcw,
  Sparkles,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCivic } from '../../context/CivicContext';
import { ReportMethod, ReportStatus, UserRole } from '../../types/civic';
import { PriorityText, StatusIndicator } from './StatusIndicator';

const DEPARTMENT_ALLOWED_STATUSES: ReportStatus[] = [
  ReportStatus.SUBMITTED,
  ReportStatus.UNDER_REVIEW,
  ReportStatus.ASSIGNED,
  ReportStatus.IN_PROGRESS,
  ReportStatus.RESOLUTION_REPORTED,
  ReportStatus.AWAITING_VERIFICATION,
];

export const ReportDetailModal: React.FC = () => {
  const { firebaseUser } = useAuth();
  const {
    allMapReports,
    selectedReportId,
    closeReportDetail,
    activeRole,
    updateReportStatus,
    verifyOrDisputeReport,
  } = useCivic();

  const report = allMapReports.find((r) => r.id === selectedReportId);
  const [nextStatus, setNextStatus] = useState<ReportStatus | ''>('');
  const [statusNote, setStatusNote] = useState('');
  const [verifyNote, setVerifyNote] = useState('');

  if (!report) return null;

  const effectiveStatus =
    nextStatus ||
    (DEPARTMENT_ALLOWED_STATUSES.includes(report.status)
      ? report.status
      : ReportStatus.IN_PROGRESS);

  const handleDepartmentSave = (e: React.FormEvent) => {
    e.preventDefault();
    void updateReportStatus(
      report.id,
      effectiveStatus,
      statusNote || `Department updated status to ${effectiveStatus}.`
    );
    setStatusNote('');
    setNextStatus('');
  };

  const isOwnReport =
    !report.isSampleDemo &&
    (report.isUserSubmitted || (Boolean(firebaseUser?.uid) && report.reporterUid === firebaseUser?.uid));

  const canCitizenVerify =
    activeRole === UserRole.CITIZEN &&
    (isOwnReport || Boolean(report.isSampleDemo && report.isUserSubmitted)) &&
    (report.status === ReportStatus.AWAITING_VERIFICATION ||
      report.status === ReportStatus.RESOLUTION_REPORTED);

  const methodIcon =
    report.method === ReportMethod.PHOTOGRAPH ? (
      <Camera className="h-4 w-4 text-[#526058]" aria-hidden="true" />
    ) : report.method === ReportMethod.VOICE ? (
      <Mic className="h-4 w-4 text-[#526058]" aria-hidden="true" />
    ) : (
      <FileText className="h-4 w-4 text-[#526058]" aria-hidden="true" />
    );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C2420]/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-detail-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-[#E2E8E4] bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[#E2E8E4] px-6 py-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#526058]">
              <span className="font-mono tabular-nums font-medium text-[#1C2420]">{report.id}</span>
              <span aria-hidden="true">·</span>
              <span>{report.category}</span>
              <span aria-hidden="true">·</span>
              <span>{report.neighbourhood}</span>
              <span aria-hidden="true">·</span>
              <span
                className={`font-semibold ${
                  report.isSampleDemo ? 'text-[#526058]' : 'text-[#14532D]'
                }`}
              >
                {report.isSampleDemo ? 'Bengaluru Demonstration Sample' : 'Your Submitted Report'}
              </span>
            </div>
            <h2
              id="report-detail-title"
              className="text-lg font-semibold text-[#1C2420] leading-snug"
            >
              {report.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={closeReportDetail}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#526058] transition-colors hover:bg-[#F6F8F7] hover:text-[#1C2420] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
            aria-label="Close report details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Current Status Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] px-4 py-3">
            <div className="flex flex-wrap items-center gap-3">
              <StatusIndicator status={report.status} />
              <PriorityText priority={report.priority} />
            </div>
            <div className="flex items-center gap-2 text-xs text-[#526058]">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="tabular-nums">Submitted {report.dateSubmitted}</span>
            </div>
          </div>

          {/* Citizen Description & Metadata */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-[#1C2420]">Citizen Description</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#29322D]">
                  {report.description}
                </p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-[#1C2420]">Evidence &amp; Submission</h3>
                {report.evidenceImageUrl ? (
                  <div className="mt-2 overflow-hidden rounded-lg border border-[#E2E8E4]">
                    <img
                      src={report.evidenceImageUrl}
                      alt={`Uploaded civic evidence for ${report.title}`}
                      className="max-h-56 w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <p className="border-t border-[#E2E8E4] bg-[#F6F8F7] px-3 py-2 text-xs text-[#526058]">
                      {report.evidenceSummary}
                    </p>
                  </div>
                ) : (
                  <div className="mt-2 flex items-start gap-3 rounded-lg border border-dashed border-[#CBD5CF] bg-[#F6F8F7] p-3.5 text-sm text-[#29322D]">
                    <div className="mt-0.5">{methodIcon}</div>
                    <div>
                      <p className="font-medium text-[#1C2420]">
                        {report.method} Evidence ({report.language})
                      </p>
                      <p className="mt-0.5 text-xs text-[#526058]">{report.evidenceSummary}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Structured Routing Metadata */}
            <div className="space-y-3 rounded-xl border border-[#E2E8E4] bg-white p-4">
              <div>
                <p className="text-xs font-medium text-[#526058]">Location</p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-[#1C2420]">
                  <MapPin className="h-4 w-4 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
                  <span>{report.address}</span>
                </p>
                {report.formattedAddress &&
                  report.formattedAddress.trim().toLowerCase() !==
                    report.address.trim().toLowerCase() && (
                    <p className="mt-1 pl-5 text-xs text-[#526058]">
                      Google Maps Address: {report.formattedAddress}
                    </p>
                  )}
                {typeof report.lat === 'number' && typeof report.lng === 'number' && (
                  <p className="mt-1 pl-5 text-[11px] font-mono text-[#526058] tabular-nums">
                    {report.lat.toFixed(5)}° N, {report.lng.toFixed(5)}° E
                  </p>
                )}
              </div>
              <hr className="border-[#E2E8E4]" />
              <div>
                <p className="text-xs font-medium text-[#526058]">Suggested Department</p>
                <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-[#1C2420]">
                  <Building2 className="h-4 w-4 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
                  <span>{report.suggestedDepartment}</span>
                </p>
              </div>
              <hr className="border-[#E2E8E4]" />
              <div>
                <p className="text-xs font-medium text-[#526058]">Reported By</p>
                <p className="mt-1 text-sm text-[#1C2420]">{report.reporterName}</p>
              </div>
              <hr className="border-[#E2E8E4]" />
              <div className="rounded-lg bg-[#EDF5F0] p-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D]">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>AI Classification &amp; Routing Note</span>
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#29322D]">
                  {report.aiClassificationNote}
                </p>
              </div>
            </div>
          </div>

          {/* Citizen Verification Action Panel */}
          {canCitizenVerify && (
            <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-4 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-[#14532D]">
                  Citizen Verification Requested
                  {report.isSampleDemo ? ' (Demonstration Workflow)' : ''}
                </h3>
                <p className="mt-0.5 text-xs text-[#29322D]">
                  The assigned department reported this issue as resolved. Please inspect the resolution history and confirm whether the work is satisfactory on site.
                </p>
              </div>
              <div>
                <label htmlFor="citizen-verify-note" className="block text-xs font-medium text-[#1C2420]">
                  Optional on-site observation
                </label>
                <input
                  id="citizen-verify-note"
                  type="text"
                  value={verifyNote}
                  onChange={(e) => setVerifyNote(e.target.value)}
                  placeholder="e.g. Drain grate cleared and water is flowing smoothly."
                  className="mt-1 w-full rounded-lg border border-[#CFE3D5] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void verifyOrDisputeReport(report.id, 'verify', verifyNote);
                    setVerifyNote('');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  <span>Verify Resolution</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void verifyOrDisputeReport(report.id, 'dispute', verifyNote);
                    setVerifyNote('');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-4 py-2 text-sm font-medium text-[#991B1B] transition-colors hover:bg-[#FEF2F2] whitespace-nowrap"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>Dispute / Reopen</span>
                </button>
              </div>
            </div>
          )}

          {/* Government Department Status Management Panel */}
          {activeRole === UserRole.GOVERNMENT && (
            <form
              onSubmit={handleDepartmentSave}
              className="rounded-xl border border-[#E2E8E4] bg-[#F6F8F7] p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[#1C2420]">
                  Department Status Management
                </h3>
                <span className="text-xs text-[#526058]">
                  Citizen verification remains restricted to the reporting resident
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="dept-status-select" className="block text-xs font-medium text-[#1C2420]">
                    Update Status
                  </label>
                  <select
                    id="dept-status-select"
                    value={effectiveStatus}
                    onChange={(e) => setNextStatus(e.target.value as ReportStatus)}
                    className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                  >
                    {DEPARTMENT_ALLOWED_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="dept-status-note" className="block text-xs font-medium text-[#1C2420]">
                    Field / Officer Note
                  </label>
                  <input
                    id="dept-status-note"
                    type="text"
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Add progress note for status history..."
                    className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg bg-[#14532D] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
                >
                  Save Status Update
                </button>
              </div>
            </form>
          )}

          {/* Status History Timeline */}
          <div>
            <h3 className="text-sm font-semibold text-[#1C2420] mb-3">Status History &amp; Resolution Evidence</h3>
            <ol className="space-y-3 border-t border-[#E2E8E4] pt-3">
              {report.statusHistory.map((entry, idx) => (
                <li
                  key={`${entry.date}-${idx}`}
                  className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 border-b border-[#E2E8E4] pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator status={entry.status} compact />
                      <span className="text-xs font-medium text-[#1C2420]">{entry.actor}</span>
                    </div>
                    <p className="text-sm text-[#29322D]">{entry.note}</p>
                  </div>
                  <span className="text-xs text-[#526058] tabular-nums whitespace-nowrap">
                    {entry.date}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2E8E4] bg-[#F6F8F7] px-6 py-3">
          <span className="text-xs text-[#526058]">
            {report.isSampleDemo
              ? 'Bengaluru Demonstration Record · Not an official municipal ticket'
              : 'NAMMAOORU Citizen Record · Platform tracking only (not an official municipal acknowledgement)'}
          </span>
          <button
            type="button"
            onClick={closeReportDetail}
            className="rounded-lg border border-[#E2E8E4] bg-white px-4 py-1.5 text-sm font-medium text-[#1C2420] transition-colors hover:bg-[#F3F5F4]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
