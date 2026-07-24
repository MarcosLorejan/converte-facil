# Windows installer (NSIS)

Converte Fácil ships a double-clickable **NSIS** setup executable via the Tauri 2 bundler.

## Build the installer

Prerequisites (Windows):

- Same as [README](../README.md) (Node, Rust MSVC, WebView2)
- Sidecar binaries present (recommended for a usable install):

```powershell
npm run sidecars:fetch
```

Then:

```powershell
npm run tauri:build
```

Output (x64), under the Cargo target directory (often `src-tauri/target/...`; some environments redirect `CARGO_TARGET_DIR`):

```
…/release/bundle/nsis/Converte Facil_0.1.0_x64-setup.exe
```

After `npm run tauri:build`, the CLI prints the final path as `Finished 1 bundle at: …`.

## What the installer does

| Behavior | Notes |
|----------|--------|
| Desktop shortcut | Created by the NSIS installer (also with silent `/S`) |
| Start Menu | Shortcut under **Converte Facil** |
| Uninstall | `uninstall.exe` removes app files, Start Menu entry, and desktop shortcut; also listed in Apps & Features |
| Languages | English + Portuguese (Brazil); language selector enabled |
| Install scope | Current user by default (no admin required for the app itself) |
| LibreOffice | After app files are copied, NSIS runs `install-libreoffice-setup.ps1` (see [ADR 0002](adr/0002-libreoffice-strategy.md)): optional ~350 MB MSI download + silent install. LibreOffice is **not** removed when uninstalling Converte Fácil. |

Bundled ImageMagick / Ghostscript (when present under `src-tauri/sidecars/`) are copied as app resources so conversion works without a system Magick/GS install. See [sidecars.md](sidecars.md).

### LibreOffice pin (setup helper)

Pinned in [`scripts/install-libreoffice-setup.ps1`](../scripts/install-libreoffice-setup.ps1):

- Version / MSI URL from Document Foundation `stable/` (currently **26.2.4** x86_64)
- SHA256 must match the winget package digest when bumping
- Hook: `src-tauri/windows/hooks.nsh` → `NSIS_HOOK_POSTINSTALL`

## Smoke test (this machine)

1. Build as above and confirm the `-setup.exe` exists.
2. Run the setup UI (or silent: `.\*-setup.exe /S`).
3. Confirm Start Menu entry and optional desktop shortcut.
4. Open the app → engines panel should show ImageMagick/Ghostscript Ready when sidecars were bundled.
5. Uninstall from Windows Settings → Apps and confirm shortcuts are gone.

A second clean PC / VM is ideal for final acceptance; local install + uninstall is the minimum smoke covered in development.
