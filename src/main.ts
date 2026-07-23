import { invoke } from "@tauri-apps/api/core";
import { initConvertControls, runConversion } from "./convert";
import { initDropZone } from "./dropzone";
import { initFormatPicker } from "./formatPicker";
import {
  applyTranslations,
  getSavedLocale,
  isLocale,
  saveLocale,
  t,
  type Locale,
} from "./i18n";
import type { OutputFormatId } from "./formats";
import type { SelectedImage } from "./images";

type ToolStatus = {
  available: boolean;
  name: string;
  detail: string | null;
};

type EngineStatus = {
  imagemagick: ToolStatus;
  ghostscript: ToolStatus;
};

function renderTool(
  locale: Locale,
  rootId: string,
  status: ToolStatus,
  tipKey: "imagemagickTip" | "ghostscriptTip",
) {
  const root = document.querySelector<HTMLElement>(`#${rootId}`);
  if (!root) return;

  const badge = root.querySelector<HTMLElement>('[data-role="badge"]');
  const detail = root.querySelector<HTMLElement>('[data-role="detail"]');
  const tip = root.querySelector<HTMLElement>('[data-role="tip"]');

  root.classList.remove("is-checking", "is-ready", "is-missing");
  root.classList.add(status.available ? "is-ready" : "is-missing");

  if (badge) {
    badge.textContent = status.available
      ? t(locale, "statusReady")
      : t(locale, "statusMissing");
  }

  if (detail) {
    detail.textContent = status.available
      ? status.detail ?? status.name
      : "";
    detail.hidden = !status.available;
  }

  if (tip) {
    tip.textContent = t(locale, tipKey);
    tip.hidden = status.available;
  }
}

async function refreshEngines(locale: Locale) {
  const errorEl = document.querySelector<HTMLElement>("#engines-error");
  if (errorEl) errorEl.hidden = true;

  try {
    const status = await invoke<EngineStatus>("get_engine_status");
    renderTool(locale, "engine-imagemagick", status.imagemagick, "imagemagickTip");
    renderTool(locale, "engine-ghostscript", status.ghostscript, "ghostscriptTip");
  } catch {
    if (errorEl) {
      errorEl.textContent = t(locale, "enginesError");
      errorEl.hidden = false;
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const select = document.querySelector<HTMLSelectElement>("#lang-select");
  let locale: Locale = getSavedLocale();
  let selectedImage: SelectedImage | null = null;
  let selectedFormat: OutputFormatId | null = null;

  const convertUi = initConvertControls();

  const syncConvertEnabled = () => {
    convertUi?.setEnabled(selectedImage !== null && selectedFormat !== null);
  };

  const formatPicker = initFormatPicker((format) => {
    selectedFormat = format;
    syncConvertEnabled();
  });

  const dropZone = initDropZone(() => locale, (selected) => {
    selectedImage = selected;
    formatPicker?.setEnabled(selected !== null);
    if (!selected) {
      selectedFormat = null;
    }
    syncConvertEnabled();
  });

  convertUi?.button.addEventListener("click", () => {
    if (!convertUi || !selectedImage || !selectedFormat) return;
    void runConversion({
      locale,
      selected: selectedImage,
      format: selectedFormat,
      ui: convertUi,
    });
  });

  const setLocale = (next: Locale) => {
    locale = next;
    saveLocale(next);
    applyTranslations(next);
    dropZone?.refreshCopy(next);
    formatPicker?.refreshCopy(next);
    convertUi?.refreshCopy(next);
    if (select) {
      select.value = next;
    }
    void refreshEngines(next);
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
