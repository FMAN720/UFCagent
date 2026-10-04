# Third-party materials

The MIT license in `LICENSE` covers project-authored code and documentation.
It does not grant rights to third-party trademarks, source website content,
or external services. Dependency packages retain their respective licenses.

## UFC desktop artwork

`assets/desktop/ufc-original.svg` comes from
[Wikimedia Commons: UFC Logo.svg](https://commons.wikimedia.org/wiki/File:UFC_Logo.svg).
The source credits UFC and UFC.com. The source page marks the simple wordmark
as public domain and separately identifies trademark restrictions. The white
and red SVG/PNG/ICO files are color/size variants of that wordmark.
This project is independent and does not imply UFC affiliation or endorsement.
The MIT code license does not grant trademark rights.

## Public sports data and parser fixtures

- UFC rankings and athlete technical statistics: [UFC Brazil](https://www.ufc.com.br/rankings).
- Schedules, news headlines, athlete records, and historical results: [ESPN MMA](https://www.espn.com/mma/).
- `data/ufc-history.json`, `lib/ufc/snapshot.json`, and `tests/fixtures/` contain
  structured sports records or reduced parser inputs derived from those sources.
- `public/reports/backtest.json` and `lib/ufc/model/` contain project-generated
  analysis of the historical results.

Public accessibility is not a blanket data license. The repository does not
relicense underlying source content or promise permission for every downstream
use. Preserve source URLs and timestamps; consult the applicable source terms
when adapting or redistributing data. No complete news articles, fight videos,
or fighter photographs are bundled.

## Services and dependencies

MyMemory is used only for public news headline translation. An optional
server-side model provider receives questions, recent conversation, and tool
results when AI mode is enabled. Those services have separate terms and policies.

React, Vinext, Vite, Cloudflare tooling, Tailwind CSS, Cheerio, lucide-react,
shadcn components, and other packages are third-party software. See
`package.json`, `package-lock.json`, and the individual packages' license files.
