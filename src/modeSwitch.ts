import { t, type Locale } from "./i18n";

export type AppMode = "images" | "pdf";

const STORAGE_KEY = "converte-facil.mode";
const DEFAULT_MODE: AppMode = "images";

export function isAppMode(value: string | null | undefined): value is AppMode {
  return value === "images" || value === "pdf";
}

export function getSavedMode(): AppMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isAppMode(saved)) {
      return saved;
    }
  } catch {
    // localStorage may be unavailable
  }
  return DEFAULT_MODE;
}

export function saveMode(mode: AppMode): void {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore write failures
  }
}

export type ModeSwitchController = {
  getMode: () => AppMode;
  setMode: (mode: AppMode) => void;
  refreshCopy: (locale: Locale) => void;
};

export function initModeSwitch(
  onChange?: (mode: AppMode) => void,
): ModeSwitchController | null {
  const root = document.querySelector<HTMLElement>("#mode-switch");
  const imagesBtn = document.querySelector<HTMLButtonElement>("#mode-images");
  const pdfBtn = document.querySelector<HTMLButtonElement>("#mode-pdf");
  const imagesPanel = document.querySelector<HTMLElement>("#panel-images");
  const pdfPanel = document.querySelector<HTMLElement>("#panel-pdf");

  if (!root || !imagesBtn || !pdfBtn || !imagesPanel || !pdfPanel) {
    return null;
  }

  let mode = getSavedMode();

  const applyMode = (next: AppMode, persist: boolean) => {
    mode = next;
    if (persist) {
      saveMode(next);
    }

    imagesBtn.classList.toggle("is-selected", next === "images");
    pdfBtn.classList.toggle("is-selected", next === "pdf");
    imagesBtn.setAttribute("aria-selected", next === "images" ? "true" : "false");
    pdfBtn.setAttribute("aria-selected", next === "pdf" ? "true" : "false");

    imagesPanel.hidden = next !== "images";
    pdfPanel.hidden = next !== "pdf";

    onChange?.(next);
  };

  imagesBtn.addEventListener("click", () => {
    if (mode !== "images") {
      applyMode("images", true);
    }
  });

  pdfBtn.addEventListener("click", () => {
    if (mode !== "pdf") {
      applyMode("pdf", true);
    }
  });

  const refreshCopy = (locale: Locale) => {
    root.setAttribute("aria-label", t(locale, "modeSwitchLabel"));
    imagesBtn.textContent = t(locale, "modeImages");
    pdfBtn.textContent = t(locale, "modePdf");
  };

  applyMode(mode, false);

  return {
    getMode: () => mode,
    setMode: (next) => applyMode(next, true),
    refreshCopy,
  };
}
