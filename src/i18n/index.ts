import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import es from './es.json';
import en from './en.json';

// EG Connect's core userbase is Guinea Ecuatorial (Spanish-speaking), so
// Spanish stays the hard default. English is only picked up when the
// browser explicitly reports an English locale, or when the user opts in
// via the language switcher (SyncSettingsScreen) -- that choice is then
// persisted to localStorage by i18next-browser-languagedetector.
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      es: { translation: es },
      en: { translation: en },
    },
    fallbackLng: 'es',
    supportedLngs: ['es', 'en'],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'egconnect_lang',
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
