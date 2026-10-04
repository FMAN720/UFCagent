import { messages } from './messages.mjs';
import { displayDomain, displayName } from './domain.mjs';
export const LANGUAGE_KEY = 'octagon.language';
export function chooseLocale(saved, browser = 'zh') {
  return saved === 'zh' || saved === 'en'
    ? saved
    : /^en\b/i.test(browser)
      ? 'en'
      : 'zh';
}
export function localize(value, locale = 'zh') {
  if (typeof value !== 'string' || !value.trim()) return value;
  const text = value.trim();
  const wrap = (v) =>
    value.slice(0, value.indexOf(text)) +
    v +
    value.slice(value.indexOf(text) + text.length);
  if (locale === 'zh')
    return wrap(
      /[\u3400-\u9fff]/.test(text)
        ? text
        : messages[text] || displayDomain(text, locale),
    );
  if (messages[text] && /[\u3400-\u9fff]/.test(text))
    return wrap(messages[text]);
  const domain = displayDomain(text, 'en');
  if (domain !== text) return wrap(domain);
  if (/^\d+ 岁$/.test(text)) return wrap(text.replace(' 岁', ' years'));
  if (!/[\u3400-\u9fff]/.test(text)) return value;
  // Composed labels such as a source timestamp or unit have a few dynamic parts.
  let translated = text;
  for (const [zh, en] of Object.entries(messages)
    .filter(([k]) => /[\u3400-\u9fff]/.test(k))
    .sort((a, b) => b[0].length - a[0].length))
    translated = translated.replaceAll(zh, en);
  return wrap(translated);
}
export { displayName };
