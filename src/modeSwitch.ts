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

  const tabFor = (next: AppMode) => (next === "images" ? imagesBtn : pdfBtn);
  const panelFor = (next: AppMode) => (next === "images" ? imagesPanel : pdfPanel);

  const syncRovingTabIndex = () => {
    imagesBtn.tabIndex = mode === "images" ? 0 : -1;
    pdfBtn.tabIndex = mode === "pdf" ? 0 : -1;
  };

  const moveFocusOutOfHiddenPanel = (next: AppMode) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const hiddenPanel = panelFor(next === "images" ? "pdf" : "images");
    if (hiddenPanel.contains(active)) {
      tabFor(next).focus();
    }
  };

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
    syncRovingTabIndex();
    moveFocusOutOfHiddenPanel(next);

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

  root.addEventListener("keydown", (event) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    event.preventDefault();

    let next: AppMode = mode;
    if (event.key === "Home") {
      next = "images";
    } else if (event.key === "End") {
      next = "pdf";
    } else {
      next = mode === "images" ? "pdf" : "images";
    }

    if (next !== mode) {
      applyMode(next, true);
    }
    tabFor(next).focus();
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
