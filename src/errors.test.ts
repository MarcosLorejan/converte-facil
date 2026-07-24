import { describe, expect, it } from "vitest";
import { humanizeError, parseInvokeError } from "./errors";

describe("parseInvokeError", () => {
  it("treats a single-line string as the code", () => {
    expect(parseInvokeError("missing_libreoffice")).toEqual({
      code: "missing_libreoffice",
    });
  });

  it("splits code and technical detail on the first newline", () => {
    expect(parseInvokeError("convert_failed\nno decode delegate")).toEqual({
      code: "convert_failed",
      detail: "no decode delegate",
    });
  });

  it("defaults empty input to convert_failed", () => {
    expect(parseInvokeError("")).toEqual({ code: "convert_failed" });
    expect(parseInvokeError(null)).toEqual({ code: "convert_failed" });
  });

  it("reads Error.message", () => {
    expect(parseInvokeError(new Error("spawn_failed"))).toEqual({
      code: "spawn_failed",
    });
  });
});

describe("humanizeError", () => {
  it("maps known codes to dedicated copy", () => {
    const result = humanizeError("en", "missing_libreoffice", "docsConvertFailed");
    expect(result.message).toContain("LibreOffice");
    expect(result.details).toBeUndefined();
  });

  it("maps convert_timeout to calm docs copy", () => {
    const en = humanizeError("en", "convert_timeout", "docsConvertFailed");
    expect(en.message).toMatch(/too long/i);
    const pt = humanizeError("pt-BR", "convert_timeout", "docsConvertFailed");
    expect(pt.message).toMatch(/demorou/i);
  });

  it("maps convert_cancelled", () => {
    const en = humanizeError("en", "convert_cancelled", "convertFailed");
    expect(en.message.toLowerCase()).toMatch(/cancel/);
  });

  it("uses the caller fallback for generic convert_failed", () => {
    const result = humanizeError("en", "convert_failed", "docsConvertFailed");
    expect(result.message).toMatch(/could not convert this document/i);
  });

  it("keeps technical detail for Details disclosure", () => {
    const result = humanizeError(
      "en",
      "convert_failed\nno decode delegate for HEIC",
      "convertFailed",
    );
    expect(result.details).toContain("no decode delegate");
    expect(result.message.toLowerCase()).toMatch(/heic|codec|format/);
  });
});
