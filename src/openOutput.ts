import { openPath, revealItemInDir } from "@tauri-apps/plugin-opener";

/**
 * Reveal a saved file in Explorer, or open a folder.
 * Prefers revealing a file; falls back to opening the directory.
 */
export async function openOutputLocation(path: string, isDirectory = false): Promise<void> {
  if (isDirectory) {
    await openPath(path);
    return;
  }
  try {
    await revealItemInDir(path);
  } catch {
    await openPath(path);
  }
}

export type OpenFolderControl = {
  show: (path: string, isDirectory?: boolean) => void;
  hide: () => void;
  refreshCopy: (label: string) => void;
};

export function bindOpenFolderButton(
  button: HTMLButtonElement | null,
): OpenFolderControl | null {
  if (!button) return null;

  let target: { path: string; isDirectory: boolean } | null = null;

  button.addEventListener("click", () => {
    if (!target) return;
    void openOutputLocation(target.path, target.isDirectory).catch(() => {
      // Ignore Explorer failures; conversion already succeeded.
    });
  });

  return {
    show: (path, isDirectory = false) => {
      target = { path, isDirectory };
      button.hidden = false;
    },
    hide: () => {
      target = null;
      button.hidden = true;
    },
    refreshCopy: (label) => {
      button.textContent = label;
    },
  };
}
