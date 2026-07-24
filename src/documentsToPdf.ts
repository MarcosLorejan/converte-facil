import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  applyHumanizedError,
  clearHumanizedError,
  humanizeError,
  parseInvokeError,
} from "./errors";
import { fileNameFromPath } from "./images";
import { t, type Locale } from "./i18n";
import { bindOpenFolderButton } from "./openOutput";

const LIBREOFFICE_DOWNLOAD_URL =
  "https://www.libreoffice.org/download/download-libreoffice/";

function isOfficePath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".docx") || lower.endsWith(".xlsx");
}

function stemFromPath(path: string): string {
  const name = fileNameFromPath(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export type DocumentsToPdfController = {
  refreshCopy: (locale: Locale) => void;
  setLibreOfficeAvailable: (available: boolean) => void;
};

export function initDocumentsToPdf(
  getLocale: () => Locale,
  onCheckAgain: () => void,
): DocumentsToPdfController | null {
  const pickButton = document.querySelector<HTMLButtonElement>("#docs-pick");
  const clearButton = document.querySelector<HTMLButtonElement>("#docs-clear");
  const fileNameEl = document.querySelector<HTMLElement>("#docs-file-name");
  const errorEl = document.querySelector<HTMLElement>("#docs-error");
  const convertButton =
    document.querySelector<HTMLButtonElement>("#docs-convert-button");
  const statusEl = document.querySelector<HTMLElement>("#docs-convert-status");
  const selection = document.querySelector<HTMLElement>("#docs-selection");
  const guide = document.querySelector<HTMLElement>("#docs-libreoffice-guide");
  const downloadButton =
    document.querySelector<HTMLButtonElement>("#docs-lo-download");
  const checkButton =
    document.querySelector<HTMLButtonElement>("#docs-lo-check");
  const convertBlock = document.querySelector<HTMLElement>("#docs-convert-block");
  const openFolder = bindOpenFolderButton(
    document.querySelector<HTMLButtonElement>("#docs-open-folder"),
  );

  if (
    !pickButton ||
    !clearButton ||
    !fileNameEl ||
    !errorEl ||
    !convertButton ||
    !statusEl ||
    !selection ||
    !guide ||
    !downloadButton ||
    !checkButton ||
    !convertBlock
  ) {
    return null;
  }

  let docPath: string | null = null;
  let busy = false;
  let libreOfficeAvailable = false;

  const syncGuide = () => {
    guide.hidden = libreOfficeAvailable;
    convertBlock.hidden = !libreOfficeAvailable;
    if (!libreOfficeAvailable) {
      setSelection(null);
      statusEl.hidden = true;
      statusEl.classList.remove("is-error", "is-success");
      statusEl.textContent = "";
      openFolder?.hide();
    }
  };

  const syncEnabled = () => {
    const ready = libreOfficeAvailable && docPath !== null && !busy;
    convertButton.disabled = !ready;
    pickButton.disabled = busy || !libreOfficeAvailable;
    clearButton.disabled = busy || docPath === null;
    downloadButton.disabled = busy;
    checkButton.disabled = busy;
  };

  const setSelection = (path: string | null) => {
    docPath = path;
    if (path) {
      fileNameEl.textContent = fileNameFromPath(path);
      selection.hidden = false;
    } else {
      fileNameEl.textContent = "";
      selection.hidden = true;
    }
    syncEnabled();
  };

  const pickDocument = async () => {
    clearHumanizedError(errorEl);
    try {
      const result = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Documents",
            extensions: ["docx", "xlsx"],
          },
        ],
        title: t(getLocale(), "docsPickTitle"),
      });
      if (result === null || Array.isArray(result)) return;
      if (!isOfficePath(result)) {
        applyHumanizedError(errorEl, getLocale(), {
          message: t(getLocale(), "docsUnsupported"),
        });
        return;
      }
      setSelection(result);
    } catch {
      // Dialog cancelled
    }
  };

  pickButton.addEventListener("click", () => {
    void pickDocument();
  });

  clearButton.addEventListener("click", () => {
    clearHumanizedError(errorEl);
    statusEl.hidden = true;
    statusEl.classList.remove("is-error", "is-success");
    statusEl.textContent = "";
    openFolder?.hide();
    setSelection(null);
  });

  downloadButton.addEventListener("click", () => {
    void openUrl(LIBREOFFICE_DOWNLOAD_URL).catch(() => {
      applyHumanizedError(errorEl, getLocale(), {
        message: t(getLocale(), "docsOpenDownloadFailed"),
      });
    });
  });

  checkButton.addEventListener("click", () => {
    clearHumanizedError(errorEl);
    onCheckAgain();
  });

  convertButton.addEventListener("click", () => {
    if (!docPath || !libreOfficeAvailable || busy) return;
    void (async () => {
      const locale = getLocale();
      clearHumanizedError(errorEl);

      let outputPath: string | null;
      try {
        outputPath = await save({
          filters: [{ name: "PDF", extensions: ["pdf"] }],
          defaultPath: `${stemFromPath(docPath)}.pdf`,
          title: t(locale, "docsSaveTitle"),
        });
      } catch {
        return;
      }
      if (!outputPath) return;

      const normalized = outputPath.toLowerCase().endsWith(".pdf")
        ? outputPath
        : `${outputPath}.pdf`;

      busy = true;
      syncEnabled();
      convertButton.classList.add("is-busy");
      statusEl.hidden = false;
      statusEl.classList.remove("is-error", "is-success");
      statusEl.textContent = t(locale, "docsConvertProgress");
      statusEl.focus();

      try {
        await invoke("convert_document_to_pdf", {
          inputPath: docPath,
          outputPath: normalized,
        });
        statusEl.classList.add("is-success");
        statusEl.textContent = t(locale, "docsConvertSuccess");
      } catch (error) {
        const humanized = humanizeError(locale, error, "docsConvertFailed");
        statusEl.classList.add("is-error");
        statusEl.textContent = humanized.message;
        applyHumanizedError(errorEl, locale, humanized);
        if (parseInvokeError(error).code === "missing_libreoffice") {
          libreOfficeAvailable = false;
          syncGuide();
        }
      } finally {
        busy = false;
        convertButton.classList.remove("is-busy");
        syncEnabled();
      }
    })();
  });

  setSelection(null);
  statusEl.hidden = true;
  syncGuide();

  return {
    setLibreOfficeAvailable: (available) => {
      libreOfficeAvailable = available;
      syncGuide();
      syncEnabled();
    },
    refreshCopy: (locale) => {
      if (!statusEl.hidden && convertButton.classList.contains("is-busy")) {
        statusEl.textContent = t(locale, "docsConvertProgress");
      }
    },
  };
}
