import { invoke } from "@tauri-apps/api/core";
import { convertedStem, joinPath, parentDir, stemFromPath } from "./pathHelpers";

export type UniquePathResult = {
  path: string;
  fileName: string;
  renamed: boolean;
};

/**
 * Pick a free file name in `dir`: `stem.ext`, then `stem-2.ext`, …
 * `used` tracks names already claimed in this batch (same dir).
 */
export async function uniqueFileInDir(
  dir: string,
  stem: string,
  ext: string,
  used: Set<string> = new Set(),
): Promise<UniquePathResult> {
  let candidate = `${stem}.${ext}`;
  let index = 2;
  let renamed = false;
  while (true) {
    const lower = candidate.toLowerCase();
    if (!used.has(lower)) {
      const fullPath = joinPath(dir, candidate);
      const exists = await invoke<boolean>("path_exists", { path: fullPath });
      if (!exists) {
        used.add(lower);
        return { path: fullPath, fileName: candidate, renamed };
      }
    }
    renamed = true;
    candidate = `${stem}-${index}.${ext}`;
    index += 1;
  }
}

/** Save beside the source: `report.docx` → `report-converted.pdf`. */
export async function uniqueConvertedSibling(
  sourcePath: string,
  ext: string,
  used: Set<string> = new Set(),
): Promise<UniquePathResult> {
  const dir = parentDir(sourcePath);
  const stem = convertedStem(stemFromPath(sourcePath));
  return uniqueFileInDir(dir, stem, ext, used);
}
