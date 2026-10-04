import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  parseRankings,
  parseTechnical,
  parseSearch,
  parseFighter,
  parseEvents,
  safeUrl,
} from '../lib/ufc/parsers.mjs';
import { predict, heuristicPredict } from '../lib/ufc/prediction.mjs';
import { planQuestion } from '../lib/ufc/agent.mjs';
import { eventRange, cached, cache } from '../lib/ufc/data.mjs';
const snapshot = JSON.parse(fs.readFileSync('lib/ufc/snapshot.json', 'utf8'));
test('official media and Meta rankings stay separate; P4P is not a championship', () => {
  const r = parseRankings(
    fs.readFileSync('tests/fixtures/rankings.html', 'utf8'),
  );
  assert.equal(r.filter((x) => x.system === 'media').length, 13);
  assert.equal(r.filter((x) => x.system === 'meta').length, 11);
  assert(
    r.filter((x) => x.name.includes('P4P')).every((x) => x.champion === null),
  );
  assert(
    r.every(
      (x) =>
        x.rows.length >= 10 &&
        x.rows.every(
          (y) =>
            Number.isInteger(y.rank) &&
            y.url.startsWith('https://www.ufc.com.br/athlete/'),
        ),
    ),
  );
});
test('blocked or incomplete rankings fail instead of producing fake empty live data', () => {
  assert.throws(() => parseRankings('<h1>Access denied</h1>'));
  assert.throws(() =>
    parseRankings('<table><caption><h4>Lightweight</h4></caption></table>'),
  );
});
test('fighter identity must match technical page', () => {
  const html = fs.readFileSync('tests/fixtures/brathlete.html', 'utf8');
  assert(parseTechnical(html, 'Zhang Weili').slpm > 0);
  assert.throws(() => parseTechnical(html, 'Conor McGregor'));
});
test('MMA search excludes other sports', () => {
  const x = parseSearch(
    JSON.parse(fs.readFileSync('tests/fixtures/search2.json', 'utf8')),
  );
  assert.equal(x.length, 2);
  assert(x.every((x) => x.id && x.url.includes('/mma/')));
});
test('fighter records keep history and do not equate career wins with UFC wins', () => {
  const x = parseFighter(
    JSON.parse(fs.readFileSync('tests/fixtures/athlete.json', 'utf8')),
  );
  assert(x.history.length > 20);
  assert.equal(x.id, '4350762');
  assert(x.history.some((h) => !h.event.startsWith('UFC')));
});
test('event parser excludes Contender Series and retains bout identities', () => {
  const x = parseEvents(
    JSON.parse(fs.readFileSync('tests/fixtures/eventsrange.json', 'utf8')),
  );
  assert(x.length > 5);
  assert(x.every((e) => !e.name.includes('Contender Series')));
  assert(
    x.every((e) =>
      e.bouts.every((b) => b.fighters.every((f) => f.id && f.name)),
    ),
  );
});
test('predictions are symmetric, bounded, explicit about missing technical data', () => {
  const a = snapshot['fighter:4350762'].data,
    b = snapshot['fighter:2554705'].data;
  const x = heuristicPredict(a, b),
    y = heuristicPredict(b, a);
  assert.equal(x.a.score + y.a.score, 100);
  assert.equal(x.a.score + x.b.score, 100);
  assert(x.a.score >= 20 && x.a.score <= 80);
  assert.equal(x.technical, false);
  assert(x.limitations.some((t) => t.includes('技术统计暂不可用')));
});
test('prediction rejects same fighter, different divisions, missing or short record', () => {
  const a = snapshot['fighter:4350762'].data,
    b = snapshot['fighter:2554705'].data;
  assert.throws(() => predict(a, a));
  assert.throws(() => predict(a, { ...b, division: 'Heavyweight' }));
  assert.throws(() => predict(a, { ...b, record: null }));
  assert.throws(() => predict(a, { ...b, record: '1-0-0' }));
});
test('Chinese queries distinguish divisions and follow up on last fighter', () => {
  assert.equal(planQuestion('女子蝇量级排名').division, '女子蝇量级');
  assert.equal(planQuestion('次中量级排名').division, '男子次中量级');
  assert.equal(planQuestion('Meta 轻量级排名').system, 'meta');
  assert.equal(
    planQuestion('她的比赛记录', { fighterId: '4350762' }).id,
    '4350762',
  );
  assert.equal(
    planQuestion('预测 Zhang Weili vs Valentina Shevchenko').action,
    'predict',
  );
  assert.equal(planQuestion('明天会下雨吗').action, 'help');
});
test('date window moves with current time, including year boundaries', () => {
  assert.equal(
    eventRange(new Date('2026-12-31T00:00:00Z')),
    '20261217-20270430',
  );
});
test('cache coalesces requests and preserves original timestamp on failure', async () => {
  let calls = 0;
  const loader = async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5));
    return { data: [1], source: 'https://www.ufc.com.br/rankings' };
  };
  const [a, b] = await Promise.all([
    cached('test', 1000, loader),
    cached('test', 1000, loader),
  ]);
  assert.equal(calls, 1);
  assert.equal(a.fetchedAt, b.fetchedAt);
  cache.get('test').expires = 0;
  const stale = await cached('test', 1000, async () => {
    throw Error('offline');
  });
  assert.equal(stale.freshness, 'snapshot');
  assert.equal(stale.fetchedAt, a.fetchedAt);
  cache.delete('test');
});
test('external links reject executable protocols', () => {
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('data:text/html,x'), null);
});
