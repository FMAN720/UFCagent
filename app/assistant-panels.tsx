'use client';
import { useEffect, useState } from 'react';
import { useLocale } from './locale';
import { api, ErrorBox, Source } from './components';

export function AssistantStatus() {
  const { locale } = useLocale();
  const en = locale === 'en';
  const [status, setStatus] = useState<any>(null),
    [error, setError] = useState('');
  async function refresh() {
    setError('');
    try {
      setStatus(await api('assistant-status'));
    } catch {
      setError(
        en ? 'Could not check assistant status.' : '暂时无法检查助手状态。',
      );
    }
  }
  useEffect(() => {
    void refresh();
  }, []);
  return (
    <div className="assistant-status">
      <div className="assistant-status-line">
        <strong>
          {status
            ? status.configured
              ? en
                ? 'AI configured'
                : 'AI 已配置'
              : en
                ? 'Data queries · AI not configured'
                : '数据查询 · AI 尚未配置'
            : en
              ? 'Checking assistant…'
              : '正在检查助手…'}
        </strong>
        <button className="text-button" onClick={() => void refresh()}>
          {en ? 'Check again' : '重新检查'}
        </button>
      </div>
      {error && <p role="alert">{error}</p>}
      {status?.configured ? (
        <p>
          {status.model} ·{' '}
          {en
            ? 'The connection is verified when you send a question. Replies identify AI analysis or fallback data queries.'
            : '发送问题时验证连接；每条回复会标明 AI 分析或降级数据查询。'}
        </p>
      ) : (
        <p>
          {en
            ? 'Records, rankings and matchup scores work now. Free-form analysis needs a model connection.'
            : '战绩、排名和对阵评分可直接使用。自由问答和深入分析需要连接模型。'}
        </p>
      )}
      <details>
        <summary>
          {en ? 'Model setup and data use' : '模型设置与数据使用'}
        </summary>
        <p>
          {en
            ? 'The site owner configures a server-side API key. Local use: copy .env.example to .dev.vars, fill UFC_MODEL_API_KEY, then restart npm run dev. Never use a NEXT_PUBLIC_ or VITE_ key variable.'
            : '由站点所有者配置服务端 API 密钥。本地使用：复制 .env.example 为 .dev.vars，填写 UFC_MODEL_API_KEY，然后重新运行 npm run dev。密钥变量不要加 NEXT_PUBLIC_ 或 VITE_ 前缀。'}
        </p>
        <p>
          {en
            ? 'For the hosted site, set the same keys in Sites runtime environment settings. Compatible providers can set the base URL, model name and chat protocol described in the README.'
            : '线上版本需在 Sites 运行环境中设置同名变量。其他兼容服务可按 README 配置接口地址、模型名称和 chat 协议。'}
        </p>
        <p>
          {en
            ? 'When AI is enabled, the selected provider receives your question, up to 8 recent messages and retrieved public UFC data. This app keeps the conversation in this page’s memory; API usage is billed by your provider.'
            : '启用 AI 后，问题、最多 8 条近期消息及检索到的公开 UFC 数据会发送给所选模型服务。应用将对话保存在当前页面内存中；API 使用由模型服务计费。'}
        </p>
      </details>
    </div>
  );
}

export function AnalysisEvidence({ answer }: { answer: any }) {
  const { tx, locale } = useLocale();
  const en = locale === 'en';
  return (
    <>
      {answer.notice && <p className="assistant-notice">{tx(answer.notice)}</p>}
      {answer.mode && (
        <p className="answer-mode">
          {answer.mode === 'ai'
            ? (en ? 'AI analysis' : 'AI 分析') + ' · ' + answer.model
            : en
              ? 'Data query mode'
              : '数据查询模式'}
        </p>
      )}
      {answer.mode === 'ai' && (
        <details className="evidence">
          <summary>
            {en ? 'Evidence and tool results' : '依据与工具执行结果'}
          </summary>
          <p>
            {en
              ? 'Sources below were returned by data tools. Interpretations in the answer still need judgment.'
              : '以下来源由数据工具实际返回，回答中的推断仍需结合证据判断。'}
          </p>
          <ol>
            {(answer.sources || []).map((s: any, i: number) => (
              <li key={i}>
                <span>[{i + 1}]</span>
                <Source value={s} />
              </li>
            ))}
          </ol>
          {!answer.sources?.length && (
            <p>
              {en
                ? 'No external source was retrieved for this answer.'
                : '本次没有获取到外部来源。'}
            </p>
          )}
          <ul>
            {(answer.trace || []).map((t: any, i: number) => (
              <li key={i}>
                {tx(
                  (
                    {
                      search_fighters: '选手检索',
                      fighter_profile: '选手档案',
                      rankings: '官方排名',
                      events: '赛事安排',
                      news: '最新消息',
                      compare_fighters: '对阵分析',
                      model_report: '历史验证报告',
                    } as Record<string, string>
                  )[t.tool] || t.tool,
                )}{' '}
                ·{' '}
                {t.status === 'ok'
                  ? en
                    ? 'Retrieved'
                    : '已获取'
                  : en
                    ? 'Unavailable'
                    : '未获取'}
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

export function BacktestPanel() {
  const { locale, tx } = useLocale();
  const en = locale === 'en';
  const [report, setReport] = useState<any>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api('model-report')
      .then((r) => {
        if (active) setReport(r);
      })
      .catch(() => {
        if (active) setError('历史验证报告暂不可用');
      });
    return () => {
      active = false;
    };
  }, []);
  if (error) return <ErrorBox text={error} />;
  if (!report)
    return (
      <p role="status">
        {en ? 'Loading historical validation…' : '正在加载历史验证…'}
      </p>
    );
  const trained = report.models[0];
  const percent = (n: number) => (n * 100).toFixed(1) + '%';
  return (
    <section className="result-panel backtest-panel">
      <div className="prediction-title">
        <h2>
          {en
            ? 'How much evidence supports the scores?'
            : '这些评分有多少验证依据？'}
        </h2>
        <span className="status">{en ? 'Experimental' : '实验阶段'}</span>
      </div>
      <p>
        {en ? 'Independent test: ' : '独立测试：'}2024–2025 · {trained.n}{' '}
        {en ? 'bouts' : '场比赛'} · {en ? 'model accuracy' : '模型命中率'}{' '}
        {percent(trained.accuracy)}
      </p>
      <p className="assistant-notice">
        {en
          ? 'The trained model has not beaten every simple baseline. Historical performance does not guarantee future results; matchup scores are not win probabilities.'
          : '训练模型尚未优于所有简单基线。历史表现不能保证未来结果，对阵评分不代表获胜概率。'}
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{en ? 'Method' : '方法'}</th>
              <th>{en ? 'Accuracy ↑' : '命中率 ↑'}</th>
              <th>{en ? 'Brier error ↓' : 'Brier 误差 ↓'}</th>
              <th>{en ? 'Log loss ↓' : '对数损失 ↓'}</th>
            </tr>
          </thead>
          <tbody>
            {report.models.map((m: any) => (
              <tr key={m.id}>
                <td>{tx(m.name)}</td>
                <td>{percent(m.accuracy)}</td>
                <td>{m.brier.toFixed(3)}</td>
                <td>{m.logLoss.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        {en
          ? 'Lower error is better. A 50/50 prediction has Brier error 0.250. Tied predictions receive half-credit for accuracy.'
          : '误差越低越好；双方各半的 Brier 误差为 0.250。无法区分双方的预测在命中率中计半分。'}
      </p>
      <details>
        <summary>
          {en
            ? 'Data coverage, calibration and reproducibility'
            : '查看数据覆盖、概率校准与复现方法'}
        </summary>
        <p>
          {en ? 'Training' : '训练'}：2015–2021 ({report.split.train.n}) ·{' '}
          {en ? 'Calibration' : '校准'}：2022–2023 ({report.split.calibration.n}
          ) · {en ? 'Test' : '测试'}：2024–2025 ({trained.n})
        </p>
        <p>
          {en
            ? `The dataset contains ${report.totalBouts} decisive UFC bouts from ${report.dataset.first} to ${report.dataset.last}. ${report.excludedTestBouts} test-period bouts were excluded because either fighter had fewer than 3 prior observed UFC results.`
            : `数据集包含 ${report.dataset.first} 至 ${report.dataset.last} 的 ${report.totalBouts} 场 UFC 明确胜负赛果。测试期另有 ${report.excludedTestBouts} 场因一方此前收录不足 3 场而被排除。`}
        </p>
        <p>
          {en
            ? 'Features are rebuilt before each fight from earlier UFC results; all results from the same UTC day are withheld until that day’s features are built. Current career records and current rankings are never used in training. Historical results may include later corrections.'
            : '每场特征仅由此前 UFC 赛果重建；同一 UTC 日期的比赛统一先生成特征，再更新赛果。不使用当前职业总战绩或当前排名训练。历史赛果可能包含后续更正。'}
        </p>
        <p>
          {en
            ? 'Results exclude draws, no contests, missing outcomes and events not named UFC. No injury, weight-cut, age, reach, technical-style or betting-odds features. One retrospective test window is not prospective validation.'
            : '数据排除平局、无结果、缺失赛果及名称非 UFC 的赛事。未加入伤病、降重、年龄、臂展、技术风格或赔率信息；单次历史测试不等于前瞻验证。'}
        </p>
        <p>
          {en ? 'Descriptive 95% accuracy interval' : '描述性 95% 命中率区间'}：
          {trained.accuracyInterval.map(percent).join('–')}。
          {en
            ? 'Repeated fighters create dependence; this interval is not a future-performance guarantee.'
            : '选手重复出场使样本并非完全独立，该区间不保证未来表现。'}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{en ? 'Year' : '年份'}</th>
                <th>{en ? 'Bouts' : '场次'}</th>
                <th>{en ? 'Accuracy' : '命中率'}</th>
                <th>Brier</th>
              </tr>
            </thead>
            <tbody>
              {report.byYear.map((y: any) => (
                <tr key={y.year}>
                  <td>{y.year}</td>
                  <td>{y.n}</td>
                  <td>{percent(y.accuracy)}</td>
                  <td>{y.brier.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3>{en ? 'Held-out calibration' : '独立测试集的概率校准表现'}</h3>
        <p>
          {en
            ? 'For each probability group, compare the average model estimate with actual wins. These are historical diagnostic probabilities, not the matchup score display.'
            : '按模型输出区间分组，比较平均估计值与实际胜率。这些概率用于历史误差诊断，不是对阵页的胜率承诺。'}
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{en ? 'Group' : '区间'}</th>
                <th>{en ? 'Bouts' : '场次'}</th>
                <th>{en ? 'Estimate' : '平均估计'}</th>
                <th>{en ? 'Observed' : '实际胜率'}</th>
              </tr>
            </thead>
            <tbody>
              {trained.calibration.map((b: any) => (
                <tr key={b.lower}>
                  <td>
                    {percent(b.lower)}–{percent(b.upper)}
                  </td>
                  <td>{b.n}</td>
                  <td>{percent(b.predicted)}</td>
                  <td>{percent(b.observed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          <a href="/reports/backtest.json" download>
            {en
              ? 'Download report and every test prediction (JSON)'
              : '下载报告与逐场测试预测（JSON）'}
          </a>
        </p>
        <p>
          <a href={report.dataset.source} target="_blank" rel="noreferrer">
            ESPN · {en ? 'Historical event source' : '历史赛果来源'}
          </a>{' '}
          · {en ? 'Retrieved' : '抓取于'}{' '}
          {report.dataset.fetchedAt.slice(0, 10)}
        </p>
      </details>
    </section>
  );
}
