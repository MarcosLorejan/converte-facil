# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | Yes       |
| < 0.1   | No        |

Security fixes are applied to the latest release on the `main` branch (and tagged releases when they exist).

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security reports.

Prefer one of these private channels:

1. **GitHub private vulnerability reporting** — use [Security advisories](https://github.com/MarcosLorejan/converte-facil/security/advisories/new) on this repository (enable “Private vulnerability reporting” in repo settings if it is not already on).
2. If that is unavailable, contact the maintainer via their [GitHub profile](https://github.com/MarcosLorejan).

Include as much detail as you can: affected version or commit, steps to reproduce, impact, and any suggested fix.

You should receive an acknowledgment within a few days. We will coordinate a fix and disclosure timeline with you.

## Scope notes

Converte Fácil is a local desktop app that shells out to ImageMagick, Ghostscript, and (optionally) LibreOffice, and may download those engines at build time. Reports related to path handling, sidecar integrity, installer trust, or unsafe process arguments are especially welcome.
