import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { trainAndEvaluate } from '../lib/ufc/backtest.mjs';
const dataset = JSON.parse(await fs.readFile('data/ufc-history.json', 'utf8'));
const hash = createHash('sha256')
  .update(JSON.stringify(dataset.bouts))
  .digest('hex');
if (hash !== dataset.sha256) throw Error('Dataset hash mismatch');
const trained = trainAndEvaluate(dataset.bouts);
const report = {
  ...trained.report,
  generatedAt: new Date().toISOString(),
  dataset: {
    sha256: hash,
    fetchedAt: dataset.fetchedAt,
    cutoffExclusive: dataset.cutoffExclusive,
    first: dataset.bouts[0].date,
    last: dataset.bouts.at(-1).date,
    source: 'https://www.espn.com/mma/schedule/_/league/ufc',
  },
};
await fs.mkdir('lib/ufc/model', { recursive: true });
await fs.mkdir('public/reports', { recursive: true });
await fs.writeFile(
  'lib/ufc/model/artifact.json',
  JSON.stringify({
    id: report.modelId,
    weights: trained.weights,
    temperature: trained.temperature,
    states: trained.states,
    asOf: report.dataset.last,
    datasetHash: hash,
  }),
);
await fs.writeFile(
  'lib/ufc/model/report.json',
  JSON.stringify(report, null, 2),
);
await fs.writeFile(
  'public/reports/backtest.json',
  JSON.stringify({ ...report, predictions: trained.predictions }, null, 2),
);
console.log(
  JSON.stringify(
    {
      split: report.split,
      models: report.models.map(({ id, n, accuracy, brier, logLoss }) => ({
        id,
        n,
        accuracy,
        brier,
        logLoss,
      })),
      beatsEloOnBrier: report.beatsEloOnBrier,
    },
    null,
    2,
  ),
);
