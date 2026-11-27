import React from 'react';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CivicProvider, useCivic } from './context/CivicContext';
import { AdminDashboardPage } from './pages/AdminDashboardPage';
import { CitizenDashboard } from './pages/CitizenDashboard';
import { CommunityActivityPage } from './pages/CommunityActivityPage';
import { GovernmentDashboardPage } from './pages/GovernmentDashboardPage';
import { LandingPage } from './pages/LandingPage';
import { MyReportsPage } from './pages/MyReportsPage';
import { NeighbourhoodMapPage } from './pages/NeighbourhoodMapPage';
import { NeighbourhoodPulsePage } from './pages/NeighbourhoodPulsePage';
import { NgoDashboardPage } from './pages/NgoDashboardPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfileSettingsPage } from './pages/ProfileSettingsPage';
import { ReportProblemPage } from './pages/ReportProblemPage';
import { RoleLoginPage } from './pages/RoleLoginPage';
import { UserRole } from './types/civic';

const NammaooruRouter: React.FC = () => {
  const { authReady } = useAuth();
  const { viewMode, activeRole, activePage } = useCivic();

  if (viewMode === 'landing') {
    return <LandingPage />;
  }

  if (viewMode === 'login') {
    if (!authReady) {
      return (
        <div className="min-h-screen bg-[#F6F8F7] flex items-center justify-center p-6">
          <div className="rounded-xl border border-[#E2E8E4] bg-white px-6 py-5 text-center space-y-2">
            <p className="font-display text-base font-bold text-[#14532D]">NAMMAOORU</p>
            <p className="text-sm text-[#526058]">Loading sign-in portal...</p>
          </div>
        </div>
      );
    }
    return <RoleLoginPage />;
  }

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        if (activeRole === UserRole.GOVERNMENT) {
          return <GovernmentDashboardPage mode="dashboard" />;
        }
        if (activeRole === UserRole.NGO) {
          return <NgoDashboardPage mode="dashboard" />;
        }
        if (activeRole === UserRole.ADMIN) {
          return <AdminDashboardPage mode="dashboard" />;
        }
        return <CitizenDashboard />;

      case 'report':
        if (activeRole === UserRole.NGO || activeRole === UserRole.GOVERNMENT) {
          return activeRole === UserRole.GOVERNMENT ? (
            <GovernmentDashboardPage mode="dashboard" />
          ) : (
            <NgoDashboardPage mode="dashboard" />
          );
        }
        return <ReportProblemPage />;

      case 'map':
        if (activeRole === UserRole.NGO) {
          return <NgoDashboardPage mode="dashboard" />;
        }
        return <NeighbourhoodMapPage />;

      case 'community':
        return <CommunityActivityPage />;

      case 'pulse':
        return <NeighbourhoodPulsePage />;

      case 'workspace':
        if (activeRole === UserRole.GOVERNMENT) {
          return <GovernmentDashboardPage mode="workspace" />;
        }
        if (activeRole === UserRole.NGO) {
          return <NgoDashboardPage mode="workspace" />;
        }
        if (activeRole === UserRole.ADMIN) {
          return <AdminDashboardPage mode="workspace" />;
        }
        return <MyReportsPage />;

      case 'notifications':
        return <NotificationsPage />;

      case 'profile':
        return <ProfileSettingsPage />;

      default:
        return <CitizenDashboard />;
    }
  };

  return <AppShell>{renderPage()}</AppShell>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <CivicProvider>
          <NammaooruRouter />
        </CivicProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
