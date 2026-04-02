import { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useAccountSnapshot } from '@/hooks/useAccountSnapshot';
import { useExchangeIntegrations } from '@/hooks/useExchangeIntegrations';
import type { ExchangeId } from '@/types/integrations';

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
  const { items: integrations, loading: integrationsLoading, connect, disconnect } = useExchangeIntegrations();
  const { items: snapshots, loading: snapshotLoading, refresh: refreshSnapshots } = useAccountSnapshot();

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
  const riskColor = useMemo(() => {
    if (riskMode === 'Conservative') return 'text-emerald-300';
    if (riskMode === 'Aggressive') return 'text-rose-300';
    return 'text-cyan-300';
  }, [riskMode]);

  return (
    <div className="space-y-3 pb-6 pt-4">
      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-4">
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
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-200">
            Pro
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {authMode === 'supabase' && !authLoading && !user ? (
            <button
              type="button"
              onClick={() => void signInWithGoogle()}
              className="rounded-lg border border-white/[0.1] bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/[0.1]"
            >
              Continue with Google
            </button>
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
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Signals</p>
            <p className="mt-1 text-base font-bold text-white">1,248</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Win rate</p>
            <p className="mt-1 text-base font-bold text-emerald-300">63%</p>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 px-2 py-2.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Avg R:R</p>
            <p className="mt-1 text-base font-bold text-white">1.9</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Trading profile</p>
        <div className="mt-2 grid grid-cols-3 gap-2">
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
                    : 'border-white/[0.08] bg-black/20 text-sigflo-muted hover:text-sigflo-text'
                }`}
              >
                {mode}
              </button>
            );
          })}
        </div>
        <p className={`mt-2 text-xs ${riskColor}`}>Current mode: {riskMode}</p>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Alerts</p>
        <div className="mt-2 space-y-2">
          <ToggleRow label="Push alerts" value={pushAlerts} onChange={setPushAlerts} />
          <ToggleRow label="High-risk setup alerts" value={highRiskAlerts} onChange={setHighRiskAlerts} />
          <ToggleRow label="Daily AI briefing" value={dailyBriefing} onChange={setDailyBriefing} />
        </div>
      </section>

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Exchange connections</p>
        {authMode === 'supabase' && !user && !authLoading ? (
          <p className="mt-2 text-[11px] text-amber-200/90">Sign in with Google to connect Bybit or MEXC.</p>
        ) : null}
        <div className="mt-2 space-y-2">
          {(['bybit', 'mexc'] as ExchangeId[]).map((exchange) => {
            const integration = integrations.find((i) => i.exchange === exchange);
            const snapshot = snapshots.find((s) => s.exchange === exchange);
            const connected = Boolean(integration);
            return (
              <div key={exchange} className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase text-white">{exchange}</p>
                    <p className="text-[11px] text-sigflo-muted">
                      {connected ? `Connected${integration?.lastValidatedAt ? ` · validated ${new Date(integration.lastValidatedAt).toLocaleString()}` : ''}` : 'Not connected'}
                    </p>
                  </div>
                  {connected ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await disconnect(exchange);
                        await refreshSnapshots();
                      }}
                      className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-2 py-1 text-[11px] font-semibold text-rose-200"
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
                      className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-semibold text-cyan-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Connect
                    </button>
                  )}
                </div>
                {snapshot ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Balances</p>
                      <p className="mt-1 text-sm font-semibold text-white">{snapshot.balances.length}</p>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-black/30 p-2">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-sigflo-muted">Positions</p>
                      <p className="mt-1 text-sm font-semibold text-white">{snapshot.positions.length}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {integrationsLoading || snapshotLoading ? <p className="mt-2 text-[11px] text-sigflo-muted">Syncing integrations...</p> : null}
        {connectError ? <p className="mt-2 text-[11px] text-rose-300">{connectError}</p> : null}
      </section>

      {exchangeForm ? (
        <section className="rounded-2xl border border-cyan-400/25 bg-cyan-500/[0.06] p-3">
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

      <section className="rounded-2xl border border-white/[0.06] bg-sigflo-surface p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sigflo-muted">Security</p>
        <div className="mt-2 space-y-2">
          <ActionButton label="Change password" />
          <ActionButton label="Enable 2FA (recommended)" />
          <ActionButton label="Manage sessions" />
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-left"
    >
      <span className="text-sm text-white">{label}</span>
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

function ActionButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="w-full rounded-lg border border-white/[0.08] bg-black/20 px-3 py-2 text-left text-sm text-sigflo-text transition hover:bg-white/[0.04]"
    >
      {label}
    </button>
  );
}
