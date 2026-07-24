# Development

Canonical reference for working on Converte Fácil: setup, the validation loop, and the issue/PR conventions.

Repo docs, code, issues, and PRs are written in **English**. The **app UI** must support English and Portuguese — see [docs/i18n.md](i18n.md).

## Prerequisites

| Requirement | Why it is needed |
| --- | --- |
| [Node.js](https://nodejs.org/) 20+ | Frontend build, tests, and the Tauri CLI. CI pins Node 20. |
| [Rust](https://rustup.rs/) (MSVC toolchain) | Builds the `src-tauri` crate. |
| [Visual Studio Build Tools 2022](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with **Desktop development with C++** | Provides `link.exe`. Without it the Rust build fails at the link step. |
| [WebView2](https://developer.microsoft.com/microsoft-edge/webview2/) | Renders the UI. Already present on most Windows 10/11 installs. |

Optional, and only needed to perform real conversions:

- **ImageMagick + Ghostscript** — either on `PATH` or fetched into `src-tauri/sidecars/` (see [docs/sidecars.md](sidecars.md))
- **LibreOffice** — a system install, for Word/Excel → PDF (see [ADR 0002](adr/0002-libreoffice-strategy.md))

## First-time setup

```bash
npm install
```

That is the whole bootstrap. There are no secrets, no `.env` file, no database, and no external accounts in the startup path.

Optionally populate the conversion engines (Windows, needs network):

```powershell
npm run sidecars:fetch
```

## Validation loop

Run these before opening a PR. They are the same checks CI runs, ordered fastest first.

```bash
npm test                                              # vitest, 18 tests
npm run build                                         # tsc typecheck + vite production build
cargo test --manifest-path src-tauri/Cargo.toml --lib  # 17 tests
```

Notes on each:

- `npm run build` is currently the only way to typecheck. It runs `tsc && vite build`, so it also produces a `dist/` bundle you do not need. A dedicated `npm run typecheck` script is tracked in [#102](https://github.com/MarcosLorejan/converte-facil/issues/102). Until then, `npx tsc --noEmit` typechecks without bundling.
- `tsconfig.json` sets `strict`, `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`, so the typecheck gives real signal rather than just confirming a bundle.
- The `--manifest-path` flag is required. There is no root `Cargo.toml` workspace, so a bare `cargo test` from the repo root fails.
- There is no linter or formatter yet. ESLint + Prettier are tracked in [#101](https://github.com/MarcosLorejan/converte-facil/issues/101), and `cargo fmt` + `clippy` in [#103](https://github.com/MarcosLorejan/converte-facil/issues/103).

Scope a single frontend test file while iterating:

```bash
npx vitest run src/errors.test.ts
npx vitest                              # watch mode
```

## Expected durations

Several of these are slow enough to look like a hang. They are not. Times are from a warm dev machine; your first run will be slower.

| Command | Cold | Warm |
| --- | --- | --- |
| `npm install` | ~30s | — |
| `npm test` | ~10s | ~3s |
| `npm run build` | ~10s | ~8s |
| `npx tsc --noEmit` | — | ~7s |
| `cargo test … --lib` | **~4 min** | ~40s |
| `npm run tauri:dev` (first build) | **~4 min** | ~20s |

Things that look broken but are not:

- **The first Rust build takes about four minutes.** `Cargo.lock` has 474 packages and `target/` starts empty, so the whole Tauri dependency tree compiles. The only progress signal is a `Building [===> ] 373/375` counter. CI's Rust job ranges from ~1m20s with a warm `rust-cache` to ~3m50s on a cold one. Do not interrupt it; allow at least a 6 minute timeout.
- **`cargo test --lib` prints `test system_libreoffice_converts_docx_if_installed has been running for over 60 seconds`.** That test shells out to a real installed LibreOffice, so its runtime depends on your machine. The message is cargo's standard long-running-test notice, not a failure.
- **`npm` output appears as a red `NativeCommandError` block in PowerShell.** PowerShell renders npm's stderr that way, including the harmless `npm warn Unknown env config "devdir"`. Check the exit code, not the color.
- **`npm run tauri:dev` never exits.** It is a long-lived GUI process. Success looks like a `Running …converte-facil.exe` line plus the Vite dev server answering on `http://localhost:1420`. Background it rather than waiting for it to finish.

## What can be verified where

Not every task is runnable in every environment. This matters most in headless or non-Windows environments, where the GUI paths simply cannot work.

| Task | Bare clone | Needs engines | Needs Windows + GUI |
| --- | --- | --- | --- |
| `npm install` | yes | — | — |
| `npm test` | yes | — | — |
| `npm run build` / `npx tsc --noEmit` | yes | — | — |
| `cargo test … --lib` | yes (Windows) | LibreOffice tests return early if absent | — |
| `npm run tauri:dev` | — | — | yes |
| `npm run tauri:build` | — | for working conversions | yes |
| Real image / PDF / document conversion | — | yes | yes |

The full Rust build needs the Windows MSVC toolchain, which is why the CI `rust` job pins `windows-latest` while the `frontend` job runs on `ubuntu-latest`.

**If you cannot run a GUI**, treat `npm test` + `npm run build` + `cargo test … --lib` as your complete self-verification loop and do not attempt `tauri:dev` or `tauri:build`.

Conversion silently degrades to `PATH` lookup when `src-tauri/sidecars/` was never populated, and nothing in the dev startup output reveals which state you are in. The app resolves engines in this order (see [docs/sidecars.md](sidecars.md)):

1. Bundled binaries under the Tauri resource dir / next to the exe
2. `PATH` (`magick`, then `gswin64c` / `gswin32c` / `gs`)

The `get_engine_status` Tauri command reports what was found, without converting anything.

## Running the app

```bash
npm run tauri:dev
```

## Building the installer

```bash
npm run tauri:build
```

This produces the Windows NSIS installer under `src-tauri/target/release/bundle/nsis/`. That path moves if `CARGO_TARGET_DIR` is set in your environment — check the build output for the real location. Shortcuts, uninstall behavior, and installer languages are documented in [docs/installer.md](installer.md).

Populate the sidecars **before** building if you want conversions to work on a clean PC.

## Conventions

### Commits

[Conventional Commits](https://www.conventionalcommits.org/), matching the existing history:

```
<type>(<optional scope>): <short description>
```

`type` is one of `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`. The description is imperative, lowercase, and has no trailing period — for example `fix(engine): harden LibreOffice convert and add regression tests`.

### Branches and PRs

One issue per PR. Branch from `main`:

```
feat/45-short-description
fix/123-short-description
docs/127-short-description
```

Reference the issue in the PR body (`Fixes #N`).

### Issue labels

Every issue should carry a **type**, a **priority**, and a **status** label. Areas are added as applicable.

| Dimension | Labels |
| --- | --- |
| Type | `type:feat` · `type:fix` · `type:docs` · `type:chore` |
| Priority | `priority:high` · `priority:medium` · `priority:low` |
| Status | `status:todo` · `status:in-progress` · `status:review-needed` |
| Area | `area:ui` · `area:imagemagick` · `area:pdf` · `area:installer` · `area:i18n` · `area:docs` · `area:security` · `area:ci` · `area:testing` |
| Other | `good-first-issue` |

New issues start at `status:todo`. Issue titles use the same conventional-commit format as commits.

## Where things live

| Path | Contents |
| --- | --- |
| `src/` | Frontend TypeScript modules |
| `src/i18n/` | `en.json` and `pt-BR.json` locale files |
| `src-tauri/src/lib.rs` | Tauri command definitions (the entire IPC surface) |
| `src-tauri/src/engine.rs` | Conversion logic; spawns `magick`, `gswin64c`, `soffice` |
| `src-tauri/sidecars/` | Bundled engines (binaries are gitignored) |
| `scripts/` | PowerShell helpers (sidecar fetch, LibreOffice setup) |
| `docs/adr/` | Architecture decision records |

A module-by-module map and the full IPC contract are tracked in [#105](https://github.com/MarcosLorejan/converte-facil/issues/105).
