import { fileNameFromPath } from "./images";

/** File stem (name without final extension) from a full path. */
export function stemFromPath(path: string): string {
  const name = fileNameFromPath(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Parent directory of a file path (keeps the original separator style). */
export function parentDir(path: string): string {
  const slash = path.lastIndexOf("/");
  const back = path.lastIndexOf("\\");
  const idx = Math.max(slash, back);
  if (idx <= 0) {
    return ".";
  }
  // Keep drive root like `C:\` intact.
  if (idx === 2 && path[1] === ":") {
    return path.slice(0, 3);
  }
  return path.slice(0, idx);
}

/** Join a directory and file name using the separator style of `dir`. */
export function joinPath(dir: string, name: string): string {
  const endsWithSep = dir.endsWith("/") || dir.endsWith("\\");
  if (endsWithSep) return `${dir}${name}`;
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir}${sep}${name}`;
}

/** Default output stem: `photo` → `photo-converted`. */
export function convertedStem(stem: string): string {
  return `${stem}-converted`;
}
