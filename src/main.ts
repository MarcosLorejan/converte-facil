import {
  applyTranslations,
  getSavedLocale,
  isLocale,
  saveLocale,
  type Locale,
} from "./i18n";

window.addEventListener("DOMContentLoaded", () => {
  const select = document.querySelector<HTMLSelectElement>("#lang-select");
  let locale: Locale = getSavedLocale();

  const setLocale = (next: Locale) => {
    locale = next;
    saveLocale(next);
    applyTranslations(next);
    if (select) {
      select.value = next;
    }
  };

  if (select) {
    select.value = locale;
    select.addEventListener("change", () => {
      const next = select.value;
      setLocale(isLocale(next) ? next : "en");
    });
  }

  setLocale(locale);
});
