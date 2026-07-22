import en from "./en.json";
import ptBR from "./pt-BR.json";

export const locales = {
  en,
  "pt-BR": ptBR,
} as const;

export type Locale = keyof typeof locales;
export type MessageKey = keyof typeof en;

const STORAGE_KEY = "converte-facil.locale";
const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "pt-BR";
}

export function getSavedLocale(): Locale {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLocale(saved)) {
      return saved;
    }
  } catch {
    // localStorage may be unavailable in some environments
  }
  return DEFAULT_LOCALE;
}

export function saveLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // ignore write failures
  }
}

export function t(locale: Locale, key: MessageKey): string {
  return locales[locale][key] ?? locales.en[key] ?? key;
}

export function applyTranslations(locale: Locale, root: ParentNode = document): void {
  document.documentElement.lang = locale === "pt-BR" ? "pt-BR" : "en";
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as MessageKey | undefined;
    if (key) {
      el.textContent = t(locale, key);
    }
  });
}
