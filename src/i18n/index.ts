/**
 * @file index.ts
 * @description i18next configuration and initialization.
 *
 * Supported languages: en (default), tr.
 * Namespaces: common, layout, agents, blueprints.
 *
 * To add a new language:
 *   1. Create src/i18n/locales/{lang}/ directory.
 *   2. Add JSON files matching the existing EN structure.
 *   3. Import and register them below — no other code changes needed.
 *
 * @module i18n
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// ── English locale files ───────────────────────────────────────
import enCommon from './locales/en/common.json';
import enLayout from './locales/en/layout.json';
import enAgents from './locales/en/agents.json';
import enBlueprints from './locales/en/blueprints.json';

// ── Turkish locale files ───────────────────────────────────────
import trCommon from './locales/tr/common.json';
import trLayout from './locales/tr/layout.json';
import trAgents from './locales/tr/agents.json';
import trBlueprints from './locales/tr/blueprints.json';

/** All registered locale resources, grouped by language code and namespace. */
const RESOURCES = {
  en: {
    common: enCommon,
    layout: enLayout,
    agents: enAgents,
    blueprints: enBlueprints,
  },
  tr: {
    common: trCommon,
    layout: trLayout,
    agents: trAgents,
    blueprints: trBlueprints,
  },
} as const;

/** Supported language codes. Extend this union when adding a new language. */
export type SupportedLanguage = keyof typeof RESOURCES;

/** Available i18n namespaces. Extend when adding a new locale file. */
export type I18nNamespace = keyof (typeof RESOURCES)['en'];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: RESOURCES,

    /** Default language when detection fails or language is unsupported. */
    fallbackLng: 'en',

    /**
     * Default namespace used when useTranslation() is called without arguments.
     * Prefer explicit namespaces in components (e.g. useTranslation('layout')).
     */
    defaultNS: 'common',

    interpolation: {
      /**
       * React already escapes values — disable i18next's own escaping
       * to avoid double-encoding HTML entities.
       */
      escapeValue: false,
    },

    detection: {
      /** Check localStorage first, then navigator.language. */
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'agentspace_language',
    },

    /**
     * In development, log missing translation keys to the console so they
     * are caught immediately. In production this is silenced.
     */
    saveMissing: import.meta.env.DEV,
    missingKeyHandler: import.meta.env.DEV
      ? (langs, ns, key) => {
          console.warn(`[i18n] Missing key: "${ns}:${key}" for lang "${langs.join(', ')}"`);
        }
      : undefined,
  });

export default i18n;
