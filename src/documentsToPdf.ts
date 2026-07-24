import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
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
  parseInvokeError,
} from "./errors";
import { fileNameFromPath } from "./images";
import { t, type Locale } from "./i18n";
import { bindOpenFolderButton } from "./openOutput";
import { stemFromPath } from "./pathHelpers";

const LIBREOFFICE_DOWNLOAD_URL =
  "https://www.libreoffice.org/download/download-libreoffice/";

function isOfficePath(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".docx") || lower.endsWith(".xlsx");
}

export type DocumentsToPdfController = DropTarget & {
  refreshCopy: (locale: Locale) => void;
  setLibreOfficeAvailable: (available: boolean) => void;
};

export function initDocumentsToPdf(
  getLocale: () => Locale,
  onCheckAgain: () => void,
): DocumentsToPdfController | null {
  const dropZone = document.querySelector<HTMLElement>("#docs-drop-zone");
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
  const cancel = bindCancelButton(
    document.querySelector<HTMLButtonElement>("#docs-convert-cancel"),
  );

  if (
    !dropZone ||
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
      dropZone.classList.add("has-file");
    } else {
      fileNameEl.textContent = "";
      selection.hidden = true;
      dropZone.classList.remove("has-file");
    }
    syncEnabled();
  };

  const showUnsupported = () => {
    applyHumanizedError(errorEl, getLocale(), {
      message: t(getLocale(), "docsUnsupported"),
    });
  };

  const acceptPaths = (paths: string[]) => {
    if (busy || !libreOfficeAvailable || paths.length === 0) return;
    clearHumanizedError(errorEl);
    const match = paths.find(isOfficePath);
    if (!match) {
      showUnsupported();
      return;
    }
    setSelection(match);
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
        showUnsupported();
        return;
      }
      setSelection(result);
    } catch {
      // Dialog cancelled
    }
  };

  dropZone.addEventListener("click", (event) => {
    if (
      event.target === pickButton ||
      pickButton.contains(event.target as Node)
    ) {
      return;
    }
    if (!busy && libreOfficeAvailable) void pickDocument();
  });

  pickButton.addEventListener("click", (event) => {
    event.stopPropagation();
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
      cancel?.setBusy(true);
      openFolder?.hide();
      statusEl.hidden = false;
      statusEl.classList.remove("is-error", "is-success");
      statusEl.textContent = t(locale, "docsConvertProgress");
      statusEl.focus();
      await resetConversionCancel();

      try {
        await invoke("convert_document_to_pdf", {
          inputPath: docPath,
          outputPath: normalized,
        });
        statusEl.classList.add("is-success");
        statusEl.textContent = t(locale, "docsConvertSuccess");
        openFolder?.show(normalized, false);
      } catch (error) {
        const humanized = humanizeError(locale, error, "docsConvertFailed");
        statusEl.classList.add("is-error");
        statusEl.textContent = isConvertCancelled(error)
          ? t(locale, "convertCancelled")
          : humanized.message;
        openFolder?.hide();
        if (!isConvertCancelled(error)) {
          applyHumanizedError(errorEl, locale, humanized);
          if (parseInvokeError(error).code === "missing_libreoffice") {
            libreOfficeAvailable = false;
            syncGuide();
          }
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
  statusEl.hidden = true;
  openFolder?.hide();
  syncGuide();

  return {
    acceptPaths,
    setDragOver: (active) => {
      dropZone.classList.toggle(
        "is-dragover",
        active && !busy && libreOfficeAvailable,
      );
    },
    setLibreOfficeAvailable: (available) => {
      libreOfficeAvailable = available;
      syncGuide();
      syncEnabled();
    },
    refreshCopy: (locale) => {
      openFolder?.refreshCopy(t(locale, "openOutputFolder"));
      cancel?.refreshCopy(t(locale, "convertCancelButton"));
      if (!statusEl.hidden && convertButton.classList.contains("is-busy")) {
        statusEl.textContent = t(locale, "docsConvertProgress");
      }
    },
  };
}
