# Converte Fácil

A **local, installable** desktop app to convert images and PDFs without uploading files to the internet.

Built so anyone can use it — large UI, clear steps, and language options (English / Portuguese).

## Install guide (end users)

- **English:** [Install Converte Fácil](docs/user-guide-en.md) — download → install → convert your first file  
- **Português:** [Instalar o Converte Fácil](docs/user-guide-pt-BR.md) — baixar → instalar → converter o primeiro arquivo

## What it does (v1)

- Convert images (JPG, PNG, WEBP, GIF, TIFF, BMP, …)
- Convert PDF ↔ image (via Ghostscript)
- Everything runs offline on your machine

## Later (v2)

- Word/Excel → PDF via local LibreOffice

## Tech base

- Desktop UI: **Tauri 2** + Vite + TypeScript (see [ADR 0001](docs/adr/0001-desktop-stack.md))
- Engine: [ImageMagick](https://github.com/ImageMagick/ImageMagick)
- PDF: Ghostscript
- Initial target: Windows installable `.exe`
- UI i18n: English + Portuguese (see [docs/i18n.md](docs/i18n.md))

## Run from source (Windows)

Prerequisites:

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (MSVC toolchain)
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload (provides `link.exe`)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually already on Windows 10/11)
- Optional for conversion without a system install: ImageMagick + Ghostscript sidecars (see below)

```bash
npm install
npm run tauri:dev
```

Production build (creates the Windows NSIS installer under `src-tauri/target/release/bundle/nsis/`):

```bash
npm run tauri:build
```

Installer details (shortcuts, uninstall, languages): [docs/installer.md](docs/installer.md)

### Bundled ImageMagick / Ghostscript (Windows)

The app prefers binaries under `src-tauri/sidecars/` over PATH. To populate them before `tauri:build`:

```powershell
.\scripts\fetch-sidecars.ps1
```

Details, version pins, and license notes: [docs/sidecars.md](docs/sidecars.md) · [third-party/NOTICE](third-party/NOTICE)

**Licenses:** ImageMagick and Ghostscript remain under their own terms. Ghostscript is **AGPL v3**; Windows builds that bundle it must offer corresponding source for the pinned Ghostscript version (documented in NOTICE / sidecars.md). The Converte Fácil app code is separate from those engines.

## Tracking

See [milestones](../../milestones) and [issues](../../issues) for the full plan.

Usability sessions (non-technical users): [docs/usability-test.md](docs/usability-test.md).
