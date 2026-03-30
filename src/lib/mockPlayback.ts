import {
  deriveIndicators,
  detectBreakoutPressure,
  detectOverextendedWarning,
  detectPullbackContinuation,
} from '@/lib/detectors';
import { getSetupScoreLabel } from '@/lib/setupScore';
import type { DerivedIndicators, DetectorEvaluation, SignalCandidate } from '@/lib/detectors';
import type { DetectorOptions } from '@/lib/detectors';
import type { PlaybackCandle } from '@/types/market';
import type { SetupScoreLabel } from '@/types/signal';
import {
  breakoutScenario5m,
  overextendedScenario5m,
  pullbackScenario5m,
} from '@/data/mockCandles';

export type ScenarioKey = 'breakout' | 'pullback' | 'overextended';

export type PlaybackSignal = SignalCandidate & {
  symbol: string;
  timestamp: number;
  candleIndex: number;
  scoreLabel: SetupScoreLabel;
  whyFired: string;
};

export type PlaybackStepResult = {
  currentCandle: PlaybackCandle;
  visibleCandles: PlaybackCandle[];
  indicators: DerivedIndicators;
  detectorEvaluations: DetectorEvaluation[];
  newSignals: PlaybackSignal[];
  emittedSignals: PlaybackSignal[];
  index: number;
  done: boolean;
};

export type PlaybackState = {
  scenario: ScenarioKey;
  symbol: string;
  index: number;
  total: number;
  visibleCandles: PlaybackCandle[];
  emittedSignals: PlaybackSignal[];
};

export type PlaybackConfig = {
  symbol: string;
  windowSize: number;
  minSetupScore: number;
  cooldownCandles: number;
  minScoreImprovement: number;
  detectorOptions: DetectorOptions;
};

export type PlaybackSession = {
  state: PlaybackState;
  config: PlaybackConfig;
  detectorEvaluations: DetectorEvaluation[];
  lastStep: PlaybackStepResult | null;
  cooldownRegistry: Record<string, CooldownState>;
};

type CooldownState = {
  lastIndex: number;
  lastSetupScore: number;
};

const DEFAULT_CONFIG: PlaybackConfig = {
  symbol: 'SOLUSDT',
  windowSize: 50,
  minSetupScore: 55,
  cooldownCandles: 4,
  minScoreImprovement: 8,
  detectorOptions: {
    useVolumeFilter: true,
    useRsiFilter: true,
    compressionThreshold: 1.4,
  },
};

const SCENARIO_DATA: Record<ScenarioKey, { symbol: string; candles: PlaybackCandle[] }> = {
  breakout: { symbol: 'SOLUSDT', candles: breakoutScenario5m },
  pullback: { symbol: 'ETHUSDT', candles: pullbackScenario5m },
  overextended: { symbol: 'DOGEUSDT', candles: overextendedScenario5m },
};

function candidateKey(symbol: string, setupType: SignalCandidate['setupType']) {
  return `${symbol}:${setupType}`;
}

function compactReason(reasons: string[]): string {
  const clean = reasons
    .map((r) => r.replace('confirmed on closed candle', '').trim())
    .filter(Boolean)
    .slice(0, 2);
  return clean.join(' + ');
}

export class MockPlaybackController {
  private series: PlaybackCandle[];
  private currentIndex: number;
  private config: PlaybackConfig;
  private emittedSignals: PlaybackSignal[];
  private cooldownRegistry: Record<string, CooldownState>;

  constructor(series: PlaybackCandle[], cfg?: Partial<PlaybackConfig>) {
    this.series = series;
    this.currentIndex = 0;
    this.config = { ...DEFAULT_CONFIG, ...cfg };
    this.emittedSignals = [];
    this.cooldownRegistry = {};
  }

  reset(series?: PlaybackCandle[], cfg?: Partial<PlaybackConfig>) {
    if (series) this.series = series;
    this.currentIndex = 0;
    this.config = { ...this.config, ...cfg };
    this.emittedSignals = [];
    this.cooldownRegistry = {};
  }

  getState() {
    return {
      index: this.currentIndex,
      total: this.series.length,
      emittedSignals: [...this.emittedSignals],
    };
  }

  stepForward(): PlaybackStepResult | null {
    if (this.currentIndex >= this.series.length) return null;
    this.currentIndex += 1;
    const visibleCandles = this.series.slice(Math.max(0, this.currentIndex - this.config.windowSize), this.currentIndex);
    if (visibleCandles.length === 0) return null;
    const currentCandle = visibleCandles.at(-1);
    if (!currentCandle) return null;

    const indicators = deriveIndicators(visibleCandles);
    const evaluations = [
      detectBreakoutPressure(visibleCandles, indicators, this.config.detectorOptions),
      detectPullbackContinuation(visibleCandles, indicators, this.config.detectorOptions),
      detectOverextendedWarning(visibleCandles, indicators, this.config.detectorOptions),
    ];

    const newSignals: PlaybackSignal[] = [];
    for (const e of evaluations) {
      if (!e.triggered || !e.candidate) continue;
      if (e.candidate.setupScore < this.config.minSetupScore) continue;

      const key = candidateKey(this.config.symbol, e.candidate.setupType);
      const prior = this.cooldownRegistry[key];
      const cooldownElapsed = !prior || this.currentIndex - prior.lastIndex >= this.config.cooldownCandles;
      const improved = !prior || e.candidate.setupScore - prior.lastSetupScore >= this.config.minScoreImprovement;
      if (!(cooldownElapsed || improved)) continue;

      const signal: PlaybackSignal = {
        ...e.candidate,
        symbol: this.config.symbol,
        timestamp: currentCandle.timestamp,
        candleIndex: this.currentIndex,
        scoreLabel: getSetupScoreLabel(e.candidate.setupScore),
        whyFired: compactReason(e.reasons),
      };
      this.cooldownRegistry[key] = {
        lastIndex: this.currentIndex,
        lastSetupScore: e.candidate.setupScore,
      };
      this.emittedSignals.push(signal);
      newSignals.push(signal);
    }

    return {
      currentCandle,
      visibleCandles,
      indicators,
      detectorEvaluations: evaluations,
      newSignals,
      emittedSignals: [...this.emittedSignals],
      index: this.currentIndex,
      done: this.currentIndex >= this.series.length,
    };
  }
}

function buildState(scenario: ScenarioKey, candles: PlaybackCandle[], config: PlaybackConfig): PlaybackState {
  return {
    scenario,
    symbol: config.symbol,
    index: 0,
    total: candles.length,
    visibleCandles: [],
    emittedSignals: [],
  };
}

/**
 * Session factory for mock playback harness.
 * This is intentionally isolated from live data transport. Bybit REST/WS can later feed the same
 * candle arrays into this exact step pipeline for parity testing.
 */
export function createPlaybackSession(input?: {
  scenario?: ScenarioKey;
  candles?: PlaybackCandle[];
  config?: Partial<PlaybackConfig>;
}): PlaybackSession {
  const scenario = input?.scenario ?? 'breakout';
  const scenarioSource = SCENARIO_DATA[scenario];
  const candles = input?.candles ?? scenarioSource.candles;
  const config: PlaybackConfig = {
    ...DEFAULT_CONFIG,
    symbol: scenarioSource.symbol,
    ...input?.config,
  };
  return {
    state: buildState(scenario, candles, config),
    config,
    detectorEvaluations: [],
    lastStep: null,
    cooldownRegistry: {},
  };
}

export function resetPlayback(session: PlaybackSession): PlaybackSession {
  return {
    ...session,
    state: buildState(session.state.scenario, SCENARIO_DATA[session.state.scenario].candles, session.config),
    detectorEvaluations: [],
    lastStep: null,
    cooldownRegistry: {},
  };
}

export function setScenario(session: PlaybackSession, scenario: ScenarioKey): PlaybackSession {
  const source = SCENARIO_DATA[scenario];
  const config = { ...session.config, symbol: source.symbol };
  return {
    ...session,
    config,
    state: buildState(scenario, source.candles, config),
    detectorEvaluations: [],
    lastStep: null,
    cooldownRegistry: {},
  };
}

export function stepForward(session: PlaybackSession): PlaybackSession {
  if (session.state.index >= session.state.total) return session;
  const sourceCandles = SCENARIO_DATA[session.state.scenario].candles;
  const nextIndex = session.state.index + 1;
  const visibleCandles = sourceCandles.slice(Math.max(0, nextIndex - session.config.windowSize), nextIndex);
  if (visibleCandles.length === 0) return session;
  const currentCandle = visibleCandles.at(-1);
  if (!currentCandle) return session;

  const indicators = deriveIndicators(visibleCandles);
  const evaluations = [
    detectBreakoutPressure(visibleCandles, indicators, session.config.detectorOptions),
    detectPullbackContinuation(visibleCandles, indicators, session.config.detectorOptions),
    detectOverextendedWarning(visibleCandles, indicators, session.config.detectorOptions),
  ];

  const nextCooldown = { ...session.cooldownRegistry };
  const newSignals: PlaybackSignal[] = [];
  for (const e of evaluations) {
    if (!e.triggered || !e.candidate) continue;
    if (e.candidate.setupScore < session.config.minSetupScore) continue;
    if (!currentCandle.isClosed) continue;

    const key = candidateKey(session.config.symbol, e.candidate.setupType);
    const prior = nextCooldown[key];
    const cooldownElapsed = !prior || nextIndex - prior.lastIndex >= session.config.cooldownCandles;
    const improved = !prior || e.candidate.setupScore - prior.lastSetupScore >= session.config.minScoreImprovement;
    if (!(cooldownElapsed || improved)) continue;

    const signal: PlaybackSignal = {
      ...e.candidate,
      symbol: session.config.symbol,
      timestamp: currentCandle.timestamp,
      candleIndex: nextIndex,
      scoreLabel: getSetupScoreLabel(e.candidate.setupScore),
      whyFired: compactReason(e.reasons),
    };
    nextCooldown[key] = { lastIndex: nextIndex, lastSetupScore: e.candidate.setupScore };
    newSignals.push(signal);
  }

  const emittedSignals = [...session.state.emittedSignals, ...newSignals];
  const result: PlaybackStepResult = {
    currentCandle,
    visibleCandles,
    indicators,
    detectorEvaluations: evaluations,
    newSignals,
    emittedSignals,
    index: nextIndex,
    done: nextIndex >= session.state.total,
  };

  return {
    ...session,
    detectorEvaluations: evaluations,
    cooldownRegistry: nextCooldown,
    lastStep: result,
    state: {
      ...session.state,
      index: nextIndex,
      visibleCandles,
      emittedSignals,
    },
  };
}

export function startAutoplay(
  session: PlaybackSession,
  onUpdate: (next: PlaybackSession) => void,
  speedMs = 700
): () => void {
  let current = session;
  const timer = window.setInterval(() => {
    const next = stepForward(current);
    current = next;
    onUpdate(next);
    if (next.lastStep?.done) window.clearInterval(timer);
  }, speedMs);
  return () => window.clearInterval(timer);
}
