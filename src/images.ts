const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "gif",
  "tif",
  "tiff",
  "bmp",
]);

export type SelectedImage = {
  path: string;
  name: string;
};

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function extensionOf(path: string): string {
  const name = fileNameFromPath(path);
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

export function isSupportedImagePath(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionOf(path));
}
