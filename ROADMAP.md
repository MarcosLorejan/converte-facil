# Roadmap — Converte Fácil

## Vision

An installable Windows app, 100% local, simple enough for non-technical users to convert files without sketchy websites. Product UI supports **English and Portuguese**.

## Phases

| Milestone | Goal | Done when |
|-----------|------|-----------|
| M1 — Foundation | Repo, stack, empty app window | App opens with welcome screen |
| M2 — Images | Image format conversion | Drag photo → pick format → save result |
| M3 — PDF | PDF ↔ image | PDF → PNG/JPG; images → PDF |
| M4 — Installer | Windows `.exe` + Magick/Ghostscript | Clean PC install converts without a terminal |
| M5 — Documents | Word/etc. via LibreOffice | `.docx` → PDF in one click |
| M6 — UX polish | Copy, errors, a11y, i18n | Non-technical user succeeds without help |

## UX principles

1. Few buttons, large text, plain language (EN + PT)
2. Never require a command line
3. Human-readable errors (“Could not open this PDF” / “Não foi possível abrir este PDF”)
4. Files never leave the computer
