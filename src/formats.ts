export const OUTPUT_FORMATS = [
  { id: "jpg", extension: "jpg", labelKey: "formatJpg" },
  { id: "png", extension: "png", labelKey: "formatPng" },
  { id: "webp", extension: "webp", labelKey: "formatWebp" },
  { id: "gif", extension: "gif", labelKey: "formatGif" },
  { id: "tiff", extension: "tiff", labelKey: "formatTiff" },
  { id: "bmp", extension: "bmp", labelKey: "formatBmp" },
] as const;

export type OutputFormatId = (typeof OUTPUT_FORMATS)[number]["id"];

export function isOutputFormatId(value: string): value is OutputFormatId {
  return OUTPUT_FORMATS.some((format) => format.id === value);
}

export function extensionForFormat(id: OutputFormatId): string {
  const match = OUTPUT_FORMATS.find((format) => format.id === id);
  return match?.extension ?? id;
}
