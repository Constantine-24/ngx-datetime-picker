# Angular Components, Templates & Services

Angular **v22**. Your training data likely predates it; when unsure of an API, query context7 (`/angular/angular`, `/angular/components`) before writing code. The rules below override older patterns.

<important if="you are about to write or modify an Angular component, directive, template, or service">

**Components & directives**

- Standalone only. Do NOT set `standalone: true` (the default since v20).
- Do NOT set `changeDetection: ChangeDetectionStrategy.OnPush` (the default since v22).
- Use `input()`, `input.required()`, `model()` and `output()`, not decorators.
- Do NOT use `@HostBinding` / `@HostListener` — put host bindings in the decorator's `host` object.
- Use `inject()`, not constructor injection.
- Keep components small and single-purpose; prefer inline templates for small components. External template/style paths are relative to the `.ts` file.
- Don't use `ngClass` / `ngStyle` — use `[class.x]` / `[style.x]` bindings.
- Use `NgOptimizedImage` for static images (not for inline base64).

**Library-specific**

- Selectors: components `ngx-dt-*` (kebab-case), directives `ngxDt*` (camelCase attribute, usually `input[ngxDt…]`). `exportAs` matches the selector name.
- Form integration: input directives implement `ControlValueAccessor` **and** `Validator`, and must work with Reactive Forms, `ngModel` **and** Signal Forms `[formField]`. Each new input gets a `*.forms.spec.ts` covering all three.
- Validation error keys are public API: `ngxDtParse`, `ngxDtMin`, `ngxDtMax`, `ngxDtFilter`, `ngxDtRangeStart`, `ngxDtRangeEnd`, `ngxDtRangeOrder`.
- Inject optional collaborators `{ optional: true }` (e.g. `DateAdapter` for time-only apps, `Directionality`), so a consumer only has to provide what their variant needs.
- Zoneless: the app and tests use `provideZonelessChangeDetection()`. Drive state through signals; don't rely on zone-triggered change detection after async work.
- SSR-safe: no top-level `window` / `document` access. Use `inject(DOCUMENT)` and `afterNextRender` for DOM-only work.

**State**

- Signals for local state, `computed()` for derived state, `linkedSignal()` for state that resets from an input. Use `set` / `update`, never `mutate`.
- Subscriptions end via `takeUntilDestroyed()` (or a finite operator). Effects that write signals are fine in v22 — `allowSignalWrites` no longer exists, so don't "fix" an effect by adding it.

**Templates**

- Native control flow (`@if`, `@for` with `track`, `@switch`); keep logic in `computed()`s, not in the template.
- Don't assume globals like `new Date()` are available in templates.

**Forms (demo / consumers)**

- Prefer Signal Forms (`@angular/forms/signals`) for new forms; otherwise Reactive Forms over template-driven.

**Services**

- Single responsibility. Prefer `@Service()` (v22) over `@Injectable({ providedIn: 'root' })` for new singletons. Libraries should prefer `provide*()` functions over root singletons so consumers control scope.
  </important>
