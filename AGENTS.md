# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should read [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md), which this file summarizes.

## What this project is

Converte Fácil is a **local, offline** Windows desktop app that converts images, PDFs, and Office documents. Files never leave the machine.

- **Frontend:** TypeScript + Vite, no framework. Plain DOM modules in `src/`.
- **Backend:** Rust in `src-tauri/`, exposed to the frontend as Tauri 2 commands.
- **Conversion:** shells out to ImageMagick, Ghostscript, and LibreOffice as child processes.

The target audience is explicitly non-technical, so UI changes are held to a high bar: few buttons, large text, plain language, human-readable errors, and never requiring a command line.

## Setup

```bash
npm install
```

No secrets, no `.env`, no database, no external accounts. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for prerequisites (Node 20+, Rust MSVC, VS Build Tools, WebView2).

## Verify your work

Run all three before claiming a change is done:

```bash
npm test                                               # vitest
npm run build                                          # tsc typecheck + vite build
cargo test --manifest-path src-tauri/Cargo.toml --lib   # rust tests
```

- The `--manifest-path` flag is **required**; there is no root `Cargo.toml`, so bare `cargo test` fails from the repo root.
- `npm run build` is currently the only typecheck path. `npx tsc --noEmit` typechecks without producing a bundle.
- There is no linter or formatter yet, so match the style of surrounding code. Tooling is tracked in [#101](https://github.com/MarcosLorejan/converte-facil/issues/101) and [#103](https://github.com/MarcosLorejan/converte-facil/issues/103); update this file when it lands.

## Do not treat these as failures

- **The first `cargo` build takes ~4 minutes** (474 crates, cold `target/`). Allow a 6+ minute timeout. The only progress signal is a `Building [===> ] 373/375` counter.
- **`cargo test --lib` prints `… has been running for over 60 seconds`** for `system_libreoffice_converts_docx_if_installed`. That test drives a real LibreOffice install. It is cargo's standard notice, not a hang.
- **`npm` output renders as a red `NativeCommandError` block in PowerShell**, including a harmless `npm warn Unknown env config "devdir"`. Check the exit code, not the color.

## What you cannot verify without a Windows GUI

`npm run tauri:dev` and `npm run tauri:build` need the Windows MSVC toolchain and a GUI, and real conversions additionally need ImageMagick/Ghostscript/LibreOffice available. **Do not attempt them in a headless environment** — they cannot succeed there, and the failure is environmental rather than something to debug.

`npm run tauri:dev` is also a long-lived process that never exits. Success is a `Running …converte-facil.exe` line plus the dev server answering on `localhost:1420`. Background it; do not await completion.

In a headless environment, `npm test` + `npm run build` + `cargo test … --lib` is your complete verification loop. The capability matrix in [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) spells out what each environment supports.

## Project rules

These are easy to get wrong and are not enforced by any tool:

1. **Invoke ImageMagick as `magick`, never `convert`.** The legacy `convert` name collides with a Windows system binary. See [docs/sidecars.md](docs/sidecars.md).
2. **Never hard-code user-visible strings.** Every UI string goes in **both** `src/i18n/en.json` and `src/i18n/pt-BR.json` with the same key, then is referenced via `data-i18n`. Applies to error messages too. See [docs/i18n.md](docs/i18n.md).
3. **Repo docs, code, issues, and PRs are written in English**, while the app UI must support English and Portuguese. Do not mix languages within a locale file.
4. **All conversion work happens in Rust**, not the frontend. The frontend orchestrates and renders; `src-tauri/src/engine.rs` owns process spawning, path validation, and timeouts.
5. **Do not commit sidecar binaries.** `.exe`, `.dll`, and large runtime trees under `src-tauri/sidecars/` are gitignored; license and NOTICE files are committed.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | App entry; wires up the UI |
| `src/convert.ts` | Conversion orchestration from the UI side |
| `src/images.ts`, `src/pdfToImages.ts`, `src/imagesToPdf.ts`, `src/documentsToPdf.ts` | Per-mode flows |
| `src/formats.ts`, `src/formatPicker.ts` | Which conversions are offered for a given input |
| `src/outputPaths.ts`, `src/pathHelpers.ts` | Output naming and collision handling |
| `src/errors.ts` | Maps backend errors to human-readable messages |
| `src/i18n/` | Locale files and lookup |
| `src-tauri/src/lib.rs` | **The entire IPC surface** — nine `#[tauri::command]` functions |
| `src-tauri/src/engine.rs` | Conversion logic and child-process handling |

`lib.rs` is a thin delegation layer over `engine.rs`; to add a backend capability you add a command in `lib.rs` and the implementation in `engine.rs`. A fuller architecture doc is tracked in [#105](https://github.com/MarcosLorejan/converte-facil/issues/105).

## Contributing conventions

- **Conventional Commits**, e.g. `fix(engine): harden LibreOffice convert and add regression tests`. Lowercase, imperative, no trailing period.
- **One issue per PR.** Branch from `main` as `feat/45-slug`, `fix/123-slug`, or `docs/127-slug`, and reference the issue (`Fixes #N`).
- Issues carry a type, priority, and status label. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

Full details: [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
