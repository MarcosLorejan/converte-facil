# Ghostscript sidecar (Windows)

Place Ghostscript Windows x64 files here so that `gswin64c.exe` is at:

`src-tauri/sidecars/ghostscript/gswin64c.exe`

Include `gsdll64.dll` and any Resource/lib folders required by that build.

Fetch automatically:

```powershell
.\scripts\fetch-sidecars.ps1
```

Ghostscript is AGPL-licensed — see `third-party/NOTICE`.

See [docs/sidecars.md](../../../docs/sidecars.md).
