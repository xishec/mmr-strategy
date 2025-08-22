/*
  Simulate plausible future QQQ data and derive TQQQ accordingly.

  Approach:
  - Bootstrap sample (overnight_rate, day_rate) pairs from historical QQQ data
    (default: last 10 years) to preserve overnight/intraday structure.
  - Generate next trading days (Mon–Fri) starting after the last date.
  - Update QQQ.json with simulated open/close and rates.
  - Derive TQQQ from QQQ using leverage with daily fees and small tracking error.
  - Write backups before overwriting.

  Usage examples:
  - npx tsx src/data/script/simulate_future.ts --days 252
  - npx tsx src/data/script/simulate_future.ts --until 2027-12-31 --seed 42
  - npx tsx src/data/script/simulate_future.ts --days 60 --leverage 3 --expense 0.0095 --borrow 0.004
*/

import fs from 'fs';
import path from 'path';

type Entry = {
  open: number;
  close: number;
  overnight_rate: number; // %
  day_rate: number; // %
  rate: number; // % combined: prev close -> close
};

type Series = Record<string, Entry>;

const DATA_DIR = path.resolve(__dirname, '..'); // src/data
const QQQ_PATH = path.join(DATA_DIR, 'QQQ.json');
const TQQQ_PATH = path.join(DATA_DIR, 'TQQQ.json');

// Simple seeded PRNG (Mulberry32)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | number | boolean | undefined> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=');
      if (v !== undefined) {
        args[k] = v;
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[k] = argv[++i];
      } else {
        args[k] = true;
      }
    }
  }
  return {
    days: args.days ? Number(args.days) : undefined,
    until: (args.until as string) || undefined,
    sampleSince: (args.sampleSince as string) || undefined, // YYYY-MM-DD
    seed: args.seed !== undefined ? Number(args.seed) : undefined,
    leverage: args.leverage !== undefined ? Number(args.leverage) : 3.0,
    expense:
      args.expense !== undefined ? Number(args.expense) : 0.0095, // annual
    borrow:
      args.borrow !== undefined ? Number(args.borrow) : 0.004, // borrow cost
    trackingErr:
      args.trackingErr !== undefined
        ? Number(args.trackingErr)
        : 0.0, // daily decimal (e.g., 0.0001)
    extraDrift: args.extraDrift !== undefined ? Number(args.extraDrift) : 0.0, // daily decimal
    block: args.block !== undefined ? Number(args.block) : 1, // block length for simple block bootstrap
    dryRun: Boolean(args['dry-run'] ?? false),
  // Regime options
  regimeMode: (args.regimeMode as string) || 'off', // 'off' | 'basic'
  trendLookback: args.trendLookback ? Number(args.trendLookback) : 60,
  bullThresh: args.bullThresh ? Number(args.bullThresh) : 0.10, // 10% over lookback
  bearThresh: args.bearThresh ? Number(args.bearThresh) : -0.10, // -10% over lookback
  sideVol: args.sideVol ? Number(args.sideVol) : 1.2, // daily stdev % threshold
  meanBull: args.meanBull ? Number(args.meanBull) : 180,
  meanBear: args.meanBear ? Number(args.meanBear) : 120,
  meanSide: args.meanSide ? Number(args.meanSide) : 150,
  startProbBull: args.startProbBull ? Number(args.startProbBull) : undefined,
  startProbBear: args.startProbBear ? Number(args.startProbBear) : undefined,
  startProbSide: args.startProbSide ? Number(args.startProbSide) : undefined,
  };
}

function isWeekday(d: Date) {
  const day = d.getDay();
  return day !== 0 && day !== 6; // Mon-Fri
}

function fmt(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function parse(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDaysSkipWeekends(start: string, n: number): string[] {
  const out: string[] = [];
  let d = parse(start);
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (isWeekday(d)) out.push(fmt(d));
  }
  return out;
}

function datesUntilExclusive(startExclusive: string, untilInclusive: string): string[] {
  const out: string[] = [];
  let d = parse(startExclusive);
  const end = parse(untilInclusive);
  while (true) {
    d.setDate(d.getDate() + 1);
    if (d > end) break;
    if (isWeekday(d)) out.push(fmt(d));
  }
  return out;
}

function round6(x: number) {
  return Math.round(x * 1e6) / 1e6;
}

function loadJson(p: string): Series {
  if (!fs.existsSync(p)) return {};
  return JSON.parse(fs.readFileSync(p, 'utf-8')) as Series;
}

function backupFile(p: string) {
//   if (!fs.existsSync(p)) return;
//   const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
//   const backup = `${p}.backup.${ts}`;
//   fs.copyFileSync(p, backup);
//   console.log(`💾 Backup created: ${backup}`);
}

function getSamplePairs(qqq: Series, sampleSince?: string, block: number = 1): Array<{ o: number; d: number }> {
  const dates = Object.keys(qqq).sort();
  const startIdx = sampleSince ? Math.max(0, dates.findIndex((x) => x >= sampleSince)) : 0;
  const pairs: Array<{ o: number; d: number }> = [];
  for (let i = Math.max(1, startIdx); i < dates.length; i++) {
    const e = qqq[dates[i]];
    // Ensure numeric values
    if (
      typeof e?.overnight_rate === 'number' &&
      typeof e?.day_rate === 'number' &&
      isFinite(e.overnight_rate) &&
      isFinite(e.day_rate)
    ) {
      pairs.push({ o: e.overnight_rate, d: e.day_rate });
    }
  }
  if (block <= 1) return pairs;

  // For block > 1, create overlapping blocks by grouping consecutive pairs.
  const blocks: Array<Array<{ o: number; d: number }>> = [];
  for (let i = 0; i <= pairs.length - block; i++) {
    blocks.push(pairs.slice(i, i + block));
  }
  // Flatten into a sequence selection strategy: we'll pick a random block, then emit its elements sequentially.
  // We return the flat list, but selection logic will use blocks.
  // To keep interface simple, store blocks logic inside generator and
  // return pairs here. The generator will pick sequence chunks when
  // block > 1 to keep some temporal correlation.
  // We'll just return pairs here and use blocks in the generator function.
  return pairs;
}

function* bootstrapGenerator(
  rng: () => number,
  pairs: Array<{ o: number; d: number }>,
  block: number
): Generator<{ o: number; d: number }> {
  if (pairs.length === 0) throw new Error('No sample pairs available');
  if (block <= 1) {
    while (true) {
      const idx = Math.floor(rng() * pairs.length);
      yield pairs[idx];
    }
  } else {
    // Build blocks indices
    const maxStart = Math.max(0, pairs.length - block);
    while (true) {
      const start = Math.floor(rng() * (maxStart + 1));
      for (let k = 0; k < block; k++) {
        const idx = start + k;
        if (idx < pairs.length) yield pairs[idx];
        else break;
      }
    }
  }
}

type Regime = 'bull' | 'bear' | 'sideways';

function rollingStats(
  qqq: Series,
  lookback: number
): Record<string, { trend: number; volDailyPct: number }> {
  const dates = Object.keys(qqq).sort();
  const out: Record<string, { trend: number; volDailyPct: number }> = {};
  if (dates.length <= lookback) return out;
  // Precompute daily combined returns in decimal
  const dailyR: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    const d = dates[i];
    const r = (qqq[d].rate ?? 0) / 100;
    dailyR.push(isFinite(r) ? r : 0);
  }
  // Sliding window
  for (let i = lookback; i < dates.length; i++) {
    const now = dates[i];
    const past = dates[i - lookback];
    const cNow = qqq[now].close;
    const cPast = qqq[past].close;
    const trend = cPast > 0 ? cNow / cPast - 1 : 0; // compounded over window
    // daily vol over last lookback days corresponds to dailyR indices [i-lookback, i-1)
    const startR = i - lookback; // in dailyR index space (shifted by 1)
    const windowR = dailyR.slice(startR, i);
    const mean = windowR.reduce((a, b) => a + b, 0) / windowR.length;
    const varr =
      windowR.reduce((a, b) => a + (b - mean) * (b - mean), 0) /
      Math.max(1, windowR.length - 1);
    const volDailyPct = Math.sqrt(Math.max(0, varr)) * 100; // convert to %
    out[now] = { trend, volDailyPct };
  }
  return out;
}

function labelRegime(
  stats: Record<string, { trend: number; volDailyPct: number }>,
  bullThresh: number,
  bearThresh: number,
  sideVol: number
): Record<string, Regime> {
  const out: Record<string, Regime> = {};
  for (const [d, s] of Object.entries(stats)) {
    if (s.trend >= bullThresh) out[d] = 'bull';
    else if (s.trend <= bearThresh) out[d] = 'bear';
    else if (Math.abs(s.trend) < (bullThresh - bearThresh) / 4 && s.volDailyPct <= sideVol)
      out[d] = 'sideways';
    else out[d] = 'sideways';
  }
  return out;
}

function splitPairsByRegime(
  qqq: Series,
  pairs: Array<{ o: number; d: number }>,
  sampleSince: string | undefined,
  lookback: number,
  bullThresh: number,
  bearThresh: number,
  sideVol: number
): Record<Regime, Array<{ o: number; d: number }>> {
  const dates = Object.keys(qqq).sort();
  const stats = rollingStats(qqq, lookback);
  const labels = labelRegime(stats, bullThresh, bearThresh, sideVol);
  const pools: Record<Regime, Array<{ o: number; d: number }>> = {
    bull: [],
    bear: [],
    sideways: [],
  };
  const startIdx = sampleSince ? Math.max(1, dates.findIndex((x) => x >= sampleSince)) : 1;
  for (let i = startIdx; i < dates.length; i++) {
    const d = dates[i];
    const e = qqq[d];
    if (
      e &&
      typeof e.overnight_rate === 'number' &&
      typeof e.day_rate === 'number' &&
      isFinite(e.overnight_rate) &&
      isFinite(e.day_rate) &&
      labels[d]
    ) {
      pools[labels[d]].push({ o: e.overnight_rate, d: e.day_rate });
    }
  }
  return pools;
}

function normalizeWeights(ws: Record<Regime, number>): Record<Regime, number> {
  const sum = Object.values(ws).reduce((a, b) => a + b, 0) || 1;
  return {
    bull: ws.bull / sum,
    bear: ws.bear / sum,
    sideways: ws.sideways / sum,
  };
}

function pickByWeight(rng: () => number, ws: Record<Regime, number>): Regime {
  const u = rng();
  let acc = 0;
  for (const k of ['bull', 'bear', 'sideways'] as Regime[]) {
    acc += ws[k];
    if (u <= acc) return k;
  }
  return 'sideways';
}

function sampleGeomMean(rng: () => number, mean: number): number {
  const p = mean > 0 ? 1 / mean : 1;
  let len = 1;
  while (rng() > p) len++;
  return len;
}

function buildRegimeSequence(
  rng: () => number,
  n: number,
  startWeights: Record<Regime, number>,
  meanLens: Record<Regime, number>
): Regime[] {
  const seq: Regime[] = [];
  let current = pickByWeight(rng, startWeights);
  while (seq.length < n) {
    const len = sampleGeomMean(rng, meanLens[current]);
    for (let i = 0; i < len && seq.length < n; i++) seq.push(current);
      // choose next regime different from current
      const all: Regime[] = ['bull', 'bear', 'sideways'];
      const others: Regime[] = [];
      for (const r of all) {
        if (r !== current) others.push(r);
      }
      // Simple transition: pick between the other two equally
      const nextIdx = Math.floor(rng() * others.length);
      current = others[nextIdx];
  }
  return seq;
}

function main() {
  const args = parseArgs(process.argv);
  const qqq = loadJson(QQQ_PATH);
  const tqqq = loadJson(TQQQ_PATH);

  if (!qqq || Object.keys(qqq).length === 0) {
    throw new Error(`QQQ.json not found or empty at ${QQQ_PATH}`);
  }

  const dates = Object.keys(qqq).sort();
  const lastDate = dates[dates.length - 1];
  const lastQQQClose = qqq[lastDate].close;
  const lastTQQQClose =
    tqqq && Object.keys(tqqq).length > 0
      ? tqqq[Object.keys(tqqq).sort().slice(-1)[0]].close
      : lastQQQClose * (args.leverage ?? 3.0);

  // Determine future dates to generate
  let futureDates: string[] = [];
  if (args.until) {
    futureDates = datesUntilExclusive(lastDate, args.until);
  } else {
    const n = args.days ?? 252; // ~1 year of trading days
    const startFrom = lastDate;
    futureDates = addDaysSkipWeekends(startFrom, n);
  }

  if (futureDates.length === 0) {
    console.log('No future dates to simulate (check --days/--until).');
    return;
  }

  // Choose sampling window (default: last 10 years from lastDate)
  const tenYearsAgo = new Date(parse(lastDate));
  tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
  const defaultSince = fmt(tenYearsAgo);
  const sampleSince = args.sampleSince || defaultSince;

  const rng = mulberry32(args.seed ?? Date.now());
  const pairs = getSamplePairs(qqq, sampleSince, args.block);
  const gen = bootstrapGenerator(rng, pairs, args.block);

  // Optional regime-based simulation
  const useRegimes = (args as any).regimeMode === 'basic';
  const pools = useRegimes
    ? splitPairsByRegime(
        qqq,
        pairs,
        sampleSince,
        (args as any).trendLookback,
        (args as any).bullThresh,
        (args as any).bearThresh,
        (args as any).sideVol
      )
    : null;
  const gensByRegime: Partial<Record<Regime, Generator<{ o: number; d: number }>>> = {};
  if (useRegimes && pools) {
    for (const r of ['bull', 'bear', 'sideways'] as Regime[]) {
      const pool = pools[r];
      if (pool && pool.length > 0) gensByRegime[r] = bootstrapGenerator(rng, pool, (args as any).block);
    }
  }
  const startWeights = useRegimes
    ? normalizeWeights({
        bull:
          (args as any).startProbBull ?? (pools!.bull?.length || 0),
        bear:
          (args as any).startProbBear ?? (pools!.bear?.length || 0),
        sideways:
          (args as any).startProbSide ?? (pools!.sideways?.length || 0),
      })
    : { bull: 1 / 3, bear: 1 / 3, sideways: 1 / 3 };
  const meanLens = {
    bull: (args as any).meanBull,
    bear: (args as any).meanBear,
    sideways: (args as any).meanSide,
  } as Record<Regime, number>;
  const regimeSeq = useRegimes
    ? buildRegimeSequence(rng, futureDates.length, startWeights, meanLens)
    : Array(futureDates.length).fill('sideways');

  // Simulate
  let prevCloseQQQ = lastQQQClose;
  let prevCloseTQQQ = lastTQQQClose;

  const feeDaily = (args.expense ?? 0.0095) / 252;
  const borrowDaily = (args.borrow ?? 0.004) / 252;
  const totalFeeFactor = 1 - feeDaily - borrowDaily;
  const leverage = args.leverage ?? 3.0;
  const trackingErr = args.trackingErr ?? 0.0; // daily decimal
  const extraDrift = args.extraDrift ?? 0.0; // daily decimal

  const newQQQ: Series = {};
  const newTQQQ: Series = {};

  for (let idx = 0; idx < futureDates.length; idx++) {
    const d = futureDates[idx];
  let pair: { o: number; d: number } | undefined = undefined;
    if (useRegimes) {
      const regime = regimeSeq[idx] as Regime;
      const g = gensByRegime[regime];
      if (g) pair = g.next().value;
    }
  if (!pair) pair = gen.next().value as { o: number; d: number };
  const { o, d: day } = pair as { o: number; d: number };
    const rO = o / 100; // decimal
    const rD = day / 100; // decimal

    const qOpen = prevCloseQQQ * (1 + rO);
    const qClose = qOpen * (1 + rD);
    const qOvernight = (qOpen / prevCloseQQQ - 1) * 100;
    const qDay = (qClose / qOpen - 1) * 100;
    const qCombined = (qClose / prevCloseQQQ - 1) * 100;

    newQQQ[d] = {
      open: round6(qOpen),
      close: round6(qClose),
      overnight_rate: round6(qOvernight),
      day_rate: round6(qDay),
      rate: round6(qCombined),
    };

    // Derive TQQQ using leverage on overnight and intraday separately, apply daily fees at close
    const tOpen = prevCloseTQQQ * (1 + leverage * rO + trackingErr / 2);
    let tClose = tOpen * (1 + leverage * rD + trackingErr / 2);
    tClose = tClose * totalFeeFactor * (1 + extraDrift);

    const tOvernight = (tOpen / prevCloseTQQQ - 1) * 100;
    const tDay = (tClose / tOpen - 1) * 100;
    const tCombined = (tClose / prevCloseTQQQ - 1) * 100;

    newTQQQ[d] = {
      open: round6(tOpen),
      close: round6(tClose),
      overnight_rate: round6(tOvernight),
      day_rate: round6(tDay),
      rate: round6(tCombined),
    };

    prevCloseQQQ = qClose;
    prevCloseTQQQ = tClose;
  }

  // Merge and save with backups
  const mergedQQQ: Series = { ...qqq, ...newQQQ };
  const mergedTQQQ: Series = { ...tqqq, ...newTQQQ };

  const fromQQQ = Object.keys(qqq).sort().slice(-1)[0];
  const toQQQ = futureDates[futureDates.length - 1];
  const fromTQQQ = Object.keys(tqqq).length
    ? Object.keys(tqqq).sort().slice(-1)[0]
    : 'N/A';
  const toTQQQ = toQQQ;

  if (args.dryRun) {
    console.log('🧪 Dry run. No files written. Summary:');
    console.log(
      `QQQ would extend: ${fromQQQ} → ${toQQQ} (+${futureDates.length} days)`
    );
    console.log(
      `TQQQ would extend: ${fromTQQQ} → ${toTQQQ} (+${futureDates.length} days)`
    );
    const sampleDate = futureDates[0];
    console.log('Example first simulated day:');
    console.log('QQQ', sampleDate, newQQQ[sampleDate]);
    console.log('TQQQ', sampleDate, newTQQQ[sampleDate]);
    return;
  }

  backupFile(QQQ_PATH);
  fs.writeFileSync(QQQ_PATH, JSON.stringify(mergedQQQ, null, 2));
  console.log(
    `✅ QQQ extended: ${fromQQQ} → ${toQQQ} (+${futureDates.length} days)`
  );

  if (Object.keys(tqqq).length === 0) {
    console.log(
      'ℹ️ No existing TQQQ.json detected; created simulated future segment only.'
    );
  }
  backupFile(TQQQ_PATH);
  fs.writeFileSync(TQQQ_PATH, JSON.stringify(mergedTQQQ, null, 2));
  console.log(
    `✅ TQQQ extended: ${fromTQQQ} → ${toTQQQ} (+${futureDates.length} days)`
  );
}

main();
