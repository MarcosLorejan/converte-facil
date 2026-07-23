import { t, type Locale, type MessageKey } from "./i18n";

export type HumanizedError = {
  message: string;
  details?: string;
};

export type ParsedInvokeError = {
  code: string;
  detail?: string;
};

const CODE_KEYS: Record<string, MessageKey> = {
  missing_imagemagick: "convertMissingMagick",
  missing_ghostscript: "pdfMissingGhostscript",
  missing_libreoffice: "docsMissingLibreOffice",
  unsupported_format: "docsUnsupported",
  spawn_failed: "convertSpawnFailed",
  convert_failed: "convertFailed",
  invalid_format: "errorUnsupportedCodec",
  no_inputs: "errorGeneric",
};

/** Magick / Ghostscript / OS failure patterns → calm UI copy. */
const DETAIL_PATTERNS: ReadonlyArray<{ test: RegExp; key: MessageKey }> = [
  {
    test: /password|encrypt(ed)?|owner password|user password/i,
    key: "errorPdfEncrypted",
  },
  {
    test: /no pages|empty pdf|pdf.*empty|zero pages/i,
    key: "errorPdfEmpty",
  },
  {
    test:
      /no decode delegate|no encode delegate|unsupported.*(format|image|codec)|improper image header/i,
    key: "errorUnsupportedCodec",
  },
  {
    test: /unable to open|does not exist|no such file|failed to open|cannot open/i,
    key: "errorFileUnreadable",
  },
  {
    test: /permission denied|access is denied|not permitted|read-only|readonly/i,
    key: "errorPermission",
  },
  {
    test: /no space left|disk (is )?full|not enough space|quota exceeded/i,
    key: "errorDiskFull",
  },
  {
    test: /corrupt|truncated|unexpected end|premature end|invalid.*pdf|damaged/i,
    key: "errorCorruptFile",
  },
  {
    test: /cache resources exhausted|out of memory|memory allocation|insufficient memory/i,
    key: "errorTooLarge",
  },
  {
    test: /ghostscript|gswin64c|gswin32c|pdf.*delegate|delegate.*pdf/i,
    key: "pdfMissingGhostscript",
  },
];

function rawErrorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    if (typeof record.message === "string") return record.message;
    if (typeof record.error === "string") return record.error;
  }
  if (error == null) return "";
  return String(error);
}

/** Split stable code (first line) from optional technical detail. */
export function parseInvokeError(error: unknown): ParsedInvokeError {
  const raw = rawErrorText(error).trim();
  if (!raw) return { code: "convert_failed" };

  const newline = raw.indexOf("\n");
  if (newline === -1) {
    return { code: raw };
  }

  const code = raw.slice(0, newline).trim() || "convert_failed";
  const detail = raw.slice(newline + 1).trim();
  return detail ? { code, detail } : { code };
}

function keyFromDetail(detail: string): MessageKey | undefined {
  for (const pattern of DETAIL_PATTERNS) {
    if (pattern.test.test(detail)) {
      return pattern.key;
    }
  }
  return undefined;
}

/**
 * Map Magick/Ghostscript/common failures to calm, actionable UI strings.
 * Technical text is returned separately for an optional Details disclosure.
 */
export function humanizeError(
  locale: Locale,
  error: unknown,
  fallbackKey: MessageKey,
): HumanizedError {
  const { code, detail } = parseInvokeError(error);
  const known = CODE_KEYS[code];

  let key: MessageKey;
  if (known) {
    // Generic convert_failed uses the caller's context (image / PDF / images→PDF).
    key = code === "convert_failed" ? fallbackKey : known;
  } else {
    key = keyFromDetail(code) ?? fallbackKey;
  }

  // Pattern catalog only for generic failures — keep dedicated codes stable.
  if (detail && (code === "convert_failed" || !known)) {
    const fromDetail = keyFromDetail(detail);
    if (fromDetail) key = fromDetail;
  }

  const technical = detail ?? (!known ? code : undefined);

  return {
    message: t(locale, key),
    details: technical?.trim() ? technical : undefined,
  };
}

/** Render calm message + optional Details; clears previous content. */
export function applyHumanizedError(
  el: HTMLElement,
  locale: Locale,
  humanized: HumanizedError,
): void {
  el.replaceChildren();

  const message = document.createElement("p");
  message.className = "error-message";
  message.textContent = humanized.message;
  el.appendChild(message);

  if (humanized.details) {
    const details = document.createElement("details");
    details.className = "error-details";

    const summary = document.createElement("summary");
    summary.textContent = t(locale, "errorDetails");

    const body = document.createElement("pre");
    body.className = "error-details-body";
    body.textContent = humanized.details;

    details.append(summary, body);
    el.appendChild(details);
  }

  el.hidden = false;
}

export function clearHumanizedError(el: HTMLElement): void {
  el.replaceChildren();
  el.hidden = true;
}
