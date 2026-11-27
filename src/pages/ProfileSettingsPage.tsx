import React, { useEffect, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Shield,
  ShieldCheck,
  User,
} from 'lucide-react';
import { BENGALURU_NEIGHBOURHOODS, ROLE_METADATA } from '../data/mockData';
import { useAuth } from '../context/AuthContext';
import { useCivic } from '../context/CivicContext';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  LanguageOption,
  NotificationPreferences,
  UserRole,
} from '../types/civic';

export const ProfileSettingsPage: React.FC = () => {
  const {
    firebaseUser,
    userProfile,
    roleRequest,
    authBusy,
    updateOwnProfilePreferences,
    changeAccountPassword,
    sendPasswordReset,
    resendVerificationEmail,
    refreshEmailVerification,
  } = useAuth();
  const {
    activeRole,
    previewProfile,
    updatePreviewProfile,
    largeTextMode,
    setLargeTextMode,
    signOutAndReturn,
    openRoleLogin,
    openSignInPage,
    showToast,
  } = useCivic();

  const [displayNameDraft, setDisplayNameDraft] = useState(
    userProfile?.displayName ?? firebaseUser?.displayName ?? previewProfile.displayName
  );
  const [phoneDraft, setPhoneDraft] = useState(
    userProfile?.phoneNumber ?? previewProfile.phoneNumber
  );
  const [addressDraft, setAddressDraft] = useState(
    userProfile?.address ?? previewProfile.address
  );
  const [neighbourhoodDraft, setNeighbourhoodDraft] = useState(
    userProfile?.neighbourhood ?? previewProfile.neighbourhood ?? BENGALURU_NEIGHBOURHOODS[0]
  );
  const [languageDraft, setLanguageDraft] = useState<LanguageOption>(
    userProfile?.preferredLanguage ?? previewProfile.preferredLanguage ?? LanguageOption.ENGLISH
  );
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences>(
    userProfile?.notificationPreferences ??
      previewProfile.notificationPreferences ??
      DEFAULT_NOTIFICATION_PREFERENCES
  );

  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

  // Password & Security state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [securityMessage, setSecurityMessage] = useState('');

  useEffect(() => {
    if (userProfile) {
      setDisplayNameDraft(userProfile.displayName);
      setPhoneDraft(userProfile.phoneNumber ?? '');
      setAddressDraft(userProfile.address ?? '');
      setNeighbourhoodDraft(userProfile.neighbourhood);
      setLanguageDraft(userProfile.preferredLanguage);
      setNotifPrefs(userProfile.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES);
    } else {
      setDisplayNameDraft(previewProfile.displayName);
      setPhoneDraft(previewProfile.phoneNumber);
      setAddressDraft(previewProfile.address);
      setNeighbourhoodDraft(previewProfile.neighbourhood);
      setLanguageDraft(previewProfile.preferredLanguage);
      setNotifPrefs(previewProfile.notificationPreferences);
    }
  }, [userProfile, previewProfile]);

  const roleMeta = ROLE_METADATA[activeRole];

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayNameDraft.trim()) return;
    setSavingProfile(true);
    try {
      const updates = {
        displayName: displayNameDraft.trim(),
        phoneNumber: phoneDraft.trim(),
        address: addressDraft.trim(),
        neighbourhood: neighbourhoodDraft,
        preferredLanguage: languageDraft,
      };
      updatePreviewProfile(updates);
      if (firebaseUser) {
        await updateOwnProfilePreferences(updates);
        showToast('Profile saved', 'Your private Citizen profile details were updated in Firestore.', 'success');
      } else {
        showToast('Profile updated', 'Saved in your active unlocked session.', 'success');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleNotifPref = async (key: keyof NotificationPreferences) => {
    const next: NotificationPreferences = {
      ...notifPrefs,
      [key]: !notifPrefs[key],
    };
    setNotifPrefs(next);
    updatePreviewProfile({ notificationPreferences: next });
    if (!firebaseUser) {
      showToast('Notification preferences updated', 'Saved in your active unlocked session.', 'info');
      return;
    }
    setSavingPrefs(true);
    try {
      await updateOwnProfilePreferences({ notificationPreferences: next });
      showToast('Notification preferences updated', 'Your in-app preference was saved.', 'info');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError('');
    setSecurityMessage('');

    if (newPassword.length < 8) {
      setSecurityError('Please choose a new password with at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setSecurityError('Passwords do not match. Please re-enter carefully.');
      return;
    }

    try {
      await changeAccountPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setSecurityMessage('Your account password has been updated.');
      showToast('Password updated', 'Your Firebase Authentication password was changed.', 'success');
    } catch (err) {
      setSecurityError(
        err instanceof Error ? err.message : 'Unable to update password right now.'
      );
    }
  };

  const handleSendResetEmail = async () => {
    const email = userProfile?.email || firebaseUser?.email;
    if (!email) return;
    setSecurityError('');
    setSecurityMessage('');
    try {
      await sendPasswordReset(email);
      setSecurityMessage(`A password reset link has been sent to ${email}.`);
      showToast('Reset email sent', `Check ${email} for your password reset link.`, 'info');
    } catch (err) {
      setSecurityError(err instanceof Error ? err.message : 'Failed to dispatch reset email.');
    }
  };

  const isPasswordAccount = firebaseUser?.providerData.some((p) => p.providerId === 'password');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1C2420]">Profile &amp; Settings</h1>
          <p className="text-sm text-[#526058]">
            Manage your private Citizen account details, Bengaluru neighbourhood, preferred language, in-app notification preferences, and account security.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOutAndReturn()}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-lg border border-[#FCA5A5] bg-white px-4 py-2 text-sm font-semibold text-[#991B1B] transition-colors hover:bg-[#FEF2F2] whitespace-nowrap"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Log Out</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Personal Profile Editing Form */}
        <section className="rounded-xl border border-[#E2E8E4] bg-white p-6 space-y-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EDF5F0] text-[#14532D]">
              <User className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold text-[#1C2420] truncate">
                {userProfile?.displayName || firebaseUser?.displayName || previewProfile.displayName}
              </h2>
              <p className="text-xs text-[#526058] truncate">
                {userProfile?.email || firebaseUser?.email || previewProfile.email}
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-4 border-t border-[#E2E8E4] pt-4">
            <div>
              <label htmlFor="profile-display-name" className="block text-xs font-semibold text-[#1C2420]">
                Full Name
              </label>
              <input
                id="profile-display-name"
                type="text"
                required
                value={displayNameDraft}
                onChange={(e) => setDisplayNameDraft(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="profile-email" className="block text-xs font-semibold text-[#1C2420]">
                Email Address (Account Identity)
              </label>
              <div className="relative mt-1">
                <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#526058]" aria-hidden="true" />
                <input
                  id="profile-email"
                  type="email"
                  readOnly
                  value={userProfile?.email || firebaseUser?.email || previewProfile.email}
                  className="w-full rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] py-2 pl-9 pr-3.5 text-sm text-[#526058]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="profile-phone" className="block text-xs font-semibold text-[#1C2420]">
                  Phone Number (Optional)
                </label>
                <div className="relative mt-1">
                  <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#526058]" aria-hidden="true" />
                  <input
                    id="profile-phone"
                    type="tel"
                    maxLength={25}
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="+91 98XXX XXXXX"
                    className="w-full rounded-lg border border-[#E2E8E4] bg-white py-2 pl-9 pr-3.5 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="settings-language" className="flex items-center gap-1.5 text-xs font-semibold text-[#1C2420]">
                  <Globe className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                  <span>Preferred Language</span>
                </label>
                <select
                  id="settings-language"
                  value={languageDraft}
                  onChange={(e) => setLanguageDraft(e.target.value as LanguageOption)}
                  className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                >
                  <option value={LanguageOption.ENGLISH}>English</option>
                  <option value={LanguageOption.KANNADA}>ಕನ್ನಡ (Kannada)</option>
                  <option value={LanguageOption.HINDI}>हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="settings-neighbourhood" className="flex items-center gap-1.5 text-xs font-semibold text-[#1C2420]">
                <MapPin className="h-3.5 w-3.5 text-[#14532D]" aria-hidden="true" />
                <span>Primary Bengaluru Neighbourhood</span>
              </label>
              <select
                id="settings-neighbourhood"
                value={neighbourhoodDraft}
                onChange={(e) => setNeighbourhoodDraft(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              >
                {BENGALURU_NEIGHBOURHOODS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="profile-address" className="block text-xs font-semibold text-[#1C2420]">
                Address / Locality Information (Private)
              </label>
              <textarea
                id="profile-address"
                rows={2}
                maxLength={240}
                value={addressDraft}
                onChange={(e) => setAddressDraft(e.target.value)}
                placeholder="e.g. 12th Main, HAL 2nd Stage, Indiranagar, Bengaluru 560038"
                className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-[#14532D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-60 whitespace-nowrap"
              >
                {savingProfile ? 'Saving Profile...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>

          {/* Verified Role Information */}
          <div className="border-t border-[#E2E8E4] pt-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1C2420]">
              <ShieldCheck className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
              <span>Authorized Civic Role</span>
            </div>
            <div className="rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] p-3.5 space-y-1">
              <p className="text-sm font-semibold text-[#14532D]">{roleMeta.label}</p>
              <p className="text-xs text-[#526058]">{roleMeta.subtitle}</p>
            </div>
            {roleRequest && (
              <div className="rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3 text-xs text-[#29322D]">
                Role request ({ROLE_METADATA[roleRequest.requestedRole].label}):{' '}
                <strong className="capitalize text-[#14532D]">{roleRequest.status}</strong>
              </div>
            )}
            {activeRole === UserRole.CITIZEN && !roleRequest && (
              <div className="pt-1 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => openRoleLogin(UserRole.GOVERNMENT)}
                  className="text-xs font-semibold text-[#14532D] hover:underline"
                >
                  Request Government Department Access
                </button>
                <span className="text-xs text-[#526058]" aria-hidden="true">
                  ·
                </span>
                <button
                  type="button"
                  onClick={() => openRoleLogin(UserRole.NGO)}
                  className="text-xs font-semibold text-[#14532D] hover:underline"
                >
                  Request NGO / Community Access
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Notification Preferences, Accessibility & Password/Security */}
        <div className="space-y-6">
          {/* In-App Notification Preferences */}
          <section className="rounded-xl border border-[#E2E8E4] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
              <div>
                <h2 className="font-display text-base font-semibold text-[#1C2420]">
                  In-App Notification Preferences
                </h2>
                <p className="text-xs text-[#526058]">
                  Saved privately to your Citizen profile (in-app notification feed only; no SMS or push active).
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#E2E8E4]">
              {(
                [
                  {
                    key: 'statusUpdates',
                    label: 'Report Submission & Status Changes',
                    desc: 'Updates when your report is logged, assigned, or updated.',
                  },
                  {
                    key: 'departmentProgress',
                    label: 'Department Progress Updates',
                    desc: 'Field crew progress notes and assignment updates.',
                  },
                  {
                    key: 'verificationRequests',
                    label: 'Citizen Verification Requests',
                    desc: 'Alerts when a completed repair awaits your confirmation.',
                  },
                  {
                    key: 'communityActivities',
                    label: 'Community & NGO Activity Updates',
                    desc: 'Volunteer confirmations and nearby Bengaluru neighbourhood drives.',
                  },
                ] as const
              ).map((item) => {
                const enabled = notifPrefs[item.key];
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 py-3 first:pt-1 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#1C2420]">{item.label}</p>
                      <p className="text-xs text-[#526058]">{item.desc}</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      disabled={savingPrefs}
                      aria-checked={enabled}
                      onClick={() => void handleToggleNotifPref(item.key)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        enabled
                          ? 'border-[#14532D] bg-[#14532D] text-white'
                          : 'border-[#E2E8E4] bg-[#F6F8F7] text-[#526058]'
                      }`}
                    >
                      {enabled ? 'On' : 'Off'}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-[#E2E8E4] pt-4">
              <div>
                <p className="text-sm font-semibold text-[#1C2420]">Comfortable Large Text</p>
                <p className="text-xs text-[#526058]">
                  Increases base reading size across dashboards and forms.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={largeTextMode}
                onClick={() => setLargeTextMode(!largeTextMode)}
                className={`rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  largeTextMode
                    ? 'border-[#14532D] bg-[#14532D] text-white'
                    : 'border-[#E2E8E4] bg-[#F6F8F7] text-[#1C2420]'
                }`}
              >
                {largeTextMode ? 'Enabled' : 'Standard'}
              </button>
            </div>
          </section>

          {/* Password & Security Settings */}
          <section className="rounded-xl border border-[#E2E8E4] bg-white p-6 space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#14532D]" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold text-[#1C2420]">
                Password &amp; Account Security
              </h2>
            </div>

            {/* Email Verification Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E2E8E4] bg-[#F6F8F7] p-3 text-xs">
              <span className="inline-flex items-center gap-1.5 font-medium text-[#1C2420]">
                <CheckCircle2
                  className={`h-4 w-4 ${
                    firebaseUser?.emailVerified ? 'text-[#14532D]' : 'text-[#9A3412]'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  Email status:{' '}
                  <strong>{firebaseUser?.emailVerified ? 'Verified' : 'Unverified'}</strong>
                </span>
              </span>
              {!firebaseUser?.emailVerified && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={async () => {
                      await resendVerificationEmail();
                      showToast('Verification email sent', 'Please check your inbox.', 'info');
                    }}
                    className="font-semibold text-[#14532D] hover:underline"
                  >
                    Resend Link
                  </button>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={async () => {
                      const ok = await refreshEmailVerification();
                      showToast(
                        ok ? 'Email verified' : 'Still pending',
                        ok
                          ? 'Your email address is now verified.'
                          : 'Click the link in your email, then refresh again.',
                        ok ? 'success' : 'info'
                      );
                    }}
                    className="font-semibold text-[#14532D] hover:underline"
                  >
                    Refresh
                  </button>
                </div>
              )}
            </div>

            {securityError && (
              <div
                className="rounded-lg border border-[#FCA5A5] bg-[#FEF2F2] px-3.5 py-2.5 text-xs text-[#991B1B]"
                role="alert"
              >
                {securityError}
              </div>
            )}
            {securityMessage && (
              <div
                className="rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3.5 py-2.5 text-xs text-[#14532D]"
                role="status"
              >
                {securityMessage}
              </div>
            )}

            {!firebaseUser ? (
              <div className="space-y-3 text-xs text-[#526058]">
                <p>
                  You are currently browsing in <strong>Unlocked Preview Mode</strong>. Sign in with Firebase Authentication anytime to sync your profile, reports, and password settings across devices.
                </p>
                <button
                  type="button"
                  onClick={() => openSignInPage(activeRole, 'profile')}
                  className="rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534]"
                >
                  Sign In or Create Account
                </button>
              </div>
            ) : isPasswordAccount ? (
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <div>
                  <label htmlFor="new-password" className="block text-xs font-semibold text-[#1C2420]">
                    New Password (min. 8 characters)
                  </label>
                  <div className="relative mt-1">
                    <input
                      id="new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full rounded-lg border border-[#E2E8E4] bg-white py-2 pl-3.5 pr-10 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-2 top-1.5 flex h-7 w-7 items-center justify-center rounded-md text-[#526058] hover:bg-[#F6F8F7]"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="block text-xs font-semibold text-[#1C2420]">
                    Confirm New Password
                  </label>
                  <input
                    id="confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="mt-1 w-full rounded-lg border border-[#E2E8E4] bg-white px-3.5 py-2 text-sm text-[#1C2420] focus:border-[#14532D] focus:outline-none"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void handleSendResetEmail()}
                    className="text-xs font-semibold text-[#14532D] hover:underline"
                  >
                    Send password reset email instead
                  </button>
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="rounded-lg bg-[#14532D] px-4 py-2 text-xs font-semibold text-white hover:bg-[#166534] disabled:opacity-60"
                  >
                    {authBusy ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-3 text-xs text-[#526058]">
                <p>
                  You signed in using Google Authentication. Password management is handled securely through your Google account, or you can send a password reset email to add an email/password credential.
                </p>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleSendResetEmail()}
                  className="rounded-lg border border-[#CFE3D5] bg-[#EDF5F0] px-3.5 py-2 text-xs font-semibold text-[#14532D] hover:bg-[#DCEEE4]"
                >
                  Send Password Reset Email
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="rounded-xl border border-[#E2E8E4] bg-white p-5 flex items-start gap-3">
        <Shield className="h-5 w-5 shrink-0 text-[#14532D] mt-0.5" aria-hidden="true" />
        <div className="space-y-1 text-sm">
          <h2 className="font-semibold text-[#1C2420]">
            Private Profile &amp; Server-Enforced Access Control
          </h2>
          <p className="text-[#526058]">
            Your phone number, locality address, notification preferences, and personal reports are strictly scoped to your Firebase UID through Firestore Security Rules. Other citizens and NGOs cannot access your private profile or reports.
          </p>
        </div>
      </section>
    </div>
  );
};
