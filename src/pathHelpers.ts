import { fileNameFromPath } from "./images";

/** File stem (name without final extension) from a full path. */
export function stemFromPath(path: string): string {
  const name = fileNameFromPath(path);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/** Join a directory and file name using the separator style of `dir`. */
export function joinPath(dir: string, name: string): string {
  const endsWithSep = dir.endsWith("/") || dir.endsWith("\\");
  if (endsWithSep) return `${dir}${name}`;
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir}${sep}${name}`;
}
