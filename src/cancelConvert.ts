import { invoke } from "@tauri-apps/api/core";
import { parseInvokeError } from "./errors";

/** Clear cancel flag before starting a conversion job. */
export async function resetConversionCancel(): Promise<void> {
  await invoke("reset_conversion_cancel");
}

/** Kill the in-flight Magick / LibreOffice process, if any. */
export async function requestConversionCancel(): Promise<void> {
  await invoke("cancel_conversion");
}

export function isConvertCancelled(error: unknown): boolean {
  return parseInvokeError(error).code === "convert_cancelled";
}

/** Wire a Cancel button shown only while `setBusy(true)`. */
export function bindCancelButton(
  button: HTMLButtonElement | null,
  onCancel?: () => void,
): {
  setBusy: (busy: boolean) => void;
  refreshCopy: (label: string) => void;
} | null {
  if (!button) return null;

  button.hidden = true;
  button.addEventListener("click", () => {
    onCancel?.();
    void requestConversionCancel();
  });

  return {
    setBusy: (busy) => {
      button.hidden = !busy;
      button.disabled = !busy;
    },
    refreshCopy: (label) => {
      button.textContent = label;
    },
  };
}
