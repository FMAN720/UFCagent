# UFCagent · OCTAGON UFC Assistant

[中文详细文档](README.md) · [Contributing](CONTRIBUTING.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

A Chinese/English UFC intelligence web app combining sourced rankings, event
schedules, fighter records, explainable matchup scores, optional tool-grounded
AI conversations, and reproducible historical backtests.

This is an independent fan project without UFC or ESPN affiliation. Matchup
scores are experimental data tendencies, not validated future win probabilities.

## Features

- Events, bout cards, news headlines and original source links.
- Fighter search, career records, fight history and available technical statistics.
- Separate Media and Meta rankings, official divisions and men's/women's P4P.
- Same-gender, same-division matchup validation and explainable scoring factors.
- Optional OpenAI Responses or tool-capable Chat Completions compatible providers.
- Persistent language preference, known-name translations and Chinese metric units.
- Historical logistic regression with chronological splits and simple baselines.
- Optional Windows desktop start/stop shortcuts.

## Quick start

Requires Node.js **>= 22.13.0**, npm and Git.

```bash
git clone https://github.com/FMAN720/UFCagent.git
cd UFCagent
npm ci
npm run dev
```

Open the URL printed by the terminal, normally `http://localhost:3000`.
Public-data queries and matchup analysis work without a model key.
The public checkout needs no Codex or personal Sites project configuration.

```bash
npm test
npm run typecheck
npm run build
npm start
```

`npm start` previews the built Cloudflare Worker locally. It requires the build
output at `dist/server/wrangler.json`; use the port printed by Wrangler.

## Optional AI configuration

On Windows:

```powershell
Copy-Item .env.example .dev.vars
```

On macOS/Linux:

```bash
cp .env.example .dev.vars
```

If the file already exists, edit it instead of overwriting your configuration.
Set `UFC_MODEL_API_KEY` in `.dev.vars`, then restart the development server.

| Variable | Default or purpose |
| --- | --- |
| `UFC_MODEL_API_KEY` | Optional server-side key |
| `OPENAI_API_KEY` | Fallback key if the UFC-specific key is absent |
| `UFC_MODEL_BASE_URL` | `https://api.openai.com/v1`; HTTPS is required |
| `UFC_MODEL_PROTOCOL` | `responses`, or `chat` for compatible providers |
| `UFC_MODEL_NAME` | `gpt-5-mini`; select a model available from your provider |

The provider must support tool calls. Never use browser-exposed environment
variable prefixes for keys. `.dev.vars*` and `.env*` are ignored except for the
blank `.env.example`. A configured status does not prove provider connectivity;
send an actual question to verify it.

AI mode sends the question, up to eight recent messages, and public tool results
to the chosen provider. Calls use that account's quota and billing. OpenAI
requests set `store:false`; other providers may use different retention policies.
Without a key, or after a provider failure, the app labels its data-query fallback.

## Architecture and data

React 19 + TypeScript + Vinext/Vite + Tailwind CSS, with Cloudflare Workers APIs.
The frontend uses the same-origin `/api/ufc` endpoint. UFC Brazil supplies
rankings/technical statistics; ESPN supplies schedules, headlines and records.

`lib/ufc/data.mjs` performs allowlisted requests, bounded in-memory caching,
request coalescing and timestamp-preserving snapshot fallback. Cache durations
are five minutes for events, ten for news, fifteen for rankings, and one hour for
fighter profiles/search. Event queries span 14 days before to 120 days after the
request date. Public data sources may change or become unavailable.

`lib/ufc/assistant.mjs` limits model tools and validates their arguments.
`lib/ufc/prediction.mjs` selects historical scoring or the explicit heuristic
fallback. `lib/ufc/backtest.mjs` rebuilds pre-fight features and trains/evaluates
the offline model. Data import and model training are not background jobs.

The API rate limit is 60 requests per minute per IP per instance, with a shared
local bucket when the Cloudflare IP header is absent. Neither cache nor limits
are distributed across instances. Both interface languages display UTC+8 times.

## Historical evaluation

The committed dataset has 7,239 decisive UFC bouts from 2010 onward. Features
use past Elo, smoothed UFC win rate, recent results, experience and inactivity.
Current career records and technical averages are not historical model inputs.
All same-day features are built before applying that day's outcomes.

| Split | Dates | Eligible bouts |
| --- | --- | --- |
| Warm-up | 2010–2014 | Initialize fighter histories |
| Training | 2015–2021 | 1,482 |
| Calibration | 2022–2023 | 543 |
| Test | 2024–2025 | 580 |

433 additional test-period bouts lack three prior observed UFC results for at
least one fighter and are excluded. Calibration temperature and fitted weights
are not chosen using the test results.

| Method | Test accuracy | Brier loss |
| --- | --- | --- |
| Trained historical model | 62.1% | 0.237 |
| Elo baseline | 56.2% | 0.244 |
| Historical UFC win-rate baseline | 62.7% | 0.232 |
| Equal scores | 50.0% | 0.250 |

The trained model does not beat every simple baseline. Results are retrospective
and omit injuries, weight cutting, age, reach and betting-odds comparisons.
Repeated fighters create dependence; these metrics do not guarantee future performance.

Historical scoring requires enough observed history, a model no older than 30
days, and no newer known UFC result for either fighter. Otherwise, the app uses
an unvalidated heuristic. The backtest does not apply to that fallback.

```bash
# Reproduce training from the committed dataset, without fetching new history:
npm run model:train
npm test

# Optionally update source data first (network required):
npm run data:history
npm run model:train
```

Training verifies the dataset SHA-256. Outputs are `lib/ufc/model/artifact.json`,
`lib/ufc/model/report.json`, and `public/reports/backtest.json`, which also contains
per-bout test predictions. Rebuild after updating artifacts.

## API examples

```bash
curl 'http://localhost:3000/api/ufc?action=rankings'
curl 'http://localhost:3000/api/ufc?action=search&q=Zhang%20Weili'
curl 'http://localhost:3000/api/ufc?action=model-report'
```

POST JSON bodies to `/api/ufc` with `Content-Type: application/json`:

```json
{"action":"ask","question":"Upcoming UFC events","locale":"en","history":[]}
```

```json
{"action":"predict","a":"4350762","b":"2554705"}
```

Data endpoints return `data`, `source`, `fetchedAt`, `freshness`
(`live`, `cache`, or `snapshot`) and `warning`. Other actions include `events`,
`news`, `fighter&id=...`, `news-translations`, and `assistant-status`.
See the Chinese README for the full endpoint list and maintenance workflow.

## Deployment

The runtime uses `cloudflare:workers`; migrating to another platform needs
runtime adaptation. The Worker name is `ufcagent` in `vite.config.ts`.
Change it and rebuild if you already use that name in your account.

```bash
npm run build
npx wrangler login
npx wrangler deploy --config dist/server/wrangler.json
npx wrangler secret put UFC_MODEL_API_KEY --config dist/server/wrangler.json
```

Set any non-secret model variables in the Worker environment. Local configuration
is not uploaded automatically. GitHub CI runs installation, tests, type checking
and the production build; it does not deploy. No verified public demo URL is supplied.

## License

Project-authored code and documentation use the [MIT license](LICENSE).
Third-party marks, source data and dependency licenses are described separately
in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
