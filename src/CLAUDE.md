# Demo app — `src/`

The demo is the library's shop window: it's deployed to GitHub Pages (`https://constantine-24.github.io/ngx-datetime-picker/`) by `.github/workflows/pages.yml` on every push to `main`, and the root README's screenshot comes from it.

<important if="you are changing the demo app">

- **Import only the public API**: `@constantine-24/ngx-datetime-picker` and `@constantine-24/ngx-datetime-picker/temporal`. Never import from `projects/…` by relative path — the demo has to prove that the published surface is enough.
- One page, no router. Small focused components under `src/app/` (header, playground, example cards, code block). Code snippets shown on the page must be valid, copy-pasteable usage that matches the README.
- Colours come from `--mat-sys-*` only. The light/dark toggle sets `color-scheme` on `<html>`, and `mat.theme()` resolves the tokens through `light-dark()`. Check both schemes.
- The page must keep a **Lighthouse accessibility score of 100** (axe). Check it with chrome-devtools: navigation mode for the page, snapshot mode with a picker overlay open.
- Pages build: `npx ng build --base-href /ngx-datetime-picker/`. All asset URLs must be relative so they resolve under that base href.
- After a visible change, refresh the README screenshot (`docs/images/demo.png`, taken at 1280px wide in light mode).
  </important>
