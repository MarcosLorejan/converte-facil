# Bundled conversion engines (ImageMagick + Ghostscript)

Converte Fácil shells out to **ImageMagick** (`magick` on Windows — never `convert`) and **Ghostscript** for PDF. On a clean PC these are not on PATH, so the Windows build ships them as **resources** under `src-tauri/sidecars/`.

## Layout

```
src-tauri/sidecars/
  imagemagick/     # magick.exe + ImageMagick DLLs / config (Windows)
  ghostscript/     # gswin64c.exe + Ghostscript DLLs / resources (Windows)
third-party/       # NOTICE + license texts shipped with the app
```

Binary blobs (`.exe`, `.dll`, large runtime trees) are **gitignored**. License/NOTICE files and this documentation are committed.

## Fetch binaries (local / CI)

From the repo root on Windows (PowerShell):

```powershell
.\scripts\fetch-sidecars.ps1
```

This downloads pinned portable Windows x64 packages into `src-tauri/sidecars/` (see versions in the script header). Then:

```bash
npm run tauri:build
```

If the folders already contain `magick.exe` / `gswin64c.exe`, the fetch script skips that tool unless you pass `-Force`.

**Without** running the fetch script, `tauri build` still succeeds (license stubs remain in the sidecar folders), but conversion will only work if Magick/Ghostscript are on PATH.

## Runtime resolution order

1. Bundled binaries under the Tauri resource directory / next to the app exe (`sidecars/imagemagick`, `sidecars/ghostscript`)
2. PATH (`magick`, then `gswin64c` / `gswin32c` / `gs`)

When a bundled Magick is used, its directory (and the bundled Ghostscript directory) are prepended to the child process `PATH` so DLLs and PDF delegates resolve.

## Updating ImageMagick / Ghostscript versions

1. Edit the version constants at the top of [`scripts/fetch-sidecars.ps1`](../scripts/fetch-sidecars.ps1) (`ImageMagickVersion`, `GhostscriptVersion` / `GhostscriptTag`, and download URLs).
2. Confirm the official download still matches:
   - ImageMagick: GitHub Releases portable **Q16-HDRI x64** `.7z` (not the legacy `convert` name)
   - Ghostscript: Artifex Windows x64 installer (`gsNNNNw64.exe`)
3. Download once (or run the script until the hash check fails), then pin the archive digests:
   ```powershell
   Get-FileHash $env:TEMP\converte-facil-sidecars\imagemagick.7z -Algorithm SHA256
   Get-FileHash $env:TEMP\converte-facil-sidecars\ghostscript-setup.exe -Algorithm SHA256
   ```
   Update `$ImageMagickSha256` and `$GhostscriptSha256` in the script to those values.
4. Run `.\scripts\fetch-sidecars.ps1 -Force` (needs network). Magick uses `7zr.exe`; Ghostscript’s NSIS installer is unpacked with full `7z.exe` obtained via `msiexec /a` of the 7-Zip MSI (no UAC install of Ghostscript itself). A SHA256 mismatch aborts before unpack.
5. Spot-check: `.\src-tauri\sidecars\imagemagick\magick.exe -version` and `.\src-tauri\sidecars\ghostscript\gswin64c.exe -version`.
6. Refresh license copies under `third-party/` if the upstream license text changed.
7. Commit script/version/docs/license changes (not the binary trees unless you intentionally vendor them).
8. Run `npm run tauri:build` with sidecars present and smoke-convert an image and a PDF.

**CI note:** cache `src-tauri/sidecars/**` after `npm run sidecars:fetch`, or restore pre-fetched artifacts. Do not commit the large `.exe`/`.dll` trees by default.

## Attribution and redistribution

See [`third-party/NOTICE`](../third-party/NOTICE) for pinned versions, license
files, and Ghostscript **AGPL** redistribution notes.

- **ImageMagick** — license text in `third-party/IMAGEMAGICK-LICENSE.txt`
- **Ghostscript** — AGPL v3 (`third-party/GHOSTSCRIPT-LICENSE.txt`). Windows
  builds that include `sidecars/ghostscript/` distribute Ghostscript binaries.
  Corresponding source for the pinned version (**10.05.1** / `gs10051`) is
  available from Artifex:
  https://github.com/ArtifexSoftware/ghostpdl-downloads/releases/tag/gs10051
- The app invokes Magick/GS as separate processes; it does not vendor their
  source trees inside the UI crate. Keep NOTICE + license texts with every
  build that ships those sidecars.

End-user install guides should mention that PDF support uses Ghostscript under
the AGPL and point readers here or at `third-party/NOTICE`.
