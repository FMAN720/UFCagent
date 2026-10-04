'use client';
import { useLocale } from './locale';
import { useState, useEffect } from 'react';
import {
  ExternalLink,
  Search,
  ChevronDown,
  Trophy,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
export type Envelope = {
  data: any;
  source: string;
  fetchedAt: string;
  freshness: string;
  warning?: string | null;
};
export const date = (v: string, time = true) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? '日期未公布'
    : new Intl.DateTimeFormat('zh-CN', {
        timeZone: 'Asia/Shanghai',
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        ...(time ? { hour: '2-digit', minute: '2-digit' } : {}),
      }).format(d);
};
export async function api(
  action: string,
  args: Record<string, string> = {},
  post = false,
) {
  const r = await fetch(
    post ? '/api/ufc' : '/api/ufc?' + new URLSearchParams({ action, ...args }),
    post
      ? {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...args }),
        }
      : {},
  );
  const result: any = await r.json();
  if (!r.ok) throw new Error(result.error || '请求失败');
  return result;
}
export function Source({ value }: { value: Omit<Envelope, 'data'> }) {
  const { tx, locale, setLocale } = useLocale();
  return (
    <div
      className={'source ' + (value.freshness === 'snapshot' ? 'stale' : '')}
    >
      <span>
        {tx(
          value.freshness === 'live'
            ? '刚刚抓取'
            : value.freshness === 'cache'
              ? '有效期内缓存'
              : '历史快照',
        )}
        {tx(' · 抓取于 ')}
        {tx(date(value.fetchedAt))}
      </span>
      <a href={value.source} target="_blank" rel="noreferrer">
        {tx('查看来源 ')}
        <ExternalLink size={12} />
      </a>
      {tx(
        value.warning && (
          <p>
            <AlertCircle size={13} />
            {tx(value.warning)}
          </p>
        ),
      )}
    </div>
  );
}
export function ErrorBox({ text }: { text: string }) {
  const { tx, locale, setLocale } = useLocale();
  return (
    <div className="error" role="alert">
      <AlertCircle size={17} />
      {tx(text)}
    </div>
  );
}
export function RankingView({
  value,
  initialDivision,
  initialSystem = 'media',
  onFighter,
}: {
  value: Envelope;
  initialDivision?: string | null;
  initialSystem?: string;
  onFighter: (name: string) => void;
}) {
  const { tx, locale, setLocale } = useLocale();
  const [system, setSystem] = useState(initialSystem);
  const [division, setDivision] = useState(initialDivision || '男子轻量级');
  const options = value.data.filter((d: any) => d.system === system);
  const selected = options.find((d: any) => d.name === division) || options[0];
  return (
    <section className="result-panel">
      <div className="toolbar">
        <div className="segmented">
          <button
            onClick={() => setSystem('media')}
            className={system === 'media' ? 'selected' : ''}
          >
            {tx('官方媒体榜')}
          </button>
          <button
            onClick={() => setSystem('meta')}
            className={system === 'meta' ? 'selected' : ''}
          >
            {tx('官方 Meta 榜')}
          </button>
        </div>
        <select
          aria-label={tx('选择量级')}
          value={selected?.name || ''}
          onChange={(e) => setDivision(e.target.value)}
        >
          {tx(
            options.map((d: any) => (
              <option key={d.id} value={d.name}>
                {tx(d.name)}
              </option>
            )),
          )}
        </select>
      </div>
      <p className="hint">
        {tx(
          '两个榜单使用不同评价体系；它们都来自官方页面，并非绝对实力排序。未公布的量级不会补造排名。',
        )}
      </p>
      {tx(
        selected ? (
          <>
            <div className="rank-heading">
              <div>
                <span className="eyebrow">
                  {tx(
                    system === 'meta' ? 'META RANKINGS' : 'OFFICIAL RANKINGS',
                  )}
                </span>
                <h2>{tx(selected.name)}</h2>
              </div>
              <Trophy size={28} />
            </div>
            {tx(
              selected.champion && (
                <button
                  className="champion"
                  onClick={() => onFighter(selected.champion.name)}
                >
                  <span className="belt">{tx('C')}</span>
                  <div>
                    <small>{tx('现任冠军')}</small>
                    <strong>{tx(selected.champion.name)}</strong>
                  </div>
                  <ArrowRight size={20} />
                </button>
              ),
            )}
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tx('排名')}</th>
                    <th>{tx('选手')}</th>
                    <th>{tx('变动')}</th>
                    <th>{tx('来源')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tx(
                    selected.rows.map((r: any) => (
                      <tr key={r.rank + '-' + r.name}>
                        <td className="rank-number">
                          {tx(String(r.rank).padStart(2, '0'))}
                        </td>
                        <td>
                          <button
                            className="text-button"
                            onClick={() => onFighter(r.name)}
                          >
                            {tx(r.name)}
                          </button>
                        </td>
                        <td
                          className={
                            r.change > 0
                              ? 'positive'
                              : r.change < 0
                                ? 'negative'
                                : 'muted'
                          }
                        >
                          {tx(
                            r.change > 0
                              ? '↑ ' + r.change
                              : r.change < 0
                                ? '↓ ' + Math.abs(r.change)
                                : '—',
                          )}
                        </td>
                        <td>
                          {tx(
                            r.url && (
                              <a
                                className="external"
                                href={r.url}
                                target="_blank"
                                rel="noreferrer"
                                aria-label={tx('查看 ' + r.name + ' 官方档案')}
                              >
                                <ExternalLink size={15} />
                              </a>
                            ),
                          )}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="empty">{tx('该榜单暂无数据。')}</p>
        ),
      )}
      <Source value={value} />
    </section>
  );
}
export function EventsView({
  value,
  onPredict,
}: {
  value: Envelope;
  onPredict?: (fighters: any[]) => void;
}) {
  const { tx, locale, setLocale } = useLocale();
  const [filter, setFilter] = useState('upcoming');
  const list = value.data
    .filter(
      (e: any) =>
        filter === 'all' ||
        (filter === 'completed' ? e.status === 'post' : e.status !== 'post'),
    )
    .sort((a: any, b: any) =>
      filter === 'completed'
        ? Date.parse(b.date) - Date.parse(a.date)
        : Date.parse(a.date) - Date.parse(b.date),
    );
  return (
    <section>
      <div className="toolbar">
        <div className="segmented">
          {tx(
            [
              ['upcoming', '即将开赛'],
              ['completed', '近期赛果'],
              ['all', '全部赛事'],
            ].map(([v, t]) => (
              <button
                key={v}
                onClick={() => setFilter(v)}
                className={filter === v ? 'selected' : ''}
              >
                {tx(t)}
              </button>
            )),
          )}
        </div>
        <span className="hint">{tx('北京时间 · 已公布赛程')}</span>
      </div>
      {tx(
        !list.length && (
          <p className="empty">
            {tx('当前数据中没有此类赛事。请核对下方抓取时间。')}
          </p>
        ),
      )}
      <div className="event-list">
        {tx(
          list.map((e: any) => (
            <article className="event-card" key={e.id}>
              <div className="event-top">
                <div className="event-date">
                  {tx(date(e.date, false).slice(5))}
                  <small>
                    {tx(date(e.date).slice(-5))}
                    {tx(' 北京')}
                  </small>
                </div>
                <div>
                  <span
                    className={'status ' + (e.status === 'post' ? 'muted' : '')}
                  >
                    {tx(
                      e.status === 'post'
                        ? '已结束'
                        : e.status === 'in'
                          ? '比赛进行中'
                          : Date.parse(e.date) < Date.now()
                            ? '状态待更新'
                            : '即将开赛',
                    )}
                  </span>
                  <h3>{tx(e.name)}</h3>
                  <p>{tx(e.venue || '场地待公布')}</p>
                </div>
                {tx(
                  e.url && (
                    <a
                      href={e.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={tx('查看 ' + e.name)}
                    >
                      <ExternalLink size={18} />
                    </a>
                  ),
                )}
              </div>
              <details>
                <summary>
                  {tx(e.bouts.length)}
                  {tx(' 场已公布对阵 ')}
                  <ChevronDown size={15} />
                </summary>
                {tx(
                  e.bouts.map((b: any) => (
                    <div className="bout" key={b.id}>
                      <span>{tx(b.division)}</span>
                      <div>
                        {tx(
                          b.fighters.map((f: any, i: number) => (
                            <span key={f.id}>
                              {tx(i > 0 && <em>{tx('VS')}</em>)}
                              <b className={f.winner ? 'positive' : ''}>
                                {tx(f.name)}
                                {tx(f.winner ? ' ✓' : '')}
                              </b>
                              <small>{tx(f.record || '战绩未公布')}</small>
                            </span>
                          )),
                        )}
                      </div>
                      {tx(
                        onPredict &&
                          b.fighters.length === 2 &&
                          b.status !== 'post' && (
                            <button
                              className="small-button"
                              onClick={() => onPredict(b.fighters)}
                            >
                              {tx('分析')}
                            </button>
                          ),
                      )}
                    </div>
                  )),
                )}
              </details>
            </article>
          )),
        )}
      </div>
      <Source value={value} />
    </section>
  );
}
type HeadlineTranslation = {
  id: string;
  title: string;
  translatedTitle: string | null;
  status: string;
};
let headlineRequest: Promise<any> | null = null;
let headlineRequestUntil = 0;
function requestHeadlines() {
  if (!headlineRequest || Date.now() > headlineRequestUntil) {
    headlineRequestUntil = Date.now() + 60000;
    headlineRequest = api('news-translations').catch((e) => {
      headlineRequest = null;
      throw e;
    });
  }
  return headlineRequest;
}
export function NewsView({ value }: { value: Envelope }) {
  const { locale, tx } = useLocale();
  const [translations, setTranslations] = useState<HeadlineTranslation[]>([]);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [original, setOriginal] = useState(false);
  useEffect(() => {
    if (locale !== 'zh') return;
    let active = true;
    setBusy(true);
    setFailed(false);
    requestHeadlines()
      .then((result) => {
        if (active) setTranslations(result.items);
      })
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [locale, value.fetchedAt]);
  return (
    <section>
      <div className="toolbar">
        <p className="hint">
          {locale === 'zh'
            ? '新闻标题提供中文译文，原文链接保持不变。'
            : 'Read the original English headlines and open the full reports.'}
        </p>
        {locale === 'zh' && (
          <button
            className="refresh"
            aria-pressed={original}
            onClick={() => setOriginal((v) => !v)}
          >
            {original ? '显示中文' : '查看英文原文'}
          </button>
        )}
      </div>
      {locale === 'zh' && (
        <p className="hint translation-notice">
          {busy
            ? '正在翻译新闻标题…'
            : failed
              ? '翻译服务暂不可用，当前显示英文原文。'
              : '新增标题由 MyMemory 机器翻译；译文仅供辅助阅读，请以原文为准。'}{' '}
          <a
            href="https://mymemory.translated.net"
            target="_blank"
            rel="noreferrer"
          >
            MyMemory ↗
          </a>
        </p>
      )}
      <div className="news-list">
        {value.data.map((n: any, i: number) => {
          const translation = translations.find(
            (item) => item.id === n.id && item.title === n.title,
          );
          const translated =
            locale === 'zh' && !original && translation?.translatedTitle;
          return (
            <a
              className="news-item"
              href={n.url}
              key={n.id}
              target="_blank"
              rel="noreferrer"
            >
              <span className="news-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <small>ESPN · {date(n.date)}</small>
                <h3 lang={translated ? 'zh-CN' : 'en'}>
                  {translated || n.title}
                </h3>
                {locale === 'zh' && !original && (
                  <small className="translation-label">
                    {translation?.status === 'curated'
                      ? '中文译文'
                      : translated
                        ? '机器翻译'
                        : busy
                          ? '正在翻译 · 暂示原文'
                          : '译文暂不可用 · 英文原文'}
                  </small>
                )}
              </div>
              <ExternalLink size={17} />
            </a>
          );
        })}
      </div>
      {!value.data.length && <p className="empty">{tx('暂无已公布消息。')}</p>}
      <Source value={value} />
    </section>
  );
}
export function SearchResults({
  value,
  onSelect,
}: {
  value: Envelope;
  onSelect: (id: string, name: string) => void;
}) {
  const { tx, locale, setLocale } = useLocale();
  return (
    <div>
      {tx(
        value.data.length ? (
          <div className="search-results">
            {tx(
              value.data.map((f: any) => (
                <button key={f.id} onClick={() => onSelect(f.id, f.name)}>
                  <span className="initials">
                    {tx(
                      f.name
                        .split(' ')
                        .map((w: string) => w[0])
                        .slice(0, 2)
                        .join(''),
                    )}
                  </span>
                  <b>{tx(f.name)}</b>
                  <ArrowRight size={17} />
                </button>
              )),
            )}
          </div>
        ) : (
          <p className="empty">{tx('没有找到匹配选手。试试完整英文姓名。')}</p>
        ),
      )}
      <Source value={value} />
    </div>
  );
}
export function FighterPicker({
  label,
  onSelect,
  selected,
}: {
  label: string;
  onSelect: (id: string, name: string) => void;
  selected?: {
    id: string;
    name: string;
  } | null;
}) {
  const { tx, locale, setLocale } = useLocale();
  const [query, setQuery] = useState('');
  const [value, setValue] = useState<Envelope | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function search(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    setValue(null);
    try {
      setValue(await api('search', { q: query.trim() }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="picker">
      <label>{tx(label)}</label>
      <form className="search-form" onSubmit={search}>
        <Search size={18} />
        <input
          aria-label={tx(label)}
          required
          minLength={2}
          maxLength={80}
          placeholder={tx('中文常用名 / 英文姓名')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button disabled={busy}>{tx(busy ? '搜索中…' : '搜索')}</button>
      </form>
      {tx(
        selected && (
          <p className="picked">
            {tx('已选择：')}
            {tx(selected.name)}
          </p>
        ),
      )}
      {tx(error && <ErrorBox text={error} />)}
      <div aria-live="polite">
        {tx(
          value && (
            <SearchResults
              value={value}
              onSelect={(id, name) => {
                onSelect(id, name);
                setValue(null);
              }}
            />
          ),
        )}
      </div>
    </div>
  );
}
export function FighterView({ value }: { value: Envelope }) {
  const { tx, locale, setLocale } = useLocale();
  const f = value.data;
  return (
    <section className="result-panel">
      <div className="fighter-heading">
        <div className="fighter-monogram">
          {tx(
            f.name
              .split(' ')
              .map((w: string) => w[0])
              .slice(0, 2)
              .join(''),
          )}
        </div>
        <div>
          <span className="eyebrow">{tx(f.nickname || 'FIGHTER PROFILE')}</span>
          <h2>{tx(f.name)}</h2>
          <p>
            {tx(f.country || '国家未知')}
            {tx(' · ')}
            {tx(f.division || '量级未知')}
          </p>
        </div>
        <div className="record">
          <strong>{tx(f.record || '—')}</strong>
          <span>{tx('职业 MMA 胜–负–平')}</span>
        </div>
      </div>
      <p className="hint">
        {tx(
          '战绩为来源记载的职业 MMA 总战绩，并非仅 UFC 战绩；无效场次未计入该三项展示。',
        )}
      </p>
      <div className="stat-grid">
        {tx(
          [
            ['年龄', f.age ? f.age + ' 岁' : null],
            ['身高', f.height],
            ['臂展', f.reach],
            ['站姿', f.stance],
            ['KO/TKO 胜–负', f.ko],
            ['降服 胜–负', f.submissions],
          ].map(([label, v]) => (
            <div key={label}>
              <span>{tx(label)}</span>
              <b>{tx(v || '未公布')}</b>
            </div>
          )),
        )}
      </div>
      <h3>
        {tx('比赛记录 ')}
        <small className="muted">
          {tx('来源已收录 ')}
          {tx(f.history.length)}
          {tx(' 场')}
        </small>
      </h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tx('结果')}</th>
              <th>{tx('对手 / 赛事')}</th>
              <th>{tx('日期')}</th>
              <th>{tx('方式')}</th>
              <th>{tx('回合')}</th>
            </tr>
          </thead>
          <tbody>
            {tx(
              f.history.map((h: any) => (
                <tr key={h.id}>
                  <td>
                    <span
                      className={
                        'result-tag ' +
                        (h.result === 'W'
                          ? 'win'
                          : h.result === 'L'
                            ? 'loss'
                            : '')
                      }
                    >
                      {tx(h.result || '—')}
                    </span>
                  </td>
                  <td>
                    <b>{tx(h.opponent)}</b>
                    <small>
                      {tx(
                        h.url ? (
                          <a href={h.url} target="_blank" rel="noreferrer">
                            {tx(h.event)}
                            {tx(' ↗')}
                          </a>
                        ) : (
                          h.event
                        ),
                      )}
                    </small>
                  </td>
                  <td>{tx(date(h.date, false))}</td>
                  <td>{tx(h.method)}</td>
                  <td>{tx(h.round || '—')}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      {tx(
        !f.history.length && (
          <p className="empty">{tx('来源暂无比赛记录。')}</p>
        ),
      )}
      <Source value={value} />
    </section>
  );
}
export function PredictionView({ value }: { value: any }) {
  const { tx, locale, setLocale } = useLocale();
  const p = value.prediction;
  return (
    <section className="result-panel">
      <div className="prediction-title">
        <span className="eyebrow">{tx('MATCHUP ANALYSIS')}</span>
        <span className="status">
          {tx('验证状态：')}
          {tx(p.confidence)}
        </span>
      </div>
      <div className="versus">
        <div>
          <h3>{tx(p.a.name)}</h3>
          <strong>
            {tx(p.a.score)}
            <small>{tx('分')}</small>
          </strong>
        </div>
        <span>{tx('VS')}</span>
        <div>
          <h3>{tx(p.b.name)}</h3>
          <strong>
            {tx(p.b.score)}
            <small>{tx('分')}</small>
          </strong>
        </div>
      </div>
      <div
        className="probability-bar"
        aria-label={tx(
          `${tx(p.a.name)} ${p.a.score} / 100, ${tx(p.b.name)} ${p.b.score} / 100`,
        )}
      >
        <span style={{ width: p.a.score + '%' }} />
      </div>
      <p className="hint">
        {tx(p.model)}
        {tx(' · 数据倾向评分，不是获胜概率')}
      </p>
      {p.historyAsOf && (
        <p className="hint">
          {tx('历史模型数据截至：')}
          {p.historyAsOf}
        </p>
      )}
      <h3>{tx('比较依据')}</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{tx('指标')}</th>
              <th>{tx(p.a.name)}</th>
              <th>{tx(p.b.name)}</th>
            </tr>
          </thead>
          <tbody>
            {tx(
              p.factors.map((f: any) => (
                <tr key={f.name}>
                  <td>{tx(f.name)}</td>
                  <td>
                    {tx(
                      f.unit === 'ratio'
                        ? (f.a * 100).toFixed(1) + '%'
                        : f.a + ' ' + f.unit,
                    )}
                  </td>
                  <td>
                    {tx(
                      f.unit === 'ratio'
                        ? (f.b * 100).toFixed(1) + '%'
                        : f.b + ' ' + f.unit,
                    )}
                  </td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>
      <div className="limitations">
        <b>{tx('如何看待这个结果')}</b>
        <ul>
          {tx(p.limitations.map((s: string) => <li key={s}>{tx(s)}</li>))}
        </ul>
        <p>
          {tx('近期可用样本：')}
          {tx(p.a.name)} {tx(p.recentSample[0])}
          {tx(' 场 / ')}
          {tx(p.b.name)} {tx(p.recentSample[1])}
          {tx(' 场。')}
        </p>
      </div>
      {tx(
        value.sources.map((s: any, i: number) => <Source key={i} value={s} />),
      )}
    </section>
  );
}
