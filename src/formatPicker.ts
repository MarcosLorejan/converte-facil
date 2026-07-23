import {
  OUTPUT_FORMATS,
  isOutputFormatId,
  type OutputFormatId,
} from "./formats";
import { t, type Locale, type MessageKey } from "./i18n";

export type FormatPickerController = {
  getFormat: () => OutputFormatId | null;
  setEnabled: (enabled: boolean) => void;
  refreshCopy: (locale: Locale) => void;
};

export function initFormatPicker(
  onChange?: (format: OutputFormatId | null) => void,
): FormatPickerController | null {
  const root = document.querySelector<HTMLElement>("#format-picker");
  const list = document.querySelector<HTMLElement>("#format-list");
  if (!root || !list) return null;

  let selected: OutputFormatId | null = null;
  let enabled = false;

  const buttons = OUTPUT_FORMATS.map((format) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "format-option";
    button.dataset.format = format.id;
    button.dataset.i18n = format.labelKey;
    button.disabled = true;
    button.addEventListener("click", () => {
      if (!enabled) return;
      selected = format.id;
      list.querySelectorAll(".format-option").forEach((el) => {
        el.classList.toggle("is-selected", el === button);
      });
      onChange?.(selected);
    });
    list.appendChild(button);
    return button;
  });

  const refreshCopy = (locale: Locale) => {
    buttons.forEach((button) => {
      const key = button.dataset.i18n as MessageKey | undefined;
      if (key) button.textContent = t(locale, key);
    });
  };

  const setEnabled = (next: boolean) => {
    enabled = next;
    root.classList.toggle("is-disabled", !next);
    buttons.forEach((button) => {
      button.disabled = !next;
    });
    if (!next) {
      selected = null;
      buttons.forEach((button) => button.classList.remove("is-selected"));
      onChange?.(null);
    }
  };

  setEnabled(false);

  return {
    getFormat: () => selected,
    setEnabled,
    refreshCopy,
  };
}

export function readSelectedFormatFromDom(): OutputFormatId | null {
  const selected = document.querySelector<HTMLElement>(".format-option.is-selected");
  const id = selected?.dataset.format;
  return id && isOutputFormatId(id) ? id : null;
}
