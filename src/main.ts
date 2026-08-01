import { invoke } from "@tauri-apps/api/core";
import { initAppDragDrop } from "./appDragDrop";
import { initConvertControls, runBatchConversion } from "./convert";
import { initDocumentsToPdf } from "./documentsToPdf";
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
import { initModeSwitch } from "./modeSwitch";
import { initPdfToImages } from "./pdfToImages";
import { initImagesToPdf } from "./imagesToPdf";

type ToolStatus = {
  available: boolean;
  name: string;
  detail: string | null;
  bundled: boolean;
};

type EngineStatus = {
  imagemagick: ToolStatus;
  ghostscript: ToolStatus;
  libreoffice: ToolStatus;
};

function renderTool(
  locale: Locale,
  rootId: string,
  status: ToolStatus,
  tipKey: "imagemagickTip" | "ghostscriptTip" | "libreofficeTip",
  bundledTipKey?: "imagemagickBundledTip" | "ghostscriptBundledTip",
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
    detail.textContent = status.available ? (status.detail ?? status.name) : "";
    detail.hidden = !status.available;
  }

  if (tip) {
    if (status.available && status.bundled && bundledTipKey) {
      tip.textContent = t(locale, bundledTipKey);
      tip.hidden = false;
    } else if (!status.available) {
      tip.textContent = t(locale, tipKey);
      tip.hidden = false;
    } else {
      tip.textContent = "";
      tip.hidden = true;
    }
  }
}

async function refreshEngines(
  locale: Locale,
  onLibreOffice?: (available: boolean) => void,
) {
  const errorEl = document.querySelector<HTMLElement>("#engines-error");
  if (errorEl) errorEl.hidden = true;

  try {
    const status = await invoke<EngineStatus>("get_engine_status");
    renderTool(
      locale,
      "engine-imagemagick",
      status.imagemagick,
      "imagemagickTip",
      "imagemagickBundledTip",
    );
    renderTool(
      locale,
      "engine-ghostscript",
      status.ghostscript,
      "ghostscriptTip",
      "ghostscriptBundledTip",
    );
    renderTool(
      locale,
      "engine-libreoffice",
      status.libreoffice,
      "libreofficeTip",
    );
    onLibreOffice?.(status.libreoffice.available);
  } catch {
    if (errorEl) {
      errorEl.textContent = t(locale, "enginesError");
      errorEl.hidden = false;
    }
    onLibreOffice?.(false);
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const select = document.querySelector<HTMLSelectElement>("#lang-select");
  let locale: Locale = getSavedLocale();
  let queue: SelectedImage[] = [];
  let selectedFormat: OutputFormatId | null = null;

  const convertUi = initConvertControls();
  const modeSwitch = initModeSwitch();
  const pdfToImages = initPdfToImages(() => locale);
  const imagesToPdf = initImagesToPdf(() => locale);

  let documentsToPdf: ReturnType<typeof initDocumentsToPdf> = null;

  const syncLibreOffice = (available: boolean) => {
    documentsToPdf?.setLibreOfficeAvailable(available);
  };

  const checkEngines = () => {
    void refreshEngines(locale, syncLibreOffice);
  };

  documentsToPdf = initDocumentsToPdf(() => locale, checkEngines);

  const syncConvertEnabled = () => {
    convertUi?.setEnabled(queue.length > 0 && selectedFormat !== null);
  };

  const formatPicker = initFormatPicker((format) => {
    selectedFormat = format;
    syncConvertEnabled();
  });

  const dropZone = initDropZone(
    () => locale,
    (next) => {
      queue = next;
      formatPicker?.setEnabled(next.length > 0);
      if (next.length === 0) {
        selectedFormat = null;
      }
      syncConvertEnabled();
    },
  );

  initAppDragDrop(() => modeSwitch?.getMode() ?? "images", {
    images: dropZone,
    pdf: pdfToImages,
    documents: documentsToPdf,
  });

  convertUi?.button.addEventListener("click", () => {
    if (!convertUi || !dropZone || queue.length === 0 || !selectedFormat)
      return;
    void runBatchConversion({
      locale,
      queue,
      format: selectedFormat,
      ui: convertUi,
      setItemStatus: dropZone.setItemStatus,
      resetStatuses: dropZone.resetStatuses,
    });
  });

  const setLocale = (next: Locale) => {
    locale = next;
    saveLocale(next);
    applyTranslations(next);
    modeSwitch?.refreshCopy(next);
    dropZone?.refreshCopy(next);
    formatPicker?.refreshCopy(next);
    convertUi?.refreshCopy(next);
    pdfToImages?.refreshCopy(next);
    imagesToPdf?.refreshCopy(next);
    documentsToPdf?.refreshCopy(next);
    if (select) {
      select.value = next;
    }
    checkEngines();
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
