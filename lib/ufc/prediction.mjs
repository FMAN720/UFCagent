import artifact from './model/artifact.json' with { type: 'json' };
import report from './model/report.json' with { type: 'json' };
import { featurePair, sigmoid, linear } from './backtest.mjs';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function heuristicPredict(a, b, ta = null, tb = null) {
  if (a.id === b.id) throw new Error('请选择两位不同的选手');
  if (!a.gender || !b.gender || a.gender !== b.gender)
    throw new Error('需要两位同性别选手的可比数据');
  if (!a.division || a.division !== b.division)
    throw new Error('当前模型仅支持资料中属于同一量级的选手');
  const rec = (f) => {
    if (!/^\d+-\d+-\d+$/.test(f.record || ''))
      throw new Error('选手战绩不足，无法生成预测');
    const [w, l, d] = f.record.split('-').map(Number);
    if (w + l + d < 5) throw new Error('至少需要 5 场职业比赛记录');
    return (w + 2) / (w + l + d + 4);
  };
  const form = (f) => {
    const results = f.history
      .filter(
        (h) =>
          ['W', 'L', 'D'].includes(h.result) &&
          Date.parse(h.date) <= Date.now(),
      )
      .slice(0, 5);
    return {
      n: results.length,
      score: results.reduce(
        (s, h) => s + (h.result === 'W' ? 1 : h.result === 'D' ? 0.5 : 0),
        0,
      ),
    };
  };
  const fa = form(a),
    fb = form(b);
  const factors = [
    {
      name: '生涯胜率（平滑后）',
      a: rec(a),
      b: rec(b),
      weight: 1.6,
      unit: 'ratio',
    },
    {
      name: '最近 5 场表现（平滑后）',
      a: (fa.score + 1) / (fa.n + 2),
      b: (fb.score + 1) / (fb.n + 2),
      weight: 1.2,
      unit: 'ratio',
    },
  ];
  if (ta && tb) {
    for (const [key, name, weight, scale, unit] of [
      ['slpm', '每分钟有效打击', 0.3, 3, '/分钟'],
      ['sapm', '每分钟承受打击', -0.28, 3, '/分钟'],
      ['tdAvg', '每 15 分钟抱摔', 0.24, 3, '/15分钟'],
      ['tdDefense', '防摔成功率', 0.28, 100, '%'],
      ['strikeDefense', '打击防守率', 0.22, 100, '%'],
    ]) {
      if (Number.isFinite(ta[key]) && Number.isFinite(tb[key]))
        factors.push({
          name,
          a: ta[key],
          b: tb[key],
          weight: weight / scale,
          unit,
        });
    }
  }
  const score = factors.reduce(
    (s, f) => s + clamp((f.a - f.b) * f.weight, -0.65, 0.65),
    0,
  );
  const p = Math.round(clamp(1 / (1 + Math.exp(-score)), 0.2, 0.8) * 100);
  return {
    a: { id: a.id, name: a.name, score: p },
    b: { id: b.id, name: b.name, score: 100 - p },
    factors,
    model: '规则倾向评分 · 未经历史验证',
    scoringMethod: 'heuristic',
    confidence: '未经验证',
    technical: !!(ta && tb),
    recentSample: [fa.n, fb.n],
    limitations: [
      '这是 0–100 的数据倾向评分，不是获胜概率。',
      '当前对阵未满足历史模型的样本或时效条件，回测报告不适用于本次规则评分。',
      '未纳入临场伤病、降重、备赛和对手强度；同量级历史均值无法完整描述风格克制。',
      ...(ta && tb ? [] : ['技术统计暂不可用，本次仅使用生涯战绩与近期赛果。']),
    ],
  };
}
export function predict(a, b, ta = null, tb = null) {
  const fallback = heuristicPredict(a, b, ta, tb);
  const sa = artifact.states[a.id],
    sb = artifact.states[b.id];
  const today = new Date().toISOString().slice(0, 10);
  const stale = (Date.parse(today) - Date.parse(artifact.asOf)) / 86400000 > 30;
  const newer = [a, b].some((f) =>
    f.history.some(
      (h) =>
        /^UFC\b/i.test(h.event || '') &&
        ['W', 'L'].includes(h.result) &&
        h.date?.slice(0, 10) > artifact.asOf &&
        Date.parse(h.date) < Date.now(),
    ),
  );
  if (!sa || !sb || sa.n < 3 || sb.n < 3 || stale || newer)
    return { ...fallback, historyAsOf: artifact.asOf };
  const score = Math.round(
    sigmoid(
      linear(artifact.weights, featurePair(sa, sb, today)) /
        artifact.temperature,
    ) * 100,
  );
  const rate = (s) => (s.wins + 2) / (s.n + 4),
    form = (s) =>
      (s.recent.reduce((x, y) => x + y, 0) + 1) / (s.recent.length + 2);
  const rest = (s) =>
    Math.max(
      0,
      Math.floor((Date.parse(today) - Date.parse(s.lastDate)) / 86400000),
    );
  return {
    a: { id: a.id, name: a.name, score },
    b: { id: b.id, name: b.name, score: 100 - score },
    model: '历史训练模型 · 实验性倾向评分',
    scoringMethod: 'historical',
    confidence: '仍需前瞻验证',
    technical: false,
    historyAsOf: artifact.asOf,
    factors: [
      {
        name: '历史 UFC 对手强度（Elo）',
        a: Math.round(sa.elo),
        b: Math.round(sb.elo),
        unit: '',
      },
      { name: '已收录 UFC 场次', a: sa.n, b: sb.n, unit: '' },
      {
        name: '历史 UFC 胜率（平滑后）',
        a: rate(sa),
        b: rate(sb),
        unit: 'ratio',
      },
      {
        name: '最近 5 场表现（平滑后）',
        a: form(sa),
        b: form(sb),
        unit: 'ratio',
      },
      { name: '距最近收录比赛', a: rest(sa), b: rest(sb), unit: '天' },
    ],
    recentSample: [sa.recent.length, sb.recent.length],
    validation: {
      modelId: report.modelId,
      n: report.models[0].n,
      accuracy: report.models[0].accuracy,
      brier: report.models[0].brier,
    },
    limitations: [
      '这是 0–100 的数据倾向评分，不是获胜概率。',
      '历史回测仅适用于覆盖条件内的比赛，不能保证这场对阵的结果。',
      '训练模型尚未优于所有简单基线；需持续进行未来比赛验证。',
      '仅使用已收录 UFC 赛果、对手强度、近期表现与休赛时间；未纳入伤病、降重或技术风格。',
    ],
  };
}
