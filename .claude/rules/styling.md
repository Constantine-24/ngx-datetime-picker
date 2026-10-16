# Styling

The library ships **no global stylesheet**. Component styles are inline (`styles:` in `picker`, `time-panel`, `toggle`), encapsulated, and themed entirely through the consumer's Angular Material M3 theme.

<important if="you are writing CSS or SCSS, modifying component styles, or touching theming">

- Colours, typography, shape and elevation come only from `--mat-sys-*` system tokens (`--mat-sys-primary`, `--mat-sys-on-surface`, `--mat-sys-surface-container-high`, …), which the host app emits with `mat.theme()`. No hard-coded colours, fonts or shadows in library styles.
- Every new visual state needs light **and** dark verification: `mat.theme()` emits `light-dark()` tokens, so test with the demo's theme toggle and with the OS dark mode.
- Honour `prefers-reduced-motion: reduce` — every transition or animation in the library must be disabled under it.
- RTL: use logical properties (`margin-inline-start`, `inset-inline-end`, `padding-inline`), not left/right. The picker propagates `Directionality` into its overlay panel.
- Disabled states use `:disabled` / `[aria-disabled]` styling, not opacity alone on text (contrast still applies).
- No `::ng-deep`. Style Material internals only through Material's documented override mixins or tokens; if that's impossible, document why next to the rule.
- Interactive targets are at least 24×24 CSS px (WCAG 2.5.8).
- Library `.scss`/inline styles have no lint coverage. The library build (`npm run build:lib`) is what proves they compile, and a browser is what proves they render.
  </important>

<important if="you are styling the demo app (src/)">

- The demo is a showcase: it may use richer layout and its own custom properties, but colours still come from `--mat-sys-*` so that the light/dark toggle and contrast work.
- `src/styles.scss` binds `body` to `--mat-sys-surface` / `--mat-sys-on-surface`. Keep that: without it the page stays white while tokens switch to dark-scheme values, and contrast fails.
  </important>
