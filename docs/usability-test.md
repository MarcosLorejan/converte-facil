# Usability test — non-technical user (issue #19)

**Goal:** Watch someone convert files with **zero coaching**. File follow-up issues for anything that blocks them.

**Participant:** Prefer someone like a parent / relative who does not use terminals or developer tools.

**Setup (tester prepares beforehand — not the participant)**

1. Install Converte Fácil from the Windows setup (`.exe`).
2. Optional: install LibreOffice if testing Documents.
3. Prepare sample files on the Desktop:
   - One `.jpg` or `.png` photo
   - One small `.pdf` (2–3 pages)
   - One `.docx` (if Documents is in scope)
4. Do **not** explain how the app works.

## Script (read aloud only the quoted lines)

### Intro

> “This app converts files on your computer. Nothing goes to the internet. I’ll watch quietly — please think out loud if you want, but I won’t help unless you get completely stuck for more than two minutes.”

Start a timer. Note OS language and whether they pick **English** or **Português**.

### Task A — Image

> “Take this photo and turn it into a PNG. Save it somewhere you can find later.”

**Observe:** find Images mode, add file, pick format, convert/save, confirm success.

### Task B — PDF → images

> “Open this PDF and turn each page into a picture. Put the pictures in a folder on the Desktop.”

**Observe:** switch to PDF, choose file, format, output folder, understand multi-page result.

### Task C — Photos → PDF (optional)

> “Make one PDF from these two photos. Put the second photo first.”

**Observe:** page order Up/Down, save PDF.

### Task D — Word → PDF (optional, needs LibreOffice)

> “Turn this Word file into a PDF.”

**Observe:** Documents mode, LibreOffice install guide if missing, convert success.

### Closing

> “Was anything confusing? What would you change?”

## Notes template

| Task | Done without help? | Friction / quotes | Follow-up issue |
|------|--------------------|-------------------|-----------------|
| A Images | | | |
| B PDF→images | | | |
| C Images→PDF | | | |
| D Documents | | | |

**Blockers to file as issues:** anything that required you to intervene, wrong clicks, unread errors, missing Portuguese, etc.

## Done when

- [ ] Script run once with a non-technical participant
- [ ] Notes filled
- [ ] Follow-up issues opened for every blocker
