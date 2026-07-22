/**
 * Temporary inline strings for the welcome screen.
 * Full i18n files + persistence land in issue #3.
 */
const copy = {
  en: {
    language: "Language",
    brand: "Converte Fácil",
    headline: "Convert files on your computer",
    privacy: "Your files stay on your computer. Nothing is uploaded to the internet.",
    comingSoon: "Conversion tools are coming next. This is the welcome screen.",
  },
  "pt-BR": {
    language: "Idioma",
    brand: "Converte Fácil",
    headline: "Converta arquivos no seu computador",
    privacy:
      "Seus arquivos ficam no seu computador. Nada é enviado para a internet.",
    comingSoon:
      "As ferramentas de conversão vêm em seguida. Esta é a tela de boas-vindas.",
  },
} as const;

type Locale = keyof typeof copy;

function applyLocale(locale: Locale) {
  const strings = copy[locale];
  document.documentElement.lang = locale === "pt-BR" ? "pt-BR" : "en";

  document.querySelectorAll<HTMLElement>("[data-i18n]").forEach((el) => {
    const key = el.dataset.i18n as keyof typeof strings | undefined;
    if (key && key in strings) {
      el.textContent = strings[key];
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const select = document.querySelector<HTMLSelectElement>("#lang-select");
  const initial: Locale = "en";
  if (select) {
    select.value = initial;
    select.addEventListener("change", () => {
      const next = select.value as Locale;
      applyLocale(next in copy ? next : "en");
    });
  }
  applyLocale(initial);
});
