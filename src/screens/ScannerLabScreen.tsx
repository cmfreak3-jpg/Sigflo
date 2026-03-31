import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { breakoutScenario5m, overextendedScenario5m, pullbackScenario5m } from '@/data/mockCandles';
import {
  deriveIndicators,
  detectBreakoutPressure,
  detectOverextendedWarning,
  detectPullbackContinuation,
  type DetectorEvaluation,
} from '@/lib/detectors';
import type { DetectorOptions } from '@/lib/detectors';
import { calculateSetupScore, getSetupScoreLabel } from '@/lib/setupScore';
import {
  createPlaybackSession,
  resetPlayback,
  setScenario as setPlaybackScenario,
  startAutoplay,
  stepForward,
  type PlaybackSession,
  type PlaybackStepResult,
  type ScenarioKey,
} from '@/lib/mockPlayback';

const SCENARIOS: Record<ScenarioKey, { label: string }> = {
  breakout: { label: 'Breakout' },
  pullback: { label: 'Pullback' },
  overextended: { label: 'Overextended' },
};
const SCENARIO_CANDLES: Record<ScenarioKey, typeof breakoutScenario5m> = {
  breakout: breakoutScenario5m,
  pullback: pullbackScenario5m,
  overextended: overextendedScenario5m,
};

function formatTs(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function nextNeedFromReasons(reasons: string[]): string {
  const text = reasons.join(' ').toLowerCase();
  if (text.includes('volume')) return 'Needs volume expansion to trigger.';
  if (text.includes('pullback depth')) return 'Waiting for pullback depth to complete.';
  if (text.includes('rsi')) return 'Needs RSI alignment before trigger.';
  if (text.includes('range') || text.includes('compressed')) return 'Needs tighter range compression.';
  if (text.includes('distance to breakout')) return 'Needs price closer to breakout zone.';
  if (text.includes('momentum')) return 'Needs stronger momentum confirmation.';
  if (text.includes('resistance')) return 'Needs cleaner resistance interaction.';
  if (text.includes('not closed')) return 'Waiting for closed candle confirmation.';
  if (text.includes('need at least')) return 'Waiting for enough candles to evaluate setup.';
  return 'Needs more conditions to align before trigger.';
}

function statusFromEvaluation(r: DetectorEvaluation, score: number | null) {
  if (r.triggered) return 'triggered' as const;
  const isWaiting = r.reasons.some((reason) => reason.includes('Need at least') || reason.includes('not closed'));
  if (isWaiting) return 'invalid' as const;
  const failCount = r.reasons.length;
  const potential = score ?? 0;
  if (failCount <= 1 || potential >= 70) return 'close' as const;
  if (failCount <= 3 || potential >= 55) return 'developing' as const;
  return 'invalid' as const;
}

export function ScannerLabScreen() {
  const navigate = useNavigate();
  const [scenario, setScenario] = useState<ScenarioKey>('breakout');
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(700);
  const [session, setSession] = useState<PlaybackSession>(() => createPlaybackSession({ scenario: 'breakout' }));
  const [lastStep, setLastStep] = useState<PlaybackStepResult | null>(session.lastStep);
  const stopAutoRef = useRef<(() => void) | null>(null);
  const prevDetectorScoresRef = useRef<Record<string, number>>({});
  const prevSetupScoreRef = useRef<number | null>(null);

  useEffect(() => {
    if (stopAutoRef.current) stopAutoRef.current();
    const next = setPlaybackScenario(session, scenario);
    setSession(next);
    setLastStep(next.lastStep);
    setIsPlaying(false);
  }, [scenario]);

  useEffect(() => {
    if (!isPlaying) {
      if (stopAutoRef.current) stopAutoRef.current();
      stopAutoRef.current = null;
      return undefined;
    }
    stopAutoRef.current = startAutoplay(
      session,
      (next) => {
        setSession(next);
        const step = next.lastStep;
        if (!step) return;
        setLastStep(step);
        if (step.newSignals.length > 0) {
          for (const s of step.newSignals) {
            console.log(
              `[ScannerLab] ${formatTs(s.timestamp)} ${s.symbol} ${s.setupType} detected | Setup Score: ${s.setupScore}`
            );
            console.log('[ScannerLab] Breakdown:', s.scoreBreakdown);
          }
        }
        if (step.done) setIsPlaying(false);
      },
      speedMs
    );
    return () => {
      if (stopAutoRef.current) stopAutoRef.current();
      stopAutoRef.current = null;
    };
  }, [isPlaying, speedMs, session]);

  const latestEvaluations = useMemo(() => {
    const rows = lastStep?.detectorEvaluations ?? [];
    return rows.map((r) => ({
      setupType: r.setupType,
      reasons: r.reasons.length > 0 ? r.reasons : ['Conditions not met'],
      score: r.scoreBreakdown ? calculateSetupScore(r.scoreBreakdown) : null,
      facts: r.explanationFacts,
    })).map((row) => {
      const prevScore = prevDetectorScoresRef.current[row.setupType];
      const trend =
        row.score == null || prevScore == null
          ? 'flat'
          : row.score > prevScore
            ? 'rising'
            : row.score < prevScore
              ? 'weakening'
              : 'flat';
      const raw = rows.find((r) => r.setupType === row.setupType);
      const status = raw ? statusFromEvaluation(raw, row.score) : 'invalid';
      if (status === 'triggered') return { ...row, status, nextNeed: 'In play now.', trend };
      return { ...row, status, nextNeed: nextNeedFromReasons(row.reasons), trend };
    });
  }, [lastStep]);

  const fireMoment = useMemo(() => {
    if (!lastStep || lastStep.newSignals.length === 0) return null;
    return {
      candleIndex: lastStep.index,
      setupTypes: new Set(lastStep.newSignals.map((s) => s.setupType)),
    };
  }, [lastStep]);

  const topPanel = useMemo(() => {
    if (lastStep) {
      return {
        price: lastStep.currentCandle.close,
        rsi: lastStep.indicators.rsi14,
        atr: lastStep.indicators.atr14,
        ema20: lastStep.indicators.ema20,
        ema50: lastStep.indicators.ema50,
      };
    }
    const candles = SCENARIO_CANDLES[scenario];
    const seed = candles.slice(0, Math.min(6, candles.length));
    const indicators = deriveIndicators(seed);
    const price = seed.at(-1)?.close ?? 0;
    return {
      price,
      rsi: indicators.rsi14,
      atr: indicators.atr14,
      ema20: indicators.ema20,
      ema50: indicators.ema50,
    };
  }, [lastStep, scenario]);

  const currentSetup = useMemo(() => {
    const evals = lastStep?.detectorEvaluations ?? [];
    const scored = evals
      .map((e) => {
        if (!e.scoreBreakdown) return null;
        const raw = calculateSetupScore(e.scoreBreakdown);
        const status = statusFromEvaluation(e, raw);
        const missing = e.reasons.length;
        // Readiness-adjusted potential:
        // non-triggered detectors lose points per missing condition so one inflated raw score
        // doesn't pin "Current Setup Score" unrealistically high.
        const adjusted = status === 'triggered' ? raw : Math.max(0, raw - missing * 6);
        const priority = status === 'triggered' ? 3 : status === 'close' ? 2 : status === 'developing' ? 1 : 0;
        return { raw, adjusted, priority };
      })
      .filter((x): x is { raw: number; adjusted: number; priority: number } => Boolean(x));
    if (scored.length === 0) return null;
    const picked = [...scored].sort((a, b) => b.priority - a.priority || b.adjusted - a.adjusted)[0];
    const score = Math.round(picked.adjusted);
    const prev = prevSetupScoreRef.current;
    const trend =
      prev == null ? 'flat' : score > prev ? 'rising' : score < prev ? 'weakening' : 'flat';
    return {
      score,
      label: getSetupScoreLabel(score),
      trend,
    };
  }, [lastStep]);

  const usefulnessMetrics = useMemo(() => {
    const candles = SCENARIO_CANDLES[scenario];
    const upto = session.state.index;
    const detectorKeys = ['breakout', 'pullback', 'overextended'] as const;
    const LOOKAHEAD_BARS = 5;
    const firstDeveloping: Record<string, number | null> = {
      breakout: null,
      pullback: null,
      overextended: null,
    };
    const leadLagSamples: Record<string, number[]> = {
      breakout: [],
      pullback: [],
      overextended: [],
    };

    for (let i = 1; i <= upto; i += 1) {
      const visible = candles.slice(0, i);
      const indicators = deriveIndicators(visible);
      const evaluations = [
        detectBreakoutPressure(visible, indicators, session.config.detectorOptions),
        detectPullbackContinuation(visible, indicators, session.config.detectorOptions),
        detectOverextendedWarning(visible, indicators, session.config.detectorOptions),
      ];
      for (const ev of evaluations) {
        const score = ev.scoreBreakdown ? calculateSetupScore(ev.scoreBreakdown) : null;
        const status = statusFromEvaluation(ev, score);
        if (status === 'developing' && firstDeveloping[ev.setupType] == null) {
          firstDeveloping[ev.setupType] = i;
        }
        if (status === 'triggered') {
          const first = firstDeveloping[ev.setupType];
          if (first != null) leadLagSamples[ev.setupType].push(i - first);
          firstDeveloping[ev.setupType] = null;
        }
      }
    }

    const triggerByType = detectorKeys.reduce(
      (acc, key) => {
        acc[key] = session.state.emittedSignals.filter((s) => s.setupType === key);
        return acc;
      },
      {} as Record<(typeof detectorKeys)[number], typeof session.state.emittedSignals>
    );

    const out = detectorKeys.map((key) => {
      const signals = triggerByType[key];
      const density = upto > 0 ? (signals.length / upto) * 100 : 0;
      const lags = leadLagSamples[key];
      const avgLag = lags.length > 0 ? lags.reduce((a, b) => a + b, 0) / lags.length : null;
      const favorableMoves: number[] = [];
      const adverseMoves: number[] = [];
      const closeAfterNMoves: number[] = [];
      for (const s of signals) {
        const triggerIdx = s.candleIndex - 1;
        const futureIdx = Math.min(candles.length - 1, triggerIdx + LOOKAHEAD_BARS);
        if (triggerIdx < 0 || futureIdx <= triggerIdx) continue;
        const entry = candles[triggerIdx].close;
        const window = candles.slice(triggerIdx + 1, futureIdx + 1);
        if (window.length === 0) continue;
        const atrAtTrigger = deriveIndicators(candles.slice(0, triggerIdx + 1)).atr14;
        const dir = s.directionBias === 'short' ? -1 : 1;
        const maxHigh = window.reduce((m, c) => Math.max(m, c.high), window[0].high);
        const minLow = window.reduce((m, c) => Math.min(m, c.low), window[0].low);
        const closeAfterN = window.at(-1)?.close ?? entry;
        const norm = Math.max(0.000001, atrAtTrigger);
        const favorableAtr = dir === 1 ? (maxHigh - entry) / norm : (entry - minLow) / norm;
        const adverseAtr = dir === 1 ? (entry - minLow) / norm : (maxHigh - entry) / norm;
        const closeAfterNAtr = ((closeAfterN - entry) * dir) / norm;
        favorableMoves.push(favorableAtr);
        adverseMoves.push(adverseAtr);
        closeAfterNMoves.push(closeAfterNAtr);
      }
      const avgFollow =
        closeAfterNMoves.length > 0 ? closeAfterNMoves.reduce((a, b) => a + b, 0) / closeAfterNMoves.length : null;
      const avgAdverse =
        adverseMoves.length > 0 ? adverseMoves.reduce((a, b) => a + b, 0) / adverseMoves.length : null;
      const avgFavorable =
        favorableMoves.length > 0 ? favorableMoves.reduce((a, b) => a + b, 0) / favorableMoves.length : null;
      return {
        key,
        leadLag: avgLag,
        density,
        avgFavorableAtr: avgFavorable,
        avgAdverseAtr: avgAdverse,
        followThroughAtr: avgFollow,
        samples: signals.length,
      };
    });

    return out;
  }, [scenario, session.config.detectorOptions, session.state.emittedSignals, session.state.index]);

  useEffect(() => {
    const nextMap: Record<string, number> = {};
    for (const row of latestEvaluations) {
      if (row.score != null) nextMap[row.setupType] = row.score;
    }
    prevDetectorScoresRef.current = nextMap;
  }, [latestEvaluations]);

  useEffect(() => {
    prevSetupScoreRef.current = currentSetup?.score ?? null;
  }, [currentSetup?.score]);

  const handleStep = () => {
    const next = stepForward(session);
    setSession(next);
    const step = next.lastStep;
    if (step) {
      setLastStep(step);
      for (const s of step.newSignals) {
        console.log(`[ScannerLab] ${formatTs(s.timestamp)} ${s.symbol} ${s.setupType} detected`);
      }
    }
  };

  const handleReset = () => {
    const next = resetPlayback(session);
    setSession(next);
    setLastStep(next.lastStep);
    setIsPlaying(false);
  };

  const applyDetectorOptions = (patch: Partial<DetectorOptions>) => {
    setIsPlaying(false);
    setSession((prev) => {
      const next = {
        ...prev,
        config: {
          ...prev.config,
          detectorOptions: {
            ...prev.config.detectorOptions,
            ...patch,
          },
        },
      };
      const reset = resetPlayback(next);
      setLastStep(reset.lastStep);
      return reset;
    });
  };

  return (
    <div className="space-y-4 pb-6 pt-4">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-sigflo-muted transition hover:bg-white/[0.08] hover:text-white"
            aria-label="Go back"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-400/85">Scanner Lab</p>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Playback sandbox</h1>
        <p className="text-sm text-sigflo-muted">Replay crafted scenarios candle-by-candle and inspect detector logic.</p>
      </header>

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold text-white">How to use this lab</h2>
        <p className="text-xs text-sigflo-muted">1) Pick a scenario. 2) Press Step or Play. 3) Watch detector status, setup score, and signal history.</p>
        <p className="text-xs text-sigflo-muted">Use Lab Controls to toggle RSI/volume filters and compression, then replay from candle 0 and compare timing + frequency.</p>
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-medium text-sigflo-muted" htmlFor="scenario">
            Scenario
          </label>
          <select
            id="scenario"
            value={scenario}
            onChange={(e) => setScenario(e.target.value as ScenarioKey)}
            className="rounded-lg border border-sigflo-border bg-sigflo-bg px-2 py-1 text-xs text-white"
          >
            {Object.entries(SCENARIOS).map(([key, s]) => (
              <option key={key} value={key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={() => setIsPlaying(true)} className="rounded-lg bg-emerald-500/20 px-2 py-2 text-xs text-emerald-200">
            Play
          </button>
          <button type="button" onClick={() => setIsPlaying(false)} className="rounded-lg bg-white/[0.06] px-2 py-2 text-xs text-white">
            Pause
          </button>
          <button type="button" onClick={handleStep} className="rounded-lg bg-cyan-500/20 px-2 py-2 text-xs text-cyan-200">
            Step
          </button>
          <button type="button" onClick={handleReset} className="rounded-lg bg-white/[0.06] px-2 py-2 text-xs text-white">
            Reset
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="text-sigflo-muted">Speed</span>
          <select
            value={String(speedMs)}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
            className="rounded-lg border border-sigflo-border bg-sigflo-bg px-2 py-1 text-xs text-white"
          >
            <option value="1000">1.0s</option>
            <option value="700">0.7s</option>
            <option value="500">0.5s</option>
          </select>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h2 className="text-sm font-semibold text-white">Lab Controls</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => applyDetectorOptions({ useVolumeFilter: !session.config.detectorOptions.useVolumeFilter })}
            className={`rounded-lg border px-2 py-2 ${
              session.config.detectorOptions.useVolumeFilter
                ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                : 'border-sigflo-border bg-sigflo-bg/50 text-sigflo-muted'
            }`}
          >
            Volume filter {session.config.detectorOptions.useVolumeFilter ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            onClick={() => applyDetectorOptions({ useRsiFilter: !session.config.detectorOptions.useRsiFilter })}
            className={`rounded-lg border px-2 py-2 ${
              session.config.detectorOptions.useRsiFilter
                ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                : 'border-sigflo-border bg-sigflo-bg/50 text-sigflo-muted'
            }`}
          >
            RSI filter {session.config.detectorOptions.useRsiFilter ? 'ON' : 'OFF'}
          </button>
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-sigflo-muted">Compression threshold</span>
            <span className="text-white">{session.config.detectorOptions.compressionThreshold.toFixed(2)}</span>
          </div>
          <input
            type="range"
            min="0.8"
            max="2.2"
            step="0.05"
            value={session.config.detectorOptions.compressionThreshold}
            onChange={(e) => applyDetectorOptions({ compressionThreshold: Number(e.target.value) })}
            className="w-full accent-cyan-400"
          />
        </div>
      </Card>

      <Card className="p-4">
        <p className="text-xs text-sigflo-muted">
          {lastStep
            ? `Candle ${lastStep.index}/${session.state.total} • ${formatTs(lastStep.currentCandle.timestamp)}`
            : `Candle 0/${session.state.total}`}
        </p>
        {fireMoment ? (
          <div className="mt-2 inline-flex items-center rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold tracking-wide text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.25)]">
            FIRE MOMENT • Candle {fireMoment.candleIndex}
          </div>
        ) : null}
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-sigflo-border bg-sigflo-bg/50 p-2">
            <p className="text-sigflo-muted">Price</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{Math.round(topPanel.price).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-sigflo-border bg-sigflo-bg/50 p-2">
            <p className="text-sigflo-muted">RSI</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{Math.round(topPanel.rsi)}</p>
          </div>
          <div className="rounded-lg border border-sigflo-border bg-sigflo-bg/50 p-2">
            <p className="text-sigflo-muted">ATR</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{Math.round(topPanel.atr).toLocaleString()}</p>
          </div>
          <div className="rounded-lg border border-sigflo-border bg-sigflo-bg/50 p-2">
            <p className="text-sigflo-muted">EMA20 / EMA50</p>
            <p className="mt-0.5 text-sm font-semibold text-white">
              {Math.round(topPanel.ema20).toLocaleString()} / {Math.round(topPanel.ema50).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="mt-2 rounded-lg border border-sigflo-border bg-sigflo-bg/50 p-2">
          <p className="text-sigflo-muted">Current Setup Score</p>
          <p className="mt-0.5 text-sm font-semibold text-white">
            {currentSetup ? currentSetup.score : '-'}{' '}
            {currentSetup?.trend === 'rising' ? '↑' : currentSetup?.trend === 'weakening' ? '↓' : '→'}
          </p>
          <p className="text-xs text-cyan-200">
            {currentSetup
              ? `${currentSetup.label} ${currentSetup.trend === 'rising' ? '↑' : currentSetup.trend === 'weakening' ? '↓' : ''}`.trim()
              : 'Builds as conditions align'}
          </p>
        </div>
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold text-white">Detector status</h2>
        {latestEvaluations.length === 0 ? (
          <p className="text-xs text-sigflo-muted">Step through candles to evaluate detectors.</p>
        ) : (
          latestEvaluations.map((row) => (
            <div
              key={row.setupType}
              className={`rounded-xl border px-3 py-2 transition ${
                fireMoment?.setupTypes.has(row.setupType)
                  ? 'border-emerald-300/60 bg-emerald-500/10 shadow-[0_0_18px_rgba(16,185,129,0.35)]'
                  : 'border-sigflo-border bg-sigflo-bg/50'
              }`}
            >
              <p className="text-xs font-semibold capitalize text-white">{row.setupType} detector</p>
              <p className="mt-1 text-xs text-white">
                Status:{' '}
                <span
                  className={
                    row.status === 'triggered'
                      ? 'text-emerald-300'
                      : row.status === 'close'
                        ? 'text-amber-300'
                        : row.status === 'developing'
                          ? 'text-cyan-300'
                          : 'text-sigflo-muted'
                  }
                >
                  {row.status === 'triggered'
                    ? '✅ In play'
                    : row.status === 'close'
                      ? '⚠️ Close'
                      : row.status === 'developing'
                        ? '🔄 Developing'
                        : '❌ Invalid'}
                </span>
              </p>
              <p className="mt-1 text-xs text-white">
                Score: {row.score ?? '-'} / Trigger: {session.config.minSetupScore}{' '}
                {row.trend === 'rising' ? '↑' : row.trend === 'weakening' ? '↓' : '→'}
              </p>
              {row.setupType === 'breakout' ? (
                <p className="mt-1 text-[11px] text-sigflo-muted">
                  Compression: {String(row.facts?.compressionRatio ?? '-')} / threshold {String(row.facts?.compressionThreshold ?? '-')}
                </p>
              ) : null}
              <div className="mt-1 text-[11px] text-sigflo-muted">
                {row.status === 'triggered' ? (
                  <>
                    <p>Reason:</p>
                    {row.reasons.map((reason, idx) => (
                      <p key={`${row.setupType}-reason-${idx}`} className="leading-relaxed">
                        "{reason}"
                      </p>
                    ))}
                  </>
                ) : (
                  <>
                    <p className={row.status === 'developing' ? 'text-cyan-300' : 'text-red-300'}>
                      {row.status === 'developing'
                        ? `🔄 ${row.setupType[0].toUpperCase() + row.setupType.slice(1)} developing`
                        : `❌ ${row.setupType[0].toUpperCase() + row.setupType.slice(1)} not in play`}
                    </p>
                    {row.reasons.map((reason, idx) => (
                      <p key={`${row.setupType}-reason-${idx}`} className="leading-relaxed">
                        • {reason}
                      </p>
                    ))}
                  </>
                )}
              </div>
              <p className="mt-2 text-[11px] font-medium text-cyan-200">{row.nextNeed}</p>
            </div>
          ))
        )}
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold text-white">Signal history</h2>
        {session.state.emittedSignals.length === 0 ? (
          <p className="text-xs text-sigflo-muted">No signals yet. Step forward to validate timing and frequency.</p>
        ) : (
          session.state.emittedSignals
            .slice()
            .reverse()
            .map((s, idx) => (
              <div key={`${s.timestamp}-${idx}`} className="rounded-xl border border-sigflo-border bg-sigflo-bg/50 px-3 py-2">
                <p
                  className={`text-xs ${
                    fireMoment && s.candleIndex === fireMoment.candleIndex
                      ? 'font-semibold text-emerald-300'
                      : 'text-sigflo-muted'
                  }`}
                >
                  Candle {s.candleIndex} • {formatTs(s.timestamp)}
                </p>
                <p className="mt-1 text-xs text-white">
                  <span className="font-semibold capitalize">{s.setupType}</span> — {s.setupScore}
                </p>
                <p className="mt-1 text-[11px] text-sigflo-muted">"{s.whyFired}"</p>
              </div>
            ))
        )}
      </Card>

      <Card className="space-y-2 p-4">
        <h2 className="text-sm font-semibold text-white">Usefulness Metrics</h2>
        <div className="rounded-xl border border-sigflo-border bg-sigflo-bg/50 px-3 py-2 text-[11px] text-sigflo-muted">
          <p>
            <span className="text-white">Lead/Lag:</span> candles from first <span className="text-cyan-200">Developing</span> state to
            trigger. Lower is faster; very low may be noisy.
          </p>
          <p>
            <span className="text-white">Signal Density:</span> triggers per 100 candles. Higher = more frequent signals.
          </p>
          <p>
            <span className="text-white">Avg Follow-through:</span> direction-aware close-after-N in ATR. Higher positive is better.
          </p>
          <p>
            <span className="text-white">Avg Adverse Move:</span> against-position excursion in ATR after trigger. Lower is safer.
          </p>
          <p>
            <span className="text-white">Avg Favorable Excursion:</span> best in-window move in your direction (ATR). Higher means more
            opportunity.
          </p>
        </div>
        {usefulnessMetrics.map((m) => (
          <div key={m.key} className="rounded-xl border border-sigflo-border bg-sigflo-bg/50 px-3 py-2 text-xs">
            <p className="font-semibold capitalize text-white">{m.key}</p>
            <p className="mt-1 text-sigflo-muted">
              Lead/Lag: {m.leadLag == null ? '-' : `${m.leadLag.toFixed(1)} candles`}
            </p>
            <p className="text-sigflo-muted">Signal Density: {m.density.toFixed(1)} per 100 candles</p>
            <p className="text-sigflo-muted">
              Avg Follow-through: {m.followThroughAtr == null ? '-' : `${m.followThroughAtr.toFixed(2)} ATR`}
            </p>
            <p className="text-sigflo-muted">Avg Adverse Move: {m.avgAdverseAtr == null ? '-' : `${m.avgAdverseAtr.toFixed(2)} ATR`}</p>
            <p className="text-sigflo-muted">Avg Favorable Excursion: {m.avgFavorableAtr == null ? '-' : `${m.avgFavorableAtr.toFixed(2)} ATR`}</p>
            <p className="text-sigflo-muted">Samples: {m.samples}</p>
          </div>
        ))}
      </Card>
    </div>
  );
}
