import knownHeadlines from '../i18n/headlines.json' with { type: 'json' };
import { getNews } from './data.mjs';
const cache = new Map(),
  pending = new Map();
const DAY = 24 * 60 * 60 * 1000;
export function parseTranslation(raw, original) {
  const translated = raw?.responseData?.translatedText;
  if (
    Number(raw?.responseStatus) !== 200 ||
    raw?.quotaFinished ||
    typeof translated !== 'string' ||
    !/[\u3400-\u9fff]/u.test(translated) ||
    translated === original ||
    translated.length > 1200
  )
    throw new Error('Translation unavailable');
  // Render as text only. Preserve original punctuation and never insert provider HTML.
  return translated
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replaceAll('战斗机', '选手')
    .replaceAll('下一场战斗', '下一场比赛')
    .replaceAll('战斗之夜', '格斗之夜');
}
export async function translateHeadline(title, fetcher = fetch) {
  if (knownHeadlines[title])
    return { title, translatedTitle: knownHeadlines[title], status: 'curated' };
  const found = cache.get(title);
  if (found && found.expires > Date.now()) return found.value;
  if (pending.has(title)) return pending.get(title);
  const job = (async () => {
    let value = { title, translatedTitle: null, status: 'unavailable' };
    try {
      if (new TextEncoder().encode(title).length > 500)
        throw Error('Headline exceeds provider limit');
      const url =
        'https://api.mymemory.translated.net/get?' +
        new URLSearchParams({ q: title, langpair: 'en|zh-CN' });
      const r = await fetcher(url, { signal: AbortSignal.timeout(7000) });
      if (!r.ok) throw Error('Provider unavailable');
      value = {
        title,
        translatedTitle: parseTranslation(await r.json(), title),
        status: 'machine',
      };
    } catch {}
    cache.delete(title);
    cache.set(title, {
      value,
      expires: Date.now() + (value.status === 'unavailable' ? 60000 : DAY),
    });
    if (cache.size > 256) cache.delete(cache.keys().next().value);
    return value;
  })();
  pending.set(title, job);
  try {
    return await job;
  } finally {
    pending.delete(title);
  }
}
export async function getNewsTranslations() {
  const news = await getNews();
  const items = [];
  // Only titles from our public news source are accepted, never user messages or arbitrary text.
  for (let i = 0; i < news.data.length; i += 3)
    items.push(
      ...(await Promise.all(
        news.data
          .slice(i, i + 3)
          .map(async (n) => ({
            id: n.id,
            ...(await translateHeadline(n.title)),
          })),
      )),
    );
  return {
    items,
    provider: 'MyMemory',
    targetLocale: 'zh',
    source: news.source,
    fetchedAt: news.fetchedAt,
  };
}
