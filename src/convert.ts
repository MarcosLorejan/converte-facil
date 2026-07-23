import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { extensionForFormat, type OutputFormatId } from "./formats";
import { fileNameFromPath, type SelectedImage } from "./images";
import { t, type Locale } from "./i18n";

function stemFromPath(path: string): string {
  const name = fileNameFromPath(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function mapConvertError(locale: Locale, code: unknown): string {
  const key =
    code === "missing_imagemagick"
      ? "convertMissingMagick"
      : code === "spawn_failed"
        ? "convertSpawnFailed"
        : "convertFailed";
  return t(locale, key);
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
      status.textContent = button.dataset.progressText ?? "";
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
      status.textContent = t(locale, "convertProgress");
    }
  };

  setEnabled(false);
  status.hidden = true;

  return { button, status, setBusy, setEnabled, refreshCopy };
}

export async function runConversion(options: {
  locale: Locale;
  selected: SelectedImage;
  format: OutputFormatId;
  ui: ConvertUi;
}): Promise<void> {
  const { locale, selected, format, ui } = options;
  const ext = extensionForFormat(format);
  const defaultName = `${stemFromPath(selected.path)}.${ext}`;

  let outputPath: string | null;
  try {
    outputPath = await save({
      defaultPath: defaultName,
      filters: [{ name: format.toUpperCase(), extensions: [ext] }],
    });
  } catch {
    return;
  }

  if (!outputPath) return;

  ui.setBusy(true);
  ui.status.hidden = false;
  ui.status.classList.remove("is-error", "is-success");
  ui.status.textContent = t(locale, "convertProgress");

  try {
    await invoke("convert_image", {
      inputPath: selected.path,
      outputPath,
    });
    ui.status.classList.add("is-success");
    ui.status.textContent = t(locale, "convertSuccess");
  } catch (error) {
    ui.status.classList.add("is-error");
    ui.status.textContent = mapConvertError(locale, error);
  } finally {
    ui.button.classList.remove("is-busy");
    ui.button.disabled = ui.button.dataset.ready !== "true";
  }
}
