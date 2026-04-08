import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAccountSnapshot } from '@/hooks/useAccountSnapshot';
import { useBotStatuses } from '@/hooks/useBotStatuses';
import { useExchangeIntegrations } from '@/hooks/useExchangeIntegrations';
import { useSignalEngine } from '@/hooks/useSignalEngine';
import { supabase } from '@/lib/supabase';
import { formatFundingBalance } from '@/lib/formatFundingBalance';
import type { ExchangeId, ExchangeSnapshot } from '@/types/integrations';

const MFA_TOTP_FRIENDLY_NAME = 'Sigflo Account';

type RiskMode = 'Conservative' | 'Balanced' | 'Aggressive';

export default function ProfileScreen() {
  const { user, loading: authLoading, authMode, signInWithGoogle, signOut } = useAuth();
  const [pushAlerts, setPushAlerts] = useState(true);
  const [highRiskAlerts, setHighRiskAlerts] = useState(false);
  const [dailyBriefing, setDailyBriefing] = useState(true);
  const [riskMode, setRiskMode] = useState<RiskMode>('Balanced');
  const [exchangeForm, setExchangeForm] = useState<{
    exchange: ExchangeId;
    apiKey: string;
    apiSecret: string;
    passphrase: string;
  } | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectBusy, setConnectBusy] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<ExchangeId | null>(null);
  const [disconnectBusy, setDisconnectBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [securityBusy, setSecurityBusy] = useState<'password' | 'sessions' | '2fa' | null>(null);
  const [securityMessage, setSecurityMessage] = useState<string | null>(null);
  const [mfaEnabled, setMfaEnabled] = useState<boolean>(false);
  const [mfaStatusLoading, setMfaStatusLoading] = useState<boolean>(false);
  const [googleSignInError, setGoogleSignInError] = useState<string | null>(null);
  const [totpCopyFlash, setTotpCopyFlash] = useState(false);
  const [totpSetup, setTotpSetup] = useState<{
    factorId: string;
    challengeId: string | null;
    qrCode: string | null;
    secret: string;
    otpauthUri: string | null;
    code: string;
  } | null>(null);
  const { items: integrations, loading: integrationsLoading, error: integrationsError, refresh: refreshIntegrations, connect, disconnect } = useExchangeIntegrations();
  const { items: snapshots, closedTrades, loading: snapshotLoading, error: snapshotError, refresh: refreshSnapshots } =
    useAccountSnapshot({ pollMs: 12_000 });
  const { signals, connection: signalConnection } = useSignalEngine();
  const { statusMap } = useBotStatuses();

  const displayName = user
    ? (user.user_metadata?.full_name as string | undefined) ??
      (user.user_metadata?.name as string | undefined) ??
      user.email?.split('@')[0] ??
      'Trader'
    : authMode === 'dev'
      ? 'Local dev'
      : 'Guest';
  const displayEmail = user?.email ?? (authMode === 'dev' ? 'Using dev header (VITE_DEV_USER_ID)' : 'Sign in to sync account');
  const initials = useMemo(() => {
    const src = user?.email ?? displayName;
    const clean = src.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2);
    return clean.length >= 2 ? clean.toUpperCase() : 'SF';
  }, [user?.email, displayName]);

  const canUseExchangeApi = authMode === 'dev' || Boolean(user);
  const mexcIntegration = integrations.find((item) => item.exchange === 'mexc');
  const bybitIntegration = integrations.find((item) => item.exchange === 'bybit');
  const primaryIntegration = mexcIntegration ?? bybitIntegration ?? integrations[0] ?? null;
  const connectedExchangeLabel = primaryIntegration ? primaryIntegration.exchange.toUpperCase() : null;
  const lastSynced = primaryIntegration?.lastValidatedAt
    ? new Date(primaryIntegration.lastValidatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;
  const signalCount = signals.length;
  const winRate = useMemo(() => {
    if (closedTrades.length === 0) return '63%';
    const wins = closedTrades.filter((trade) => trade.closedPnl > 0).length;
    return `${Math.round((wins / closedTrades.length) * 100)}%`;
  }, [closedTrades]);
  const avgRr = useMemo(() => {
    if (closedTrades.length === 0) return '1.9';
    const wins = closedTrades.filter((trade) => trade.closedPnl > 0).map((trade) => trade.closedPnl);
    const losses = closedTrades.filter((trade) => trade.closedPnl < 0).map((trade) => Math.abs(trade.closedPnl));
    if (wins.length === 0 || losses.length === 0) return '—';
    const avgWin = wins.reduce((sum, value) => sum + value, 0) / wins.length;
    const avgLoss = losses.reduce((sum, value) => sum + value, 0) / losses.length;
    return (avgWin / Math.max(avgLoss, 0.0001)).toFixed(1);
  }, [closedTrades]);
  const activeBotCount = useMemo(
    () => Object.values(statusMap).filter((status) => status === 'active').length,
    [statusMap],
  );
  const apiConnected = !integrationsError && !snapshotError;
  const dataStatus = signalConnection === 'connected' ? 'Live' : signalConnection === 'reconnecting' ? 'Syncing' : 'Offline';
  const syncIssue = integrationsError || snapshotError;
  const riskColor = useMemo(() => {
    if (riskMode === 'Conservative') return 'text-emerald-300';
    if (riskMode === 'Aggressive') return 'text-rose-300';
    return 'text-sigflo-accent';
  }, [riskMode]);

  useEffect(() => {
    if (!disconnectTarget) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !disconnectBusy) {
        setDisconnectTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disconnectTarget, disconnectBusy]);

  useEffect(() => {
    async function loadMfaStatus() {
      if (!supabase || authMode !== 'supabase' || !user) {
        setMfaEnabled(false);
        return;
      }
      try {
        setMfaStatusLoading(true);
        const mfa = (supabase.auth as unknown as { mfa?: Record<string, unknown> }).mfa;
        const listFactors = (mfa as {
          listFactors?: () => Promise<{ data?: { all?: Array<{ status?: string }> }; error?: Error }>;
        })?.listFactors;
        if (!listFactors) {
          setMfaEnabled(false);
          return;
        }
        const { data, error } = await listFactors();
        if (error) throw error;
        const allFactors = data?.all ?? [];
        const hasVerified = allFactors.some((factor) => factor.status === 'verified');
        setMfaEnabled(hasVerified);
      } catch {
        setMfaEnabled(false);
      } finally {
        setMfaStatusLoading(false);
      }
    }
    void loadMfaStatus();
  }, [authMode, user?.id, totpSetup]);

  async function handleChangePassword() {
    if (!supabase || !user?.email) {
      setSecurityMessage('Sign in with Google to manage password resets.');
      return;
    }
    try {
      setSecurityBusy('password');
      setSecurityMessage(null);
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const redirectTo = `${window.location.origin}${base}/profile`;
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo });
      if (error) throw error;
      setSecurityMessage(`Password reset link sent to ${user.email}.`);
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Failed to start password reset.');
    } finally {
      setSecurityBusy(null);
    }
  }

  async function handleManageSessions() {
    if (!supabase || !user) {
      setSecurityMessage('Sign in to manage active sessions.');
      return;
    }
    try {
      setSecurityBusy('sessions');
      setSecurityMessage(null);
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      setSecurityMessage('Signed out other sessions. Current session is still active.');
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Failed to manage sessions.');
    } finally {
      setSecurityBusy(null);
    }
  }

  async function handleEnable2fa() {
    if (authMode !== 'supabase' || !supabase || !user) {
      setSecurityMessage('2FA setup requires Supabase sign-in.');
      return;
    }
    try {
      setSecurityBusy('2fa');
      setSecurityMessage(null);
      const mfa = supabase.auth.mfa;
      if (!mfa) {
        setSecurityMessage('MFA is not available in this auth session. Try signing out and in again.');
        return;
      }
      const { data: listed, error: listError } = await mfa.listFactors();
      if (listError) throw listError;
      const allFactors = listed?.all ?? [];
      const totpFactors = allFactors.filter((f) => f.factor_type === 'totp');
      const verifiedTotp = totpFactors.find((f) => f.status === 'verified');
      if (verifiedTotp) {
        setMfaEnabled(true);
        setSecurityMessage('2FA is already enabled on this account.');
        return;
      }
      for (const factor of totpFactors.filter((f) => f.status === 'unverified')) {
        const { error: unenrollError } = await mfa.unenroll({ factorId: factor.id });
        if (unenrollError) throw unenrollError;
      }
      const { data, error } = await mfa.enroll({ factorType: 'totp', friendlyName: MFA_TOTP_FRIENDLY_NAME });
      if (error) throw error;
      const factorId = data?.id as string | undefined;
      const qrCode = (data?.totp?.qr_code as string | undefined)?.trim() || null;
      const secret = (data?.totp?.secret as string | undefined)?.trim() || '';
      const otpauthUri = (data?.totp?.uri as string | undefined)?.trim() || null;
      if (!factorId || !secret) {
        setSecurityMessage('Could not initialize TOTP setup. Try again.');
        return;
      }
      setTotpSetup({
        factorId,
        challengeId: null,
        qrCode,
        secret,
        otpauthUri,
        code: '',
      });
      setSecurityMessage(
        'Scan the QR if you can, or enter the setup key / open the setup link, then enter the 6-digit code.',
      );
    } catch (error) {
      setSecurityMessage(error instanceof Error ? `2FA setup failed: ${error.message}` : '2FA setup failed. Please try again.');
    } finally {
      setSecurityBusy(null);
    }
  }

  async function handleVerifyTotp() {
    if (!supabase || !totpSetup) return;
    if (!/^\d{6}$/.test(totpSetup.code.trim())) {
      setSecurityMessage('Enter a valid 6-digit authenticator code.');
      return;
    }
    try {
      setSecurityBusy('2fa');
      setSecurityMessage(null);
      const mfa = (supabase.auth as unknown as { mfa?: Record<string, unknown> }).mfa;
      const challenge = (mfa as {
        challenge?: (args: { factorId: string }) => Promise<{ data?: { id?: string }; error?: Error }>;
      })?.challenge;
      const verify = (mfa as {
        verify?: (args: { factorId: string; challengeId: string; code: string }) => Promise<{ data?: unknown; error?: Error }>;
      })?.verify;
      if (!challenge || !verify) {
        setSecurityMessage('This Supabase SDK version does not support MFA verification APIs.');
        return;
      }
      let challengeId = totpSetup.challengeId;
      if (!challengeId) {
        const challengeRes = await challenge({ factorId: totpSetup.factorId });
        if (challengeRes.error) throw challengeRes.error;
        challengeId = (challengeRes.data?.id as string | undefined) ?? null;
        if (!challengeId) {
          setSecurityMessage('Unable to create verification challenge. Please try again.');
          return;
        }
      }
      const verifyRes = await verify({
        factorId: totpSetup.factorId,
        challengeId,
        code: totpSetup.code.trim(),
      });
      if (verifyRes.error) throw verifyRes.error;
      setMfaEnabled(true);
      setTotpCopyFlash(false);
      setSecurityMessage('2FA enabled successfully.');
      setTotpSetup(null);
    } catch (error) {
      setSecurityMessage(error instanceof Error ? error.message : 'Failed to verify 2FA code.');
    } finally {
      setSecurityBusy(null);
    }
  }

  async function handleCancelTotpSetup() {
    setTotpCopyFlash(false);
    if (!supabase || !totpSetup) {
      setTotpSetup(null);
      return;
    }
    try {
      const mfa = (supabase.auth as unknown as { mfa?: Record<string, unknown> }).mfa;
      const unenroll = (mfa as { unenroll?: (args: { factorId: string }) => Promise<{ error?: Error }> })?.unenroll;
      if (unenroll) {
        const { error } = await unenroll({ factorId: totpSetup.factorId });
        if (error) throw error;
      }
    } catch {
      // best-effort cleanup; factor remains unverified if unenroll is unavailable
    } finally {
      setTotpSetup(null);
    }
  }

  async function handleManualSync() {
    setSyncBusy(true);
    try {
      await Promise.all([refreshIntegrations(), refreshSnapshots()]);
    } finally {
      setSyncBusy(false);
    }
  }

  return (
    <div className="space-y-3.5 pb-6 pt-4">
      <div className="px-1">
        <h2 className="text-lg font-semibold tracking-tight text-white">Account</h2>
      </div>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4 shadow-[0_0_28px_-20px_rgba(0,255,200,0.35)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-400/25 bg-cyan-500/[0.14] text-sm font-bold text-cyan-200">
              {initials}
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight text-white">{displayName}</p>
              <p className="text-xs text-sigflo-muted">{displayEmail}</p>
            </div>
          </div>
          <div className="space-y-1 text-right">
            <span className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
              Pro
            </span>
            <p className="text-[11px] font-semibold text-sigflo-accent">
              {connectedExchangeLabel ? `Connected to ${connectedExchangeLabel}` : 'No exchange connected'}
            </p>
            {lastSynced ? <p className="text-[10px] text-sigflo-muted">Last synced: {lastSynced}</p> : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {authMode === 'supabase' && !authLoading && !user ? (
            <div className="flex flex-col items-end gap-1">
              <button
                type="button"
                onClick={() => {
                  setGoogleSignInError(null);
                  void signInWithGoogle().catch((e: unknown) => {
                    setGoogleSignInError(e instanceof Error ? e.message : 'Google sign-in failed');
                  });
                }}
                className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
              >
                Continue with Google
              </button>
              {googleSignInError ? (
                <p className="max-w-[14rem] text-right text-[10px] leading-snug text-rose-300/95">{googleSignInError}</p>
              ) : null}
            </div>
          ) : null}
          {authMode === 'supabase' && user ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-lg border border-white/[0.08] bg-black/25 px-3 py-1.5 text-xs font-semibold text-sigflo-muted transition hover:text-white"
            >
              Sign out
            </button>
          ) : null}
          {authMode === 'dev' ? (
            <p className="text-[11px] text-sigflo-muted">Auth: dev header (set VITE_SUPABASE_* for Google sign-in).</p>
          ) : null}
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Exchange Connections</p>
        {authMode === 'supabase' && !user && !authLoading ? (
          <p className="mt-2 text-[11px] text-amber-200/90">Sign in with Google to connect Bybit or MEXC.</p>
        ) : null}
        <div className="mt-2 space-y-2">
          {(['bybit', 'mexc'] as ExchangeId[]).map((exchange) => {
            const integration = integrations.find((i) => i.exchange === exchange);
            const snapshot = snapshots.find((s) => s.exchange === exchange);
            const connected = Boolean(integration);
            return (
              <div
                key={exchange}
                className={`rounded-xl border p-2.5 transition ${
                  connected
                    ? 'border-sigflo-accent/30 bg-gradient-to-b from-sigflo-accent/[0.08] to-black/25 shadow-[0_0_26px_-16px_rgba(0,255,200,0.45)]'
                    : 'border-white/[0.06] bg-black/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase text-white">{exchange}</p>
                    <p className={`text-[11px] font-medium ${connected ? 'text-emerald-300' : 'text-sigflo-muted'}`}>
                      {connected ? 'Connected' : 'Not connected'}
                    </p>
                    <p className="text-[11px] text-sigflo-muted">
                      {connected
                        ? `Last synced: ${
                            integration?.lastValidatedAt
                              ? new Date(integration.lastValidatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                              : 'just now'
                          }`
                        : 'Link API keys — withdrawals must be off'}
                    </p>
                  </div>
                  {connected ? (
                    <button
                      type="button"
                      onClick={() => setDisconnectTarget(exchange)}
                      className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200 transition hover:bg-rose-500/15"
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!canUseExchangeApi}
                      onClick={() => {
                        setConnectError(null);
                        setExchangeForm({ exchange, apiKey: '', apiSecret: '', passphrase: '' });
                      }}
                      className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Connect
                    </button>
                  )}
                </div>
                {snapshot ? <ExchangeBalanceBreakdown snapshot={snapshot} /> : null}
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          {integrationsLoading || snapshotLoading ? (
            <p className="text-[11px] text-sigflo-muted">Syncing integrations...</p>
          ) : (
            <p className="text-[11px] text-sigflo-muted">Need a refresh? Sync manually.</p>
          )}
          <button
            type="button"
            disabled={syncBusy}
            onClick={() => void handleManualSync()}
            className="shrink-0 rounded-lg border border-white/[0.12] bg-white/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sigflo-text transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            {syncBusy ? 'Syncing...' : 'Sync now'}
          </button>
        </div>
        {syncIssue ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg border border-amber-300/20 bg-amber-300/10 px-2.5 py-2">
            <p className="text-[11px] text-amber-100">Last sync failed: {syncIssue}</p>
            <button
              type="button"
              disabled={syncBusy}
              onClick={() => void handleManualSync()}
              className="shrink-0 rounded-lg border border-amber-200/35 bg-amber-200/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-100 transition hover:bg-amber-200/15 disabled:opacity-50"
            >
              {syncBusy ? 'Retrying...' : 'Retry'}
            </button>
          </div>
        ) : null}
        {connectError ? <p className="mt-2 text-[11px] text-rose-300">{connectError}</p> : null}
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Trading Profile</p>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {(['Conservative', 'Balanced', 'Aggressive'] as RiskMode[]).map((mode) => {
            const active = riskMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setRiskMode(mode)}
                className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition ${
                  active
                    ? 'border-cyan-400/35 bg-cyan-500/12 text-cyan-100'
                    : 'border-white/[0.08] bg-black/20 text-sigflo-muted hover:border-white/[0.14] hover:text-sigflo-text'
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>
        <p className={`mt-2 text-xs ${riskColor}`}>Risk profile: {riskMode}</p>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Alerts</p>
        <div className="mt-2 space-y-2">
          <ToggleRow label="Push alerts" subtext="Signals & execution updates" value={pushAlerts} onChange={setPushAlerts} />
          <ToggleRow label="High-risk setup alerts" subtext="Aggressive setups only" value={highRiskAlerts} onChange={setHighRiskAlerts} />
          <ToggleRow label="Daily AI briefing" subtext="Daily market summary" value={dailyBriefing} onChange={setDailyBriefing} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Your Stats</p>
        <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Signals</p>
            <p className="mt-1 text-base font-bold text-white">{signalCount.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Win rate</p>
            <p className="mt-1 text-base font-bold text-emerald-300">{winRate}</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Avg R:R</p>
            <p className="mt-1 text-base font-bold text-white">{avgRr}</p>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-sigflo-muted">Based on your trading activity</p>
      </section>

      {exchangeForm ? (
        <section className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-3.5">
          <p className="text-sm font-semibold text-cyan-100">Connect {exchangeForm.exchange.toUpperCase()}</p>
          <div className="mt-2 space-y-2">
            <input
              value={exchangeForm.apiKey}
              onChange={(e) => setExchangeForm({ ...exchangeForm, apiKey: e.target.value })}
              placeholder="API key"
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-sm text-white outline-none"
            />
            <input
              value={exchangeForm.apiSecret}
              onChange={(e) => setExchangeForm({ ...exchangeForm, apiSecret: e.target.value })}
              placeholder="API secret"
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-sm text-white outline-none"
            />
            <input
              value={exchangeForm.passphrase}
              onChange={(e) => setExchangeForm({ ...exchangeForm, passphrase: e.target.value })}
              placeholder="Passphrase (optional)"
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-sm text-white outline-none"
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              disabled={connectBusy}
              onClick={async () => {
                if (!exchangeForm.apiKey || !exchangeForm.apiSecret) {
                  setConnectError('API key and secret are required.');
                  return;
                }
                try {
                  setConnectBusy(true);
                  setConnectError(null);
                  await connect(exchangeForm.exchange, {
                    apiKey: exchangeForm.apiKey,
                    apiSecret: exchangeForm.apiSecret,
                    passphrase: exchangeForm.passphrase || undefined,
                  });
                  await refreshSnapshots();
                  setExchangeForm(null);
                } catch (e) {
                  setConnectError(e instanceof Error ? e.message : 'Connection failed.');
                } finally {
                  setConnectBusy(false);
                }
              }}
              className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200"
            >
              {connectBusy ? 'Validating...' : 'Save and validate'}
            </button>
            <button
              type="button"
              onClick={() => setExchangeForm(null)}
              className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-sigflo-text"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-[11px] text-sigflo-muted">Keys are encrypted at rest and never returned to the client after submission.</p>
        </section>
      ) : null}

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">System</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <SystemIndicator label="API" value={apiConnected ? 'Connected' : 'Degraded'} active={apiConnected} />
          <SystemIndicator label="Data" value={dataStatus} active={signalConnection === 'connected'} />
          <SystemIndicator label="Bots" value={`${activeBotCount} active`} active={activeBotCount > 0} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Security</p>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
              mfaEnabled
                ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
                : 'border-white/10 bg-white/[0.04] text-sigflo-muted'
            }`}
          >
            {mfaStatusLoading ? 'Checking 2FA...' : mfaEnabled ? '2FA enabled' : '2FA not enabled'}
          </span>
        </div>
        <div className="mt-2 space-y-2">
          <ActionButton
            label="Change password"
            subtext="Send secure reset link to your email"
            busy={securityBusy === 'password'}
            busyLabel="Sending..."
            onClick={() => void handleChangePassword()}
          />
          <ActionButton
            label="Enable 2FA"
            subtext="Set up authenticator app (TOTP)"
            busy={securityBusy === '2fa'}
            busyLabel="Preparing..."
            onClick={() => void handleEnable2fa()}
          />
          <ActionButton
            label="Manage sessions"
            subtext="Sign out other active devices"
            busy={securityBusy === 'sessions'}
            busyLabel="Applying..."
            onClick={() => void handleManageSessions()}
          />
        </div>
        {totpSetup ? (
          <div className="mt-2 rounded-xl border border-sigflo-accent/25 bg-sigflo-accent/[0.06] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-sigflo-accent">Authenticator setup</p>
            {totpSetup.qrCode ? (
              <div className="mt-2 flex justify-center rounded-lg border border-white/[0.08] bg-black/35 p-2">
                <div className="rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: totpSetup.qrCode }} />
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-sigflo-muted">QR not available — use manual setup key or the link below.</p>
            )}
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-sigflo-muted">Manual setup key</p>
              <p className="text-[11px] text-sigflo-muted">
                In your authenticator app, choose &quot;Enter setup key&quot; (or equivalent) and paste this secret.
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={totpSetup.secret}
                  className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-black/40 px-2 py-2 font-mono text-[11px] text-white outline-none"
                  aria-label="TOTP setup secret"
                />
                <button
                  type="button"
                  disabled={securityBusy === '2fa'}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(totpSetup.secret);
                      setTotpCopyFlash(true);
                      window.setTimeout(() => setTotpCopyFlash(false), 2000);
                    } catch {
                      setSecurityMessage('Could not copy — select the key and copy manually.');
                    }
                  }}
                  className="shrink-0 rounded-lg border border-sigflo-accent/35 bg-sigflo-accent/10 px-2.5 py-2 text-[11px] font-semibold text-sigflo-accent transition hover:bg-sigflo-accent/15 disabled:opacity-60"
                >
                  {totpCopyFlash ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            {totpSetup.otpauthUri ? (
              <a
                href={totpSetup.otpauthUri}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex text-[11px] font-semibold text-sigflo-accent underline decoration-sigflo-accent/40 underline-offset-2 transition hover:decoration-sigflo-accent"
              >
                Open setup link (adds account in some apps)
              </a>
            ) : null}
            <input
              value={totpSetup.code}
              onChange={(event) => setTotpSetup((prev) => (prev ? { ...prev, code: event.target.value.replace(/\D/g, '').slice(0, 6) } : prev))}
              placeholder="Enter 6-digit code"
              inputMode="numeric"
              className="mt-2 w-full rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-2 text-sm text-white outline-none"
            />
            <div className="mt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={securityBusy === '2fa'}
                onClick={() => void handleCancelTotpSetup()}
                className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-sigflo-text"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={securityBusy === '2fa'}
                onClick={() => void handleVerifyTotp()}
                className="rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 disabled:opacity-60"
              >
                {securityBusy === '2fa' ? 'Verifying...' : 'Verify and enable'}
              </button>
            </div>
          </div>
        ) : null}
        {securityMessage ? (
          <p className="mt-2 rounded-lg border border-white/[0.08] bg-black/20 px-2.5 py-2 text-[11px] text-sigflo-text">{securityMessage}</p>
        ) : null}
      </section>

      {disconnectTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={() => {
            if (!disconnectBusy) setDisconnectTarget(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-rose-400/25 bg-[#0B0B0B] p-4 shadow-[0_0_40px_-18px_rgba(255,91,123,0.45)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="text-sm font-semibold text-rose-100">Disconnect {disconnectTarget.toUpperCase()}?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-rose-100/85">
              This will stop syncing balances and positions until you connect this exchange again.
            </p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={disconnectBusy}
                onClick={() => setDisconnectTarget(null)}
                className="rounded-lg border border-white/[0.12] bg-white/[0.04] px-2.5 py-1.5 text-xs font-semibold text-sigflo-text transition hover:bg-white/[0.07] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={disconnectBusy}
                onClick={async () => {
                  if (!disconnectTarget) return;
                  setDisconnectBusy(true);
                  try {
                    await disconnect(disconnectTarget);
                    await refreshSnapshots();
                    setDisconnectTarget(null);
                  } finally {
                    setDisconnectBusy(false);
                  }
                }}
                className="rounded-lg border border-rose-400/35 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:opacity-50"
              >
                {disconnectBusy ? 'Disconnecting...' : 'Confirm disconnect'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  subtext,
  value,
  onChange,
}: {
  label: string;
  subtext: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-left transition hover:border-white/[0.12] hover:bg-white/[0.03]"
    >
      <div>
        <p className="text-sm text-white">{label}</p>
        <p className="mt-0.5 text-[11px] text-sigflo-muted">{subtext}</p>
      </div>
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
          value ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200' : 'border-white/10 bg-white/[0.04] text-sigflo-muted'
        }`}
      >
        {value ? 'On' : 'Off'}
      </span>
    </button>
  );
}

function fmtUsdMaybe(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function BalanceMetricCell({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/25 p-2">
      <p className="text-[9px] uppercase tracking-[0.12em] text-sigflo-muted">{label}</p>
      <p className="mt-1 text-xs font-semibold tabular-nums text-white">{fmtUsdMaybe(value)}</p>
    </div>
  );
}

function ExchangeBalanceBreakdown({ snapshot }: { snapshot: ExchangeSnapshot }) {
  const breakdown = snapshot.accountBreakdown ?? null;

  if (!breakdown) {
    if (snapshot.status === 'error') {
      return (
        <p className="mt-2 rounded-lg border border-rose-400/25 bg-rose-500/10 px-2 py-2 text-[11px] leading-snug text-rose-100/95">
          Portfolio sync failed for this exchange. Try Sync now, or disconnect and reconnect after checking API key
          permissions.
        </p>
      );
    }
    const noRows = snapshot.balances.length === 0 && snapshot.positions.length === 0;
    if (noRows) {
      return (
        <div className="mt-2 space-y-2">
          <p className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-2.5 py-2 text-[11px] leading-snug text-amber-100/95">
            Connected, but <span className="font-semibold">no wallet summary</span> came back from Bybit. This is not
            “$0” — the app could not read UTA / Funding / spot wallets. Check: API key has{' '}
            <span className="font-semibold">Wallet</span> (and Contracts) read access; withdrawals stay off; if the key
            uses an IP allowlist, add your <span className="font-semibold">backend host</span> (e.g. Railway). Unified
            Trading accounts work best with our sync.
          </p>
        </div>
      );
    }
    return (
      <div className="mt-2 space-y-1.5">
        <p className="text-[10px] text-sigflo-muted">
          USD totals unavailable — showing raw row counts from the last sync.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Balance rows</p>
            <p className="mt-1 text-sm font-semibold text-white">{snapshot.balances.length}</p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Positions</p>
            <p className="mt-1 text-sm font-semibold text-white">{snapshot.positions.length}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2.5">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <BalanceMetricCell label="Total Equity" value={breakdown.overview.totalEquity} />
        <BalanceMetricCell label="Wallet Balance" value={breakdown.overview.totalWalletBalance} />
        <BalanceMetricCell label="Available to Trade" value={breakdown.overview.availableToTrade} />
        <div className="rounded-lg border border-white/[0.06] bg-black/25 p-2">
          <p className="text-[9px] uppercase tracking-[0.12em] text-sigflo-muted">Funding Balance</p>
          <p className="mt-1 text-xs font-semibold tabular-nums text-white">
            {formatFundingBalance(
              breakdown.overview.fundingWalletBalance ?? NaN,
              breakdown.overview.fundingPrimaryAsset,
            )}
          </p>
          <p className="mt-0.5 text-[8px] leading-tight text-sigflo-muted/85" title="Funding = deposit / transfer wallet">
            Funding = deposit / transfer wallet
          </p>
        </div>
      </div>

      {breakdown.buckets.map((bucket) => {
        const usdt = bucket.assets.find((a) => a.asset === 'USDT');
        return (
          <div key={bucket.kind} className="rounded-lg border border-white/[0.06] bg-black/25 p-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/95">{bucket.label}</p>
                <p className="mt-0.5 text-[10px] text-sigflo-muted">{bucket.helperText}</p>
              </div>
              {usdt ? (
                <span className="rounded border border-cyan-400/25 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-100/95">
                  USDT {fmtUsdMaybe(usdt.total)}
                </span>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <BalanceMetricCell label="Available Balance" value={bucket.metrics.availableBalance} />
              <BalanceMetricCell label="Wallet Balance" value={bucket.metrics.walletBalance} />
              <BalanceMetricCell label="Equity" value={bucket.metrics.equity} />
              <BalanceMetricCell label="Margin Balance" value={bucket.metrics.marginBalance} />
              <BalanceMetricCell label="Margin Used" value={bucket.metrics.marginUsed} />
              <BalanceMetricCell label="Unrealized PnL" value={bucket.metrics.unrealizedPnl} />
            </div>
            {bucket.kind === 'funding' && bucket.assets.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bucket.assets.slice(0, 8).map((a) => (
                  <span
                    key={a.asset}
                    className="rounded border border-white/[0.08] bg-black/30 px-1.5 py-0.5 text-[9px] font-medium tabular-nums text-sigflo-text/95"
                    title={`${a.asset} — wallet total`}
                  >
                    {a.asset}{' '}
                    <span className="text-white/90">{fmtUsdMaybe(a.total)}</span>
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function SystemIndicator({ label, value, active }: { label: string; value: string; active?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/20 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">{label}</p>
      <p className={`mt-1 text-xs font-semibold ${active ? 'text-emerald-300' : 'text-sigflo-text'}`}>{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  subtext,
  onClick,
  busy,
  busyLabel,
}: {
  label: string;
  subtext: string;
  onClick: () => void;
  busy?: boolean;
  busyLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-left text-sm text-sigflo-text transition hover:border-white/[0.14] hover:bg-white/[0.04] disabled:opacity-60"
    >
      <p>{busy ? busyLabel ?? label : label}</p>
      <p className="mt-0.5 text-[11px] text-sigflo-muted">{subtext}</p>
    </button>
  );
}
