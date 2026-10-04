'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { chooseLocale, LANGUAGE_KEY, localize } from '@/lib/i18n/locale.mjs';
type Locale = 'zh' | 'en';
const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: 'zh', setLocale: () => {} });
export function LocaleProvider({
  children,
  initialLocale = 'zh',
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  useEffect(() => {
    let saved = null;
    try {
      saved = localStorage.getItem(LANGUAGE_KEY);
    } catch {}
    setLocaleState(chooseLocale(saved, navigator.language));
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
    document.title =
      locale === 'zh' ? 'OCTAGON · UFC 智能助手' : 'OCTAGON · UFC Intelligence';
  }, [locale]);
  function setLocale(value: Locale) {
    setLocaleState(value);
    try {
      localStorage.setItem(LANGUAGE_KEY, value);
    } catch {}
  }
  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      {children}
    </LocaleContext.Provider>
  );
}
export function useLocale() {
  const { locale, setLocale } = useContext(LocaleContext);
  return {
    locale,
    setLocale,
    tx: <T,>(value: T): T => localize(value, locale) as T,
  };
}
