# ADR 0002: LibreOffice strategy on Windows (bundle vs system)

**Status:** Accepted  
**Date:** 2026-07-22  
**Issue:** #16

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

For **Converte Fácil v2 (M5)**:

1. **Do not embed LibreOffice in the default Windows installer** (reject option A as the default shipping model).
2. **Prefer option B for the first v2 ship:** detect a system LibreOffice install; if absent, show a dedicated guided install UX (EN/PT) pointing at the official TDF Windows download; block document conversion with a clear message until `soffice` is found.
3. **Treat option C as a follow-up** if real-user friction from the guided install is high: optional on-demand download of a pinned LibreOffice into app-local storage, reusing the same detection order (bundled/app-local → system → prompt).

Resolution order when implementing:

1. App-local / previously downloaded engine (only if C is implemented later)
2. Well-known Windows install paths (`Program Files\LibreOffice*\program\soffice.exe`) and PATH
3. Guided prompt — never silent failure

## Consequences

- Document conversion in v2 depends on LibreOffice being present on the machine (system or, later, app-local).
- Installer size and Magick/GS sidecar story stay intact.
- Engineering work for M5 centers on detection, headless invocation, profile isolation, and i18n copy — not on packaging a 355 MB MSI inside NSIS.
- `third-party/NOTICE` grows only when we distribute or cache LibreOffice binaries ourselves (A or C); for B we still document the dependency in product docs.
- Auto-update remains feasible for the core app without multi-hundred-MB LibreOffice payloads on every release.
- If we later adopt C, pin versions in a fetch script (analogue to `scripts/fetch-sidecars.ps1`), verify hashes, and document disk/network expectations in the user guide.

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
