import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Eye,
  EyeOff,
  Handshake,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCivic } from '../context/CivicContext';
import {
  BENGALURU_NEIGHBOURHOODS,
  INITIAL_DEPARTMENTS,
  INITIAL_NGOS,
  ROLE_METADATA,
} from '../data/mockData';
import { UserRole } from '../types/civic';

type AuthTab = 'signin' | 'register' | 'forgot';

const ROLE_LOGIN_CONFIG: Record<
  UserRole,
  {
    pageTitle: string;
    subtitle: string;
    icon: React.ReactNode;
    accessPolicy: string;
    registerLabel: string;
  }
> = {
  [UserRole.CITIZEN]: {
    pageTitle: 'Citizen Login',
    subtitle:
      'Sign in to report neighbourhood issues, track your private civic reports, and verify completed repairs.',
    icon: <Users className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    accessPolicy:
      'Citizens can register directly and manage only their own civic reports and public community drives.',
    registerLabel: 'Create Citizen Account',
  },
  [UserRole.GOVERNMENT]: {
    pageTitle: 'Government Department Login',
    subtitle:
      'Sign in with an authorized municipal department account to review and update assigned civic reports.',
    icon: <Building2 className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    accessPolicy:
      'Department access is restricted to verified officers assigned by a Platform Administrator. New department accounts require approval before access is granted.',
    registerLabel: 'Request Department Account',
  },
  [UserRole.NGO]: {
    pageTitle: 'NGO / Community Organisation Login',
    subtitle:
      'Sign in with a verified partner account to coordinate volunteer drives and record community initiatives.',
    icon: <Handshake className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    accessPolicy:
      'NGO accounts access only permitted community activities and never receive private citizen report data. Organisation accounts require administrator verification.',
    registerLabel: 'Request Organisation Account',
  },
  [UserRole.ADMIN]: {
    pageTitle: 'Platform Administrator Login',
    subtitle:
      'Sign in with an authorized NAMMAOORU administrator account to manage approvals, categories, and city-wide oversight.',
    icon: <ShieldCheck className="h-5 w-5 text-[#14532D]" aria-hidden="true" />,
    accessPolicy:
      'Administrator privileges are strictly limited to verified platform administrators. Unapproved requests cannot access administrative controls.',
    registerLabel: 'Request Administrator Access',
  },
};

export const RoleLoginPage: React.FC = () => {
  const {
    firebaseUser,
    userProfile,
    roleRequest,
    authBusy,
    authError,
    sessionMessage,
    clearAuthError,
    clearSessionMessage,
    signInWithGoogle,
    signInWithEmail,
    registerCitizenWithEmail,
    registerAndRequestRoleWithEmail,
    submitRoleAccessRequest,
    sendPasswordReset,
  } = useAuth();

  const {
    selectedLoginRole,
    openRoleLogin,
    openSignInPage,
    enterAuthorizedWorkspace,
    returnToLanding,
    signOutAndReturn,
    showToast,
  } = useCivic();

  const [tab, setTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [neighbourhood, setNeighbourhood] = useState<string>(BENGALURU_NEIGHBOURHOODS[0]);

  // Privileged role request fields
  const [departmentId, setDepartmentId] = useState<string>(INITIAL_DEPARTMENTS[0].id);
  const [organisationId, setOrganisationId] = useState<string>(INITIAL_NGOS[0].id);
  const [customOrgName, setCustomOrgName] = useState('');
  const [justification, setJustification] = useState('');

  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [requestSubmittedMsg, setRequestSubmittedMsg] = useState<string | null>(null);
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);

  const config = ROLE_LOGIN_CONFIG[selectedLoginRole];
  const isPrivilegedTarget = selectedLoginRole !== UserRole.CITIZEN;

  // Automatically enter workspace when authenticated user matches the selected role
  useEffect(() => {
    if (
      firebaseUser &&
      userProfile &&
      userProfile.approvalStatus === 'approved' &&
      userProfile.role === selectedLoginRole
    ) {
      enterAuthorizedWorkspace();
    }
  }, [firebaseUser, userProfile, selectedLoginRole, enterAuthorizedWorkspace]);

  const handleTabChange = (nextTab: AuthTab) => {
    setTab(nextTab);
    setLocalError(null);
    setResetSuccessMsg(null);
    setRequestSubmittedMsg(null);
    clearAuthError();
    clearSessionMessage();
  };

  const handleGoogleSignIn = async () => {
    setLocalError(null);
    clearAuthError();
    const profile = await signInWithGoogle();
    if (profile && profile.approvalStatus === 'approved' && profile.role === selectedLoginRole) {
      showToast(
        `Signed in as ${ROLE_METADATA[profile.role].label}`,
        `Welcome back, ${profile.displayName}.`,
        'success'
      );
      enterAuthorizedWorkspace();
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    if (!email.trim() || !password) {
      setLocalError('Please enter both your email address and password.');
      return;
    }
    const profile = await signInWithEmail(email, password);
    if (profile && profile.approvalStatus === 'approved' && profile.role === selectedLoginRole) {
      showToast(
        `Signed in as ${ROLE_METADATA[profile.role].label}`,
        `Welcome back, ${profile.displayName}.`,
        'success'
      );
      enterAuthorizedWorkspace();
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    setRequestSubmittedMsg(null);

    if (!displayName.trim()) {
      setLocalError('Please enter your full name.');
      return;
    }
    if (!email.trim() || !password) {
      setLocalError('Please enter an email address and password.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Please choose a password with at least 8 characters.');
      return;
    }

    if (selectedLoginRole === UserRole.CITIZEN) {
      const profile = await registerCitizenWithEmail(displayName, email, password, neighbourhood);
      if (profile) {
        showToast(
          'Citizen account created',
          'A verification link was sent to your email address.',
          'success'
        );
        enterAuthorizedWorkspace();
      }
      return;
    }

    // Privileged role registration: creates Citizen base account + pending RoleAccessRequest
    const resolvedOrgName =
      selectedLoginRole === UserRole.GOVERNMENT
        ? INITIAL_DEPARTMENTS.find((d) => d.id === departmentId)?.name ?? customOrgName.trim()
        : selectedLoginRole === UserRole.NGO
        ? customOrgName.trim() ||
          (INITIAL_NGOS.find((n) => n.id === organisationId)?.name ?? '')
        : customOrgName.trim() || 'NAMMAOORU Platform Operations';

    if (resolvedOrgName.length < 2) {
      setLocalError('Please specify your department or organisation name.');
      return;
    }
    if (justification.trim().length < 10) {
      setLocalError('Please provide a short verification note (at least 10 characters).');
      return;
    }

    await registerAndRequestRoleWithEmail({
      displayName,
      email,
      password,
      neighbourhood,
      requestedRole: selectedLoginRole,
      organisationName: resolvedOrgName,
      departmentId: selectedLoginRole === UserRole.GOVERNMENT ? departmentId : '',
      organisationId: selectedLoginRole === UserRole.NGO ? organisationId : '',
      justification,
    });
    setRequestSubmittedMsg(
      'Account created and role request submitted. A Platform Administrator must approve your request before privileged access is granted.'
    );
  };

  const handleExistingUserRoleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    setRequestSubmittedMsg(null);

    if (selectedLoginRole === UserRole.CITIZEN) return;

    const resolvedOrgName =
      selectedLoginRole === UserRole.GOVERNMENT
        ? INITIAL_DEPARTMENTS.find((d) => d.id === departmentId)?.name ?? customOrgName.trim()
        : selectedLoginRole === UserRole.NGO
        ? customOrgName.trim() ||
          (INITIAL_NGOS.find((n) => n.id === organisationId)?.name ?? '')
        : customOrgName.trim() || 'NAMMAOORU Platform Operations';

    if (resolvedOrgName.length < 2) {
      setLocalError('Please specify your department or organisation name.');
      return;
    }
    if (justification.trim().length < 10) {
      setLocalError('Please provide a brief justification (at least 10 characters).');
      return;
    }

    await submitRoleAccessRequest({
      requestedRole: selectedLoginRole,
      organisationName: resolvedOrgName,
      departmentId: selectedLoginRole === UserRole.GOVERNMENT ? departmentId : '',
      organisationId: selectedLoginRole === UserRole.NGO ? organisationId : '',
      justification,
    });
    setRequestSubmittedMsg(
      'Your role access request has been submitted for Platform Administrator review.'
    );
    setJustification('');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    clearAuthError();
    setResetSuccessMsg(null);

    if (!email.trim()) {
      setLocalError('Please enter your registered email address.');
      return;
    }

    try {
      await sendPasswordReset(email);
      setResetSuccessMsg(
        `If an account exists for ${email.trim()}, a password reset link has been sent to that email address.`
      );
    } catch {
      // authError is already populated by AuthContext
    }
  };

  const isSignedInRoleMismatch =
    Boolean(firebaseUser && userProfile) &&
    (userProfile!.role !== selectedLoginRole || userProfile!.approvalStatus !== 'approved');

  return (
    <div className="min-h-screen bg-[#F6F8F7] text-[#1C2420] flex flex-col">
      {/* Top Bar */}
      <header className="border-b border-[#E2E8E4] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <button
            type="button"
            onClick={returnToLanding}
            className="text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
          >
            <span className="block font-display text-lg font-bold tracking-tight text-[#14532D]">
              NAMMAOORU
            </span>
            <span className="block text-xs text-[#526058]">
              NAMMA JAVABDARI · Secure Role Access
            </span>
          </button>

          <button
            type="button"
            onClick={returnToLanding}
            className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-xs font-semibold text-[#1C2420] transition-colors hover:bg-[#EDF5F0] hover:text-[#14532D] whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Back to Landing Page</span>
          </button>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-6 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
          {/* Left Context & Role Identification Column */}
          <div className="lg:col-span-5 space-y-5">
            <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#CFE3D5] bg-white">
                  {config.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold text-[#14532D]">Selected Civic Portal</p>
                  <h1 className="font-display text-xl font-bold text-[#1C2420]">
                    {config.pageTitle}
                  </h1>
                </div>
              </div>

              <p className="text-sm text-[#29322D] leading-relaxed">{config.subtitle}</p>

              <div className="border-t border-[#CFE3D5] pt-3.5 flex items-start gap-2.5 text-xs text-[#29322D]">
                <Lock className="h-4 w-4 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
                <p className="leading-relaxed">{config.accessPolicy}</p>
              </div>
            </div>

            {/* Role Login Selector (does NOT grant access; switches portal context only) */}
            <div className="rounded-xl border border-[#E2E8E4] bg-white p-5 space-y-3">
              <p className="text-xs font-semibold text-[#526058]">Switch Login Portal</p>
              <div className="grid grid-cols-1 gap-2">
                {Object.values(UserRole).map((role) => {
                  const active = selectedLoginRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        setLocalError(null);
                        clearAuthError();
                        setRequestSubmittedMsg(null);
                        openSignInPage(role);
                      }}
                      className={`flex items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-xs font-semibold transition-colors ${
                        active
                          ? 'border-[#14532D] bg-[#EDF5F0] text-[#14532D]'
                          : 'border-[#E2E8E4] bg-white text-[#29322D] hover:bg-[#F6F8F7]'
                      }`}
                    >
                      <span>{ROLE_LOGIN_CONFIG[role].pageTitle}</span>
                      <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-[#526058]">
                All four portals are currently unlocked for direct preview, or you can sign in with Firebase Authentication below.
              </p>
            </div>
          </div>

          {/* Right Auth Form or Role Mismatch Guard Column */}
          <div className="lg:col-span-7">
            {/* Unlocked Direct Entry Card */}
            <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-4 sm:p-5">
              <div className="space-y-0.5">
                <p className="text-xs font-semibold text-[#14532D]">Login Unlocked for Preview</p>
                <p className="text-sm text-[#1C2420]">
                  Enter the <strong>{ROLE_METADATA[selectedLoginRole].label}</strong> portal immediately without signing in.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openRoleLogin(selectedLoginRole, 'dashboard')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap shrink-0"
              >
                <span>Open {ROLE_METADATA[selectedLoginRole].shortLabel} Portal</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
            {sessionMessage && (
              <div
                className="mb-4 flex items-start gap-3 rounded-xl border border-[#FCD34D] bg-[#FFFBEB] p-4 text-sm text-[#92400E]"
                role="status"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{sessionMessage}</p>
              </div>
            )}

            {(localError || authError) && (
              <div
                className="mb-4 flex items-start gap-3 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] p-4 text-sm text-[#991B1B]"
                role="alert"
              >
                <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{localError || authError}</p>
              </div>
            )}

            {requestSubmittedMsg && (
              <div
                className="mb-4 flex items-start gap-3 rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-4 text-sm text-[#14532D]"
                role="status"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
                <p>{requestSubmittedMsg}</p>
              </div>
            )}

            {/* Case A: User is already signed in, but NOT authorized for the selected portal */}
            {isSignedInRoleMismatch && userProfile ? (
              <div className="rounded-xl border border-[#E2E8E4] bg-white p-6 sm:p-8 space-y-6">
                <div className="flex items-start gap-3.5">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FEF2F2] text-[#991B1B]">
                    <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-bold text-[#1C2420]">
                      Access Not Authorized for {ROLE_METADATA[selectedLoginRole].label}
                    </h2>
                    <p className="text-sm text-[#526058]">
                      Signed in as <strong className="text-[#1C2420]">{userProfile.email}</strong>.
                      Your verified account role is{' '}
                      <strong className="text-[#14532D]">
                        {ROLE_METADATA[userProfile.role].label}
                      </strong>
                      . Selecting a different login portal does not grant another role&apos;s permissions.
                    </p>
                  </div>
                </div>

                {/* Primary Actions: Enter actual authorized role or Sign Out */}
                <div className="flex flex-wrap items-center gap-3 border-y border-[#E2E8E4] py-4">
                  {userProfile.approvalStatus === 'approved' && (
                    <button
                      type="button"
                      onClick={() => enterAuthorizedWorkspace('dashboard')}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] whitespace-nowrap"
                    >
                      <span>Open My {ROLE_METADATA[userProfile.role].shortLabel} Dashboard</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void signOutAndReturn()}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#E2E8E4] bg-white px-4 py-2.5 text-sm font-semibold text-[#1C2420] transition-colors hover:bg-[#F6F8F7] whitespace-nowrap"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Sign Out &amp; Use Another Account</span>
                  </button>
                </div>

                {/* Role Access Request Status or Form (for Government / NGO / Admin) */}
                {isPrivilegedTarget && (
                  <div className="space-y-4">
                    {roleRequest && roleRequest.status === 'pending' ? (
                      <div className="rounded-xl border border-[#CFE3D5] bg-[#EDF5F0] p-4 flex items-start gap-3">
                        <Clock className="h-5 w-5 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
                        <div className="text-sm space-y-1">
                          <p className="font-semibold text-[#14532D]">
                            Role Access Request Pending Administrator Approval
                          </p>
                          <p className="text-[#29322D]">
                            You requested{' '}
                            <strong>{ROLE_METADATA[roleRequest.requestedRole].label}</strong> access
                            for <strong>{roleRequest.organisationName}</strong>. Until approved by a
                            Platform Administrator, you can continue using your Citizen workspace.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={handleExistingUserRoleRequest} className="space-y-4">
                        <div>
                          <h3 className="font-display text-base font-semibold text-[#1C2420]">
                            Submit {ROLE_METADATA[selectedLoginRole].label} Verification Request
                          </h3>
                          <p className="mt-1 text-xs text-[#526058]">
                            {roleRequest?.status === 'rejected'
                              ? 'Your previous access request was declined. You may submit an updated request with verification details below.'
                              : 'Provide your official department or organisation details for Platform Administrator approval.'}
                          </p>
                        </div>

                        {selectedLoginRole === UserRole.GOVERNMENT && (
                          <div>
                            <label
                              htmlFor="req-dept"
                              className="block text-xs font-semibold text-[#1C2420]"
                            >
                              Bengaluru Municipal Department
                            </label>
                            <select
                              id="req-dept"
                              value={departmentId}
                              onChange={(e) => setDepartmentId(e.target.value)}
                              className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                            >
                              {INITIAL_DEPARTMENTS.map((d) => (
                                <option key={d.id} value={d.id}>
                                  {d.name} ({d.jurisdiction})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {selectedLoginRole === UserRole.NGO && (
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label
                                htmlFor="req-ngo-select"
                                className="block text-xs font-semibold text-[#1C2420]"
                              >
                                Partner Organisation
                              </label>
                              <select
                                id="req-ngo-select"
                                value={organisationId}
                                onChange={(e) => setOrganisationId(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                              >
                                {INITIAL_NGOS.map((n) => (
                                  <option key={n.id} value={n.id}>
                                    {n.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label
                                htmlFor="req-org-custom"
                                className="block text-xs font-semibold text-[#1C2420]"
                              >
                                Or New Organisation Name
                              </label>
                              <input
                                id="req-org-custom"
                                type="text"
                                value={customOrgName}
                                onChange={(e) => setCustomOrgName(e.target.value)}
                                placeholder="e.g. Koramangala Green Collective"
                                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                              />
                            </div>
                          </div>
                        )}

                        {selectedLoginRole === UserRole.ADMIN && (
                          <div>
                            <label
                              htmlFor="req-admin-unit"
                              className="block text-xs font-semibold text-[#1C2420]"
                            >
                              Governance / Operations Unit
                            </label>
                            <input
                              id="req-admin-unit"
                              type="text"
                              value={customOrgName}
                              onChange={(e) => setCustomOrgName(e.target.value)}
                              placeholder="e.g. NAMMAOORU Bengaluru Pilot Operations"
                              className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                            />
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor="req-justification"
                            className="block text-xs font-semibold text-[#1C2420]"
                          >
                            Official Role &amp; Verification Note
                          </label>
                          <textarea
                            id="req-justification"
                            rows={3}
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            placeholder="Share your ward office, official designation, or community registration details for administrator review."
                            className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          />
                        </div>

                        <button
                          type="submit"
                          disabled={authBusy}
                          className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60"
                        >
                          <span>
                            {authBusy ? 'Submitting...' : 'Submit Access Request for Approval'}
                          </span>
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* Case B: Unauthenticated Visitor — Sign In / Register / Forgot Password */
              <div className="rounded-xl border border-[#E2E8E4] bg-white p-6 sm:p-8 space-y-6">
                {/* Tabs */}
                <div className="flex flex-wrap gap-2 border-b border-[#E2E8E4] pb-4">
                  <button
                    type="button"
                    onClick={() => handleTabChange('signin')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      tab === 'signin'
                        ? 'bg-[#14532D] text-white'
                        : 'bg-[#F6F8F7] text-[#29322D] hover:bg-[#EDF5F0]'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('register')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      tab === 'register'
                        ? 'bg-[#14532D] text-white'
                        : 'bg-[#F6F8F7] text-[#29322D] hover:bg-[#EDF5F0]'
                    }`}
                  >
                    {config.registerLabel}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTabChange('forgot')}
                    className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                      tab === 'forgot'
                        ? 'bg-[#14532D] text-white'
                        : 'bg-[#F6F8F7] text-[#29322D] hover:bg-[#EDF5F0]'
                    }`}
                  >
                    Forgot Password
                  </button>
                </div>

                {/* SIGN IN TAB */}
                {tab === 'signin' && (
                  <div className="space-y-5">
                    <div>
                      <button
                        type="button"
                        disabled={authBusy}
                        onClick={() => void handleGoogleSignIn()}
                        className="flex w-full items-center justify-center gap-3 rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-4 py-3 text-sm font-semibold text-[#14532D] transition-colors hover:bg-[#DCEEE4] disabled:opacity-60"
                      >
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                        <span>{authBusy ? 'Authenticating...' : 'Continue with Google'}</span>
                      </button>
                      <p className="mt-2 text-xs text-[#526058]">
                        Recommended for instant verified sign-in. New Google accounts start with Citizen access and can request department or NGO verification.
                      </p>
                    </div>

                    <div className="relative flex items-center py-1">
                      <div className="flex-1 border-t border-[#E2E8E4]" />
                      <span className="px-3 text-xs font-medium text-[#526058]">
                        or sign in with email &amp; password
                      </span>
                      <div className="flex-1 border-t border-[#E2E8E4]" />
                    </div>

                    <form onSubmit={handleEmailSignIn} className="space-y-4">
                      <div>
                        <label
                          htmlFor="login-email"
                          className="block text-sm font-semibold text-[#1C2420]"
                        >
                          Email Address
                        </label>
                        <div className="relative mt-1.5">
                          <Mail
                            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#526058]"
                            aria-hidden="true"
                          />
                          <input
                            id="login-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full rounded-lg border border-[#E2E8E4] bg-white py-2.5 pl-9 pr-3.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="login-password"
                            className="block text-sm font-semibold text-[#1C2420]"
                          >
                            Password
                          </label>
                          <button
                            type="button"
                            onClick={() => handleTabChange('forgot')}
                            className="text-xs font-semibold text-[#14532D] hover:underline"
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="relative mt-1.5">
                          <KeyRound
                            className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#526058]"
                            aria-hidden="true"
                          />
                          <input
                            id="login-password"
                            type={showSignInPassword ? 'text' : 'password'}
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            className="w-full rounded-lg border border-[#E2E8E4] bg-white py-2.5 pl-9 pr-11 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowSignInPassword((prev) => !prev)}
                            aria-label={showSignInPassword ? 'Hide password' : 'Show password'}
                            className="absolute right-2.5 top-2 flex h-7 w-7 items-center justify-center rounded-md text-[#526058] hover:bg-[#F6F8F7] hover:text-[#1C2420]"
                          >
                            {showSignInPassword ? (
                              <EyeOff className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14532D] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60"
                      >
                        <span>
                          {authBusy ? 'Signing in...' : `Sign In to ${config.pageTitle}`}
                        </span>
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </form>
                  </div>
                )}

                {/* REGISTER / REQUEST ACCESS TAB */}
                {tab === 'register' && (
                  <div className="space-y-5">
                    {isPrivilegedTarget && (
                      <div className="rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] p-4 text-xs text-[#29322D] space-y-1">
                        <p className="font-semibold text-[#14532D]">
                          Approval Required for {ROLE_METADATA[selectedLoginRole].label} Accounts
                        </p>
                        <p>
                          Registering here creates a verified Citizen identity and submits a role
                          authorization request to NAMMAOORU Platform Administrators. You can also
                          sign in with Google first and submit your request immediately.
                        </p>
                      </div>
                    )}

                    <form onSubmit={handleRegister} className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="reg-name"
                            className="block text-sm font-semibold text-[#1C2420]"
                          >
                            Full Name
                          </label>
                          <input
                            id="reg-name"
                            type="text"
                            autoComplete="name"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="e.g. Kavitha Deshpande"
                            className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="reg-neighbourhood"
                            className="block text-sm font-semibold text-[#1C2420]"
                          >
                            Bengaluru Neighbourhood
                          </label>
                          <select
                            id="reg-neighbourhood"
                            value={neighbourhood}
                            onChange={(e) => setNeighbourhood(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          >
                            {BENGALURU_NEIGHBOURHOODS.map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label
                            htmlFor="reg-email"
                            className="block text-sm font-semibold text-[#1C2420]"
                          >
                            Email Address
                          </label>
                          <input
                            id="reg-email"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="reg-password"
                            className="block text-sm font-semibold text-[#1C2420]"
                          >
                            Password (min. 8 characters)
                          </label>
                          <div className="relative mt-1.5">
                            <input
                              id="reg-password"
                              type={showRegisterPassword ? 'text' : 'password'}
                              autoComplete="new-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Create a strong password"
                              className="w-full rounded-lg border border-[#E2E8E4] bg-white py-2.5 pl-3.5 pr-11 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setShowRegisterPassword((prev) => !prev)}
                              aria-label={showRegisterPassword ? 'Hide password' : 'Show password'}
                              className="absolute right-2.5 top-2 flex h-7 w-7 items-center justify-center rounded-md text-[#526058] hover:bg-[#F6F8F7] hover:text-[#1C2420]"
                            >
                              {showRegisterPassword ? (
                                <EyeOff className="h-4 w-4" aria-hidden="true" />
                              ) : (
                                <Eye className="h-4 w-4" aria-hidden="true" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {selectedLoginRole === UserRole.GOVERNMENT && (
                        <div>
                          <label
                            htmlFor="reg-dept"
                            className="block text-sm font-semibold text-[#1C2420]"
                          >
                            Government Department
                          </label>
                          <select
                            id="reg-dept"
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          >
                            {INITIAL_DEPARTMENTS.map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name} ({d.jurisdiction})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {selectedLoginRole === UserRole.NGO && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <div>
                            <label
                              htmlFor="reg-ngo"
                              className="block text-sm font-semibold text-[#1C2420]"
                            >
                              Partner Organisation
                            </label>
                            <select
                              id="reg-ngo"
                              value={organisationId}
                              onChange={(e) => setOrganisationId(e.target.value)}
                              className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                            >
                              {INITIAL_NGOS.map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label
                              htmlFor="reg-org-custom"
                              className="block text-sm font-semibold text-[#1C2420]"
                            >
                              Or Organisation Name
                            </label>
                            <input
                              id="reg-org-custom"
                              type="text"
                              value={customOrgName}
                              onChange={(e) => setCustomOrgName(e.target.value)}
                              placeholder="Optional if unlisted"
                              className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                            />
                          </div>
                        </div>
                      )}

                      {isPrivilegedTarget && (
                        <div>
                          <label
                            htmlFor="reg-justification"
                            className="block text-sm font-semibold text-[#1C2420]"
                          >
                            Verification Details for Administrator Approval
                          </label>
                          <textarea
                            id="reg-justification"
                            rows={3}
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            placeholder="Provide your official designation, ward assignment, or NGO registration details..."
                            className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authBusy}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#14532D] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60"
                      >
                        <span>
                          {authBusy
                            ? 'Processing...'
                            : isPrivilegedTarget
                            ? `Register & Submit ${ROLE_METADATA[selectedLoginRole].shortLabel} Request`
                            : 'Create Citizen Account'}
                        </span>
                      </button>
                    </form>
                  </div>
                )}

                {/* FORGOT PASSWORD TAB */}
                {tab === 'forgot' && (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    <p className="text-sm text-[#526058]">
                      Enter your registered email address and we will send you a secure Firebase
                      password reset link.
                    </p>

                    {resetSuccessMsg && (
                      <div
                        className="rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] p-4 text-sm text-[#14532D]"
                        role="status"
                      >
                        {resetSuccessMsg}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="reset-email"
                        className="block text-sm font-semibold text-[#1C2420]"
                      >
                        Registered Email Address
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="mt-1.5 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="submit"
                        disabled={authBusy}
                        className="inline-flex items-center gap-2 rounded-lg bg-[#14532D] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#166534] disabled:opacity-60"
                      >
                        <span>{authBusy ? 'Sending...' : 'Send Password Reset Link'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleTabChange('signin')}
                        className="text-sm font-semibold text-[#14532D] hover:underline"
                      >
                        Back to Sign In
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
