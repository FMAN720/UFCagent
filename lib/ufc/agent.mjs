import {
  aliases,
  translateName,
  getRankings,
  getEvents,
  getNews,
  getFighter,
  searchFighters,
  getTechnical,
} from './data.mjs';
import { predict } from './prediction.mjs';
import { normalize } from './parsers.mjs';
import { fighterNames, divisions, searchName } from '../i18n/domain.mjs';
export async function predictionResult(aId, bId) {
  const [a, b] = await Promise.all([getFighter(aId), getFighter(bId)]);
  predict(a.data, b.data);
  const tech = await Promise.allSettled([
    getTechnical(a.data),
    getTechnical(b.data),
  ]);
  const ta = tech[0].status === 'fulfilled' ? tech[0].value : null,
    tb = tech[1].status === 'fulfilled' ? tech[1].value : null;
  return {
    kind: 'prediction',
    prediction: predict(a.data, b.data, ta?.data, tb?.data),
    sources: [a, b, ...[ta, tb].filter(Boolean)].map(
      ({ data, ...meta }) => meta,
    ),
  };
}
export async function resolveFighter(q) {
  const result = await searchFighters(translateName(q));
  const normalized = normalize(translateName(q));
  const exact = result.data.find((f) => normalize(f.name) === normalized);
  if (exact) return exact;
  if (result.data.length === 1) return result.data[0];
  return null;
}
export function planQuestion(question, context = {}) {
  const q = question.trim().replace(/[’‘]/g, "'");
  if (/排名|榜单|p4p|pound.for.pound|rank/i.test(q)) {
    let division = null;
    const female = /女子|\bwom[ae]n(?:'s)?\b/i.test(q);
    const labels = [
      '女子草量级',
      '女子蝇量级',
      '女子雏量级',
      '男子次中量级',
      '男子轻重量级',
      '男子重量级',
      '男子中量级',
      '男子轻量级',
      '男子羽量级',
      '男子雏量级',
      '男子蝇量级',
    ];
    for (const label of labels)
      if (
        q.includes(label) ||
        (!female && q.includes(label.replace('男子', '')))
      ) {
        division = label;
        break;
      }
    const english = Object.entries(divisions)
      .filter(([zh]) => zh.startsWith(female ? '女子' : '男子'))
      .sort((a, b) => b[1].length - a[1].length);
    for (const [zh, en] of english) {
      const term = en.replace(/^(Men's|Women's) /, '');
      if (new RegExp('\\b' + term + '\\b', 'i').test(q)) {
        division = zh;
        break;
      }
    }
    if (/p4p|pound.for.pound/i.test(q))
      division = female ? '女子 P4P' : '男子 P4P';
    return {
      action: 'rankings',
      division,
      system: /meta/i.test(q) ? 'meta' : 'media',
    };
  }
  if (/新闻|消息|赛讯|news/i.test(q)) return { action: 'news' };
  if (
    /赛程|最近.*比赛|下.*比赛|接下来|赛事|schedule|\bevents?\b|\b(upcoming|next|recent)\s+(ufc\s+)?(fights?|results?|cards?)\b/i.test(
      q,
    )
  )
    return { action: 'events' };
  const names = Object.entries(aliases)
    .filter(([cn]) => q.includes(cn))
    .map(([, en]) => en);
  for (const zh of Object.values(fighterNames)) {
    const canonical = searchName(zh);
    if (q.includes(zh) && !names.includes(canonical)) names.push(canonical);
  }
  const unique = [...new Set(names)];
  if (
    /预测|谁.*赢|对阵|\bvs\b| versus |对比|\bpredict\b|\bcompare\b|who.*win/i.test(
      q,
    )
  ) {
    if (unique.length >= 2)
      return { action: 'predict', names: unique.slice(0, 2) };
    const pair = q
      .replace(/^(预测|对比|分析|predict|compare|who wins:?)\s*/i, '')
      .split(/\s+(?:vs\.?|versus|and)\s+|对阵|对比|\s*和\s*/i)
      .map((x) => x.replace(/谁会赢|谁赢|的比赛|的结果|[？?。]/g, '').trim());
    if (pair.length === 2 && pair.every(Boolean))
      return { action: 'predict', names: pair };
    return {
      action: 'help',
      text: '请写出两位选手，例如「预测 Zhang Weili vs Valentina Shevchenko」，或到对阵预测页选择选手。',
    };
  }
  if (unique.length) return { action: 'fighter', query: unique[0] };
  if (
    /^(他|她|这位选手|(?:show\s+)?(?:his|her|their|this fighter)\b)/i.test(q) &&
    context.fighterId
  )
    return { action: 'fighter', id: context.fighterId };
  const name = q
    .replace(/^(请|帮我|我想|了解|查询|查看|搜索|查一下|查|选手)\s*/g, '')
    .replace(
      /^(?:please\s+)?(?:show|find|search(?: for)?|look up|tell me about|query)\s+/i,
      '',
    )
    .replace(/的?(最新)?(战绩|资料|档案|职业生涯|比赛记录).*$/, '')
    .replace(
      /(?:'s)?\s+(?:record|stats|profile|fight history|career)(?:\s+.*)?$/i,
      '',
    )
    .replace(/[？?。]/g, '')
    .trim();
  if (/^[a-zA-ZÀ-ž .'’-]{2,80}$/.test(name))
    return { action: 'fighter', query: name };
  return {
    action: 'help',
    text: '我可以检索赛程、最新消息、官方排名和选手战绩，也能进行统计预测。试试「女子蝇量级排名」「查询宋亚东的战绩」或使用选手英文姓名。当前使用数据工具路由，自由问答模型尚未配置。',
  };
}
export async function askAgent(question, context = {}) {
  const plan = planQuestion(question, context);
  if (plan.action === 'rankings') {
    const result = await getRankings();
    return {
      kind: 'rankings',
      text:
        '以下为 UFC 官方网站公布的' +
        (plan.system === 'meta' ? ' Meta 榜单。' : '媒体排名。'),
      result,
      filter: plan,
    };
  }
  if (plan.action === 'events')
    return {
      kind: 'events',
      text: '以下赛事按北京时间展示，比赛安排以来源后续更新为准。',
      result: await getEvents(),
    };
  if (plan.action === 'news')
    return {
      kind: 'news',
      text: '以下为 ESPN 最新 UFC 消息，保留原标题便于核对。',
      result: await getNews(),
    };
  if (plan.action === 'predict') {
    const fighters = await Promise.all(plan.names.map(resolveFighter));
    if (fighters.some((f) => !f))
      return {
        kind: 'text',
        text: '没有唯一匹配到这两位选手，请使用完整英文姓名或到对阵预测页搜索选择。',
      };
    return predictionResult(fighters[0].id, fighters[1].id);
  }
  if (plan.action === 'fighter') {
    if (plan.id) return { kind: 'fighter', result: await getFighter(plan.id) };
    const fighter = await resolveFighter(plan.query);
    if (fighter)
      return { kind: 'fighter', result: await getFighter(fighter.id) };
    return {
      kind: 'search',
      text: '请选择匹配的选手。',
      result: await searchFighters(plan.query),
    };
  }
  return { kind: 'text', text: plan.text };
}
