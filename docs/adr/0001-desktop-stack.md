# ADR 0001: Desktop application stack

**Status:** Accepted  
**Date:** 2026-07-22  
**Issue:** #1

## Context

Converte Fácil is a Windows-first desktop app for non-technical users. It must:

- Ship a small, double-clickable installer
- Shell out to (and later bundle) ImageMagick and Ghostscript
- Host a simple web UI with English + Portuguese strings
- Keep files entirely on-device

We compared **Tauri 2** and **Electron** as the two realistic options for a web UI + native host.

## Decision

Use **Tauri 2** with:

- **Frontend:** Vite + vanilla TypeScript (no heavy UI framework until needed)
- **Backend:** Rust (Tauri commands for Magick/Ghostscript detection and conversion)
- **Target:** Windows first (WebView2)

## Alternatives considered

### Electron

- Pros: huge ecosystem, all-JS team path, mature auto-update patterns, identical Chromium everywhere
- Cons: large installer (~100MB+ before Magick), higher RAM, heavier for a “simple converter” story

### Tauri 2

- Pros: small core binary (often single-digit to low tens of MB before bundling Magick), low idle RAM, OS WebView2 on Windows, first-class way to ship sidecar binaries, capability-based permissions
- Cons: Rust host (learning curve), UI depends on system WebView (acceptable on modern Windows)

## Consequences

- Issue #2 scaffolds a Tauri 2 + Vite + TypeScript app
- Conversion and binary detection live in Rust commands, not Node `child_process`
- Installer work (M4) will use Tauri bundlers and sidecar resources for Magick/Ghostscript
- If we later need macOS/Linux, Tauri supports them; WebView quirks must be tested per OS

## References

- https://v2.tauri.app/
- https://github.com/ImageMagick/ImageMagick
