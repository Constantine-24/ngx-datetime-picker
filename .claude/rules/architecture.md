# Architecture

Angular CLI workspace with two projects (see `angular.json`):

| Project               | Root                            | What it is                                                                                               |
| --------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ngx-datetime-picker` | `projects/ngx-datetime-picker/` | The publishable library (ng-packagr). Output: `dist/ngx-datetime-picker/`.                               |
| `date-time-picker`    | `src/`                          | The demo app. Consumes the library exactly like a user would; deployed to GitHub Pages. Never published. |

## Library entry points

| Import specifier                               | Source                                                    | Contents                                                                                                |
| ---------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `@constantine-24/ngx-datetime-picker`          | `projects/ngx-datetime-picker/src/public-api.ts`          | Adapter-agnostic core: picker, toggle, inputs, time panel, abstract adapters, tokens, types.            |
| `@constantine-24/ngx-datetime-picker/temporal` | `projects/ngx-datetime-picker/temporal/src/public-api.ts` | Temporal adapters + `provideTemporal*Adapter()` providers. Only this entry imports `temporal-polyfill`. |

- `tsconfig.json` `paths` map both specifiers to **source**, so the demo and specs compile against live code (no `dist` round-trip). ng-packagr ignores these paths.
- The core entry must never import from `temporal/` or `temporal-polyfill` — that is what keeps the polyfill tree-shakeable for consumers using another adapter. The secondary entry imports the core by its package specifier, never by a relative path.

## Library layout (`projects/ngx-datetime-picker/src/lib/`)

One folder per public building block; each holds the implementation plus its specs (`*.spec.ts`, `*.forms.spec.ts` for Reactive/ngModel/Signal-Forms integration, `*.validators.spec.ts`).

- `picker/` — `NgxDtPicker<D>`: the single component behind all five variants (`type` input), inline or CDK overlay; owns calendar(s), time panel(s), footer, draft mode.
- `toggle/` — `NgxDtToggle`: the button that opens a picker.
- `input/`, `time-input/`, `datetime-input/` — single-value `<input>` directives (CVA + Validator), deliberate parallel siblings.
- `range-input/`, `datetime-range-input/` — two-input range containers (CVA + Validator over one `DateRange<D>`) with start/end part directives, also parallel siblings.
- `time-panel/` — `NgxDtTimePanel`: the hour/minute/second spinbutton stepper.
- `time/`, `datetime/` — abstract `NgxDtTimeAdapter` and the `NgxDtDateTimeAdapter` bridge (dates use Material's `DateAdapter`).
- `util/` — pure helpers (e.g. `resolveHourCycle`).
- `tokens.ts` — `NGX_DT_DEFAULT_OPTIONS`.

The design record is `docs/ngx-datetime-picker-design.md`. Internal mechanics and pinned Material internals are documented in `projects/ngx-datetime-picker/CLAUDE.md` — read it before changing the picker.

<important if="you are adding, removing, or renaming anything exported from a public-api.ts">

- `public-api.ts` files are the published contract. Every export needs TSDoc and a CHANGELOG entry under `[Unreleased]`.
- Removing or renaming an export, input, output, selector, error key or CSS custom property is a **breaking change** (major version). Prefer deprecating with a `@deprecated` TSDoc tag and keeping the old name working.
- Export only what consumers need. Internal helpers stay unexported, even if a spec imports them by relative path.
  </important>
