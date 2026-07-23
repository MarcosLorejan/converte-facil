# Roadmap — Converte Fácil

## Vision

An installable Windows app, 100% local, simple enough for non-technical users to convert files without sketchy websites. Product UI supports **English and Portuguese**.

## Phases

| Milestone | Goal | Status |
|-----------|------|--------|
| M1 — Foundation | Repo, stack, empty app window | Done |
| M2 — Images | Image format conversion | Done |
| M3 — PDF | PDF ↔ image | Done |
| M4 — Installer | Windows `.exe` + Magick/Ghostscript | Done |
| M5 — Documents | Word/Excel → PDF via LibreOffice | Done |
| M6 — UX polish | Copy, errors, a11y, i18n | Done |
| [M7 — Ship & compliance](https://github.com/MarcosLorejan/converte-facil/milestone/7) | LICENSE, AGPL notes, first Release, docs sync | In progress |
| [M8 — Hardening & quality](https://github.com/MarcosLorejan/converte-facil/milestone/8) | CSP, path validation, CI/tests, overwrite fixes | Open |
| [M9 — UX & formats](https://github.com/MarcosLorejan/converte-facil/milestone/9) | HEIC, cancel, open folder, drag-drop parity | Open |

## UX principles

1. Few buttons, large text, plain language (EN + PT)
2. Never require a command line
3. Human-readable errors (“Could not open this PDF” / “Não foi possível abrir este PDF”)
4. Files never leave the computer
