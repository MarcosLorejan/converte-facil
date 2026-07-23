import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { QueueItemStatus } from "./dropzone";
import {
  applyHumanizedError,
  humanizeError,
  type HumanizedError,
} from "./errors";
import { extensionForFormat, type OutputFormatId } from "./formats";
import { fileNameFromPath, type SelectedImage } from "./images";
import { t, type Locale } from "./i18n";

function stemFromPath(path: string): string {
  const name = fileNameFromPath(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function joinPath(dir: string, name: string): string {
  const endsWithSep = dir.endsWith("/") || dir.endsWith("\\");
  if (endsWithSep) return `${dir}${name}`;
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir}${sep}${name}`;
}

function uniqueFileName(
  stem: string,
  ext: string,
  used: Set<string>,
): string {
  let candidate = `${stem}.${ext}`;
  let index = 2;
  while (used.has(candidate.toLowerCase())) {
    candidate = `${stem}-${index}.${ext}`;
    index += 1;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

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
  setBusy: (busy: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  refreshCopy: (locale: Locale) => void;
};

export function initConvertControls(): ConvertUi | null {
  const button = document.querySelector<HTMLButtonElement>("#convert-button");
  const status = document.querySelector<HTMLElement>("#convert-status");
  if (!button || !status) return null;

  const setBusy = (busy: boolean) => {
    button.disabled = busy || button.dataset.ready !== "true";
    button.classList.toggle("is-busy", busy);
    status.hidden = !busy;
    if (busy) {
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
    if (!status.hidden && button.classList.contains("is-busy")) {
      showStatusMessage(status, t(locale, "convertProgress"));
    }
  };

  setEnabled(false);
  status.hidden = true;

  return { button, status, setBusy, setEnabled, refreshCopy };
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

  let outputDir: string | string[] | null;
  try {
    outputDir = await open({
      directory: true,
      multiple: false,
      title: t(locale, "convertPickFolder"),
    });
  } catch {
    return;
  }

  if (!outputDir || Array.isArray(outputDir)) return;

  resetStatuses();
  ui.setBusy(true);
  ui.status.hidden = false;
  ui.status.classList.remove("is-error", "is-success");
  showStatusMessage(ui.status, t(locale, "convertProgress"));

  const ext = extensionForFormat(format);
  const usedNames = new Set<string>();
  let successCount = 0;
  let failCount = 0;
  let lastHumanized: HumanizedError | null = null;

  try {
    for (const item of queue) {
      setItemStatus(item.path, "converting");
      const fileName = uniqueFileName(stemFromPath(item.path), ext, usedNames);
      const outputPath = joinPath(outputDir, fileName);

      try {
        await invoke("convert_image", {
          inputPath: item.path,
          outputPath,
        });
        setItemStatus(item.path, "success");
        successCount += 1;
      } catch (error) {
        const humanized = humanizeError(locale, error, "convertFailed");
        lastHumanized = humanized;
        setItemStatus(
          item.path,
          "error",
          humanized.message,
          humanized.details,
        );
        failCount += 1;
      }
    }

    ui.status.classList.remove("is-error", "is-success");
    if (failCount === 0) {
      ui.status.classList.add("is-success");
      showStatusMessage(ui.status, t(locale, "convertSuccess"));
    } else if (successCount === 0) {
      ui.status.classList.add("is-error");
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
      showStatusWithOptionalDetails(
        ui.status,
        locale,
        t(locale, "convertPartial"),
        lastHumanized?.details,
      );
    }
  } finally {
    ui.button.classList.remove("is-busy");
    ui.button.disabled = ui.button.dataset.ready !== "true";
  }
}
