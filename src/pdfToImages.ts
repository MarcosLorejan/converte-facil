import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { fileNameFromPath } from "./images";
import { t, type Locale } from "./i18n";

export type PdfImageFormat = "png" | "jpg";

function isPdfPath(path: string): boolean {
  return path.toLowerCase().endsWith(".pdf");
}

function mapPdfError(locale: Locale, code: unknown): string {
  switch (code) {
    case "missing_imagemagick":
      return t(locale, "convertMissingMagick");
    case "missing_ghostscript":
      return t(locale, "pdfMissingGhostscript");
    case "spawn_failed":
      return t(locale, "convertSpawnFailed");
    default:
      return t(locale, "pdfConvertFailed");
  }
}

export type PdfToImagesController = {
  refreshCopy: (locale: Locale) => void;
  setBusy: (busy: boolean) => void;
};

export function initPdfToImages(
  getLocale: () => Locale,
): PdfToImagesController | null {
  const pickButton = document.querySelector<HTMLButtonElement>("#pdf-pick");
  const clearButton = document.querySelector<HTMLButtonElement>("#pdf-clear");
  const fileNameEl = document.querySelector<HTMLElement>("#pdf-file-name");
  const errorEl = document.querySelector<HTMLElement>("#pdf-error");
  const formatList = document.querySelector<HTMLElement>("#pdf-format-list");
  const convertButton = document.querySelector<HTMLButtonElement>("#pdf-convert-button");
  const statusEl = document.querySelector<HTMLElement>("#pdf-convert-status");
  const selection = document.querySelector<HTMLElement>("#pdf-selection");

  if (
    !pickButton ||
    !clearButton ||
    !fileNameEl ||
    !errorEl ||
    !formatList ||
    !convertButton ||
    !statusEl ||
    !selection
  ) {
    return null;
  }

  let pdfPath: string | null = null;
  let format: PdfImageFormat | null = null;
  let busy = false;

  const formatButtons = Array.from(
    formatList.querySelectorAll<HTMLButtonElement>("[data-pdf-format]"),
  );

  const showError = (message: string) => {
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  const clearError = () => {
    errorEl.textContent = "";
    errorEl.hidden = true;
  };

  const syncEnabled = () => {
    const ready = pdfPath !== null && format !== null && !busy;
    convertButton.disabled = !ready;
    formatButtons.forEach((button) => {
      button.disabled = pdfPath === null || busy;
    });
    pickButton.disabled = busy;
    clearButton.disabled = busy || pdfPath === null;
  };

  const setSelection = (path: string | null) => {
    pdfPath = path;
    if (path) {
      fileNameEl.textContent = fileNameFromPath(path);
      selection.hidden = false;
    } else {
      fileNameEl.textContent = "";
      selection.hidden = true;
      format = null;
      formatButtons.forEach((button) => button.classList.remove("is-selected"));
    }
    syncEnabled();
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
        showError(t(getLocale(), "pdfUnsupported"));
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

  pickButton.addEventListener("click", () => {
    void pickPdf();
  });

  clearButton.addEventListener("click", () => {
    clearError();
    statusEl.hidden = true;
    statusEl.classList.remove("is-error", "is-success");
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
      statusEl.hidden = false;
      statusEl.classList.remove("is-error", "is-success");
      statusEl.textContent = t(locale, "pdfConvertProgress");

      try {
        const pageCount = await invoke<number>("convert_pdf_to_images", {
          inputPath: pdfPath,
          outputDir,
          format,
        });
        statusEl.classList.add("is-success");
        statusEl.textContent = t(locale, "pdfConvertSuccess").replace(
          "{count}",
          String(pageCount),
        );
      } catch (error) {
        const message = mapPdfError(locale, error);
        statusEl.classList.add("is-error");
        statusEl.textContent = message;
        showError(message);
      } finally {
        busy = false;
        convertButton.classList.remove("is-busy");
        syncEnabled();
      }
    })();
  });

  setSelection(null);
  statusEl.hidden = true;

  return {
    setBusy: (next) => {
      busy = next;
      syncEnabled();
    },
    refreshCopy: (locale) => {
      formatButtons.forEach((button) => {
        const key = button.dataset.i18n;
        if (key === "formatPng" || key === "formatJpg") {
          button.textContent = t(locale, key);
        }
      });
      if (!statusEl.hidden && convertButton.classList.contains("is-busy")) {
        statusEl.textContent = t(locale, "pdfConvertProgress");
      }
    },
  };
}
