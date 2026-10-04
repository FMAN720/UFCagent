import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { extractBouts } from '../scripts/import-history.mjs';
import {
  buildTimeline,
  featurePair,
  metrics,
  linear,
  sigmoid,
} from '../lib/ufc/backtest.mjs';
import { predict, heuristicPredict } from '../lib/ufc/prediction.mjs';
import artifact from '../lib/ufc/model/artifact.json' with { type: 'json' };
import report from '../lib/ufc/model/report.json' with { type: 'json' };
const bout = (id, date, a = '1', b = '2', y = 1) => ({
  id,
  date,
  a: { id: a, name: a },
  b: { id: b, name: b },
  y,
});
test('future and same-day results cannot change pre-fight features', () => {
  const history = [
    bout('a', '2020-01-01'),
    bout('b', '2020-02-01'),
    bout('c', '2020-02-01', '1', '3'),
    bout('d', '2020-03-01'),
  ];
  const original = buildTimeline(history);
  const altered = buildTimeline(
    history.map((b) =>
      ['b', 'c', 'd'].includes(b.id) ? { ...b, y: 1 - b.y } : b,
    ),
  );
  assert.deepEqual(
    original.rows.slice(0, 3).map((r) => r.x),
    altered.rows.slice(0, 3).map((r) => r.x),
  );
  assert.notDeepEqual(original.rows[3].x, altered.rows[3].x);
  assert.throws(() => buildTimeline([history[0], history[0]]));
});
test('swapping identities complements a trained estimate', () => {
  const [a, b] = Object.values(artifact.states).filter((s) => s.n >= 5);
  const x = sigmoid(
    linear(artifact.weights, featurePair(a, b, '2026-09-12')) /
      artifact.temperature,
  );
  const y = sigmoid(
    linear(artifact.weights, featurePair(b, a, '2026-09-12')) /
      artifact.temperature,
  );
  assert(Math.abs(x + y - 1) < 1e-12);
});
test('metric definitions and half-credit ties are correct', () => {
  const rows = [{ y: 1 }, { y: 0 }];
  const m = metrics(rows, () => 0.5);
  assert.equal(m.accuracy, 0.5);
  assert.equal(m.brier, 0.25);
  assert.equal(m.ties, 2);
  assert(Math.abs(m.logLoss - Math.log(2)) < 1e-12);
  assert.equal(m.calibration[0].observed, 0.5);
});
test('history import excludes draws, future events and non-UFC; never imports current records', () => {
  const raw = {
    events: [
      {
        id: 'e',
        name: 'UFC Test',
        date: '2020-01-01T00:00Z',
        competitions: [
          {
            id: 'c',
            status: { type: { completed: true } },
            competitors: [
              {
                id: '2',
                winner: true,
                records: [{ summary: '999-0-0' }],
                athlete: { displayName: 'A' },
              },
              { id: '1', winner: false, athlete: { displayName: 'B' } },
            ],
          },
        ],
      },
    ],
  };
  const result = extractBouts(raw, 'https://www.espn.com', '2021-01-01');
  assert.equal(result[0].a.id, '1');
  assert.equal(result[0].y, 0);
  assert(!JSON.stringify(result).includes('999-0-0'));
  assert.equal(extractBouts(raw, '', '2019-01-01').length, 0);
  raw.events[0].competitions[0].competitors[0].winner = false;
  assert.equal(extractBouts(raw, '', '2021-01-01').length, 0);
});
test('published report matches per-fight predictions and has disjoint chronological partitions', () => {
  const download = JSON.parse(
    fs.readFileSync('public/reports/backtest.json', 'utf8'),
  );
  assert(report.split.train.to < report.split.calibration.from);
  assert(report.split.calibration.to < report.split.test.from);
  assert(
    download.predictions.every(
      (r) => r.date >= report.split.test.from && r.date <= report.split.test.to,
    ),
  );
  const recalculated = metrics(download.predictions, (r) => r.p);
  assert.equal(recalculated.n, report.models[0].n);
  assert.equal(recalculated.brier, report.models[0].brier);
  assert.equal(artifact.datasetHash, report.dataset.sha256);
});
test('matchup output uses score fields and clearly separates heuristic coverage', () => {
  const snapshot = JSON.parse(fs.readFileSync('lib/ufc/snapshot.json', 'utf8'));
  const a = snapshot['fighter:4350762'].data,
    b = snapshot['fighter:2554705'].data;
  const p = predict(a, b);
  assert(!Object.hasOwn(p.a, 'probability'));
  assert.equal(p.a.score + p.b.score, 100);
  const fallback = heuristicPredict(a, b);
  assert.equal(fallback.scoringMethod, 'heuristic');
  assert(fallback.limitations.some((t) => t.includes('回测报告不适用')));
});
