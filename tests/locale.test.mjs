import test from 'node:test';
import assert from 'node:assert/strict';
import { localize, chooseLocale } from '../lib/i18n/locale.mjs';
import { displayDomain, searchName } from '../lib/i18n/domain.mjs';
import { planQuestion } from '../lib/ufc/agent.mjs';
test('alternate English name order is not mistaken for a second opponent', () => {
  assert.deepEqual(planQuestion('预测 张伟丽 vs 亚历克萨·格拉索').names, ['Zhang Weili', 'Alexa Grasso']);
});
import {
  parseTranslation,
  translateHeadline,
} from '../lib/ufc/translation.mjs';
test('language preference honors saved choice and survives unavailable storage', () => {
  assert.equal(chooseLocale('en', 'zh-CN'), 'en');
  assert.equal(chooseLocale('zh', 'en-US'), 'zh');
  assert.equal(chooseLocale(null, 'en-GB'), 'en');
  assert.equal(chooseLocale('bad', 'zh-CN'), 'zh');
});
test('fighter records translate known terms and names without changing identity or numbers', () => {
  assert.equal(localize('Justin Gaethje', 'zh'), '贾斯汀·盖奇');
  assert.equal(localize('Justin Gaethje', 'en'), 'Justin Gaethje');
  assert.equal(searchName('贾斯汀盖奇'), 'Justin Gaethje');
  assert.equal(localize('张伟丽', 'en'), 'Zhang Weili');
  assert.equal(localize('Decision - Unanimous', 'zh'), '一致判定');
  assert.equal(localize('Southpaw', 'zh'), '左架');
  assert.equal(localize('China', 'zh'), '中国');
  assert.equal(localize('26-4-0', 'zh'), '26-4-0');
  assert.equal(localize('Unknown Fighter', 'zh'), 'Unknown Fighter');
  assert.equal(localize(73, 'en'), 73);
});
test('units, divisions and event titles follow locale while source names remain recoverable', () => {
  assert.equal(displayDomain('125 lbs', 'zh'), '56.7 千克');
  assert.equal(displayDomain('63"', 'zh'), '160.0 厘米');
  assert.equal(localize('女子蝇量级', 'en'), "Women's Flyweight");
  assert.equal(localize("Women's Flyweight", 'zh'), '女子蝇量级');
  assert.equal(
    localize('UFC Fight Night: Hooker vs. Parnasse', 'zh'),
    'UFC 格斗之夜: 胡克 对阵 帕纳斯',
  );
});
test('English and Chinese questions route to equivalent tools and preserve division specificity', () => {
  for (const [question, expected] of [
    ['Upcoming UFC events', { action: 'events' }],
    ['Show Zhang Weili’s record', { action: 'fighter', query: 'Zhang Weili' }],
    [
      'Women’s flyweight rankings',
      { action: 'rankings', division: '女子蝇量级', system: 'media' },
    ],
    [
      'Light heavyweight Meta rankings',
      { action: 'rankings', division: '男子轻重量级', system: 'meta' },
    ],
  ])
    assert.deepEqual(planQuestion(question), expected);
  assert.deepEqual(
    planQuestion('Predict Zhang Weili vs Valentina Shevchenko').names,
    ['Zhang Weili', 'Valentina Shevchenko'],
  );
  assert.equal(
    planQuestion('Her record', { fighterId: '4350762' }).id,
    '4350762',
  );
});
test('translation quota/errors cannot masquerade as a translated headline', () => {
  assert.throws(() =>
    parseTranslation(
      {
        responseStatus: 403,
        responseData: { translatedText: 'MYMEMORY WARNING' },
      },
      'Original',
    ),
  );
  assert.throws(() =>
    parseTranslation(
      {
        responseStatus: 200,
        quotaFinished: true,
        responseData: { translatedText: '限制' },
      },
      'Original',
    ),
  );
  assert.throws(() =>
    parseTranslation(
      { responseStatus: 200, responseData: { translatedText: 'Original' } },
      'Original',
    ),
  );
  assert.equal(
    parseTranslation(
      { responseStatus: 200, responseData: { translatedText: '宋亚东获胜' } },
      'Song wins',
    ),
    '宋亚东获胜',
  );
});
test('headline translation coalesces requests, preserves original and honestly falls back', async () => {
  let count = 0;
  const request = async () => {
    count++;
    await new Promise((r) => setTimeout(r, 5));
    return new Response(
      JSON.stringify({
        responseStatus: 200,
        responseData: { translatedText: '测试新闻中文标题' },
      }),
    );
  };
  const [a, b] = await Promise.all([
    translateHeadline('A unique test headline', request),
    translateHeadline('A unique test headline', request),
  ]);
  assert.equal(count, 1);
  assert.equal(a.status, 'machine');
  assert.equal(a.title, 'A unique test headline');
  assert.deepEqual(a, b);
  const fail = await translateHeadline('A second unique headline', async () => {
    throw Error('offline');
  });
  assert.equal(fail.status, 'unavailable');
  assert.equal(fail.translatedTitle, null);
  assert.equal(fail.title, 'A second unique headline');
});
test('MMA translation glossary avoids interpreting fighters as aircraft', () => {
  assert.equal(
    parseTranslation(
      {
        responseStatus: 200,
        responseData: { translatedText: 'UFC战斗机为下一场战斗做好准备' },
      },
      'UFC fighters prepare for their next fight',
    ),
    'UFC选手为下一场比赛做好准备',
  );
});
