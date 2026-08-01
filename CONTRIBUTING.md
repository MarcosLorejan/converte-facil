# Contributing

Repo docs, code, issues, and PRs are written in **English**.  
The **app UI** must support English and Portuguese (i18n).

By participating, you agree to follow our [Code of Conduct](CODE_OF_CONDUCT.md).

## Getting set up

Setup, the validation loop, expected build durations, and the project layout live in **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**. If you are using an AI coding agent, point it at [AGENTS.md](AGENTS.md).

The short version:

```bash
npm install
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

## Issues

**One issue per PR.** Branch naming:

```
fix/123-short-description
feat/45-short-description
docs/127-short-description
```

Issue titles use the same [Conventional Commits](https://www.conventionalcommits.org/) format as commit messages.

## Labels

Every issue should carry a **type**, a **priority**, and a **status** label. Add `area:` labels as applicable.

| Dimension | Labels |
| --- | --- |
| Type | `type:feat` · `type:fix` · `type:docs` · `type:chore` |
| Priority | `priority:high` · `priority:medium` · `priority:low` |
| Status | `status:todo` · `status:in-progress` · `status:review-needed` |
| Area | `area:ui` · `area:imagemagick` · `area:pdf` · `area:installer` · `area:i18n` · `area:docs` · `area:security` · `area:ci` · `area:testing` |
| Other | `good-first-issue` |

New issues start at `status:todo`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<optional scope>): <short description>
```

`type` is one of `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`. Keep the description imperative, lowercase, and without a trailing period:

```
feat(ui): add cancel button to the conversion queue
fix(engine): harden LibreOffice convert and add regression tests
docs: add development guide
```

One logical change per commit.

## Flow

1. Pick an issue from the current milestone
2. Branch from `main`
3. Make the change, and run the validation loop above
4. Open a PR referencing the issue (`Fixes #N`)
5. Review / merge
