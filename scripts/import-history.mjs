import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Historical scoreboard records are CURRENT career records. Never import them as features.
export function extractBouts(
  raw,
  source,
  cutoff = new Date().toISOString().slice(0, 10),
) {
  if (!Array.isArray(raw.events)) throw Error('Missing events array');
  const bouts = [];
  for (const event of raw.events) {
    if (!/^UFC\b/i.test(event.name || '')) continue;
    const date = event.date?.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || date >= cutoff) continue;
    for (const c of event.competitions || []) {
      if (c.status?.type?.completed !== true) continue;
      const fighters = [...(c.competitors || [])].sort((a, b) =>
        String(a.id).localeCompare(String(b.id), 'en'),
      );
      if (
        fighters.length !== 2 ||
        fighters[0].id === fighters[1].id ||
        fighters.some((f) => !/^\d+$/.test(f.id) || !f.athlete?.displayName)
      )
        continue;
      // Draws, NCs, cancelled and ambiguous results have no binary label.
      if (fighters.filter((f) => f.winner === true).length !== 1) continue;
      bouts.push({
        id: String(c.id),
        eventId: String(event.id),
        event: event.name,
        date,
        division: c.type?.abbreviation || null,
        a: {
          id: String(fighters[0].id),
          name: fighters[0].athlete.displayName,
        },
        b: {
          id: String(fighters[1].id),
          name: fighters[1].athlete.displayName,
        },
        y: fighters[0].winner === true ? 1 : 0,
        source,
      });
    }
  }
  return bouts;
}

async function main() {
  const cutoff = new Date().toISOString().slice(0, 10);
  await fs.mkdir('data/raw/history', { recursive: true });
  const all = [];
  const years = Array.from(
    { length: Number(cutoff.slice(0, 4)) - 2009 },
    (_, i) => 2010 + i,
  );
  for (const year of years) {
    const source = `https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard?dates=${year}0101-${year}1231&limit=1000`;
    const path = `data/raw/history/${year}.json`;
    let raw;
    try {
      if (year === Number(cutoff.slice(0, 4)))
        throw Error('refresh current year');
      raw = JSON.parse(await fs.readFile(path, 'utf8'));
    } catch {
      let error;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const r = await fetch(source, { signal: AbortSignal.timeout(25000) });
          if (!r.ok) throw Error(`HTTP ${r.status}`);
          const candidate = await r.json();
          if (!candidate.events?.length || candidate.events.length >= 1000)
            throw Error('Empty or truncated annual data');
          await fs.writeFile(path, JSON.stringify(candidate));
          raw = candidate;
          break;
        } catch (e) {
          error = e;
        }
      }
      if (!raw) throw error;
    }
    const rows = extractBouts(raw, source, cutoff);
    if (!rows.length) throw Error(`No eligible UFC bouts in ${year}`);
    all.push(...rows);
    console.log(`${year}: ${rows.length} completed UFC bouts`);
  }
  const map = new Map();
  for (const b of all) {
    const prior = map.get(b.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(b))
      throw Error(`Conflicting bout ${b.id}`);
    map.set(b.id, b);
  }
  const bouts = [...map.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
  const sha256 = createHash('sha256')
    .update(JSON.stringify(bouts))
    .digest('hex');
  await fs.mkdir('data', { recursive: true });
  await fs.writeFile(
    'data/ufc-history.json',
    JSON.stringify({
      schemaVersion: 1,
      fetchedAt: new Date().toISOString(),
      cutoffExclusive: cutoff,
      sha256,
      scope: 'ESPN completed events named UFC; decisive bouts only; from 2010',
      bouts,
    }),
  );
  console.log(`Saved ${bouts.length} bouts; sha256 ${sha256}`);
}
if (process.argv[1]?.replaceAll('\\', '/').endsWith('/import-history.mjs'))
  await main();
