# Converte Fácil

A **local, installable** desktop app to convert images and PDFs without uploading files to the internet.

Built so anyone can use it — large UI, clear steps, and language options (English / Portuguese).

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
- UI i18n: English + Portuguese

## Run from source (Windows)

Prerequisites:

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) (MSVC toolchain)
- [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the **Desktop development with C++** workload (provides `link.exe`)
- [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) (usually already on Windows 10/11)

```bash
npm install
npm run tauri:dev
```

Production build:

```bash
npm run tauri:build
```

## Tracking

See [milestones](../../milestones) and [issues](../../issues) for the full plan.
