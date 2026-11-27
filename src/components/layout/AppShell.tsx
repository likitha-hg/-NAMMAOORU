import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Bell,
  Briefcase,
  CheckCircle2,
  Compass,
  FilePlus2,
  Home,
  LayoutDashboard,
  LogIn,
  LogOut,
  Map,
  Menu,
  RefreshCw,
  Settings,
  ShieldCheck,
  Unlock,
  Users,
  X,
} from 'lucide-react';
import { ROLE_METADATA } from '../../data/mockData';
import { useAuth } from '../../context/AuthContext';
import { useCivic } from '../../context/CivicContext';
import { AppPage, UserRole } from '../../types/civic';
import { ReportDetailModal } from '../ui/ReportDetailModal';

interface AppShellProps {
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ children }) => {
  const {
    firebaseUser,
    userProfile,
    resendVerificationEmail,
    refreshEmailVerification,
    authBusy,
  } = useAuth();
  const {
    activeRole,
    activePage,
    isUnlockedPreview,
    previewProfile,
    navigateTo,
    switchPortalRole,
    openSignInPage,
    returnToLanding,
    signOutAndReturn,
    notifications,
    largeTextMode,
    toast,
    dismissToast,
    showToast,
  } = useCivic();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const roleMeta = ROLE_METADATA[activeRole];
  const unreadCount = notifications.filter((n) => !n.read).length;

  const displayName =
    firebaseUser && userProfile
      ? userProfile.displayName || firebaseUser.displayName || roleMeta.demoPersonName
      : activeRole === UserRole.CITIZEN
      ? previewProfile.displayName
      : roleMeta.demoPersonName;

  const subIdentity =
    firebaseUser && userProfile
      ? userProfile.departmentName ||
        userProfile.organisationName ||
        userProfile.email ||
        firebaseUser.email ||
        roleMeta.label
      : roleMeta.demoOrganisation;

  const navItems: {
    page: AppPage;
    label: string;
    icon: React.ReactNode;
    badgeCount?: number;
  }[] = [
    {
      page: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    ...(activeRole === UserRole.CITIZEN
      ? [
          {
            page: 'report' as AppPage,
            label: 'Report a Problem',
            icon: <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
        ]
      : []),
    ...(activeRole !== UserRole.NGO
      ? [
          {
            page: 'map' as AppPage,
            label: 'Neighbourhood Map',
            icon: <Map className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
        ]
      : []),
    {
      page: 'community',
      label: 'Community Activity',
      icon: <Users className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      page: 'pulse',
      label: 'Neighbourhood Pulse',
      icon: <Activity className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    {
      page: 'workspace',
      label: roleMeta.workspaceNavLabel,
      icon: <Briefcase className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
    ...(activeRole === UserRole.ADMIN
      ? [
          {
            page: 'report' as AppPage,
            label: 'Report a Problem',
            icon: <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
          },
        ]
      : []),
    {
      page: 'notifications',
      label: 'Notifications',
      icon: <Bell className="h-4 w-4 shrink-0" aria-hidden="true" />,
      badgeCount: unreadCount,
    },
    {
      page: 'profile',
      label: 'Profile & Settings',
      icon: <Settings className="h-4 w-4 shrink-0" aria-hidden="true" />,
    },
  ];

  const handleNavClick = (page: AppPage) => {
    navigateTo(page);
    setMobileMenuOpen(false);
  };

  const handleCheckVerification = async () => {
    const verified = await refreshEmailVerification();
    if (verified) {
      showToast('Email verified', 'Your email verification is now active.', 'success');
    } else {
      showToast(
        'Verification pending',
        'Please click the verification link in your inbox, then check again.',
        'warning'
      );
    }
  };

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col justify-between bg-white">
      <div>
        {/* Wordmark */}
        <div className="border-b border-[#E2E8E4] px-5 py-4">
          <button
            type="button"
            onClick={returnToLanding}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
          >
            <span className="block font-display text-lg font-bold tracking-tight text-[#14532D]">
              NAMMAOORU
            </span>
            <span className="block text-xs text-[#526058]">
              NAMMA JAVABDARI · Bengaluru
            </span>
          </button>
        </div>

        {/* Unlocked Portal Switcher */}
        <div className="border-b border-[#E2E8E4] bg-[#EDF5F0] px-4 py-3 space-y-2">
          <div className="flex items-center justify-between gap-1.5 text-xs font-semibold text-[#14532D]">
            <span className="inline-flex items-center gap-1.5">
              {isUnlockedPreview ? (
                <Unlock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              <span>{isUnlockedPreview ? 'Active Portal (Unlocked)' : 'Verified Account Role'}</span>
            </span>
          </div>
          <label htmlFor="portal-role-switcher" className="sr-only">
            Switch active civic portal
          </label>
          <select
            id="portal-role-switcher"
            value={activeRole}
            onChange={(e) => {
              switchPortalRole(e.target.value as UserRole);
              setMobileMenuOpen(false);
            }}
            className="w-full rounded-lg border border-[#CFE3D5] bg-white px-2.5 py-2 text-xs font-semibold text-[#1C2420] focus:border-[#14532D] focus:outline-none"
          >
            {Object.values(UserRole).map((role) => (
              <option key={role} value={role}>
                {ROLE_METADATA[role].label}
              </option>
            ))}
          </select>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 py-4 space-y-1" aria-label="Main navigation">
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <button
                key={item.page}
                type="button"
                onClick={() => handleNavClick(item.page)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] ${
                  isActive
                    ? 'bg-[#EDF5F0] text-[#14532D]'
                    : 'text-[#29322D] hover:bg-[#F6F8F7] hover:text-[#14532D]'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badgeCount === 'number' && item.badgeCount > 0 && (
                  <span className="ml-2 rounded-md bg-[#14532D] px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
                    {item.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom User & Sign In / Sign Out */}
      <div className="border-t border-[#E2E8E4] p-4 space-y-2.5">
        <div className="text-xs">
          <p className="font-semibold text-[#1C2420] truncate">{displayName}</p>
          <p className="text-[#526058] truncate">{subIdentity}</p>
        </div>
        <button
          type="button"
          onClick={returnToLanding}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] px-3 py-2 text-xs font-medium text-[#1C2420] transition-colors hover:bg-[#EDF5F0] hover:text-[#14532D]"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Landing Page</span>
        </button>
        {firebaseUser ? (
          <button
            type="button"
            onClick={() => void signOutAndReturn()}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#FCA5A5] bg-white px-3 py-2 text-xs font-semibold text-[#991B1B] transition-colors hover:bg-[#FEF2F2]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setMobileMenuOpen(false);
              openSignInPage(activeRole, activePage);
            }}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#CFE3D5] bg-white px-3 py-2 text-xs font-semibold text-[#14532D] transition-colors hover:bg-[#EDF5F0]"
          >
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sign In (Optional)</span>
          </button>
        )}
      </div>
    </div>
  );

  const pageTitles: Record<AppPage, string> = {
    dashboard: `${roleMeta.shortLabel} Dashboard`,
    report: 'Report a Problem',
    map: 'Neighbourhood Map',
    community: 'Community Activity',
    pulse: 'Community Intelligence & Neighbourhood Pulse',
    workspace: roleMeta.workspaceNavLabel,
    notifications: 'Notifications',
    profile: 'Profile & Settings',
  };

  return (
    <div
      className={`min-h-screen bg-[#F6F8F7] text-[#1C2420] flex flex-col lg:flex-row ${
        largeTextMode ? 'text-[17px]' : 'text-[15px]'
      }`}
    >
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block lg:w-64 lg:shrink-0 lg:border-r lg:border-[#E2E8E4] lg:bg-white lg:sticky lg:top-0 lg:h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#E2E8E4] bg-white px-4 py-3 lg:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#1C2420] hover:bg-[#F6F8F7]"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <span className="block font-display text-base font-bold text-[#14532D] truncate">
              NAMMAOORU
            </span>
            <span className="block text-xs text-[#526058] truncate">
              {roleMeta.shortLabel} · {pageTitles[activePage]}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => navigateTo('notifications')}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#1C2420] hover:bg-[#F6F8F7]"
            aria-label={`Notifications (${unreadCount} unread)`}
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 rounded-md bg-[#14532D] px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                {unreadCount}
              </span>
            )}
          </button>
          {firebaseUser ? (
            <button
              type="button"
              onClick={() => void signOutAndReturn()}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#991B1B] hover:bg-[#FEF2F2]"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openSignInPage(activeRole, activePage)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#CFE3D5] text-[#14532D] hover:bg-[#EDF5F0]"
              aria-label="Sign in"
            >
              <LogIn className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-[#1C2420]/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8E4] text-[#526058] hover:bg-[#F6F8F7]"
              aria-label="Close navigation menu"
            >
              <X className="h-4 w-4" />
            </button>
            {renderSidebarContent()}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Top Contextual Bar */}
        <div className="hidden lg:flex items-center justify-between gap-8 border-b border-[#E2E8E4] bg-white px-8 py-4">
          <div className="flex items-center gap-2 text-sm text-[#526058]">
            <span className="font-medium text-[#14532D]">{roleMeta.label}</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-[#1C2420]">{pageTitles[activePage]}</span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {activeRole === UserRole.CITIZEN && activePage !== 'report' && (
              <button
                type="button"
                onClick={() => navigateTo('report')}
                className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
              >
                <FilePlus2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Report a Problem</span>
              </button>
            )}
            {activeRole !== UserRole.CITIZEN && (
              <button
                type="button"
                onClick={() => navigateTo('pulse')}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8E4] bg-white px-4 py-2 text-xs font-medium text-[#1C2420] transition-colors hover:bg-[#F6F8F7] whitespace-nowrap"
              >
                <Compass className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                <span>Neighbourhood Pulse</span>
              </button>
            )}
            {firebaseUser ? (
              <button
                type="button"
                onClick={() => void signOutAndReturn()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-xs font-medium text-[#526058] transition-colors hover:border-[#FCA5A5] hover:bg-[#FEF2F2] hover:text-[#991B1B] whitespace-nowrap"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openSignInPage(activeRole, activePage)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#CFE3D5] bg-white px-3.5 py-2 text-xs font-medium text-[#14532D] transition-colors hover:bg-[#EDF5F0] whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Sign In (Optional)</span>
              </button>
            )}
          </div>
        </div>

        {/* Email Verification Reminder Banner */}
        {firebaseUser && !firebaseUser.emailVerified && (
          <div className="border-b border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 sm:px-6 lg:px-8">
            <div className="mx-auto flex max-w-6xl flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#92400E]">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  <strong>Verify your email address:</strong> Please confirm the verification link
                  sent to <strong>{firebaseUser.email}</strong> to strengthen account security and
                  recovery.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void resendVerificationEmail()}
                  className="rounded-lg border border-[#F59E0B] bg-white px-3 py-1.5 font-semibold text-[#92400E] hover:bg-[#FEF3C7] whitespace-nowrap"
                >
                  Resend Link
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleCheckVerification()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#92400E] px-3 py-1.5 font-semibold text-white hover:bg-[#78350F] whitespace-nowrap"
                >
                  <RefreshCw className="h-3 w-3" aria-hidden="true" />
                  <span>I&apos;ve Verified</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>

      {/* Global Toast Feedback */}
      {toast && (
        <div
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-[#CFE3D5] bg-white p-4 shadow-lg"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1C2420]">{toast.title}</p>
              <p className="mt-0.5 text-xs text-[#526058]">{toast.detail}</p>
            </div>
            <button
              type="button"
              onClick={dismissToast}
              className="text-[#526058] hover:text-[#1C2420]"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Shared Report Detail Modal */}
      <ReportDetailModal />
    </div>
  );
};
