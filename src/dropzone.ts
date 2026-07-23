import { convertFileSrc } from "@tauri-apps/api/core";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open } from "@tauri-apps/plugin-dialog";
import {
  fileNameFromPath,
  isSupportedImagePath,
  type SelectedImage,
} from "./images";
import { t, type Locale } from "./i18n";

export type QueueItemStatus = "idle" | "converting" | "success" | "error";

type QueueItem = SelectedImage & {
  status: QueueItemStatus;
  errorMessage: string;
  errorDetails: string;
};

type DropZoneUi = {
  zone: HTMLElement;
  browse: HTMLButtonElement;
  error: HTMLElement;
  queueRoot: HTMLElement;
  list: HTMLElement;
};

export type DropZoneController = {
  getQueue: () => SelectedImage[];
  setItemStatus: (
    path: string,
    status: QueueItemStatus,
    errorMessage?: string,
    errorDetails?: string,
  ) => void;
  resetStatuses: () => void;
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

function statusLabel(locale: Locale, item: QueueItem): string {
  switch (item.status) {
    case "converting":
      return t(locale, "queueStatusConverting");
    case "success":
      return t(locale, "queueStatusSuccess");
    case "error":
      return item.errorMessage || t(locale, "queueStatusFailed");
    default:
      return "";
  }
}

export function initDropZone(
  getLocale: () => Locale,
  onChange?: (queue: SelectedImage[]) => void,
): DropZoneController | null {
  const zone = document.querySelector<HTMLElement>("#drop-zone");
  const browse = document.querySelector<HTMLButtonElement>("#drop-browse");
  const error = document.querySelector<HTMLElement>("#drop-error");
  const queueRoot = document.querySelector<HTMLElement>("#queue");
  const list = document.querySelector<HTMLElement>("#queue-list");

  if (!zone || !browse || !error || !queueRoot || !list) {
    return null;
  }

  const ui: DropZoneUi = { zone, browse, error, queueRoot, list };
  let queue: QueueItem[] = [];

  const emitChange = () => {
    onChange?.(queue.map(({ path, name }) => ({ path, name })));
  };

  const renderQueue = () => {
    const locale = getLocale();
    list.replaceChildren();
    queueRoot.hidden = queue.length === 0;
    zone.classList.toggle("has-file", queue.length > 0);

    for (const item of queue) {
      const row = document.createElement("li");
      row.className = `queue-item is-${item.status}`;
      row.dataset.path = item.path;

      const preview = document.createElement("img");
      preview.className = "queue-preview";
      preview.alt = item.name;
      preview.src = convertFileSrc(item.path);

      const meta = document.createElement("div");
      meta.className = "queue-meta";

      const name = document.createElement("p");
      name.className = "queue-name";
      name.textContent = item.name;

      const status = document.createElement("div");
      status.className = "queue-status";
      status.hidden = item.status === "idle";

      const statusText = document.createElement("p");
      statusText.className = "queue-status-text";
      statusText.textContent = statusLabel(locale, item);
      status.appendChild(statusText);

      if (item.status === "error" && item.errorDetails) {
        const details = document.createElement("details");
        details.className = "error-details";

        const summary = document.createElement("summary");
        summary.textContent = t(locale, "errorDetails");

        const body = document.createElement("pre");
        body.className = "error-details-body";
        body.textContent = item.errorDetails;

        details.append(summary, body);
        status.appendChild(details);
      }

      meta.append(name, status);

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "queue-remove";
      remove.textContent = t(locale, "dropClear");
      remove.addEventListener("click", () => {
        clearError(ui);
        queue = queue.filter((entry) => entry.path !== item.path);
        renderQueue();
        emitChange();
      });

      row.append(preview, meta, remove);
      list.appendChild(row);
    }
  };

  const acceptPaths = (paths: string[]) => {
    clearError(ui);
    if (paths.length === 0) return;

    const existing = new Set(queue.map((item) => item.path));
    const added: QueueItem[] = [];
    let rejected = 0;

    for (const path of paths) {
      if (!isSupportedImagePath(path)) {
        rejected += 1;
        continue;
      }
      if (existing.has(path)) continue;
      existing.add(path);
      added.push({
        path,
        name: fileNameFromPath(path),
        status: "idle",
        errorMessage: "",
        errorDetails: "",
      });
    }

    if (added.length === 0) {
      showError(
        ui,
        t(
          getLocale(),
          rejected > 0 ? "dropUnsupported" : "dropNoneAdded",
        ),
      );
      return;
    }

    if (rejected > 0) {
      showError(ui, t(getLocale(), "dropSomeUnsupported"));
    }

    queue = [...queue, ...added];
    renderQueue();
    emitChange();
  };

  const openPicker = async () => {
    clearError(ui);
    try {
      const result = await open({
        multiple: true,
        directory: false,
        filters: [
          {
            name: "Images",
            extensions: ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "bmp"],
          },
        ],
      });

      if (result === null) return;
      const paths = typeof result === "string" ? [result] : result;
      acceptPaths(paths);
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

  browse.addEventListener("click", (event) => {
    event.stopPropagation();
    void openPicker();
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
    getQueue: () => queue.map(({ path, name }) => ({ path, name })),
    setItemStatus: (path, status, errorMessage = "", errorDetails = "") => {
      const item = queue.find((entry) => entry.path === path);
      if (!item) return;
      item.status = status;
      item.errorMessage = errorMessage;
      item.errorDetails = errorDetails;
      renderQueue();
    },
    resetStatuses: () => {
      for (const item of queue) {
        item.status = "idle";
        item.errorMessage = "";
        item.errorDetails = "";
      }
      renderQueue();
    },
    refreshCopy: (locale) => {
      renderQueue();
      if (!error.hidden) {
        const text = error.textContent ?? "";
        const keys = [
          "dropUnsupported",
          "dropSomeUnsupported",
          "dropNoneAdded",
        ] as const;
        for (const key of keys) {
          if (text === t("en", key) || text === t("pt-BR", key)) {
            showError(ui, t(locale, key));
            break;
          }
        }
      }
    },
  };
}
