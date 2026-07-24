# ADR 0002: LibreOffice strategy on Windows (bundle vs system)

**Status:** Accepted (amended 2026-07-24 — prefer winget on-demand install)  
**Date:** 2026-07-22  
**Issue:** #16 / #85

## Context

Milestone **M5 / Converte Fácil v2** adds Word/Excel (and related Office formats) → PDF. The only practical local engine for that on Windows without Microsoft Office is **LibreOffice** (`soffice.exe --headless --convert-to pdf`).

v1 already ships **ImageMagick** and **Ghostscript** as Tauri sidecars so a clean PC can convert images/PDFs without a separate install (see [docs/sidecars.md](../sidecars.md) and [ADR 0001](0001-desktop-stack.md)). We need to decide whether LibreOffice follows that same bundling model or stays an external dependency.

This spike compares approaches for **Windows first**, focusing on installer size, license, end-user UX, and how updates work.

## Options

### A — Bundle LibreOffice inside the Converte Fácil installer

Ship a full (or portable) LibreOffice tree next to the app, similar to Magick/Ghostscript sidecars, and always call the bundled `soffice`.

### B — Require / detect a system LibreOffice install

Ship the app without LibreOffice. At runtime, locate `soffice` (common `Program Files` paths + PATH). If missing, show a clear in-app guide (download link, optional `winget` hint for advanced users) and re-check after install.

### C — Hybrid: small installer + on-demand download

Ship without LibreOffice. On first document conversion (or via an optional setup step), download a **pinned** LibreOffice package into app-local storage (e.g. under `%LOCALAPPDATA%`), then use that binary. System install remains an accepted alternative if already present.

## Findings

### Size

| Artifact | Approximate size (Windows x86-64, 2026) |
| --- | --- |
| LibreOffice MSI download (e.g. 26.2.x) | ~**355 MB** |
| Installed disk footprint | up to ~**1.5 GB** (Document Foundation system requirements) |
| Converte Fácil core + Magick/GS sidecars | tens of MB (order of magnitude smaller) |

Bundling LibreOffice in the default NSIS package would dominate download and install size by an order of magnitude and undermine the “small double-clickable installer” goal from ADR 0001. On-demand download (option C) keeps the *initial* installer small but still requires ~0.3–1.5 GB when document conversion is enabled.

There is no official tiny “convert-only” LibreOffice build from TDF; headless conversion still needs the Writer/Calc filters and supporting runtime.

### License

LibreOffice is Free Software, primarily under the **Mozilla Public License 2.0** (dual-licensing with LGPLv3+ for contributions; installs also include other OSS components — see the in-product license dialog / `LICENSE` files).

**Redistribution is allowed** if we comply with MPL (and other component licenses): ship notices, preserve copyright, and provide access to corresponding source for MPL-covered files as required. Bundling or on-demand caching is legally workable for a proprietary or separately licensed host app, but we must extend `third-party/NOTICE` (and any installer license UI) the same way we do for ImageMagick and Ghostscript.

License alone does **not** decide bundling; size and UX do.

### UX (non-technical users)

Product rules: few buttons, no command line, human-readable errors, English + Portuguese.

| Approach | UX impact |
| --- | --- |
| **A — Bundle** | Best “it just works” after install; matches Magick/GS mental model. Cost: huge download, longer install, more disk, harder to explain “why is this converter 400 MB?” |
| **B — System install** | First document convert may fail until LibreOffice is installed (needs **admin** for the MSI). Mitigated with detection, a single guided screen (“Install LibreOffice to convert Word/Excel”), deep link to the official download, and a “Check again” button. Users who already have LibreOffice get zero extra friction. |
| **C — On-demand** | First use needs network, progress UI, and ~GB free disk; then subsequent converts work offline. More product/engineering work than B, less painful than A for users who never touch documents. |

Headless conversion details (all options):

- Invoke `soffice.exe --headless --nologo --nofirststartwizard --convert-to pdf --outdir …`
- Use a unique `-env:UserInstallation=…` profile per run (or per process) to avoid profile locks
- Prefer detecting existing installs before downloading anything (C)

### Update story

| Approach | Who updates LibreOffice? | Notes |
| --- | --- | --- |
| **A — Bundle** | Converte Fácil releases | Every LO security/fix release may force a full app rebuild and a very large auto-update. Pinning versions is clear; lagging on CVEs is costly. |
| **B — System** | User / OS package habits | Users (or IT) update via TDF installer / `winget`. App should detect `soffice`, optionally warn if missing or too old, but does not own the LO update cadence. |
| **C — On-demand** | App-managed pin + re-fetch | We control the pinned version (good for reproducibility) and can offer “Update conversion engine” without shipping LO in every NSIS build. Still need bandwidth, integrity checks (hash), and NOTICE refresh when the pin changes. |

Security: LibreOffice regularly publishes advisories. Owning the binary (A/C) means owning the patch cadence; depending on the system (B) means clearer separation but uneven user versions.

## Decision

**Amended 2026-07-24** (usability follow-up [#85](https://github.com/MarcosLorejan/converte-facil/issues/85)):

1. **Still do not embed LibreOffice in the default Windows installer** (reject option A as the default shipping model — size vs ADR 0001).
2. **Prefer option C for Documents UX:** one-click install via **Windows Package Manager (`winget`)** when LibreOffice is missing (`TheDocumentFoundation.LibreOffice`), with progress + cancel in the Documents guide.
3. **Keep option B as fallback:** official download page + “Check again” when winget is unavailable or install fails.
4. Detection order: app-local cache under `%LOCALAPPDATA%\converte-facil\LibreOffice\` (reserved for a future extract pin) → well-known Program Files / PATH → guided install UX.

Original M5 ship used B-only; real-user friction justified promoting C without bloating the NSIS package.

## Consequences

- Document conversion works after a guided in-app install for typical Windows 10/11 PCs with winget.
- Installer size and Magick/GS sidecar story stay intact (LO still not inside NSIS).
- Winget install may show a Windows UAC / package consent UI — expected, not a console flash.
- We do **not** redistribute LibreOffice binaries ourselves when using winget; NOTICE documents the dependency and install path.
- A future pin + extract into `%LOCALAPPDATA%` remains compatible with the detection order above.

## Alternatives considered (summary)

- **Always bundle (A):** Rejected as default — installer and update size conflict with ADR 0001 and the Magick/GS scale.
- **Microsoft Office / Word COM automation:** Not pursued — requires paid Office, different license and reliability story, worse for a privacy-local free converter.
- **Cloud conversion APIs:** Out of scope — product is on-device only.
- **Collabora / other LO forks:** Possible engine later; same size class and similar licensing analysis; no advantage for this spike’s shipping decision.

## References

- https://www.libreoffice.org/download/download-libreoffice/
- https://www.libreoffice.org/licenses/
- https://www.libreoffice.org/system-requirements/
- https://download.documentfoundation.org/libreoffice/stable/ (Windows x86-64 MSI ~355 MB for recent 26.2.x builds)
- Headless convert: `soffice --headless --convert-to pdf`
- Related: [ADR 0001 — Desktop stack](0001-desktop-stack.md), [docs/sidecars.md](../sidecars.md)
