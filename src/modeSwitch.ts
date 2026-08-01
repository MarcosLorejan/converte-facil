import { t, type Locale } from "./i18n";

export type AppMode = "images" | "pdf" | "documents";

const STORAGE_KEY = "converte-facil.mode";
const DEFAULT_MODE: AppMode = "images";
const MODES: AppMode[] = ["images", "pdf", "documents"];

export function isAppMode(value: string | null | undefined): value is AppMode {
  return value === "images" || value === "pdf" || value === "documents";
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
  const docsBtn = document.querySelector<HTMLButtonElement>("#mode-documents");
  const imagesPanel = document.querySelector<HTMLElement>("#panel-images");
  const pdfPanel = document.querySelector<HTMLElement>("#panel-pdf");
  const docsPanel = document.querySelector<HTMLElement>("#panel-documents");

  if (
    !root ||
    !imagesBtn ||
    !pdfBtn ||
    !docsBtn ||
    !imagesPanel ||
    !pdfPanel ||
    !docsPanel
  ) {
    return null;
  }

  let mode = getSavedMode();

  const tabFor = (next: AppMode) => {
    if (next === "images") return imagesBtn;
    if (next === "pdf") return pdfBtn;
    return docsBtn;
  };

  const panelFor = (next: AppMode) => {
    if (next === "images") return imagesPanel;
    if (next === "pdf") return pdfPanel;
    return docsPanel;
  };

  const syncRovingTabIndex = () => {
    for (const m of MODES) {
      tabFor(m).tabIndex = mode === m ? 0 : -1;
    }
  };

  const moveFocusOutOfHiddenPanel = (next: AppMode) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    for (const m of MODES) {
      if (m === next) continue;
      if (panelFor(m).contains(active)) {
        tabFor(next).focus();
        return;
      }
    }
  };

  const applyMode = (next: AppMode, persist: boolean) => {
    mode = next;
    if (persist) {
      saveMode(next);
    }

    for (const m of MODES) {
      const selected = next === m;
      tabFor(m).classList.toggle("is-selected", selected);
      tabFor(m).setAttribute("aria-selected", selected ? "true" : "false");
      panelFor(m).hidden = !selected;
    }

    syncRovingTabIndex();
    moveFocusOutOfHiddenPanel(next);
    onChange?.(next);
  };

  imagesBtn.addEventListener("click", () => {
    if (mode !== "images") applyMode("images", true);
  });
  pdfBtn.addEventListener("click", () => {
    if (mode !== "pdf") applyMode("pdf", true);
  });
  docsBtn.addEventListener("click", () => {
    if (mode !== "documents") applyMode("documents", true);
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

    const index = MODES.indexOf(mode);
    let next: AppMode;
    if (event.key === "Home") {
      next = MODES[0];
    } else if (event.key === "End") {
      next = MODES[MODES.length - 1];
    } else if (event.key === "ArrowRight") {
      next = MODES[(index + 1) % MODES.length];
    } else {
      next = MODES[(index - 1 + MODES.length) % MODES.length];
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
    docsBtn.textContent = t(locale, "modeDocuments");
  };

  applyMode(mode, false);

  return {
    getMode: () => mode,
    setMode: (next) => applyMode(next, true),
    refreshCopy,
  };
}
