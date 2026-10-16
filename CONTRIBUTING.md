# Contributing

Thanks for your interest in improving **ngx-datetime-picker**! Bug reports, docs fixes and pull requests are all welcome.

## Getting started

```bash
git clone https://github.com/Constantine-24/ngx-datetime-picker.git
cd ngx-datetime-picker
nvm use          # Node version from .nvmrc
npm ci
npm start        # demo app on http://localhost:4200, using the library sources live
```

## Project layout

| Path                            | What                                                                        |
| ------------------------------- | --------------------------------------------------------------------------- |
| `projects/ngx-datetime-picker/` | The library (`src/` core entry, `temporal/` Temporal adapter entry)         |
| `src/`                          | The demo app, deployed to GitHub Pages                                      |
| `docs/`                         | Design record and release notes                                             |
| `.claude/rules/`                | Engineering rules (they apply to humans too — read `architecture.md` first) |

## Development loop

```bash
npx ng test ngx-datetime-picker --include lib/picker --watch=false   # scoped tests
npm run test:ci        # all tests
npm run lint           # angular-eslint
npm run format         # prettier
npm run build:lib      # ng-packagr build → dist/ngx-datetime-picker
```

## Pull requests

1. Open an issue first for anything beyond a small fix, so we can agree on the API.
2. Branch from `main` (`feat/…`, `fix/…`, `docs/…`).
3. Write a failing test first. Input directives need Reactive Forms, `ngModel` **and** Signal Forms coverage.
4. Keep the accessibility contract: keyboard support, ARIA roles/names, WCAG AA contrast in light and dark themes.
5. Add an entry under `## [Unreleased]` in `projects/ngx-datetime-picker/CHANGELOG.md` for user-visible changes.
6. Use [Conventional Commits](https://www.conventionalcommits.org/) (`fix(picker): …`, `feat(time-panel): …`).

CI must be green (format, lint, type-check, tests, library build) before merge.

## Releases

Maintainers cut releases by pushing a `vX.Y.Z` tag. See `.claude/rules/release.md`.

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
