import i18n from 'i18next';
import enTranslations from './locales/en.json';
import arTranslations from './locales/ar.json';
import deTranslations from './locales/de.json';
import itTranslations from './locales/it.json';

export const defaultNS = 'common';
export const resources = {
  en: {
    common: enTranslations,
  },
  ar: {
    common: arTranslations,
  },
  de: {
    common: deTranslations,
  },
  it: {
    common: itTranslations,
  },
} as const;

export type SupportedLanguage = 'en' | 'ar' | 'de' | 'it';

export const LANGUAGE_STORAGE_KEY = 'procal_lang';

export function getInitialLanguage(): SupportedLanguage {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY) as SupportedLanguage | null;
    if (stored === 'ar' || stored === 'en' || stored === 'de' || stored === 'it') {
      return stored;
    }
    const browserLang = navigator.language?.toLowerCase() || '';
    if (browserLang.startsWith('ar')) {
      return 'ar';
    }
    if (browserLang.startsWith('de')) {
      return 'de';
    }
    if (browserLang.startsWith('it')) {
      return 'it';
    }
  } catch {
    // fallback
  }
  return 'en';
}

if (!i18n.isInitialized) {
  i18n.init({
    lng: 'en',
    fallbackLng: 'en',
    resources,
    defaultNS,
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
