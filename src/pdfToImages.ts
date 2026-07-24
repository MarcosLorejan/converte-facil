import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { DropTarget } from "./appDragDrop";
import {
  bindCancelButton,
  isConvertCancelled,
  resetConversionCancel,
} from "./cancelConvert";
import {
  applyHumanizedError,
  clearHumanizedError,
  humanizeError,
} from "./errors";
import { fileNameFromPath } from "./images";
import { t, type Locale } from "./i18n";
import { bindOpenFolderButton } from "./openOutput";

export type PdfImageFormat = "png" | "jpg";
export type PdfQualityPreset = "small" | "normal" | "high";

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

function isPdfQuality(value: string | undefined): value is PdfQualityPreset {
  return value === "small" || value === "normal" || value === "high";
}

export type PdfToImagesController = DropTarget & {
  refreshCopy: (locale: Locale) => void;
  setBusy: (busy: boolean) => void;
};

export function initPdfToImages(
  getLocale: () => Locale,
): PdfToImagesController | null {
  const dropZone = document.querySelector<HTMLElement>("#pdf-drop-zone");
  const pickButton = document.querySelector<HTMLButtonElement>("#pdf-pick");
  const clearButton = document.querySelector<HTMLButtonElement>("#pdf-clear");
  const fileNameEl = document.querySelector<HTMLElement>("#pdf-file-name");
  const errorEl = document.querySelector<HTMLElement>("#pdf-error");
  const formatList = document.querySelector<HTMLElement>("#pdf-format-list");
  const qualityList = document.querySelector<HTMLElement>("#pdf-quality-list");
  const convertButton =
    document.querySelector<HTMLButtonElement>("#pdf-convert-button");
  const statusEl = document.querySelector<HTMLElement>("#pdf-convert-status");
  const selection = document.querySelector<HTMLElement>("#pdf-selection");
  const openFolder = bindOpenFolderButton(
    document.querySelector<HTMLButtonElement>("#pdf-open-folder"),
  );
  const cancel = bindCancelButton(
    document.querySelector<HTMLButtonElement>("#pdf-convert-cancel"),
  );

  if (
    !dropZone ||
    !pickButton ||
    !clearButton ||
    !fileNameEl ||
    !errorEl ||
    !formatList ||
    !qualityList ||
    !convertButton ||
    !statusEl ||
    !selection
  ) {
    return null;
  }

  let pdfPath: string | null = null;
  let format: PdfImageFormat | null = null;
  let quality: PdfQualityPreset = "normal";
  let busy = false;
  let lastRawError: unknown = null;
  let plainErrorKey: "pdfUnsupported" | null = null;

  const formatButtons = Array.from(
    formatList.querySelectorAll<HTMLButtonElement>("[data-pdf-format]"),
  );
  const qualityButtons = Array.from(
    qualityList.querySelectorAll<HTMLButtonElement>("[data-pdf-quality]"),
  );

  const showPlainError = (key: "pdfUnsupported") => {
    lastRawError = null;
    plainErrorKey = key;
    clearHumanizedError(errorEl);
    errorEl.textContent = t(getLocale(), key);
    errorEl.hidden = false;
  };

  const showInvokeError = (error: unknown, locale: Locale) => {
    plainErrorKey = null;
    lastRawError = error;
    const humanized = humanizeError(locale, error, "pdfConvertFailed");
    applyHumanizedError(errorEl, locale, humanized);
  };

  const clearError = () => {
    lastRawError = null;
    plainErrorKey = null;
    clearHumanizedError(errorEl);
  };

  const syncEnabled = () => {
    const ready = pdfPath !== null && format !== null && !busy;
    convertButton.disabled = !ready;
    formatButtons.forEach((button) => {
      button.disabled = pdfPath === null || busy;
    });
    qualityButtons.forEach((button) => {
      button.disabled = pdfPath === null || busy;
    });
    pickButton.disabled = busy;
    clearButton.disabled = busy || pdfPath === null;
  };

  const syncQualitySelection = () => {
    qualityButtons.forEach((button) => {
      button.classList.toggle(
        "is-selected",
        button.dataset.pdfQuality === quality,
      );
    });
  };

  const setSelection = (path: string | null) => {
    pdfPath = path;
    if (path) {
      fileNameEl.textContent = fileNameFromPath(path);
      selection.hidden = false;
      dropZone.classList.add("has-file");
    } else {
      fileNameEl.textContent = "";
      selection.hidden = true;
      dropZone.classList.remove("has-file");
      format = null;
      quality = "normal";
      formatButtons.forEach((button) => button.classList.remove("is-selected"));
      syncQualitySelection();
    }
    syncEnabled();
  };

  const acceptPaths = (paths: string[]) => {
    if (busy || paths.length === 0) return;
    clearError();
    const match = paths.find(isPdfPath);
    if (!match) {
      showPlainError("pdfUnsupported");
      return;
    }
    setSelection(match);
  };

  const pickPdf = async () => {
    clearError();
    try {
      const result = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
        title: t(getLocale(), "pdfPickTitle"),
      });
      if (result === null || Array.isArray(result)) return;
      if (!isPdfPath(result)) {
        showPlainError("pdfUnsupported");
        return;
      }
      setSelection(result);
    } catch {
      // Dialog cancelled
    }
  };

  formatButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (pdfPath === null || busy) return;
      const value = button.dataset.pdfFormat;
      if (value !== "png" && value !== "jpg") return;
      format = value;
      formatButtons.forEach((el) => {
        el.classList.toggle("is-selected", el === button);
      });
      syncEnabled();
    });
  });

  qualityButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (pdfPath === null || busy) return;
      const value = button.dataset.pdfQuality;
      if (!isPdfQuality(value)) return;
      quality = value;
      syncQualitySelection();
    });
  });

  dropZone.addEventListener("click", (event) => {
    if (
      event.target === pickButton ||
      pickButton.contains(event.target as Node)
    ) {
      return;
    }
    if (!busy) void pickPdf();
  });

  pickButton.addEventListener("click", (event) => {
    event.stopPropagation();
    void pickPdf();
  });

  clearButton.addEventListener("click", () => {
    clearError();
    statusEl.hidden = true;
    statusEl.classList.remove("is-error", "is-success");
    statusEl.replaceChildren();
    openFolder?.hide();
    setSelection(null);
  });

  convertButton.addEventListener("click", () => {
    if (!pdfPath || !format || busy) return;
    void (async () => {
      const locale = getLocale();
      clearError();

      let outputDir: string | string[] | null;
      try {
        outputDir = await open({
          directory: true,
          multiple: false,
          title: t(locale, "pdfPickFolder"),
        });
      } catch {
        return;
      }
      if (!outputDir || Array.isArray(outputDir)) return;

      busy = true;
      syncEnabled();
      convertButton.classList.add("is-busy");
      cancel?.setBusy(true);
      openFolder?.hide();
      statusEl.hidden = false;
      statusEl.classList.remove("is-error", "is-success");
      statusEl.replaceChildren();
      statusEl.textContent = t(locale, "pdfConvertProgress");
      await resetConversionCancel();

      try {
        const result = await invoke<{
          pageCount: number;
          outputDir: string;
        }>("convert_pdf_to_images", {
          inputPath: pdfPath,
          outputDir,
          format,
          quality,
        });
        const folderName = fileNameFromPath(result.outputDir);
        statusEl.classList.add("is-success");
        statusEl.textContent = t(locale, "pdfConvertSuccess")
          .replace("{count}", String(result.pageCount))
          .replace("{folder}", folderName);
        openFolder?.show(result.outputDir, true);
        statusEl.focus();
      } catch (error) {
        const humanized = humanizeError(locale, error, "pdfConvertFailed");
        statusEl.classList.add("is-error");
        statusEl.replaceChildren();
        statusEl.textContent = isConvertCancelled(error)
          ? t(locale, "convertCancelled")
          : humanized.message;
        openFolder?.hide();
        statusEl.focus();
        if (!isConvertCancelled(error)) {
          showInvokeError(error, locale);
        }
      } finally {
        busy = false;
        convertButton.classList.remove("is-busy");
        cancel?.setBusy(false);
        syncEnabled();
      }
    })();
  });

  setSelection(null);
  syncQualitySelection();
  statusEl.hidden = true;
  openFolder?.hide();

  return {
    acceptPaths,
    setDragOver: (active) => {
      dropZone.classList.toggle("is-dragover", active && !busy);
    },
    setBusy: (next) => {
      busy = next;
      syncEnabled();
    },
    refreshCopy: (locale) => {
      openFolder?.refreshCopy(t(locale, "openOutputFolder"));
      cancel?.refreshCopy(t(locale, "convertCancelButton"));
      formatButtons.forEach((button) => {
        const key = button.dataset.i18n;
        if (key === "formatPng" || key === "formatJpg") {
          button.textContent = t(locale, key);
        }
      });
      qualityButtons.forEach((button) => {
        const key = button.dataset.i18n;
        if (
          key === "pdfQualitySmall" ||
          key === "pdfQualityNormal" ||
          key === "pdfQualityHigh"
        ) {
          button.textContent = t(locale, key);
        }
      });
      if (!statusEl.hidden && convertButton.classList.contains("is-busy")) {
        statusEl.replaceChildren();
        statusEl.textContent = t(locale, "pdfConvertProgress");
      }
      if (plainErrorKey) {
        errorEl.textContent = t(locale, plainErrorKey);
        errorEl.hidden = false;
      } else if (lastRawError != null) {
        const humanized = humanizeError(
          locale,
          lastRawError,
          "pdfConvertFailed",
        );
        applyHumanizedError(errorEl, locale, humanized);
        if (!statusEl.hidden && statusEl.classList.contains("is-error")) {
          statusEl.replaceChildren();
          statusEl.textContent = humanized.message;
        }
      }
    },
  };
}
