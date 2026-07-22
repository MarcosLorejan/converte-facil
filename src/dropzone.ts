import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import {
  fileNameFromPath,
  isSupportedImagePath,
  type SelectedImage,
} from "./images";
import { t, type Locale } from "./i18n";

type DropZoneUi = {
  zone: HTMLElement;
  browse: HTMLButtonElement;
  clear: HTMLButtonElement;
  error: HTMLElement;
  selection: HTMLElement;
  preview: HTMLImageElement;
  name: HTMLElement;
};

export type DropZoneController = {
  getSelection: () => SelectedImage | null;
  refreshCopy: (locale: Locale) => void;
};

function showError(ui: DropZoneUi, message: string) {
  ui.error.textContent = message;
  ui.error.hidden = false;
}

function clearError(ui: DropZoneUi) {
  ui.error.textContent = "";
  ui.error.hidden = true;
}

function renderSelection(ui: DropZoneUi, selected: SelectedImage | null) {
  if (!selected) {
    ui.selection.hidden = true;
    ui.preview.removeAttribute("src");
    ui.name.textContent = "";
    ui.zone.classList.remove("has-file");
    return;
  }

  ui.selection.hidden = false;
  ui.zone.classList.add("has-file");
  ui.name.textContent = selected.name;
  ui.preview.alt = selected.name;
  ui.preview.src = convertFileSrc(selected.path);
}

export function initDropZone(
  getLocale: () => Locale,
  onChange?: (selected: SelectedImage | null) => void,
): DropZoneController | null {
  const zone = document.querySelector<HTMLElement>("#drop-zone");
  const browse = document.querySelector<HTMLButtonElement>("#drop-browse");
  const clear = document.querySelector<HTMLButtonElement>("#drop-clear");
  const error = document.querySelector<HTMLElement>("#drop-error");
  const selection = document.querySelector<HTMLElement>("#selection");
  const preview = document.querySelector<HTMLImageElement>("#selection-preview");
  const name = document.querySelector<HTMLElement>("#selection-name");

  if (!zone || !browse || !clear || !error || !selection || !preview || !name) {
    return null;
  }

  const ui: DropZoneUi = { zone, browse, clear, error, selection, preview, name };
  let selected: SelectedImage | null = null;

  const setSelected = (next: SelectedImage | null) => {
    selected = next;
    renderSelection(ui, next);
    onChange?.(next);
  };

  const acceptPaths = (paths: string[]) => {
    clearError(ui);
    if (paths.length === 0) return;

    if (paths.length > 1) {
      showError(ui, t(getLocale(), "dropMulti"));
      return;
    }

    const path = paths[0];
    if (!isSupportedImagePath(path)) {
      showError(ui, t(getLocale(), "dropUnsupported"));
      return;
    }

    setSelected({ path, name: fileNameFromPath(path) });
  };

  const openPicker = async () => {
    clearError(ui);
    try {
      const result = await open({
        multiple: false,
        directory: false,
        filters: [
          {
            name: "Images",
            extensions: ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "bmp"],
          },
        ],
      });

      if (result === null) return;
      const path = typeof result === "string" ? result : result[0];
      if (path) acceptPaths([path]);
    } catch {
      // Dialog cancelled or unavailable — leave UI unchanged
    }
  };

  zone.addEventListener("click", (event) => {
    if (event.target === browse || browse.contains(event.target as Node)) {
      return;
    }
    void openPicker();
  });

  zone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void openPicker();
    }
  });

  browse.addEventListener("click", (event) => {
    event.stopPropagation();
    void openPicker();
  });

  clear.addEventListener("click", () => {
    clearError(ui);
    setSelected(null);
  });

  void getCurrentWebview()
    .onDragDropEvent((event) => {
      if (event.payload.type === "over") {
        zone.classList.add("is-dragover");
      } else if (event.payload.type === "leave" || event.payload.type === "drop") {
        zone.classList.remove("is-dragover");
      }

      if (event.payload.type === "drop") {
        acceptPaths(event.payload.paths);
      }
    })
    .catch(() => {
      // Running outside Tauri (e.g. vite-only) — picker still works
    });

  return {
    getSelection: () => selected,
    refreshCopy: (locale) => {
      if (!error.hidden && selected === null) {
        // Keep generic unsupported/multi messages in sync with language
        const text = error.textContent ?? "";
        if (
          text === t("en", "dropUnsupported") ||
          text === t("pt-BR", "dropUnsupported")
        ) {
          showError(ui, t(locale, "dropUnsupported"));
        } else if (
          text === t("en", "dropMulti") ||
          text === t("pt-BR", "dropMulti")
        ) {
          showError(ui, t(locale, "dropMulti"));
        }
      }
    },
  };
}
