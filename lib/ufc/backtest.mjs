export const FEATURE_NAMES = [
  'eloGap',
  'winRateGap',
  'recentFormGap',
  'experienceGap',
  'layoffGap',
];
export const sigmoid = (z) =>
  1 / (1 + Math.exp(-Math.max(-30, Math.min(30, z))));
const empty = () => ({ elo: 1500, wins: 0, n: 0, recent: [], lastDate: null });
export function featurePair(a = empty(), b = empty(), date) {
  const rate = (s) => (s.wins + 2) / (s.n + 4);
  const form = (s) =>
    (s.recent.reduce((x, y) => x + y, 0) + 1) / (s.recent.length + 2);
  const layoff = (s) =>
    s.lastDate
      ? Math.min(
          730,
          Math.max(0, (Date.parse(date) - Date.parse(s.lastDate)) / 86400000),
        ) / 365
      : 1;
  return [
    (a.elo - b.elo) / 400,
    rate(a) - rate(b),
    form(a) - form(b),
    (Math.log1p(a.n) - Math.log1p(b.n)) / 3,
    layoff(a) - layoff(b),
  ];
}
export function buildTimeline(bouts) {
  const sorted = [...bouts].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const states = {},
    rows = [],
    seen = new Set();
  for (let i = 0; i < sorted.length;) {
    const day = sorted[i].date,
      batch = [];
    while (i < sorted.length && sorted[i].date === day) batch.push(sorted[i++]);
    // Predict every bout on a UTC date BEFORE applying any result from that date.
    for (const b of batch) {
      if (seen.has(b.id)) throw Error('Duplicate bout ID');
      seen.add(b.id);
      if (
        ![0, 1].includes(b.y) ||
        b.a.id === b.b.id ||
        !Number.isFinite(Date.parse(b.date))
      )
        throw Error('Invalid bout');
      const a = states[b.a.id] || empty(),
        c = states[b.b.id] || empty();
      rows.push({
        ...b,
        x: featurePair(a, c, day),
        prior: [a.n, c.n],
        eloP: 1 / (1 + 10 ** ((c.elo - a.elo) / 400)),
        rateP: sigmoid(
          4 * ((a.wins + 2) / (a.n + 4) - (c.wins + 2) / (c.n + 4)),
        ),
      });
    }
    const before = structuredClone(states);
    for (const b of batch) {
      const a0 = before[b.a.id] || empty(),
        b0 = before[b.b.id] || empty();
      const delta = 32 * (b.y - 1 / (1 + 10 ** ((b0.elo - a0.elo) / 400)));
      for (const [f, result, change] of [
        [b.a, b.y, delta],
        [b.b, 1 - b.y, -delta],
      ]) {
        const s = (states[f.id] ||= empty());
        s.elo += change;
        s.n++;
        s.wins += result;
        s.recent = [...s.recent, result].slice(-5);
        s.lastDate = day;
        s.name = f.name;
      }
    }
  }
  return { rows, states };
}
export const linear = (weights, x) =>
  weights.reduce((s, w, i) => s + w * x[i], 0);
export function fit(rows, epochs = 1600) {
  if (!rows.length) throw Error('Training set empty');
  // No intercept: swapping fighters must complement the result exactly.
  // Symmetric differences also prevent winner-first or corner-order shortcuts.
  const weights = FEATURE_NAMES.map(() => 0);
  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradient = weights.map((w) => 0.01 * w);
    for (const r of rows) {
      const error = sigmoid(linear(weights, r.x)) - r.y;
      for (let i = 0; i < weights.length; i++)
        gradient[i] += (error * r.x[i]) / rows.length;
    }
    for (let i = 0; i < weights.length; i++) weights[i] -= 0.5 * gradient[i];
  }
  return weights;
}
export function metrics(rows, probability) {
  if (!rows.length) throw Error('Evaluation set empty');
  let correct = 0,
    ties = 0,
    brier = 0,
    logLoss = 0;
  const bins = Array.from({ length: 10 }, (_, i) => ({
    lower: i / 10,
    upper: (i + 1) / 10,
    n: 0,
    sum: 0,
    wins: 0,
  }));
  for (const r of rows) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, probability(r)));
    if (Math.abs(p - 0.5) < 1e-9) {
      ties++;
      correct += 0.5;
    } else if ((p > 0.5 ? 1 : 0) === r.y) correct++;
    brier += (p - r.y) ** 2;
    logLoss -= r.y * Math.log(p) + (1 - r.y) * Math.log(1 - p);
    const bin = bins[Math.min(9, Math.floor(p * 10))];
    bin.n++;
    bin.sum += p;
    bin.wins += r.y;
  }
  const n = rows.length,
    accuracy = correct / n,
    z = 1.96;
  const center = (accuracy + (z * z) / (2 * n)) / (1 + (z * z) / n);
  const margin =
    (z * Math.sqrt((accuracy * (1 - accuracy)) / n + (z * z) / (4 * n * n))) /
    (1 + (z * z) / n);
  const calibration = bins
    .filter((b) => b.n)
    .map((b) => ({
      lower: b.lower,
      upper: b.upper,
      n: b.n,
      predicted: b.sum / b.n,
      observed: b.wins / b.n,
    }));
  return {
    n,
    correct,
    ties,
    accuracy,
    accuracyInterval: [center - margin, center + margin],
    brier: brier / n,
    logLoss: logLoss / n,
    calibration,
    ece: calibration.reduce(
      (s, b) => s + (b.n / n) * Math.abs(b.predicted - b.observed),
      0,
    ),
  };
}
export function trainAndEvaluate(bouts) {
  const { rows, states } = buildTimeline(bouts);
  const eligible = rows.filter((r) => r.prior.every((n) => n >= 3));
  const train = eligible.filter(
    (r) => r.date >= '2015-01-01' && r.date < '2022-01-01',
  );
  const calibration = eligible.filter(
    (r) => r.date >= '2022-01-01' && r.date < '2024-01-01',
  );
  const test = eligible.filter(
    (r) => r.date >= '2024-01-01' && r.date < '2026-01-01',
  );
  if (train.length < 100 || calibration.length < 50 || test.length < 50)
    throw Error('Insufficient historical coverage');
  const weights = fit(train);
  // Select temperature only on 2022–2023. Test results never update weights or calibration.
  let temperature = 1,
    loss = Infinity;
  for (let t = 0.5; t <= 3.001; t += 0.05) {
    const score = metrics(calibration, (r) =>
      sigmoid(linear(weights, r.x) / t),
    ).logLoss;
    if (score < loss) {
      loss = score;
      temperature = Number(t.toFixed(2));
    }
  }
  const probability = (r) => sigmoid(linear(weights, r.x) / temperature);
  const models = [
    { id: 'trained', name: '历史训练模型', ...metrics(test, probability) },
    { id: 'elo', name: 'Elo 对手强度基线', ...metrics(test, (r) => r.eloP) },
    {
      id: 'record',
      name: '历史 UFC 胜率基线',
      ...metrics(test, (r) => r.rateP),
    },
    { id: 'coin', name: '双方各半基线', ...metrics(test, () => 0.5) },
  ];
  const report = {
    status: 'experimental',
    modelId: 'ufc-history-logistic-v2',
    features: FEATURE_NAMES,
    split: {
      warmup: '2010–2014',
      train: { from: '2015-01-01', to: '2021-12-31', n: train.length },
      calibration: {
        from: '2022-01-01',
        to: '2023-12-31',
        n: calibration.length,
      },
      test: { from: '2024-01-01', to: '2025-12-31', n: test.length },
    },
    totalBouts: bouts.length,
    excludedTestBouts:
      rows.filter((r) => r.date >= '2024-01-01' && r.date < '2026-01-01')
        .length - test.length,
    models,
    beatsEloOnBrier: models[0].brier < models[1].brier,
    byYear: ['2024', '2025'].map((year) => ({
      year,
      ...metrics(
        test.filter((r) => r.date.startsWith(year)),
        probability,
      ),
    })),
    scope:
      'Only decisive UFC bouts with at least 3 prior observed UFC results per fighter. All same-day outcomes are applied after features. No current career records, current rankings or career technical averages are used.',
    limitations: [
      'Retrospective ESPN results can include later corrections; this is not a prospective live trial.',
      'Coverage starts in 2010 and excludes draws, no contests, missing results and events not named UFC.',
      'No injuries, weight-cut, age, reach, detailed striking or grappling features. No betting-odds benchmark.',
      'Single chronological test window; repeated fighters create dependence. The Wilson interval is descriptive, not a guarantee.',
    ],
  };
  return {
    weights,
    temperature,
    states,
    report,
    predictions: test.map((r) => ({
      id: r.id,
      date: r.date,
      a: r.a,
      b: r.b,
      y: r.y,
      p: probability(r),
      source: r.source,
    })),
  };
}
