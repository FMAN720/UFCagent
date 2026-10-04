'use client';
import { useLocale } from './locale';
import {
  AssistantStatus,
  AnalysisEvidence,
  BacktestPanel,
} from './assistant-panels';
import { useState, useEffect, useRef } from 'react';
import {
  ArrowUpRight,
  ArrowUp,
  Activity,
  CalendarDays,
  Users,
  Trophy,
  Swords,
  Hexagon,
  Sparkles,
  RefreshCw,
  LoaderCircle,
} from 'lucide-react';
import {
  api,
  date,
  Source,
  ErrorBox,
  RankingView,
  EventsView,
  NewsView,
  FighterPicker,
  FighterView,
  PredictionView,
  SearchResults,
  type Envelope,
} from './components';
const tabs = [
  { id: 'agent', label: '智能助手', icon: Sparkles },
  { id: 'events', label: '赛程与消息', icon: CalendarDays },
  { id: 'fighters', label: '选手档案', icon: Users },
  { id: 'rankings', label: '官方排名', icon: Trophy },
  { id: 'predict', label: '对阵预测', icon: Swords },
];
type Pick = {
  id: string;
  name: string;
};
export default function Home() {
  const { tx, locale, setLocale } = useLocale();
  const [tab, setTab] = useState('agent'),
    [input, setInput] = useState(''),
    [feedTab, setFeedTab] = useState('events');
  const [data, setData] = useState<Record<string, Envelope>>({}),
    [pending, setPending] = useState(''),
    [error, setError] = useState('');
  const [fighter, setFighter] = useState<Envelope | null>(null),
    [a, setA] = useState<Pick | null>(null),
    [b, setB] = useState<Pick | null>(null),
    [prediction, setPrediction] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]),
    [asking, setAsking] = useState(false);
  const context = useRef<string | null>(null);
  const mounted = useRef(true);
  const actionVersion = useRef(0);
  const askLock = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function load(action: string) {
    const version = ++actionVersion.current;
    setError('');
    setPending(action);
    try {
      const value = await api(action);
      if (mounted.current) setData((d) => ({ ...d, [action]: value }));
    } catch (e) {
      if (mounted.current && version === actionVersion.current)
        setError((e as Error).message);
    } finally {
      if (mounted.current && version === actionVersion.current) setPending('');
    }
  }
  useEffect(() => {
    void load('events');
  }, []);
  useEffect(() => {
    const key =
      tab === 'rankings' ? 'rankings' : tab === 'events' ? feedTab : null;
    if (key && !data[key]) void load(key);
  }, [tab, feedTab]);
  async function showFighter(id: string) {
    const version = ++actionVersion.current;
    setTab('fighters');
    setError('');
    setFighter(null);
    setPending('fighter');
    try {
      const value = await api('fighter', { id });
      if (version === actionVersion.current) {
        setFighter(value);
        context.current = id;
      }
    } catch (e) {
      if (version === actionVersion.current) setError((e as Error).message);
    } finally {
      if (version === actionVersion.current) setPending('');
    }
  }
  async function findFighter(name: string) {
    setTab('fighters');
    setError('');
    setPending('search');
    try {
      const value = await api('search', { q: name });
      setData((d) => ({ ...d, search: value }));
      if (value.data.length === 1) {
        await showFighter(value.data[0].id);
        return;
      }
    } catch (e) {
      setError((e as Error).message);
    }
    setPending('');
  }
  async function runPrediction() {
    if (!a || !b) return;
    setError('');
    setPending('predict');
    setPrediction(null);
    try {
      setPrediction(await api('predict', { a: a.id, b: b.id }, true));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending('');
    }
  }
  function selectBout(f: any[]) {
    setA({ id: f[0].id, name: f[0].name });
    setB({ id: f[1].id, name: f[1].name });
    setPrediction(null);
    setError('');
    setTab('predict');
  }
  async function ask(question: string) {
    if (!question.trim() || askLock.current) return;
    askLock.current = true;
    setAsking(true);
    setInput('');
    setMessages((m) => [...m, { question }]);
    try {
      const r = await fetch('/api/ufc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ask',
          question,
          locale,
          history: messages
            .filter((m) => m.question || m.answer?.text)
            .slice(-8)
            .map((m) => ({
              role: m.question ? 'user' : 'assistant',
              content: String(m.question || m.answer.text).slice(0, 1200),
            })),
          context: { fighterId: context.current },
        }),
      });
      const answer: any = await r.json();
      if (!r.ok) throw new Error(answer.error || '请求失败');
      if (answer.kind === 'fighter') context.current = answer.result.data.id;
      setMessages((m) => [...m, { answer }]);
      return { kind: answer.kind, text: answer.text || '查询完成' };
    } catch (e) {
      setMessages((m) => [
        ...m,
        { answer: { kind: 'error', text: (e as Error).message } },
      ]);
      return { error: (e as Error).message };
    } finally {
      setAsking(false);
      askLock.current = false;
    }
  }
  const askRef = useRef(ask);
  askRef.current = ask;
  useEffect(() => {
    const registry = (document as any).modelContext;
    if (!registry?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        registry.registerTool(
          {
            name: 'ask_ufc_agent',
            title: '查询 UFC 数据',
            description:
              '向 UFC 数据助手查询赛程、战绩、官方排名或比赛预测，并在当前页面显示回答。',
            inputSchema: {
              type: 'object',
              properties: {
                question: { type: 'string', minLength: 1, maxLength: 500 },
              },
              required: ['question'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: true },
            execute: async (value: unknown) => {
              const v = value as any;
              if (
                !v ||
                typeof v.question !== 'string' ||
                !v.question.trim() ||
                v.question.length > 500 ||
                Object.keys(v).some((k) => k !== 'question')
              )
                throw new Error('需要 1–500 字的问题');
              if (askLock.current) throw new Error('已有问题正在处理');
              setTab('agent');
              return await askRef.current(v.question);
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, []);
  const nextEvent = data.events?.data
    .filter((e: any) => e.status !== 'post' && Date.parse(e.date) > Date.now())
    .sort((a: any, b: any) => Date.parse(a.date) - Date.parse(b.date))[0];
  function answerView(answer: any) {
    return (
      <div className="answer">
        <div className="answer-label">
          <Hexagon size={18} />
          {tx(' OCTAGON ')}
          <span>{tx('检索与分析')}</span>
        </div>
        <AnalysisEvidence answer={answer} />
        {tx(
          answer.text && (
            <p className="answer-text">
              {answer.mode === 'ai' ? answer.text : tx(answer.text)}
            </p>
          ),
        )}
        {tx(
          answer.kind === 'error' && (
            <ErrorBox text="请稍后重试，也可切换到对应功能页查询。" />
          ),
        )}
        {tx(
          answer.kind === 'rankings' && (
            <RankingView
              value={answer.result}
              initialDivision={answer.filter.division}
              initialSystem={answer.filter.system}
              onFighter={findFighter}
            />
          ),
        )}{' '}
        {tx(
          answer.kind === 'events' && (
            <EventsView value={answer.result} onPredict={selectBout} />
          ),
        )}{' '}
        {tx(answer.kind === 'news' && <NewsView value={answer.result} />)}{' '}
        {tx(answer.kind === 'fighter' && <FighterView value={answer.result} />)}{' '}
        {tx(
          answer.kind === 'search' && (
            <SearchResults value={answer.result} onSelect={showFighter} />
          ),
        )}{' '}
        {tx(answer.kind === 'prediction' && <PredictionView value={answer} />)}
      </div>
    );
  }
  return (
    <div className="shell">
      <aside className="sidebar">
        <a className="brand" href="/">
          <Hexagon size={32} />
          <span>
            {tx('OCTAGON')}
            <small>{tx('UFC INTELLIGENCE')}</small>
          </span>
        </a>
        <div className="nav-label">{tx('你的八角笼情报站')}</div>
        <nav aria-label={tx('主导航')}>
          {tx(
            tabs.map((t) => (
              <button
                aria-current={tab === t.id ? 'page' : undefined}
                className={tab === t.id ? 'active' : ''}
                onClick={() => {
                  setTab(t.id);
                  setError('');
                }}
                key={t.id}
              >
                <t.icon size={19} />
                {tx(t.label)}
                <span>{tx('↗')}</span>
              </button>
            )),
          )}
        </nav>
        <div className="sidebar-bottom">
          <span className="dot" />
          {tx(' 数据可溯源')}
          <p>
            {tx('独立 UFC 数据助手')}
            <br />
            {tx('每一次判断，都有依据。')}
          </p>
          <a
            href="https://www.ufc.com.br/rankings"
            target="_blank"
            rel="noreferrer"
          >
            {tx('UFC 官方来源 ↗')}
          </a>
        </div>
      </aside>
      <div className="workspace">
        <header>
          <span>
            {tx('工作台 ')}
            <b>{tx('/')}</b> {tx(tabs.find((t) => t.id === tab)?.label)}
          </span>
          <div
            className="language-switch"
            role="group"
            aria-label={locale === 'zh' ? '界面语言' : 'Interface language'}
          >
            <button
              lang="zh-CN"
              aria-pressed={locale === 'zh'}
              onClick={() => setLocale('zh')}
            >
              中文
            </button>
            <button
              lang="en"
              aria-pressed={locale === 'en'}
              onClick={() => setLocale('en')}
            >
              English
            </button>
          </div>
        </header>
        <main>
          {tx(
            tab === 'agent' ? (
              <>
                <div className="eyebrow">{tx('THE FIGHT, IN FOCUS.')}</div>
                <h1>
                  {tx('读懂比赛。')}
                  <span>{tx('看见胜负之外。')}</span>
                </h1>
                <p className="intro">
                  {tx('从最新赛讯到技术对比，向你的 UFC 助手提问。')}
                </p>
                <section className="agent-box">
                  <div className="agent-label">
                    <Sparkles size={18} />
                    <b>{tx('OCTAGON 助手')}</b>
                    <span>{tx('基于公开数据')}</span>
                  </div>
                  <h2>{tx('今天，想了解八角笼里的什么？')}</h2>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void ask(input);
                    }}
                  >
                    <textarea
                      aria-label={tx('向 UFC 助手提问')}
                      maxLength={500}
                      required
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' &&
                          !e.shiftKey &&
                          !e.nativeEvent.isComposing
                        ) {
                          e.preventDefault();
                          void ask(input);
                        }
                      }}
                      placeholder={tx(
                        '例如：查询张伟丽的战绩，或者看看轻量级最新排名…',
                      )}
                    />
                    <div className="composer-bottom">
                      <span>{tx('Enter 发送 · Shift + Enter 换行')}</span>
                      <button
                        disabled={asking || !input.trim()}
                        className="send"
                        aria-label={tx('发送问题')}
                      >
                        {tx(
                          asking ? (
                            <LoaderCircle size={20} className="spin" />
                          ) : (
                            <ArrowUp size={20} />
                          ),
                        )}
                      </button>
                    </div>
                  </form>
                  <div className="chips">
                    {tx(
                      [
                        '最近有什么 UFC 比赛？',
                        '查看轻量级排名',
                        '查询张伟丽的战绩',
                      ].map((x) => (
                        <button
                          disabled={asking}
                          key={x}
                          onClick={() => void ask(tx(x))}
                        >
                          {tx(x)}
                          <ArrowUpRight size={14} />
                        </button>
                      )),
                    )}
                  </div>
                  <AssistantStatus />
                  {messages.length > 0 && (
                    <button
                      className="text-button"
                      disabled={asking}
                      onClick={() => {
                        setMessages([]);
                        context.current = null;
                      }}
                    >
                      {locale === 'en' ? 'Clear conversation' : '清空对话'}
                    </button>
                  )}
                </section>
                <div
                  className="conversation"
                  aria-live="polite"
                  aria-busy={asking}
                >
                  {tx(
                    messages.map((m, i) =>
                      m.question ? (
                        <div className="question" key={i}>
                          {m.question}
                        </div>
                      ) : (
                        <div key={i}>{tx(answerView(m.answer))}</div>
                      ),
                    ),
                  )}
                  {tx(
                    asking && (
                      <div className="loading">
                        <LoaderCircle size={18} className="spin" />
                        {tx(' 正在检索数据与核对来源…')}
                      </div>
                    ),
                  )}
                </div>
                {tx(
                  nextEvent && (
                    <button
                      className="next-event"
                      onClick={() => setTab('events')}
                    >
                      <CalendarDays size={21} />
                      <span>
                        <small>
                          {tx('下一场 · ')}
                          {tx(date(nextEvent.date))}
                          {tx(' 北京时间')}
                          {tx(
                            data.events.freshness === 'snapshot'
                              ? ' · 历史快照'
                              : '',
                          )}
                        </small>
                        <b>{tx(nextEvent.name)}</b>
                      </span>
                      <ArrowUpRight size={21} />
                    </button>
                  ),
                )}
                <div className="section-title">
                  <h2>{tx('进入比赛')}</h2>
                  <span>{tx('选择一个方向，开始探索')}</span>
                </div>
                <div className="feature-grid">
                  {tx(
                    tabs.slice(1).map((t, i) => (
                      <button
                        className="feature"
                        key={t.id}
                        onClick={() => {
                          setTab(t.id);
                          setError('');
                        }}
                      >
                        <div>
                          <t.icon size={23} />
                          <span>
                            {tx('0')}
                            {tx(i + 1)}
                          </span>
                        </div>
                        <h3>{tx(t.label)}</h3>
                        <p>
                          {tx(
                            [
                              '追踪赛事安排与最新消息',
                              '搜索选手与生涯比赛记录',
                              '浏览各量级与 P4P 榜单',
                              '比较统计数据与胜负倾向',
                            ][i],
                          )}
                        </p>
                        <ArrowUpRight size={20} />
                      </button>
                    )),
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="page-heading">
                  <div>
                    <div className="eyebrow">
                      {tx(
                        tab === 'rankings'
                          ? 'THE CONTENDERS'
                          : tab === 'fighters'
                            ? 'BEHIND THE RECORD'
                            : tab === 'predict'
                              ? 'EVERY MATCHUP HAS A STORY'
                              : 'ON THE FIGHT CALENDAR',
                      )}
                    </div>
                    <h1>{tx(tabs.find((t) => t.id === tab)?.label)}</h1>
                  </div>
                  {tx(
                    (tab === 'rankings' || tab === 'events') && (
                      <button
                        className="refresh"
                        disabled={!!pending}
                        onClick={() =>
                          void load(tab === 'rankings' ? 'rankings' : feedTab)
                        }
                      >
                        <RefreshCw
                          size={16}
                          className={pending ? 'spin' : ''}
                        />
                        {tx(' 重新获取')}
                      </button>
                    ),
                  )}
                </div>
                {tx(
                  tab === 'events' && (
                    <div className="feed-tabs">
                      <button
                        className={feedTab === 'events' ? 'selected' : ''}
                        onClick={() => setFeedTab('events')}
                      >
                        {tx('赛事安排')}
                      </button>
                      <button
                        className={feedTab === 'news' ? 'selected' : ''}
                        onClick={() => setFeedTab('news')}
                      >
                        {tx('最新消息')}
                      </button>
                    </div>
                  ),
                )}
                {tx(
                  tab === 'fighters' && (
                    <>
                      <p className="intro">
                        {tx('搜索职业 MMA 总战绩、个人资料与逐场比赛记录。')}
                      </p>
                      <FighterPicker
                        label={tx('搜索选手')}
                        onSelect={showFighter}
                      />
                      <div className="chips">
                        {tx(
                          ['张伟丽', '宋亚东', 'Valentina Shevchenko'].map(
                            (n) => (
                              <button
                                key={n}
                                onClick={() => void findFighter(n)}
                              >
                                {tx(n)}
                                <ArrowUpRight size={14} />
                              </button>
                            ),
                          ),
                        )}
                      </div>
                      {tx(
                        data.search && !fighter && (
                          <SearchResults
                            value={data.search}
                            onSelect={showFighter}
                          />
                        ),
                      )}
                    </>
                  ),
                )}
                {tx(
                  tab === 'predict' && (
                    <>
                      <p className="intro">
                        {tx(
                          '选择两位同量级选手，查看统计比较与可解释的胜负倾向。',
                        )}
                      </p>
                      <div className="predict-pickers">
                        <FighterPicker
                          label={tx('红方选手')}
                          selected={a}
                          onSelect={(id, name) => {
                            setA({ id, name });
                            setPrediction(null);
                          }}
                        />
                        <div className="vs-label">{tx('VS')}</div>
                        <FighterPicker
                          label={tx('蓝方选手')}
                          selected={b}
                          onSelect={(id, name) => {
                            setB({ id, name });
                            setPrediction(null);
                          }}
                        />
                      </div>
                      <div className="predict-actions">
                        <button
                          className="primary-button"
                          disabled={!a || !b || !!pending}
                          onClick={() => void runPrediction()}
                        >
                          <Swords size={18} />
                          {tx(' 开始分析')}
                        </button>
                        <button
                          className="text-button muted"
                          onClick={() => {
                            setA({ id: '4350762', name: 'Zhang Weili' });
                            setB({
                              id: '2554705',
                              name: 'Valentina Shevchenko',
                            });
                            setPrediction(null);
                          }}
                        >
                          {tx('试试：张伟丽 vs 舍甫琴科')}
                        </button>
                      </div>
                    </>
                  ),
                )}
                {tx(error && <ErrorBox text={error} />)}{' '}
                {tx(
                  pending && (
                    <div className="loading" role="status">
                      <LoaderCircle size={18} className="spin" />
                      {tx(' 正在获取数据…')}
                    </div>
                  ),
                )}
                {tx(
                  tab === 'rankings' && data.rankings && (
                    <RankingView
                      value={data.rankings}
                      onFighter={findFighter}
                    />
                  ),
                )}{' '}
                {tx(
                  tab === 'events' &&
                    data[feedTab] &&
                    (feedTab === 'events' ? (
                      <EventsView value={data.events} onPredict={selectBout} />
                    ) : (
                      <NewsView value={data.news} />
                    )),
                )}{' '}
                {tx(
                  tab === 'fighters' && fighter && (
                    <FighterView value={fighter} />
                  ),
                )}{' '}
                {tx(
                  tab === 'predict' && prediction && (
                    <PredictionView value={prediction} />
                  ),
                )}
                {tab === 'predict' && <BacktestPanel />}
              </>
            ),
          )}
          <footer>
            {tx('数据来源：UFC 官方网站 / ESPN ')}
            <span>{tx('预测存在不确定性 · 非 UFC 官方产品')}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
