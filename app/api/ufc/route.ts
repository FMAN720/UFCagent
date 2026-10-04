import {
  getEvents,
  getNews,
  getRankings,
  getFighter,
  searchFighters,
} from '@/lib/ufc/data.mjs';
import { predictionResult } from '@/lib/ufc/agent.mjs';
import {
  askAssistant,
  modelConfig,
  modelStatus,
  normalizeHistory,
} from '@/lib/ufc/assistant.mjs';
import modelReport from '@/lib/ufc/model/report.json';
import { env } from 'cloudflare:workers';
import { getNewsTranslations } from '@/lib/ufc/translation.mjs';
const windows = new Map<string, { count: number; until: number }>();
function limited(request: Request) {
  const key = request.headers.get('cf-connecting-ip') || 'local';
  const now = Date.now();
  const old = windows.get(key);
  if (!old || old.until < now) {
    windows.delete(key);
    windows.set(key, { count: 1, until: now + 60000 });
    if (windows.size > 1000) windows.delete(windows.keys().next().value!);
    return false;
  }
  old.count++;
  return old.count > 60;
}
function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
function fail(e: unknown) {
  return json(
    { error: e instanceof Error ? e.message : '请求失败，请重试' },
    503,
  );
}
export async function GET(request: Request) {
  if (limited(request))
    return json({ error: '请求过于频繁，请一分钟后重试' }, 429);
  const p = new URL(request.url).searchParams;
  try {
    switch (p.get('action')) {
      case 'assistant-status':
        return json(modelStatus(modelConfig(env)));
      case 'model-report':
        return json(modelReport);
      case 'news-translations':
        return json(await getNewsTranslations());
      case 'rankings':
        return json(await getRankings());
      case 'events':
        return json(await getEvents());
      case 'news':
        return json(await getNews());
      case 'fighter': {
        const id = p.get('id') || '';
        if (!/^\d{1,10}$/.test(id))
          return json({ error: '无效的选手 ID' }, 400);
        return json(await getFighter(id));
      }
      case 'search': {
        const q = p.get('q')?.trim() || '';
        if (q.length < 2 || q.length > 80)
          return json({ error: '姓名长度应为 2–80 个字符' }, 400);
        return json(await searchFighters(q));
      }
      default:
        return json({ error: '不支持的查询' }, 400);
    }
  } catch (e) {
    return fail(e);
  }
}
export async function POST(request: Request) {
  if (limited(request))
    return json({ error: '请求过于频繁，请一分钟后重试' }, 429);
  if (!request.headers.get('content-type')?.includes('application/json'))
    return json({ error: '需要 JSON 请求' }, 415);
  if (Number(request.headers.get('content-length')) > 20000)
    return json({ error: '请求过长' }, 413);
  let body;
  try {
    const text = await request.text();
    if (text.length > 20000) return json({ error: '请求过长' }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: '无效 JSON' }, 400);
  }
  if (!body || typeof body !== 'object')
    return json({ error: '无效请求' }, 400);
  try {
    if (body.action === 'predict') {
      if (
        typeof body.a !== 'string' ||
        typeof body.b !== 'string' ||
        !/^\d{1,10}$/.test(body.a) ||
        !/^\d{1,10}$/.test(body.b)
      )
        return json({ error: '需要两个有效选手 ID' }, 400);
      return json(await predictionResult(body.a, body.b));
    }
    if (body.action === 'ask') {
      if (
        typeof body.question !== 'string' ||
        !body.question.trim() ||
        body.question.length > 500
      )
        return json({ error: '请输入 1–500 字的问题' }, 400);
      const id = body.context?.fighterId;
      const context =
        typeof id === 'string' && /^\d{1,10}$/.test(id)
          ? { fighterId: id }
          : {};
      return json(
        await askAssistant(
          body.question,
          {
            ...context,
            locale: body.locale === 'en' ? 'en' : 'zh',
            history: normalizeHistory(body.history),
          },
          modelConfig(env),
        ),
      );
    }
    return json({ error: '不支持的操作' }, 400);
  } catch (e) {
    return fail(e);
  }
}
