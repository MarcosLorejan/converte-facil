import { getCurrentWebview } from "@tauri-apps/api/webview";
import type { AppMode } from "./modeSwitch";

export type DropTarget = {
  acceptPaths: (paths: string[]) => void;
  setDragOver: (active: boolean) => void;
};

/**
 * Single webview drag-drop listener routed by the active app mode.
 * Tauri delivers drops to the whole webview (not hit-tested per element).
 */
export function initAppDragDrop(
  getMode: () => AppMode,
  targets: Partial<Record<AppMode, DropTarget | null>>,
): void {
  void getCurrentWebview()
    .onDragDropEvent((event) => {
      const target = targets[getMode()];
      if (!target) return;

      if (event.payload.type === "over") {
        target.setDragOver(true);
      } else if (
        event.payload.type === "leave" ||
        event.payload.type === "drop"
      ) {
        target.setDragOver(false);
      }

      if (event.payload.type === "drop") {
        target.acceptPaths(event.payload.paths);
      }
    })
    .catch(() => {
      // Running outside Tauri (e.g. vite-only) — pickers still work
    });
}
