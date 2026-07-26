import { invoke } from "@tauri-apps/api/core";
import {
  bindCancelButton,
  isConvertCancelled,
  resetConversionCancel,
} from "./cancelConvert";
import type { QueueItemStatus } from "./dropzone";
import {
  applyHumanizedError,
  humanizeError,
  type HumanizedError,
} from "./errors";
import { extensionForFormat, type OutputFormatId } from "./formats";
import { type SelectedImage } from "./images";
import { t, type Locale } from "./i18n";
import { bindOpenFolderButton, type OpenFolderControl } from "./openOutput";
import { uniqueConvertedSibling } from "./outputPaths";
import { parentDir } from "./pathHelpers";

function showStatusMessage(el: HTMLElement, message: string): void {
  el.replaceChildren();
  el.textContent = message;
}

function showStatusWithOptionalDetails(
  el: HTMLElement,
  locale: Locale,
  summary: string,
  details?: string,
): void {
  if (!details) {
    showStatusMessage(el, summary);
    return;
  }
  applyHumanizedError(el, locale, { message: summary, details });
}

export type ConvertUi = {
  button: HTMLButtonElement;
  status: HTMLElement;
  openFolder: OpenFolderControl | null;
  setBusy: (busy: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  refreshCopy: (locale: Locale) => void;
};

export function initConvertControls(): ConvertUi | null {
  const button = document.querySelector<HTMLButtonElement>("#convert-button");
  const status = document.querySelector<HTMLElement>("#convert-status");
  const openFolder = bindOpenFolderButton(
    document.querySelector<HTMLButtonElement>("#convert-open-folder"),
  );
  const cancel = bindCancelButton(
    document.querySelector<HTMLButtonElement>("#convert-cancel"),
  );
  if (!button || !status) return null;

  const setBusy = (busy: boolean) => {
    button.disabled = busy || button.dataset.ready !== "true";
    button.classList.toggle("is-busy", busy);
    cancel?.setBusy(busy);
    if (busy) {
      status.hidden = false;
      openFolder?.hide();
      showStatusMessage(status, button.dataset.progressText ?? "");
    }
  };

  const setEnabled = (enabled: boolean) => {
    button.dataset.ready = enabled ? "true" : "false";
    if (!button.classList.contains("is-busy")) {
      button.disabled = !enabled;
    }
  };

  const refreshCopy = (locale: Locale) => {
    button.dataset.progressText = t(locale, "convertProgress");
    openFolder?.refreshCopy(t(locale, "openOutputFolder"));
    cancel?.refreshCopy(t(locale, "convertCancelButton"));
    if (!status.hidden && button.classList.contains("is-busy")) {
      showStatusMessage(status, t(locale, "convertProgress"));
    }
  };

  setEnabled(false);
  status.hidden = true;
  openFolder?.hide();

  return { button, status, openFolder, setBusy, setEnabled, refreshCopy };
}

export async function runBatchConversion(options: {
  locale: Locale;
  queue: SelectedImage[];
  format: OutputFormatId;
  ui: ConvertUi;
  setItemStatus: (
    path: string,
    status: QueueItemStatus,
    errorMessage?: string,
    errorDetails?: string,
  ) => void;
  resetStatuses: () => void;
}): Promise<void> {
  const { locale, queue, format, ui, setItemStatus, resetStatuses } = options;
  if (queue.length === 0) return;

  resetStatuses();
  ui.setBusy(true);
  ui.openFolder?.hide();
  ui.status.hidden = false;
  ui.status.classList.remove("is-error", "is-success");
  showStatusMessage(ui.status, t(locale, "convertProgress"));
  await resetConversionCancel();

  const ext = extensionForFormat(format);
  const usedByDir = new Map<string, Set<string>>();
  let successCount = 0;
  let failCount = 0;
  let renamedCount = 0;
  let lastHumanized: HumanizedError | null = null;
  let cancelled = false;
  let lastOutputDir: string | null = null;

  try {
    for (const item of queue) {
      setItemStatus(item.path, "converting");
      const dir = parentDir(item.path);
      let used = usedByDir.get(dir);
      if (!used) {
        used = new Set();
        usedByDir.set(dir, used);
      }
      const { path: outputPath, renamed } = await uniqueConvertedSibling(
        item.path,
        ext,
        used,
      );
      if (renamed) renamedCount += 1;

      try {
        await invoke("convert_image", {
          inputPath: item.path,
          outputPath,
        });
        setItemStatus(item.path, "success");
        successCount += 1;
        lastOutputDir = dir;
      } catch (error) {
        if (isConvertCancelled(error)) {
          cancelled = true;
          const humanized = humanizeError(locale, error, "convertFailed");
          setItemStatus(
            item.path,
            "error",
            humanized.message,
            humanized.details,
          );
          lastHumanized = humanized;
          break;
        }
        const humanized = humanizeError(locale, error, "convertFailed");
        lastHumanized = humanized;
        setItemStatus(item.path, "error", humanized.message, humanized.details);
        failCount += 1;
      }
    }

    ui.status.classList.remove("is-error", "is-success");
    if (cancelled) {
      ui.status.classList.add("is-error");
      ui.openFolder?.hide();
      showStatusMessage(ui.status, t(locale, "convertCancelled"));
    } else if (failCount === 0) {
      ui.status.classList.add("is-success");
      const base = t(locale, "convertSuccess");
      const note =
        renamedCount > 0 ? ` ${t(locale, "convertRenamedNote")}` : "";
      showStatusMessage(ui.status, `${base}${note}`);
      if (lastOutputDir) ui.openFolder?.show(lastOutputDir, true);
    } else if (successCount === 0) {
      ui.status.classList.add("is-error");
      ui.openFolder?.hide();
      const summary =
        queue.length === 1 && lastHumanized
          ? lastHumanized.message
          : t(locale, "convertAllFailed");
      showStatusWithOptionalDetails(
        ui.status,
        locale,
        summary,
        lastHumanized?.details,
      );
    } else {
      ui.status.classList.add("is-error");
      if (lastOutputDir) ui.openFolder?.show(lastOutputDir, true);
      showStatusWithOptionalDetails(
        ui.status,
        locale,
        t(locale, "convertPartial"),
        lastHumanized?.details,
      );
    }
    ui.status.focus();
  } finally {
    ui.setBusy(false);
    ui.button.disabled = ui.button.dataset.ready !== "true";
  }
}
