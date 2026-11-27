import React, { useState } from 'react';
import { Bell, Check, CheckCheck, ExternalLink, MailOpen } from 'lucide-react';
import { DemoNotice } from '../components/ui/DemoNotice';
import { EmptyState } from '../components/ui/EmptyState';
import { useCivic } from '../context/CivicContext';

export const NotificationsPage: React.FC = () => {
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    openNotificationTarget,
  } = useCivic();

  const [filter, setFilter] = useState<'ALL' | 'UNREAD'>('ALL');

  const unreadCount = notifications.filter((n) => !n.read).length;
  const visible = notifications.filter((n) => (filter === 'UNREAD' ? !n.read : true));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1C2420]">Notifications</h1>
          <p className="text-sm text-[#526058]">
            In-app updates for your report submissions, department progress, assignments, verification requests, disputed reports, and Bengaluru community activities.
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllNotificationsRead()}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8E4] bg-white px-4 py-2 text-xs font-medium text-[#14532D] hover:bg-[#EDF5F0] whitespace-nowrap shrink-0"
          >
            <CheckCheck className="h-4 w-4" aria-hidden="true" />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            filter === 'ALL'
              ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
              : 'border-[#E2E8E4] bg-white text-[#526058] hover:text-[#1C2420]'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('UNREAD')}
          className={`rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
            filter === 'UNREAD'
              ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
              : 'border-[#E2E8E4] bg-white text-[#526058] hover:text-[#1C2420]'
          }`}
        >
          Unread ({unreadCount})
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No unread notifications"
          description="You are all caught up. New report confirmations and community updates will appear here."
          actionLabel="View All Notifications"
          onAction={() => setFilter('ALL')}
        />
      ) : (
        <div className="divide-y divide-[#E2E8E4] rounded-xl border border-[#E2E8E4] bg-white">
          {visible.map((notif) => (
            <div
              key={notif.id}
              className={`flex flex-col sm:flex-row sm:items-start justify-between gap-4 p-5 transition-colors ${
                notif.read ? 'bg-white' : 'bg-[#EDF5F0]/60'
              }`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                    notif.read
                      ? 'border-[#E2E8E4] bg-[#F6F8F7] text-[#526058]'
                      : 'border-[#CFE3D5] bg-white text-[#14532D]'
                  }`}
                >
                  {notif.read ? (
                    <MailOpen className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Bell className="h-4 w-4" aria-hidden="true" />
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[#526058]">
                    <span className="font-medium text-[#14532D]">{notif.type}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{notif.timestamp}</span>
                    {notif.isSampleDemo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="rounded bg-[#F3F5F4] px-1.5 py-0.5 text-[10px] font-medium text-[#526058]">
                          Pilot Sample
                        </span>
                      </>
                    )}
                    {!notif.read && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-semibold text-[#14532D]">Unread</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-sm sm:text-base font-semibold text-[#1C2420]">
                    {notif.title}
                  </h2>
                  <p className="text-sm text-[#29322D]">{notif.message}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {(notif.relatedPage || notif.relatedReportId || notif.relatedActivityId) && (
                  <button
                    type="button"
                    onClick={() => openNotificationTarget(notif)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-white px-3 py-1.5 text-xs font-medium text-[#14532D] hover:bg-[#EDF5F0] whitespace-nowrap"
                  >
                    <span>Open Related View</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void markNotificationRead(notif.id, !notif.read)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] px-3 py-1.5 text-xs font-medium text-[#1C2420] hover:bg-[#E2E8E4]/50 whitespace-nowrap"
                >
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{notif.read ? 'Mark unread' : 'Mark read'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DemoNotice description="Notifications for your own reports and volunteer registrations are stored in Firestore for in-app viewing. External SMS, email, and mobile push delivery are not active in this pilot." />
    </div>
  );
};
