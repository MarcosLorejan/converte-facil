# Install Converte Fácil (Windows)

Short guide for everyday use: download → install → convert your first file. No developer steps.

**Português:** [Guia de instalação](user-guide-pt-BR.md)

## 1. Download

1. Open the [Releases](https://github.com/MarcosLorejan/converte-facil/releases) page (or the download link you were given).
2. Get the Windows installer: a file named like **`Converte Facil_…_x64-setup.exe`**.
3. Save it somewhere easy to find (Downloads is fine).

> **Screenshot placeholder:** Releases page with the setup `.exe` highlighted  
> `docs/images/en-01-download.png`

## 2. Install

1. Double-click the setup file.
2. If Windows asks “Do you want to allow this app…?”, choose **Yes**.
3. Pick **English** or **Português** if asked.
4. Follow the steps. Leave the **desktop shortcut** option checked if you want an icon on the desktop.
5. Finish the installer.

The app installs for your Windows user (usually no administrator password).

> **Screenshot placeholder:** Installer welcome / options screen  
> `docs/images/en-02-installer.png`

## 3. Open the app

- Use the **desktop** icon, or  
- Open the **Start** menu → **Converte Facil** → **Converte Facil**

Choose **Language** (English / Português) at the top if needed.

> **Screenshot placeholder:** Main window with language selector and Images / PDF / Documents buttons  
> `docs/images/en-03-main.png`

## 4. Convert your first file (images)

1. Click **Images**.
2. Drop a photo onto the big box, or click **Choose files**.  
   Phone photos in **HEIC** / **HEIF** (and **AVIF**) are accepted when your ImageMagick build supports them.
3. Under **Convert to**, pick a format (for example **JPG** or **PNG**).
4. Click **Convert and save**, then choose a folder for the result.
5. Wait until you see a success message.

> **Screenshot placeholder:** Image queue + format picker + Convert button  
> `docs/images/en-04-convert-image.png`

## 5. Convert a PDF (optional)

1. Click **PDF**.
2. Choose a PDF, pick **PNG** or **JPG**, then **Convert and save** into a folder.  
   Each page becomes a separate image (`page-001`, `page-002`, …).
3. Or use **Turn photos into a PDF** to combine photos into one PDF file.

> **Screenshot placeholder:** PDF mode panel  
> `docs/images/en-05-pdf.png`

## 6. Convert Word or Excel to PDF (optional)

Documents mode needs **LibreOffice**. If it is not on the PC yet, use **Install LibreOffice** in the app (Windows may ask for permission). Or download from the official site and click **Check again**.

1. Click **Documents**.
2. If LibreOffice is missing, click **Install LibreOffice** and wait (or use the download page + **Check again**).
3. Choose a **Word (`.docx`)** or **Excel (`.xlsx`)** file.
4. Click **Convert to PDF**. The PDF is saved next to the original file.

> **Screenshot placeholder:** Documents mode + LibreOffice guide  
> `docs/images/en-06-documents.png`

## Uninstall

1. Open Windows **Settings** → **Apps** → **Installed apps**.
2. Find **Converte Facil** → **Uninstall**.

That removes the app, the Start menu entry, and the desktop shortcut.

## Open-source components (PDF)

PDF conversion uses **Ghostscript**, which is free software under the **GNU AGPL v3**. The official Windows installer may include Ghostscript. Source code for the Ghostscript version we ship is available from Artifex (see [third-party/NOTICE](../third-party/NOTICE) and [docs/sidecars.md](sidecars.md) in the project repository).

## Need help?

- Files stay on your computer — nothing is uploaded.
- If a tool shows **Not found** in the app, reinstall from a full installer build (the official setup includes the conversion tools).
- For building from source (developers): see the [README](../README.md).
