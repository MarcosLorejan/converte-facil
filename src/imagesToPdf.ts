import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import {
  fileNameFromPath,
  isSupportedImagePath,
  type SelectedImage,
} from "./images";
import { t, type Locale } from "./i18n";

type QueueItem = SelectedImage;

function mapError(locale: Locale, code: unknown): string {
  switch (code) {
    case "missing_imagemagick":
      return t(locale, "convertMissingMagick");
    case "missing_ghostscript":
      return t(locale, "pdfMissingGhostscript");
    case "spawn_failed":
      return t(locale, "convertSpawnFailed");
    default:
      return t(locale, "imagesToPdfFailed");
  }
}

export type ImagesToPdfController = {
  refreshCopy: (locale: Locale) => void;
};

export function initImagesToPdf(
  getLocale: () => Locale,
): ImagesToPdfController | null {
  const pickButton = document.querySelector<HTMLButtonElement>("#images-to-pdf-pick");
  const errorEl = document.querySelector<HTMLElement>("#images-to-pdf-error");
  const queueRoot = document.querySelector<HTMLElement>("#images-to-pdf-queue");
  const list = document.querySelector<HTMLElement>("#images-to-pdf-list");
  const convertButton = document.querySelector<HTMLButtonElement>("#images-to-pdf-convert");
  const statusEl = document.querySelector<HTMLElement>("#images-to-pdf-status");

  if (!pickButton || !errorEl || !queueRoot || !list || !convertButton || !statusEl) {
    return null;
  }

  let queue: QueueItem[] = [];
  let busy = false;

  const showError = (message: string) => {
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  const clearError = () => {
    errorEl.textContent = "";
    errorEl.hidden = true;
  };

  const syncEnabled = () => {
    convertButton.disabled = queue.length === 0 || busy;
    pickButton.disabled = busy;
  };

  const moveItem = (index: number, delta: number) => {
    const next = index + delta;
    if (next < 0 || next >= queue.length) return;
    const copy = [...queue];
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    queue = copy;
    renderQueue();
  };

  const renderQueue = () => {
    const locale = getLocale();
    list.replaceChildren();
    queueRoot.hidden = queue.length === 0;

    queue.forEach((item, index) => {
      const row = document.createElement("li");
      row.className = "queue-item images-to-pdf-item";

      const preview = document.createElement("img");
      preview.className = "queue-preview";
      preview.alt = item.name;
      preview.src = convertFileSrc(item.path);

      const meta = document.createElement("div");
      meta.className = "queue-meta";

      const name = document.createElement("p");
      name.className = "queue-name";
      name.textContent = item.name;

      const page = document.createElement("p");
      page.className = "queue-status";
      page.textContent = t(locale, "imagesToPdfPageLabel").replace(
        "{n}",
        String(index + 1),
      );

      meta.append(name, page);

      const actions = document.createElement("div");
      actions.className = "queue-actions";

      const up = document.createElement("button");
      up.type = "button";
      up.className = "queue-order";
      up.textContent = t(locale, "imagesToPdfMoveUp");
      up.disabled = busy || index === 0;
      up.addEventListener("click", () => moveItem(index, -1));

      const down = document.createElement("button");
      down.type = "button";
      down.className = "queue-order";
      down.textContent = t(locale, "imagesToPdfMoveDown");
      down.disabled = busy || index === queue.length - 1;
      down.addEventListener("click", () => moveItem(index, 1));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "queue-remove";
      remove.textContent = t(locale, "dropClear");
      remove.disabled = busy;
      remove.addEventListener("click", () => {
        clearError();
        queue = queue.filter((entry) => entry.path !== item.path);
        renderQueue();
        syncEnabled();
      });

      actions.append(up, down, remove);
      row.append(preview, meta, actions);
      list.appendChild(row);
    });

    syncEnabled();
  };

  const acceptPaths = (paths: string[]) => {
    clearError();
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
      added.push({ path, name: fileNameFromPath(path) });
    }

    if (added.length === 0) {
      showError(
        t(
          getLocale(),
          rejected > 0 ? "dropUnsupported" : "dropNoneAdded",
        ),
      );
      return;
    }

    if (rejected > 0) {
      showError(t(getLocale(), "dropSomeUnsupported"));
    }

    queue = [...queue, ...added];
    renderQueue();
  };

  pickButton.addEventListener("click", () => {
    void (async () => {
      clearError();
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
          title: t(getLocale(), "imagesToPdfPickTitle"),
        });
        if (result === null) return;
        const paths = typeof result === "string" ? [result] : result;
        acceptPaths(paths);
      } catch {
        // Dialog cancelled
      }
    })();
  });

  convertButton.addEventListener("click", () => {
    if (queue.length === 0 || busy) return;
    void (async () => {
      const locale = getLocale();
      clearError();

      let outputPath: string | null;
      try {
        outputPath = await save({
          filters: [{ name: "PDF", extensions: ["pdf"] }],
          defaultPath: "photos.pdf",
          title: t(locale, "imagesToPdfSaveTitle"),
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
      statusEl.textContent = t(locale, "imagesToPdfProgress");
      renderQueue();

      try {
        await invoke("combine_images_to_pdf", {
          inputPaths: queue.map((item) => item.path),
          outputPath: normalized,
        });
        statusEl.classList.add("is-success");
        statusEl.textContent = t(locale, "imagesToPdfSuccess");
      } catch (error) {
        const message = mapError(locale, error);
        statusEl.classList.add("is-error");
        statusEl.textContent = message;
        showError(message);
      } finally {
        busy = false;
        convertButton.classList.remove("is-busy");
        renderQueue();
      }
    })();
  });

  renderQueue();
  statusEl.hidden = true;

  return {
    refreshCopy: () => {
      renderQueue();
      if (!statusEl.hidden && convertButton.classList.contains("is-busy")) {
        statusEl.textContent = t(getLocale(), "imagesToPdfProgress");
      }
    },
  };
}
