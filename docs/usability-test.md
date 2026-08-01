# Usability test — non-technical user (issue #19)

**Goal:** Watch someone convert files with **zero coaching**. File follow-up issues for anything that blocks them.

**Participant:** Prefer someone like a parent / relative who does not use terminals or developer tools.

**Setup (tester prepares beforehand — not the participant)**

1. Install Converte Fácil from the Windows setup (`.exe`).
2. Optional: install LibreOffice if testing Documents.
3. Generate the sample files (repo root, PowerShell):

   ```powershell
   npm run usability:samples
   ```

   This writes a `converte-facil-teste` folder to your Desktop containing:

   | File | Used by |
   |------|---------|
   | `foto-1.jpg`, `foto-2.png` | Task A, Task C |
   | `documento-3-paginas.pdf` | Task B |
   | `carta-teste.docx` | Task D |
   | `planilha-teste.xlsx` | Task D (Excel variant) |

   Re-running rewrites those five input files in place and leaves everything else
   in the folder alone, so it is safe to run before each session and every session
   starts from identical inputs — keep it that way so notes stay comparable.

   During a session the participant will save conversion **outputs** into this same
   folder. Those are session evidence: do not clear the folder between sessions
   without copying them out first. Pass `-OutDir` to write somewhere else:

   ```powershell
   .\scripts\make-usability-samples.ps1 -OutDir "D:\sessao-03"
   ```

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
