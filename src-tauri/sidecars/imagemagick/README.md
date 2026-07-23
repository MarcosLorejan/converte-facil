# ImageMagick sidecar (Windows)

Place the portable **ImageMagick** Windows x64 tree here so that `magick.exe` is at:

`src-tauri/sidecars/imagemagick/magick.exe`

Do **not** use or ship a binary named `convert.exe` on Windows.

Fetch automatically:

```powershell
.\scripts\fetch-sidecars.ps1
```

See [docs/sidecars.md](../../../docs/sidecars.md).
