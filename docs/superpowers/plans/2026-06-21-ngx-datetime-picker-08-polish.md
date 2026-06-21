# ngx-datetime-picker — Plan 8: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Final-polish the five-variant `ngx-datetime-picker` library: close the carried functional gaps (hour-cycle-aware input formatting, `dateFilter`/`timeFilter` predicates), complete keyboard a11y on the time stepper, add RTL + reduced-motion + a theming/`:disabled` CSS sweep, ship the two opted-in features (dual synced calendars, draft/Apply-Cancel), write the docs, and verify (AXE/Lighthouse, SSR, build, tests).

**Architecture:** All work is additive polish on the existing components — no new public component except an internal empty calendar-header used to suppress `MatCalendar`'s built-in nav for dual mode. New behavior is opt-in via picker `input()`s (`monthsToDisplay`, `draftMode`, `timeFilter`) so every existing demo and test keeps its current behavior. A shared `resolveHourCycle()` util becomes the single source of truth for 12/24h resolution across the panel and all inputs.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), `@angular/cdk` (overlay, a11y, bidi), `@angular/material` (`MatCalendar`, `DateAdapter`), TC39 Temporal (flagship adapter), Vitest (`@angular/build:unit-test`), chrome-devtools-mcp Lighthouse for AXE.

## Global Constraints

Every task's requirements implicitly include this section. Copied verbatim from `.claude/CLAUDE.md` and the established build conventions:

- **Angular idioms:** standalone components only; **MUST NOT** set `standalone: true`; **MUST NOT** set `changeDetection: OnPush` explicitly. Use `input()`/`output()`/`model()`/`computed()`/`signal()`. Use `inject()` (not constructor params). Host bindings go in the `host` object — **no** `@HostBinding`/`@HostListener`. Use `class`/`style` bindings — **no** `ngClass`/`ngStyle`. Native control flow (`@if`/`@for`/`@switch`) — no `*ngIf`/`*ngFor`. Use the `@Service` decorator only for new singletons; adapters keep `@Injectable` + `useClass`.
- **Angular v22 note (recurring reviewer false-positive):** `allowSignalWrites` was **removed in v19** — effects allow signal writes by default. Do **not** add `{ allowSignalWrites: true }` to any `effect()`; it is a compile error. Verify any flagged "needs allowSignalWrites" idiom against the shipped sibling input directives before acting.
- **Types:** strict; avoid `any`; use `unknown` when uncertain. The only permitted casts are the documented `as unknown as D` at the loosely-typed `MatCalendar`/`NgxDtTimePanel` template seams (the picker is single-generic `<D>` but the calendar runs the `PlainDate` adapter and the panel the `PlainTime` adapter). Never `any`.
- **Accessibility:** MUST pass all AXE checks and WCAG AA (focus management, color contrast, ARIA). Target Lighthouse a11y = 100 on every variant's open overlay.
- **Forms:** components support Reactive Forms, `ngModel`, and Signal Forms simultaneously (CVA + Validator). Error keys are stable: `ngxDtParse`, `ngxDtMin`, `ngxDtMax`, `ngxDtFilter` (single inputs); `ngxDtRangeStart`, `ngxDtRangeEnd`, `ngxDtMin`, `ngxDtMax`, `ngxDtFilter`, `ngxDtRangeOrder` (range inputs).
- **Pinned internal dependencies:** Material `22.0.2`. The picker already depends on `MatCalendar`'s internal `(_userSelection)` output (covered by tests). This plan adds one more pinned dependency: `MatCalendar.[headerComponent]` (public input) used to render an empty header in dual mode — cover it with a test so a Material change surfaces.
- **Test commands:** library `npx ng test --project ngx-datetime-picker --watch=false` (add `-- <spec-substring>` to focus a file); whole repo `npm test` runs the app project (2 files / 5 tests) then the library (currently 22 files / 210 tests). Library build: `npx ng build ngx-datetime-picker`.
- **Commit trailer on EVERY commit (exact):**
  ```
  Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
  ```
- **Branch:** all work lands on `feat/ngx-datetime-picker-polish` (already created off `main` at `c4e78c6`). Do not work on `main`.
- **Do not touch `tokens.ts`** — `tokens.spec.ts` asserts `NGX_DT_DEFAULT_OPTIONS_VALUE` equals exactly `{ hasBackdrop: true, restoreFocus: true }`. New options are plain picker `input()`s (consistent with the existing `hourCycle`/`minuteStep`/`showSeconds` inputs), not token fields.

---

## File Structure

**New files:**
- `projects/ngx-datetime-picker/src/lib/util/hour-cycle.ts` — `resolveHourCycle(explicit, locale)` pure util (Task 1).
- `projects/ngx-datetime-picker/src/lib/util/hour-cycle.spec.ts` — its unit tests (Task 1).
- `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-empty-calendar-header.ts` — empty `MatCalendar` header to suppress built-in nav in dual mode (Task 5).

**Modified files (by task):**
- Task 1: `time-panel/ngx-dt-time-panel.ts`, `time-input/ngx-dt-time-input.ts` (+ `.spec.ts`), `datetime-input/ngx-dt-datetime-input.ts` (+ `.spec.ts`), `datetime-range-input/ngx-dt-datetime-range-input.ts` (+ `.spec.ts`).
- Task 2: `datetime-input/ngx-dt-datetime-input.ts` (+ `.spec.ts`), `datetime-range-input/ngx-dt-datetime-range-input.ts` (+ `.validators.spec.ts`).
- Task 3: `picker/ngx-dt-picker.ts` (+ `.spec.ts`), `time-panel/ngx-dt-time-panel.ts` (+ `.spec.ts`), `time-input/ngx-dt-time-input.ts` (+ `.spec.ts`).
- Task 4: `time-panel/ngx-dt-time-panel.ts` (+ `.spec.ts`).
- Task 5: `picker/ngx-dt-picker.ts` (+ `.spec.ts`), new empty-header file.
- Task 6: `picker/ngx-dt-picker.ts` (+ `.spec.ts`).
- Task 7: `picker/ngx-dt-picker.ts` (+ `.spec.ts`).
- Task 8: `toggle/ngx-dt-toggle.ts` (+ `.spec.ts`), `time-panel/ngx-dt-time-panel.ts`, `picker/ngx-dt-picker.ts`.
- Task 9: `input/ngx-dt-input.spec.ts`, `input/ngx-dt-input.ts` (comment), `picker/ngx-dt-picker.spec.ts`, `picker/ngx-dt-picker.ts` (comment).
- Task 10: `projects/ngx-datetime-picker/README.md`, root `README.md`, TSDoc in public files.
- Task 11: `src/app/app.ts`, `src/app/app.html`, `src/app/app.scss` (demo); verification only elsewhere.

---

## Interfaces (cross-task contracts)

- **Task 1 → all input format paths:** `resolveHourCycle(explicit: 12 | 24 | null, locale: string): 12 | 24`. Pure; explicit wins, else derive from locale (`en-US`→12, `en-GB`→24).
- **Task 3 → Task 4:** the time panel exposes filter-aware commit helpers: `step(field, direction)` (relative, skips filtered values), `commit(mutate)` (absolute, rejects filtered values), and `setFieldAbsolute(field, raw)` (absolute set via `commit`). Task 4 wires Home/End to `setFieldAbsolute` and PageUp/PageDown to `step(field, ±5)`.
- **Task 3 → picker:** picker gains `timeFilter = input<(time: D) => boolean>(() => true)`, passed to every `<ngx-dt-time-panel>` as `[timeFilter]`.
- **Task 5 → picker:** picker gains `monthsToDisplay = input<1 | 2>(1)`, `dualCalendars` computed, `_activeMonth` signal, `onPrevMonth()`/`onNextMonth()`, `dualMonths()` computed, `monthLabel()`, and references `NgxDtEmptyCalendarHeader`.
- **Task 6 → picker:** picker gains `draftMode = input(false)`, `_draftActive`/`_draftValue`/`_draftRange` signals, draft-aware `displayValue`/`rangeDisplayValue`/`commitValue`/`commitRange`, `showFooter` computed, `onApplyClick()`/`onCancelClick()`. Tasks 5 and 6 both edit the picker template/footer; the Task 6 implementer integrates with the dual-calendar template already present.
- **Task 7 → picker:** picker gains `direction` signal (`'ltr' | 'rtl'`) bound as `[attr.dir]` on both panel containers.

---

### Task 1: Hour-cycle-aware input formatting

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/util/hour-cycle.ts`
- Create: `projects/ngx-datetime-picker/src/lib/util/hour-cycle.spec.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.ts`
- Test: the three `.spec.ts` siblings of the modified inputs.

**Interfaces:**
- Produces: `resolveHourCycle(explicit: 12 | 24 | null, locale: string): 12 | 24`.
- Consumes: the picker's existing `hourCycle()` and `showSeconds()` inputs (read via the input directives' `picker()` ref), and `MAT_DATE_LOCALE`.

**Context:** Today `NgxDtTimeInput`, `NgxDtDateTimeInput`, and the datetime-range part directives call `adapter.format(value)` with **no options**, so the flagship Temporal adapters format at their hardcoded `hour12: false` default — a 12h picker panel shows "02:30 PM" but the input text shows "14:30". This task threads the picker's effective hour cycle into the inputs' display formatting. The time panel already resolves the cycle inline (`effectiveHourCycle`); extract that logic so panel and inputs agree.

- [ ] **Step 1: Write the util test**

Create `projects/ngx-datetime-picker/src/lib/util/hour-cycle.spec.ts`:
```ts
import { resolveHourCycle } from './hour-cycle';

describe('resolveHourCycle', () => {
  it('returns the explicit cycle when set', () => {
    expect(resolveHourCycle(12, 'en-GB')).toBe(12);
    expect(resolveHourCycle(24, 'en-US')).toBe(24);
  });

  it('derives 12h for an en-US locale when explicit is null', () => {
    expect(resolveHourCycle(null, 'en-US')).toBe(12);
  });

  it('derives 24h for an en-GB locale when explicit is null', () => {
    expect(resolveHourCycle(null, 'en-GB')).toBe(24);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- hour-cycle`
Expected: FAIL — cannot find module `./hour-cycle`.

- [ ] **Step 3: Write the util**

Create `projects/ngx-datetime-picker/src/lib/util/hour-cycle.ts`:
```ts
/**
 * Resolve the effective hour cycle for display. An explicit `12`/`24` wins;
 * `null` derives the cycle from the resolved locale (e.g. `en-US`→12, `en-GB`→24),
 * matching Material's locale-aware `MatTimepicker` behaviour.
 */
export function resolveHourCycle(explicit: 12 | 24 | null, locale: string): 12 | 24 {
  if (explicit === 12 || explicit === 24) {
    return explicit;
  }
  const hour12 =
    new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true;
  return hour12 ? 12 : 24;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- hour-cycle`
Expected: PASS (3 tests).

- [ ] **Step 5: Refactor the time panel onto the util**

In `time-panel/ngx-dt-time-panel.ts`, add the import (top, after the existing imports):
```ts
import { resolveHourCycle } from '../util/hour-cycle';
```
Replace the `effectiveHourCycle` computed and delete the now-unused `localeUses12Hour` method. Current:
```ts
  protected readonly effectiveHourCycle = computed<12 | 24>(() => {
    // `hourCycle` is the explicit opt-in. When unset we derive the cycle purely
    // from the resolved locale (`MAT_DATE_LOCALE`, defaulting to `'en-US'`),
    // matching Material's `MatTimepicker` locale-aware behaviour.
    const explicit = this.hourCycle();
    if (explicit != null) return explicit;
    return this.localeUses12Hour() ? 12 : 24;
  });
```
becomes:
```ts
  protected readonly effectiveHourCycle = computed<12 | 24>(() =>
    resolveHourCycle(this.hourCycle(), this.locale),
  );
```
Then delete the `localeUses12Hour()` method entirely:
```ts
  private localeUses12Hour(): boolean {
    return (
      new Intl.DateTimeFormat(this.locale, { hour: 'numeric' }).resolvedOptions()
        .hour12 === true
    );
  }
```

- [ ] **Step 6: Write the failing input-formatting tests**

In `time-input/ngx-dt-time-input.spec.ts`, add to the `describe('NgxDtTimeInput', ...)` block (the host template already has `<input [ngxDtTimeInput]="picker" [formControl]="ctrl" /><ngx-dt-picker #picker type="time" .../>` — extend the host to bind `[hourCycle]` so the test can drive it; if the existing `Host` does not expose `hourCycle`, add a `hourCycle = signal<12 | 24 | null>(null)` to it and bind `[hourCycle]="hourCycle()"` on the `<ngx-dt-picker>`):
```ts
  it('formats the field in 12h when the picker hourCycle is 12', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(12);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.picker().setValueFromPicker?.(
      Temporal.PlainTime.from('14:30') as unknown as never,
    );
    // setValueFromPicker is on the input directive; drive it through the control instead:
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('14:30'));
    await fixture.whenStable();
    expect(input.value).toMatch(/PM/i);
    expect(input.value).toContain('2:30');
  });

  it('formats the field in 24h when the picker hourCycle is 24', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(24);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('14:30'));
    await fixture.whenStable();
    expect(input.value).toContain('14:30');
    expect(input.value).not.toMatch(/PM/i);
  });
```
> NOTE for the implementer: keep only the `ctrl.setValue(...)` path (it triggers `writeValue` → `_formatToInput`). Remove the `setValueFromPicker?.(...)` line from the first test if it does not compile against the host — it is illustrative; the control-write path is the real assertion.

In `datetime-input/ngx-dt-datetime-input.spec.ts`, the host has `<input [ngxDtDateTimeInput]="picker" [formControl]="ctrl" /><ngx-dt-picker #picker type="datetime" .../>`. Add `hourCycle = signal<12 | 24 | null>(null)` to the host and bind `[hourCycle]="hourCycle()"`, then add:
```ts
  it('formats the field honoring the picker hourCycle (12h shows AM/PM)', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(12);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T14:30'));
    await fixture.whenStable();
    expect(input.value).toMatch(/PM/i);
  });

  it('formats the field in 24h when hourCycle is 24', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.hourCycle.set(24);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T14:30'));
    await fixture.whenStable();
    expect(input.value).toContain('14:30');
    expect(input.value).not.toMatch(/PM/i);
  });
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-input`
then: `npx ng test --project ngx-datetime-picker --watch=false -- datetime-input`
Expected: the new 12h tests FAIL (input shows 24h text because `format()` ignores the cycle).

- [ ] **Step 8: Make `NgxDtTimeInput` honor the cycle**

In `time-input/ngx-dt-time-input.ts`:
- Add imports:
  ```ts
  import { MAT_DATE_LOCALE } from '@angular/material/core';
  import { resolveHourCycle } from '../util/hour-cycle';
  ```
- Inject the locale (alongside the existing `adapter`/`elementRef` injects):
  ```ts
  private readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';
  ```
- Replace `_formatToInput`:
  ```ts
  private _formatToInput(time: T | null): void {
    this.elementRef.nativeElement.value =
      time && this.adapter.isValid(time)
        ? this.adapter.format(time, this._displayOptions())
        : '';
  }

  /** Display options that honor the picker's effective hour cycle. */
  private _displayOptions(): Intl.DateTimeFormatOptions {
    const cycle = resolveHourCycle(this.picker().hourCycle(), this.locale);
    return { hour: '2-digit', minute: '2-digit', hour12: cycle === 12 };
  }
  ```

- [ ] **Step 9: Make `NgxDtDateTimeInput` honor the cycle**

In `datetime-input/ngx-dt-datetime-input.ts`, mirror Step 8:
- Add imports for `MAT_DATE_LOCALE` and `resolveHourCycle`.
- Inject `locale` as above.
- Replace `_formatToInput` and add `_displayOptions`:
  ```ts
  private _formatToInput(value: T | null): void {
    this.elementRef.nativeElement.value =
      value && this.adapter.isValid(value)
        ? this.adapter.format(value, this._displayOptions())
        : '';
  }

  /** Date+time display options that honor the picker's effective hour cycle. */
  private _displayOptions(): Intl.DateTimeFormatOptions {
    const cycle = resolveHourCycle(this.picker().hourCycle(), this.locale);
    return {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: cycle === 12,
    };
  }
  ```

- [ ] **Step 10: Make the datetime-range parts honor the cycle**

In `datetime-range-input/ngx-dt-datetime-range-input.ts`, in the abstract part base (`NgxDtDateTimeRangePartBase`):
- Add imports for `MAT_DATE_LOCALE` and `resolveHourCycle`.
- Inject locale in the base:
  ```ts
  protected readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';
  ```
- Replace `formatValue`:
  ```ts
  formatValue(value: T | null): void {
    this.elementRef.nativeElement.value =
      value && this.adapter.isValid(value)
        ? this.adapter.format(value, this._displayOptions())
        : '';
  }

  private _displayOptions(): Intl.DateTimeFormatOptions {
    const cycle = resolveHourCycle(this.parent.picker().hourCycle(), this.locale);
    return {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: cycle === 12,
    };
  }
  ```

- [ ] **Step 11: Add the datetime-range hour-cycle test**

In `datetime-range-input/ngx-dt-datetime-range-input.spec.ts`, in the text-I/O host (which renders the container + start/end inputs + a `<ngx-dt-picker type="datetime-range">`), ensure the host binds `[hourCycle]="12"` on the picker (or add a `hourCycle` signal and bind it). Add:
```ts
  it('formats both inputs honoring the picker hourCycle (12h shows AM/PM)', async () => {
    setup();
    const fixture = TestBed.createComponent(Host); // host picker bound [hourCycle]="12"
    await fixture.whenStable();
    const [start, end] = Array.from(
      fixture.nativeElement.querySelectorAll('input'),
    ) as HTMLInputElement[];
    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-21T09:00'),
        Temporal.PlainDateTime.from('2026-06-21T17:30'),
      ),
    );
    await fixture.whenStable();
    expect(start.value).toMatch(/AM/i);
    expect(end.value).toMatch(/PM/i);
  });
```

- [ ] **Step 12: Run all four affected specs to verify they pass**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-panel`
Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-input`
Run: `npx ng test --project ngx-datetime-picker --watch=false -- datetime-input`
Run: `npx ng test --project ngx-datetime-picker --watch=false -- datetime-range-input`
Expected: all PASS (existing panel cycle tests still pass; new input tests pass).

- [ ] **Step 13: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/util/ \
  projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts \
  projects/ngx-datetime-picker/src/lib/time-input/ \
  projects/ngx-datetime-picker/src/lib/datetime-input/ \
  projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.ts \
  projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.spec.ts
git commit -m "$(cat <<'EOF'
feat(inputs): honor picker hourCycle when formatting input text

Extract resolveHourCycle() and thread it into NgxDtTimeInput,
NgxDtDateTimeInput, and the datetime-range part directives so typed
fields match the 12/24h panel. Panel now uses the shared util.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `dateFilter` validator on the datetime inputs

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.ts`
- Test: `datetime-input/ngx-dt-datetime-input.spec.ts`, `datetime-range-input/ngx-dt-datetime-range-input.validators.spec.ts`

**Interfaces:**
- Consumes: the picker's existing `dateFilter = input<(date: D) => boolean>(() => true)`. The predicate operates on the **date part** (consistent with the calendar, which runs the `PlainDate` adapter and calls `dateFilter` with dates). Adapter `getDate(value)` extracts that part.
- Produces: the `ngxDtFilter: true` error key on `NgxDtDateTimeInput` and on each end of `NgxDtDateTimeRangeInput` (parity with `NgxDtInput`/`NgxDtDateRangeInput`).

**Context:** `NgxDtInput` (date) validates `dateFilter` → `ngxDtFilter`, but `NgxDtDateTimeInput` and the datetime-range container do not. Mirror the date-input pattern. The filter must be evaluated on the date part so a "no weekends" predicate written for the calendar also rejects typed datetimes on those days.

- [ ] **Step 1: Write the failing single-input test**

In `datetime-input/ngx-dt-datetime-input.spec.ts`, extend the host so the picker accepts a `dateFilter` (add `dateFilter = signal<(d: Temporal.PlainDate) => boolean>(() => true)` and bind `[dateFilter]="dateFilter()"` on the `<ngx-dt-picker>`), then add:
```ts
  it('reports ngxDtFilter when the typed datetime falls on a filtered-out day', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    // Disallow 2026-06-21 specifically (compare the date part).
    fixture.componentInstance.dateFilter.set(
      (d) => Temporal.PlainDate.compare(d, Temporal.PlainDate.from('2026-06-21')) !== 0,
    );
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '2026-06-21T10:00';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toEqual({ ngxDtFilter: true });
  });

  it('passes validation for a datetime on an allowed day', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.dateFilter.set(
      (d) => Temporal.PlainDate.compare(d, Temporal.PlainDate.from('2026-06-21')) !== 0,
    );
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '2026-06-22T10:00';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- datetime-input`
Expected: the filter test FAILS (`errors` is `null` — no filter check exists yet).

- [ ] **Step 3: Add the filter check to `NgxDtDateTimeInput.validate`**

In `datetime-input/ngx-dt-datetime-input.ts`, in `validate()`, after the `max` check and before `return null`:
```ts
    // The calendar filters dates, so evaluate the predicate on the date part.
    const datePart = this.adapter.getDate(value) as unknown as T;
    if (!picker.dateFilter()(datePart)) {
      return { ngxDtFilter: true };
    }
    return null;
```
And extend the constructor `effect` to re-validate when the filter changes:
```ts
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      picker.dateFilter();
      this._onValidatorChange();
    });
```

- [ ] **Step 4: Run to verify single-input passes**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- datetime-input`
Expected: PASS.

- [ ] **Step 5: Write the failing datetime-range validator test**

In `datetime-range-input/ngx-dt-datetime-range-input.validators.spec.ts`, following the existing validator-test setup (host renders the container + start/end + a `<ngx-dt-picker type="datetime-range">`; ensure the host can set `dateFilter` on the picker), add:
```ts
  it('reports ngxDtFilter when an end datetime is on a filtered-out day', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.dateFilter.set(
      (d) => Temporal.PlainDate.compare(d, Temporal.PlainDate.from('2026-06-25')) !== 0,
    );
    await fixture.whenStable();
    const [start, end] = Array.from(
      fixture.nativeElement.querySelectorAll('input'),
    ) as HTMLInputElement[];
    start.value = '2026-06-21T09:00';
    start.dispatchEvent(new Event('input'));
    end.value = '2026-06-25T17:00';
    end.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toEqual({ ngxDtFilter: true });
  });
```

- [ ] **Step 6: Run to verify it fails**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- datetime-range-input`
Expected: FAIL.

- [ ] **Step 7: Add the filter check to the datetime-range validator**

In `datetime-range-input/ngx-dt-datetime-range-input.ts`, in `validate()`, after the existing per-end min/max checks and before `ngxDtRangeOrder`/`return null`, add a date-part filter check for each present end. Match the existing structure (the validator already coerces `start`/`end` values); for each non-null end:
```ts
    const filter = picker.dateFilter();
    if (start !== null && !filter(this.adapter.getDate(start) as unknown as T)) {
      return { ngxDtFilter: true };
    }
    if (end !== null && !filter(this.adapter.getDate(end) as unknown as T)) {
      return { ngxDtFilter: true };
    }
```
> The implementer must place this using the validator's existing local variable names for the coerced start/end (read the current `validate()` body). Also add `picker.dateFilter();` to the container's constructor `effect` so the validator re-runs on filter change (mirror the single input).

- [ ] **Step 8: Run to verify the range validator passes**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- datetime-range-input`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/datetime-input/ \
  projects/ngx-datetime-picker/src/lib/datetime-range-input/
git commit -m "$(cat <<'EOF'
feat(datetime-inputs): add dateFilter validator (ngxDtFilter)

NgxDtDateTimeInput and NgxDtDateTimeRangeInput now validate the picker's
dateFilter predicate against the date part of each value, matching
NgxDtInput/NgxDtDateRangeInput. Constructor effects watch dateFilter().

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `timeFilter` predicate

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.ts`
- Test: `time-panel/ngx-dt-time-panel.spec.ts`, `time-input/ngx-dt-time-input.spec.ts`

**Interfaces:**
- Produces (picker): `timeFilter = input<(time: D) => boolean>(() => true)`, bound to every `<ngx-dt-time-panel>` as `[timeFilter]="timeFilter()"`.
- Produces (panel): `timeFilter = input<(time: T) => boolean>(() => true)`; **filter-aware** commit helpers — `commit(mutate)` rejects a filtered result; `step(field, direction)` skips filtered results (advances in the same direction up to one field-cycle); a private `allowed(time)` guard. Task 4 depends on these.
- Produces (time input): `ngxDtFilter: true` validator key.

**Context:** Parallel to `dateFilter`. The panel both prevents landing on a filtered time (steps skip, absolute sets reject) and the time input validates typed values. In datetime modes the picker's `timeFilter` operates on the time part (the panel passes its time value, cast at the seam).

- [ ] **Step 1: Write the failing panel tests**

In `time-panel/ngx-dt-time-panel.spec.ts`, the `Host` already exposes inputs. Add `timeFilter = signal<(t: Temporal.PlainTime) => boolean>(() => true)` to the host and bind `[timeFilter]="timeFilter()"` on `<ngx-dt-time-panel>`. Then add to the 24h describe:
```ts
  it('ArrowUp skips a filtered minute and lands on the next allowed value', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    // Allow only minutes that are multiples of 15.
    fixture.componentInstance.timeFilter.set((t) => t.minute % 15 === 0);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('10:00'));
    await fixture.whenStable();
    const minute = fixture.nativeElement.querySelectorAll(
      'input[role="spinbutton"]',
    )[1] as HTMLInputElement;
    minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(15);
  });

  it('type-to-set rejects a filtered value and keeps the current one', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.timeFilter.set((t) => t.minute % 15 === 0);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('10:00'));
    await fixture.whenStable();
    const minute = fixture.nativeElement.querySelectorAll(
      'input[role="spinbutton"]',
    )[1] as HTMLInputElement;
    minute.value = '07';
    minute.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(0); // unchanged
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-panel`
Expected: FAIL (no `timeFilter` input; ArrowUp lands on `:01`).

- [ ] **Step 3: Add `timeFilter` to the panel and make commits filter-aware**

In `time-panel/ngx-dt-time-panel.ts`:
- Add the input (after `hourCycle`):
  ```ts
  readonly timeFilter = input<(time: T) => boolean>(() => true);
  ```
- Add an `allowed` guard (near `baseTime`):
  ```ts
  /** Whether a composed/clamped time passes the active filter. */
  private allowed(time: T): boolean {
    return this.timeFilter()(time);
  }
  ```
- Replace `step` to skip filtered values:
  ```ts
  protected step(field: TimeField, direction: number): void {
    if (this.disabled()) return;
    const unit = field === 'minute' ? this.minuteStep() : 1;
    const perStep = direction * unit;
    const base = this.parts() ?? this.toParts(this.baseTime());
    // Field cycles are 24 (hour) or 60 (minute/second); cap the skip search at
    // one full cycle so an all-filtered field can never loop forever.
    const cap = field === 'hour' ? 24 : 60;
    let candidate = base;
    for (let i = 0; i < cap; i++) {
      candidate = this.stepField(candidate, field, perStep);
      const composed = this.adapter.createTime(
        candidate.hour,
        candidate.minute,
        candidate.second,
      );
      const clamped = this.adapter.clampTime(composed, this.min(), this.max());
      if (this.allowed(clamped)) {
        if (!this.adapter.sameTime(clamped, this.value())) {
          this.value.set(clamped);
          void this.live.announce(this.announceText(clamped), 'polite');
        }
        return;
      }
    }
  }
  ```
- Replace `commit` to reject filtered results (used by type/meridiem and, in Task 4, Home/End):
  ```ts
  /** Apply a parts mutation, compose, clamp; reject if filtered; else set+announce. */
  private commit(mutate: (p: TimeParts) => TimeParts): void {
    const base = this.parts() ?? this.toParts(this.baseTime());
    const next = mutate(base);
    const composed = this.adapter.createTime(next.hour, next.minute, next.second);
    const clamped = this.adapter.clampTime(composed, this.min(), this.max());
    if (!this.allowed(clamped)) {
      return; // filtered out — no change
    }
    if (!this.adapter.sameTime(clamped, this.value())) {
      this.value.set(clamped);
      void this.live.announce(this.announceText(clamped), 'polite');
    }
  }
  ```
> Note: `commitField` already reformats the field after `commit` via `input.value = this.fieldText(field)`, so a rejected type-to-set visually reverts. Keep `commitField` as-is.

- [ ] **Step 4: Run to verify the panel passes**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-panel`
Expected: PASS (new + existing).

- [ ] **Step 5: Wire `timeFilter` from the picker to every time panel**

In `picker/ngx-dt-picker.ts`:
- Add the input (after `showSeconds`):
  ```ts
  readonly timeFilter = input<(time: D) => boolean>(() => true);
  ```
- Add `[timeFilter]="timeFilter()"` to all four `<ngx-dt-time-panel>` usages in the template (the `isTime()` panel, the `isDateTime()` panel, and both datetime-range Start/End panels).

- [ ] **Step 6: Write the failing time-input validator test**

In `time-input/ngx-dt-time-input.spec.ts`, extend the host to bind `[timeFilter]` on the picker (add `timeFilter = signal<(t: Temporal.PlainTime) => boolean>(() => true)`), then add:
```ts
  it('reports ngxDtFilter when the typed time is filtered out', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.timeFilter.set((t) => t.minute % 15 === 0);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = '10:07';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors).toEqual({ ngxDtFilter: true });
  });
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-input`
Expected: FAIL.

- [ ] **Step 8: Add the filter check to `NgxDtTimeInput.validate`**

In `time-input/ngx-dt-time-input.ts`, in `validate()`, after the `max` check and before `return null`:
```ts
    if (!picker.timeFilter()(value)) {
      return { ngxDtFilter: true };
    }
    return null;
```
And extend the constructor `effect` to watch it:
```ts
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      picker.timeFilter();
      this._onValidatorChange();
    });
```

- [ ] **Step 9: Run time-input + picker specs**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-input`
Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: PASS (picker spec unaffected; new input default `timeFilter` is a no-op).

- [ ] **Step 10: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts \
  projects/ngx-datetime-picker/src/lib/time-panel/ \
  projects/ngx-datetime-picker/src/lib/time-input/
git commit -m "$(cat <<'EOF'
feat(time): add timeFilter predicate (panel skip/reject + ngxDtFilter)

Picker exposes timeFilter; the stepper skips filtered values on step and
rejects them on type/meridiem; NgxDtTimeInput validates it as ngxDtFilter.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Time stepper Home/End/PageUp/PageDown

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts`
- Test: `time-panel/ngx-dt-time-panel.spec.ts`

**Interfaces:**
- Consumes (from Task 3): `step(field, direction)` (skips filtered) and `commit(mutate)` (rejects filtered).
- Produces: `setFieldAbsolute(field, raw)` and the Home/End/PageUp/PageDown cases in `onFieldKeydown`.

**Context:** WAI-ARIA spinbutton keys. Home → field minimum, End → field maximum (absolute, via `commit` so a filtered bound is rejected); PageUp/PageDown → 5× the arrow step (via `step`, so filtered values skip). Uses the existing `setField` (cycle-aware) for absolute bounds.

- [ ] **Step 1: Write the failing keyboard tests**

In `time-panel/ngx-dt-time-panel.spec.ts`, add to the 24h describe:
```ts
  it('Home sets the minute field to 0', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('10:37'));
    await fixture.whenStable();
    const minute = fixture.nativeElement.querySelectorAll(
      'input[role="spinbutton"]',
    )[1] as HTMLInputElement;
    minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(0);
  });

  it('End sets the minute field to 59', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('10:00'));
    await fixture.whenStable();
    const minute = fixture.nativeElement.querySelectorAll(
      'input[role="spinbutton"]',
    )[1] as HTMLInputElement;
    minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(59);
  });

  it('End sets the hour field to 23 (24h)', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('10:00'));
    await fixture.whenStable();
    const hour = fixture.nativeElement.querySelectorAll(
      'input[role="spinbutton"]',
    )[0] as HTMLInputElement;
    hour.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.hour).toBe(23);
  });

  it('PageUp advances the minute field by 5', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('10:00'));
    await fixture.whenStable();
    const minute = fixture.nativeElement.querySelectorAll(
      'input[role="spinbutton"]',
    )[1] as HTMLInputElement;
    minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(5);
  });

  it('PageDown wraps the minute field below 0', async () => {
    setup();
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('10:02'));
    await fixture.whenStable();
    const minute = fixture.nativeElement.querySelectorAll(
      'input[role="spinbutton"]',
    )[1] as HTMLInputElement;
    minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true }));
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(57); // 2 - 5 wraps within 60
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-panel`
Expected: FAIL (keys not handled).

- [ ] **Step 3: Add the key cases and `setFieldAbsolute`**

In `time-panel/ngx-dt-time-panel.ts`, extend `onFieldKeydown` (after the `Enter` branch, before the closing brace):
```ts
    } else if (event.key === 'Home') {
      event.preventDefault();
      this.setFieldAbsolute(field, 0);
    } else if (event.key === 'End') {
      event.preventDefault();
      this.setFieldAbsolute(field, field === 'hour' ? 23 : 59);
    } else if (event.key === 'PageUp') {
      event.preventDefault();
      this.step(field, 5);
    } else if (event.key === 'PageDown') {
      event.preventDefault();
      this.step(field, -5);
    }
```
Add the helper (near `step`):
```ts
  /** Absolute set of a field to a raw value (clamped/cycle-aware via setField). */
  private setFieldAbsolute(field: TimeField, raw: number): void {
    if (this.disabled()) return;
    this.commit((p) => this.setField(p, field, raw));
  }
```

- [ ] **Step 4: Run to verify they pass**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- time-panel`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/time-panel/
git commit -m "$(cat <<'EOF'
feat(time-panel): Home/End/PageUp/PageDown on spinbutton fields

Home/End jump to field bounds (filter-rejecting); PageUp/PageDown step
by 5x the arrow unit (filter-skipping). Completes WAI-ARIA spinbutton keys.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Dual synced calendars (`monthsToDisplay`)

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-empty-calendar-header.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Produces: picker `monthsToDisplay = input<1 | 2>(1)`; `dualCalendars` computed (true only in range modes with 2 months); `_activeMonth` signal + `activeMonthStart`/`activeMonthNext` computeds; `dualMonths()` (keyed list for `@for` recreation); `onPrevMonth()`/`onNextMonth()`; `monthLabel(date)`; `emptyHeader` reference.

**Context:** `MatCalendar.activeDate` is effectively read-only and `[startAt]` only sets the initial month, so a single shared header drives both calendars by owning `_activeMonth` and **recreating** the two `<mat-calendar>`s via a keyed `@for` when the month changes (change-detection-safe in zoneless). Each calendar's built-in header is suppressed with an empty `[headerComponent]`. Dual mode is scoped to range variants in **month** view. Known limitation (document in Task 10): arrowing past a month edge inside one calendar navigates that calendar independently of the shared header.

`DateAdapter` methods used: `addCalendarMonths`, `getYear`, `getMonth`, `getMonthNames` — all standard and implemented by `TemporalDateAdapter`.

- [ ] **Step 1: Create the empty header component**

Create `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-empty-calendar-header.ts`:
```ts
import { Component } from '@angular/core';

/**
 * An empty `MatCalendar` header. Passed via `[headerComponent]` to suppress the
 * calendar's built-in month/year label + navigation arrows in dual-calendar
 * mode, where a single shared header (rendered by the picker) drives both months.
 */
@Component({
  selector: 'ngx-dt-empty-calendar-header',
  template: '',
})
export class NgxDtEmptyCalendarHeader {}
```

- [ ] **Step 2: Write the failing dual-calendar tests**

In `picker/ngx-dt-picker.spec.ts` (the spec already creates host components binding `<ngx-dt-picker>`), add a host that renders an **inline** range picker with `monthsToDisplay`. Add tests:
```ts
  it('renders two calendars when monthsToDisplay is 2 (range mode)', async () => {
    // Host: <ngx-dt-picker [inline]="true" type="date-range"
    //          [monthsToDisplay]="2" [startAt]="startAt()" />
    const fixture = createDualHost();
    fixture.componentInstance.startAt.set(Temporal.PlainDate.from('2026-06-15'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('mat-calendar').length).toBe(2);
  });

  it('renders a single calendar when monthsToDisplay is 1', async () => {
    const fixture = createDualHost();
    fixture.componentInstance.months.set(1);
    fixture.componentInstance.startAt.set(Temporal.PlainDate.from('2026-06-15'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('mat-calendar').length).toBe(1);
  });

  it('the shared next-month control advances both month labels', async () => {
    const fixture = createDualHost();
    fixture.componentInstance.startAt.set(Temporal.PlainDate.from('2026-06-15'));
    await fixture.whenStable();
    const labels = () =>
      Array.from(fixture.nativeElement.querySelectorAll('.ngx-dt-cal-label')).map(
        (el: Element) => el.textContent?.trim(),
      );
    expect(labels()).toEqual(['June 2026', 'July 2026']);
    (fixture.nativeElement.querySelector('[data-testid="cal-next"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(labels()).toEqual(['July 2026', 'August 2026']);
  });
```
> The implementer writes `createDualHost()` as a small `@Component` host with `months = signal<1 | 2>(2)`, `startAt = signal<Temporal.PlainDate | null>(null)`, template `<ngx-dt-picker [inline]="true" type="date-range" [monthsToDisplay]="months()" [startAt]="startAt()" />`, imported into the test module. `setup()` must provide `provideTemporalDateAdapter()` (the spec's existing date setup).

- [ ] **Step 3: Run to verify they fail**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: FAIL (no `monthsToDisplay`; one calendar; no labels).

- [ ] **Step 4: Add dual-calendar state to the picker**

In `picker/ngx-dt-picker.ts`:
- Import the empty header:
  ```ts
  import { NgxDtEmptyCalendarHeader } from './ngx-dt-empty-calendar-header';
  ```
- Add the input (after `dateFilter`):
  ```ts
  readonly monthsToDisplay = input<1 | 2>(1);
  ```
- Add state + computeds (near `effectiveStartAt`):
  ```ts
  /** Custom header component used to hide each calendar's built-in nav. */
  protected readonly emptyHeader = NgxDtEmptyCalendarHeader;

  /** Dual months are only meaningful for the range variants. */
  protected readonly dualCalendars = computed(
    () => this.monthsToDisplay() === 2 && this.calendarRangeMode(),
  );

  /** Left month anchor; user navigation overrides the computed start-at. */
  private readonly _activeMonth = signal<D | null>(null);
  protected readonly activeMonthStart = computed<D | null>(
    () => this._activeMonth() ?? this.effectiveStartAt(),
  );
  protected readonly activeMonthNext = computed<D | null>(() => {
    const adapter = this.adapter;
    const start = this.activeMonthStart();
    return adapter && start ? adapter.addCalendarMonths(start, 1) : null;
  });

  /** Keyed descriptors for the two calendars; key change forces recreation. */
  protected readonly dualMonths = computed(() => {
    const adapter = this.adapter;
    const start = this.activeMonthStart();
    const next = this.activeMonthNext();
    if (!adapter || !start || !next) return [];
    return [
      { key: this.monthKey(start), start },
      { key: this.monthKey(next), start: next },
    ];
  });

  private monthKey(d: D): string {
    const a = this.adapter!;
    return `${a.getYear(d)}-${a.getMonth(d)}`;
  }

  protected monthLabel(d: D | null): string {
    const a = this.adapter;
    if (!a || !d) return '';
    return `${a.getMonthNames('long')[a.getMonth(d)]} ${a.getYear(d)}`;
  }

  protected onPrevMonth(): void {
    const a = this.adapter;
    const start = this.activeMonthStart();
    if (a && start) this._activeMonth.set(a.addCalendarMonths(start, -1));
  }

  protected onNextMonth(): void {
    const a = this.adapter;
    const start = this.activeMonthStart();
    if (a && start) this._activeMonth.set(a.addCalendarMonths(start, 1));
  }
  ```

- [ ] **Step 5: Render the dual calendars in the template**

In the picker template, replace the single `<mat-calendar ...>` (the one inside the `@else` branch, currently bound `[startAt]`/`[startView]`/`[selected]`/`[minDate]`/`[maxDate]`/`[dateFilter]`/`(selectedChange)`/`(_userSelection)`) with a dual/single switch:
```html
          @if (dualCalendars()) {
            <div class="ngx-dt-calendars">
              <div class="ngx-dt-cal-nav" role="group" aria-label="Calendar navigation">
                <button
                  type="button"
                  class="ngx-dt-cal-arrow"
                  data-testid="cal-prev"
                  [disabled]="disabled()"
                  aria-label="Previous month"
                  (click)="onPrevMonth()"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <span class="ngx-dt-cal-label">{{ monthLabel(activeMonthStart()) }}</span>
                <span class="ngx-dt-cal-label">{{ monthLabel(activeMonthNext()) }}</span>
                <button
                  type="button"
                  class="ngx-dt-cal-arrow"
                  data-testid="cal-next"
                  [disabled]="disabled()"
                  aria-label="Next month"
                  (click)="onNextMonth()"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
              <div class="ngx-dt-calendars-row">
                @for (m of dualMonths(); track m.key) {
                  <mat-calendar
                    [startAt]="m.start"
                    [startView]="'month'"
                    [headerComponent]="emptyHeader"
                    [selected]="calendarSelection()"
                    [minDate]="calendarMin()"
                    [maxDate]="calendarMax()"
                    [dateFilter]="dateFilter()"
                    (selectedChange)="onSelectedChange($event)"
                    (_userSelection)="onUserSelection($event)"
                  />
                }
              </div>
            </div>
          } @else {
            <mat-calendar
              [startAt]="effectiveStartAt()"
              [startView]="startView()"
              [selected]="calendarSelection()"
              [minDate]="calendarMin()"
              [maxDate]="calendarMax()"
              [dateFilter]="dateFilter()"
              (selectedChange)="onSelectedChange($event)"
              (_userSelection)="onUserSelection($event)"
            />
          }
```
> The `@else` branch is the original single calendar verbatim (so `monthsToDisplay === 1`, single-date, datetime, and time are unchanged).

- [ ] **Step 6: Add dual-calendar styles**

Add to the picker `styles` array:
```css
      .ngx-dt-calendars-row {
        display: flex;
        gap: 8px;
      }
      .ngx-dt-cal-nav {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 4px 8px;
      }
      .ngx-dt-cal-label {
        flex: 1;
        text-align: center;
        font: var(--mat-sys-title-small, inherit);
        color: var(--mat-sys-on-surface, inherit);
      }
      .ngx-dt-cal-arrow {
        min-width: 32px;
        min-height: 32px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--mat-sys-on-surface-variant, currentColor);
        cursor: pointer;
      }
      .ngx-dt-cal-arrow:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-cal-arrow:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 1px;
      }
      .ngx-dt-cal-arrow[disabled] {
        opacity: 0.38;
        cursor: default;
      }
```

- [ ] **Step 7: Run to verify dual-calendar passes (+ a datetime-range smoke check)**

Add one more test asserting datetime-range also goes dual:
```ts
  it('renders two calendars for a datetime-range picker too', async () => {
    // Host: <ngx-dt-picker [inline]="true" type="datetime-range" [monthsToDisplay]="2"
    //          [startAt]="startAt()" /> with provideTemporalDateTimeAdapter()
    const fixture = createDualDateTimeHost();
    fixture.componentInstance.startAt.set(Temporal.PlainDateTime.from('2026-06-15T00:00'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('mat-calendar').length).toBe(2);
  });
```
Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/
git commit -m "$(cat <<'EOF'
feat(picker): dual synced calendars via monthsToDisplay=2

Range pickers can show two months with a single shared nav header. The
picker owns _activeMonth and recreates both mat-calendars (keyed @for) on
navigation; an empty headerComponent hides each calendar's built-in nav.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Draft / Apply-Cancel mode (`draftMode`)

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Consumes: the Task 5 template (footer is separate from the calendar block — integrate the footer changes with whatever calendar markup is present).
- Produces: picker `draftMode = input(false)`; `_draftActive`/`_draftValue`/`_draftRange` signals; draft-aware `displayValue`/`rangeDisplayValue`/`commitValue`/`commitRange`; `showFooter` computed; `onApplyClick()`/`onCancelClick()`.

**Context:** When `draftMode` is on (overlay only — inline never opens, so it stays immediate-commit), opening seeds a draft from the committed value; all edits buffer into the draft; the calendar/time panels read the draft; the overlay does **not** auto-close on selection; the footer shows **Cancel**/**Apply**. Apply flushes the draft to the real sink and closes; Cancel/backdrop/Escape discard.

- [ ] **Step 1: Write the failing draft tests**

In `picker/ngx-dt-picker.spec.ts`, add a host that opens a `draftMode` date picker against an explicit origin. Tests:
```ts
  it('draftMode: selecting buffers until Apply, then commits', async () => {
    // Host: <button #trigger></button>
    //       <ngx-dt-picker #p type="date" [draftMode]="true" [(value)]="value" />
    const fixture = createDraftHost();
    const cmp = fixture.componentInstance;
    cmp.picker().open(cmp.trigger().nativeElement);
    await fixture.whenStable();
    // simulate a calendar selection (date mode uses (selectedChange))
    cmp.picker()['onSelectedChange'](Temporal.PlainDate.from('2026-06-21'));
    await fixture.whenStable();
    expect(cmp.value()).toBeNull(); // buffered, not committed
    (document.querySelector('[data-testid="dt-apply"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(cmp.value()?.toString()).toBe('2026-06-21');
    expect(cmp.picker().isOpen()).toBe(false);
  });

  it('draftMode: Cancel discards the buffered selection', async () => {
    const fixture = createDraftHost();
    const cmp = fixture.componentInstance;
    cmp.picker().open(cmp.trigger().nativeElement);
    await fixture.whenStable();
    cmp.picker()['onSelectedChange'](Temporal.PlainDate.from('2026-06-21'));
    await fixture.whenStable();
    (document.querySelector('[data-testid="dt-cancel"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(cmp.value()).toBeNull();
    expect(cmp.picker().isOpen()).toBe(false);
  });

  it('draftMode: closing via backdrop/escape discards the draft', async () => {
    const fixture = createDraftHost();
    const cmp = fixture.componentInstance;
    cmp.picker().open(cmp.trigger().nativeElement);
    await fixture.whenStable();
    cmp.picker()['onSelectedChange'](Temporal.PlainDate.from('2026-06-21'));
    await fixture.whenStable();
    cmp.picker().close();
    await fixture.whenStable();
    expect(cmp.value()).toBeNull();
  });
```
> The implementer writes `createDraftHost()` with `viewChild` refs `picker`/`trigger`, a `value = signal<Temporal.PlainDate | null>(null)`, and `provideTemporalDateAdapter()`. Calling the protected `onSelectedChange` via index access is acceptable in the spec (the spec file already reaches protected members for isolated assertions). The overlay buttons render into the document overlay container, hence `document.querySelector`.

- [ ] **Step 2: Run to verify they fail**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: FAIL (no draft buffering; no Apply/Cancel; date auto-commits and closes).

- [ ] **Step 3: Add draft state and make display/commit draft-aware**

In `picker/ngx-dt-picker.ts`:
- Add the input (after `monthsToDisplay`):
  ```ts
  readonly draftMode = input(false);
  ```
- Add draft state (near the `_open` signal):
  ```ts
  private readonly _draftActive = signal(false);
  private readonly _draftValue = signal<D | null>(null);
  private readonly _draftRange = signal<DateRange<D> | null>(null);
  ```
- Make `displayValue` draft-aware:
  ```ts
  protected readonly displayValue = computed<D | null>(() => {
    if (this._draftActive()) return this._draftValue();
    const input = this._input();
    return input ? input.value() : this.value();
  });
  ```
- Make `rangeDisplayValue` draft-aware:
  ```ts
  protected readonly rangeDisplayValue = computed<DateRange<D> | null>(() => {
    if (this._draftActive()) return this._draftRange();
    const input = this._rangeInput();
    return input ? input.range() : this.range();
  });
  ```
- Make `commitValue`/`commitRange` buffer when the draft is active:
  ```ts
  private commitValue(value: D | null): void {
    if (this._draftActive()) {
      this._draftValue.set(value);
      return;
    }
    const input = this._input();
    if (input) {
      input.setValueFromPicker(value);
    } else {
      this.value.set(value);
    }
  }

  private commitRange(range: DateRange<D>): void {
    if (this._draftActive()) {
      this._draftRange.set(range);
      return;
    }
    const input = this._rangeInput();
    if (input) {
      input.setRangeFromPicker(range);
    } else {
      this.range.set(range);
    }
  }
  ```

- [ ] **Step 4: Seed the draft on open, discard on close, never auto-close while drafting**

- In `open()`, after `this._origin.set(anchor);` and before `this._open.set(true);`:
  ```ts
    if (this.draftMode()) {
      this._draftValue.set(this._input() ? this._input()!.value() : this.value());
      this._draftRange.set(
        this._rangeInput() ? this._rangeInput()!.range() : this.range(),
      );
      this._draftActive.set(true);
    }
  ```
- In `close()`, after the `if (!this._open()) return;` guard:
  ```ts
    this._draftActive.set(false); // discard any uncommitted draft
  ```
- In `onSelectedChange`, change the auto-close to respect drafting:
  ```ts
    this.commitValue(date);
    if (!this.inline() && !this._draftActive()) {
      this.close();
    }
  ```
- In `onUserSelection` (the non-datetime range branch at the end), change the auto-close:
  ```ts
    if (!this.inline() && !this._draftActive() && next.start !== null && next.end !== null) {
      this.close();
    }
  ```

- [ ] **Step 5: Add `showFooter`, Apply/Cancel handlers, and restructure the footer**

- Add the computed (near `isAnyDateTime`):
  ```ts
  /** Footer renders for datetime variants (Now/Clear) and/or draft mode (Apply/Cancel). */
  protected readonly showFooter = computed(
    () => this.isAnyDateTime() || (this.draftMode() && !this.inline()),
  );
  ```
- Add handlers (near `onDoneClick`):
  ```ts
  protected onApplyClick(): void {
    if (this._draftActive()) {
      this._draftActive.set(false); // deactivate first so commit writes the real sink
      if (this.calendarRangeMode()) {
        this.commitRange(this._draftRange() ?? this._emptyRange);
      } else {
        this.commitValue(this._draftValue());
      }
    }
    this.close();
  }

  protected onCancelClick(): void {
    this.close(); // close() already discards the draft
  }
  ```
- Restructure the footer block. Replace the current footer (`@if (isAnyDateTime()) { <div class="ngx-dt-actions">...Now/Clear/Done...</div> }`) with:
  ```html
          @if (showFooter()) {
            <div class="ngx-dt-actions" role="group" aria-label="Actions">
              @if (isAnyDateTime()) {
                <button
                  type="button"
                  class="ngx-dt-action"
                  data-testid="dt-now"
                  [disabled]="disabled()"
                  (click)="onNowClick()"
                >
                  Now
                </button>
                <button
                  type="button"
                  class="ngx-dt-action"
                  data-testid="dt-clear"
                  [disabled]="disabled()"
                  (click)="onClearClick()"
                >
                  Clear
                </button>
              }
              @if (draftMode() && !inline()) {
                <button
                  type="button"
                  class="ngx-dt-action"
                  data-testid="dt-cancel"
                  (click)="onCancelClick()"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  class="ngx-dt-action ngx-dt-action-primary"
                  data-testid="dt-apply"
                  (click)="onApplyClick()"
                >
                  Apply
                </button>
              } @else if (isAnyDateTime() && !inline()) {
                <button
                  type="button"
                  class="ngx-dt-action ngx-dt-action-primary"
                  data-testid="dt-done"
                  (click)="onDoneClick()"
                >
                  Done
                </button>
              }
            </div>
          }
  ```
  > This block lives inside the `@else` (calendar) branch where the original footer was. Note: for `type="time"` (the `@if (isTime())` branch) there is no footer today; draftMode for a pure-time popup is out of scope (time editing is continuous and never auto-closes) — leave the time branch unchanged.

- [ ] **Step 6: Run to verify draft passes (and existing picker tests still pass)**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: PASS. In particular the existing non-draft datetime footer tests (`dt-now`/`dt-clear`/`dt-done`) still pass because `draftMode` defaults false.

- [ ] **Step 7: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/
git commit -m "$(cat <<'EOF'
feat(picker): draft / Apply-Cancel mode (draftMode)

In draftMode the overlay buffers edits and commits only on Apply; Cancel,
backdrop, and Escape discard. Display/commit read/write a draft while open;
footer swaps Done for Cancel/Apply. Inline stays immediate-commit.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: RTL support

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Produces: picker `direction` signal (`'ltr' | 'rtl'`), bound `[attr.dir]="direction()"` on both panel containers (inline and overlay).

**Context:** `CdkConnectedOverlay` already mirrors `start`/`end` connected positions from the ambient `Directionality` (so overlay placement flips for free). The remaining work is propagating direction into the portaled panel so its internal logical-CSS resolves correctly, and reflecting live direction changes. Inject `Directionality` (optional, so date-only/test setups without `BidiModule` still work), seed a signal, and subscribe to `change`.

- [ ] **Step 1: Write the failing RTL test**

In `picker/ngx-dt-picker.spec.ts`, add:
```ts
  it('reflects the ambient direction on the panel (RTL)', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateAdapter(),
        { provide: Directionality, useValue: { value: 'rtl', change: new Subject<Direction>() } },
      ],
    });
    // Host: <ngx-dt-picker [inline]="true" />
    const fixture = TestBed.createComponent(InlineHost);
    await fixture.whenStable();
    const panel = fixture.nativeElement.querySelector('.ngx-dt-panel') as HTMLElement;
    expect(panel.getAttribute('dir')).toBe('rtl');
  });
```
Add imports to the spec:
```ts
import { Directionality, type Direction } from '@angular/cdk/bidi';
import { Subject } from 'rxjs';
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: FAIL (`dir` attribute absent).

- [ ] **Step 3: Inject Directionality and bind `[attr.dir]`**

In `picker/ngx-dt-picker.ts`:
- Add imports:
  ```ts
  import { DestroyRef } from '@angular/core';
  import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
  import { Directionality } from '@angular/cdk/bidi';
  ```
- Inject and seed (with the other injects):
  ```ts
  private readonly dir = inject(Directionality, { optional: true });
  private readonly _direction = signal<'ltr' | 'rtl'>(this.dir?.value ?? 'ltr');
  protected readonly direction = this._direction.asReadonly();
  ```
- Add a constructor to subscribe to direction changes (the picker currently has no constructor):
  ```ts
  constructor() {
    this.dir?.change
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this._direction.set(value));
  }
  ```
- Bind `[attr.dir]="direction()"` on **both** `<div class="ngx-dt-panel" ...>` elements (the inline `role="group"` one and the overlay `role="dialog"` one).

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/
git commit -m "$(cat <<'EOF'
feat(picker): RTL support via Directionality

Inject Directionality (optional), reflect it as [attr.dir] on the inline
and overlay panels, and track live change events. CdkConnectedOverlay
mirrors start/end positions from the ambient direction automatically.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Theming + `:disabled` + reduced-motion CSS sweep

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/toggle/ngx-dt-toggle.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `toggle/ngx-dt-toggle.spec.ts`

**Context:** The toggle currently ships **no styles** (relies on UA button rendering — no themed focus ring, hover, or disabled affordance). The time-panel text inputs have no `:disabled` rule. Nothing respects `prefers-reduced-motion`. This task adds `--mat-sys-*`-driven styles to the toggle, a disabled rule to the time inputs, and a reduced-motion guard on the panel. Functional assertions are thin (CSS is verified by Lighthouse/AXE in Task 11); add the one behavioral assertion that holds.

- [ ] **Step 1: Write/confirm the toggle disabled test**

In `toggle/ngx-dt-toggle.spec.ts`, add (if not already present):
```ts
  it('reflects the disabled state on the button', async () => {
    // Host: <ngx-dt-toggle [for]="picker" [disabled]="true" /> <ngx-dt-picker #picker />
    const fixture = createToggleHost(/* disabled */ true);
    await fixture.whenStable();
    const button = fixture.nativeElement.querySelector('.ngx-dt-toggle-button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
```

- [ ] **Step 2: Run it (should pass already if disabled binding exists; otherwise red)**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- toggle`
Expected: PASS (the `[disabled]` binding already exists). This guards the disabled affordance the CSS targets.

- [ ] **Step 3: Add themed styles to the toggle**

In `toggle/ngx-dt-toggle.ts`, add a `styles` array to the `@Component`:
```ts
  styles: [
    `
      .ngx-dt-toggle-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;
        padding: 8px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--mat-sys-on-surface-variant, currentColor);
        cursor: pointer;
      }
      .ngx-dt-toggle-button:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-toggle-button:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 2px;
      }
      .ngx-dt-toggle-button[disabled] {
        opacity: 0.38;
        cursor: default;
      }
      .ngx-dt-toggle-icon {
        display: block;
      }
    `,
  ],
```

- [ ] **Step 4: Add the time-input `:disabled` rule**

In `time-panel/ngx-dt-time-panel.ts` styles, add after the `.ngx-dt-time-input:focus-visible` rule:
```css
      .ngx-dt-time-input:disabled {
        opacity: 0.38;
        cursor: default;
      }
```

- [ ] **Step 5: Add the reduced-motion guard to the picker panel**

In `picker/ngx-dt-picker.ts` styles, add:
```css
      @media (prefers-reduced-motion: reduce) {
        .ngx-dt-panel,
        .ngx-dt-panel * {
          transition: none !important;
          animation: none !important;
        }
      }
```

- [ ] **Step 6: Run the affected specs + build**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- toggle`
Run: `npx ng build ngx-datetime-picker`
Expected: tests PASS; build succeeds (styles compile).

- [ ] **Step 7: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/toggle/ \
  projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts \
  projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts
git commit -m "$(cat <<'EOF'
feat(theming): toggle styles, time-input :disabled, reduced-motion guard

Toggle gains --mat-sys--driven hover/focus-visible/disabled styles; time
inputs get a disabled affordance; the panel honors prefers-reduced-motion.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Carried test/comment cleanups

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/input/ngx-dt-input.spec.ts` (+ a comment in `ngx-dt-input.ts`)
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts` (+ a comment in `ngx-dt-picker.ts`)

**Context:** Small carried items from Plans 3 and 7: a calendar→`dateChange` assertion, an explanatory comment on the date-input constructor effect, a symmetric panel-bound assertion set for the datetime-range, a step-time-before-date-pick test documenting the intentional today-anchoring, and a one-line same-day pre-clamp comment.

- [ ] **Step 1: Add the `dateChange`-from-calendar assertion (Plan 3)**

In `input/ngx-dt-input.spec.ts`, add a test that selecting through the picker emits the directive's `dateChange` output:
```ts
  it('emits dateChange when the calendar selection flows into the input', async () => {
    setup();
    // Host: <input [ngxDtInput]="picker" (dateChange)="last = $event" />
    //       <ngx-dt-picker #picker />
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const picker = fixture.componentInstance.picker();
    picker.value.set(Temporal.PlainDate.from('2026-06-21'));
    // The input owns the value via the seam: drive setValueFromPicker.
    fixture.componentInstance.inputDir().setValueFromPicker(
      Temporal.PlainDate.from('2026-06-21'),
    );
    await fixture.whenStable();
    expect(fixture.componentInstance.last?.toString()).toBe('2026-06-21');
  });
```
> The implementer adapts to the existing host in this spec (it already has a picker + input). If the host lacks a `dateChange` capture, add `last?: Temporal.PlainDate | null` and `(dateChange)="last = $event"`, plus a `viewChild` for the directive. Use the seam method `setValueFromPicker` (the picker→input contract) to drive selection.

- [ ] **Step 2: Add the explanatory comment to the date-input effect (Plan 3)**

In `input/ngx-dt-input.ts`, add a one-line comment above the constructor `effect` noting it relies on the required `picker` input being resolved before validation runs:
```ts
    // Re-validate whenever the picker's constraints change. The required `picker`
    // input is resolved before this effect first runs, so `this.picker()` is safe.
    effect(() => {
```

- [ ] **Step 3: Add symmetric panel-bound assertions + step-before-date test (Plan 7)**

In `picker/ngx-dt-picker.spec.ts`, in the datetime-range section, add assertions reading the symmetric computeds directly (cast to reach the protected members, matching the existing pattern in this spec):
```ts
  it('exposes symmetric start/end time-panel bounds on a shared day', async () => {
    // datetime-range picker with a range whose start and end fall on the same day.
    const p = createDateTimeRangePicker(); // helper already used by sibling tests
    p.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-21T09:00'),
        Temporal.PlainDateTime.from('2026-06-21T17:00'),
      ),
    );
    // start ceiling is the end time; end floor is the start time (same day).
    expect((p as any).startTimePanelMax()?.toString()).toContain('17:00');
    expect((p as any).endTimePanelMin()?.toString()).toContain('09:00');
  });

  it('stepping a start time before any date anchors to today (intentional parity)', async () => {
    const p = createDateTimeRangePicker();
    p.range.set(new DateRange<Temporal.PlainDateTime>(null, null));
    (p as any).onStartTimeChange(Temporal.PlainTime.from('08:30') as unknown as never);
    await Promise.resolve();
    const start = p.range()?.start;
    expect(start).not.toBeNull();
    expect(start!.toPlainTime().toString()).toContain('08:30');
  });
```
> Adapt `createDateTimeRangePicker()` to the spec's existing datetime-range helper/host. The casts `(p as any)` to read protected computeds match how this spec already verifies internal computeds.

- [ ] **Step 4: Add the same-day pre-clamp comment (Plan 7)**

In `picker/ngx-dt-picker.ts`, add a one-line comment above `startTimePanelMax` (or the same-day block) noting the panel's own `clampTime` pre-clamps the composed value before emit, so handlers never receive an out-of-order same-day time:
```ts
  // The time panel pre-clamps the composed value against these bounds before it
  // emits, so a same-day start can never be stepped past the end (and vice versa).
  protected readonly startTimePanelMax = computed<D | null>(() => {
```

- [ ] **Step 5: Run the affected specs**

Run: `npx ng test --project ngx-datetime-picker --watch=false -- input`
Run: `npx ng test --project ngx-datetime-picker --watch=false -- picker`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/input/ \
  projects/ngx-datetime-picker/src/lib/picker/
git commit -m "$(cat <<'EOF'
test(cleanups): carried Plan 3 + Plan 7 assertions and comments

Add dateChange-from-calendar assertion + effect comment (Plan 3); symmetric
start/end time-panel bound assertions, step-before-date today-anchoring test,
and same-day pre-clamp comment (Plan 7).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: README + TSDoc docs

**Files:**
- Modify: `projects/ngx-datetime-picker/README.md` (full rewrite)
- Modify: root `README.md`
- Modify: TSDoc in public files where thin (picker new inputs; `ngxDtFilter` keys).

**Context:** The library README still says "Foundation only". Rewrite it to document all five variants, the three provide functions, options (incl. the new `monthsToDisplay`/`draftMode`/`timeFilter`/`dateFilter`), forms support, theming, RTL, a11y, and the known dual-calendar keyboard limitation. This task has no unit tests; verify via `ng build` and a docs read-through.

- [ ] **Step 1: Rewrite the library README**

Replace `projects/ngx-datetime-picker/README.md` with content covering, in order:
1. Title + one-paragraph description (configurable Angular date/time picker on CDK + Material, Temporal flagship, five variants).
2. **Entry points** table: `ngx-datetime-picker` (components + adapters' abstract base classes + tokens) and `ngx-datetime-picker/temporal` (`provideTemporalDateAdapter`, `provideTemporalTimeAdapter`, `provideTemporalDateTimeAdapter` + the concrete adapters + formats).
3. **Installation** (`npm install ngx-datetime-picker @angular/material @angular/cdk temporal-polyfill`; polyfill optional).
4. **Providers**: which `provide*` to use per variant — `provideTemporalDateAdapter()` (date, date-range), `provideTemporalTimeAdapter()` (time), `provideTemporalDateTimeAdapter()` (datetime, datetime-range — superset).
5. **Usage** — one short snippet per variant: inline date; popup date with `[ngxDtInput]` + `<ngx-dt-toggle>` in `mat-form-field`; date-range with `<ngx-dt-date-range-input>` + `[ngxDtStartDate]`/`[ngxDtEndDate]`; time with `[ngxDtTimeInput]`; datetime with `[ngxDtDateTimeInput]`; datetime-range with `<ngx-dt-datetime-range-input>` + `[ngxDtStartDateTime]`/`[ngxDtEndDateTime]`.
6. **Picker inputs** table: `type`, `inline`, `min`, `max`, `startAt`, `startView`, `dateFilter`, `timeFilter`, `disabled`, `hourCycle`, `minuteStep`, `showSeconds`, `monthsToDisplay`, `draftMode`, `hasBackdrop`, `restoreFocus`, `ariaLabel`.
7. **Forms**: works with Reactive Forms, `ngModel`, and Signal Forms; error keys `ngxDtParse`/`ngxDtMin`/`ngxDtMax`/`ngxDtFilter` (single) and `ngxDtRangeStart`/`ngxDtRangeEnd`/`ngxDtMin`/`ngxDtMax`/`ngxDtFilter`/`ngxDtRangeOrder` (range).
8. **Theming**: components consume `--mat-sys-*` tokens; host app needs `mat.theme()`. Note `prefers-reduced-motion` is honored.
9. **Accessibility**: dialog role + focus trap + Escape + restore-focus; `role="spinbutton"` time fields with full arrow/Home/End/Page keys; `LiveAnnouncer`; WCAG AA. **Dual-calendar known limitation**: keyboard date-arrow past a month edge navigates that calendar independently of the shared header.
10. **RTL**: honored via CDK `Directionality`.
11. **Building & testing** (the `ng build` / `ng test` commands).

- [ ] **Step 2: Update the root README**

Point the root `README.md` at the library: a short intro + "See `projects/ngx-datetime-picker/README.md` for the library docs" + the demo run command (`npm start`). Keep it brief; do not duplicate the full table.

- [ ] **Step 3: TSDoc pass on new public surface**

Add/confirm concise TSDoc on the picker's new inputs (`monthsToDisplay`, `draftMode`, `timeFilter`) and a one-line note on `dateFilter` that the datetime inputs validate it on the date part. Keep doc comments to one or two lines each. (No behavior change.)

- [ ] **Step 4: Verify the build still succeeds**

Run: `npx ng build ngx-datetime-picker`
Expected: build OK (docs don't affect build, but TSDoc edits touch TS files).

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/README.md README.md \
  projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts
git commit -m "$(cat <<'EOF'
docs: rewrite library README for all five variants + options

Document entry points, providers, per-variant usage, picker inputs, forms +
error keys, theming, a11y (incl. dual-calendar keyboard limitation), RTL.
Add TSDoc for monthsToDisplay/draftMode/timeFilter.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Demo + full verification

**Files:**
- Modify: `src/app/app.ts`, `src/app/app.html`, `src/app/app.scss`
- Verification across the workspace (no library code change unless the SSR audit finds a real issue).

**Context:** Showcase the new features in the demo and run the full verification gate: tests, build, Lighthouse a11y on the new surfaces, an RTL spot-check, and an SSR-safety audit.

- [ ] **Step 1: Add demo sections**

In `src/app/app.ts`, add state for the new demos:
```ts
  // Dual-calendar range
  protected readonly dualRangeCtrl = new FormControl<DateRange<Temporal.PlainDate> | null>(null);
  // Draft-mode date
  protected readonly draftValue = signal<Temporal.PlainDate | null>(null);
  // Filtered datetime: weekdays only, business hours 09:00–17:00
  protected readonly weekdaysOnly = (d: Temporal.PlainDate) => d.dayOfWeek <= 5;
  protected readonly businessHours = (t: Temporal.PlainTime) => t.hour >= 9 && t.hour < 17;
```
In `src/app/app.html`, add sections:
- **Dual-calendar date range**: the existing range-input markup with `<ngx-dt-picker #dualRange type="date-range" [monthsToDisplay]="2" />` bound to `dualRangeCtrl`.
- **Draft-mode date**: `[ngxDtInput]` + toggle with `<ngx-dt-picker #draftPick [draftMode]="true" [(value)]="draftValue" />`.
- **Filtered time/datetime**: a `type="time"` (or `datetime`) picker with `[dateFilter]="weekdaysOnly"` and `[timeFilter]="businessHours"` and a `[hourCycle]="12"` to show consistent input formatting.

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: app project 5/5, library all green (existing 210 + the new tests from Tasks 1–9). Record the new totals.

- [ ] **Step 3: Build the library**

Run: `npx ng build ngx-datetime-picker`
Expected: ng-packagr build OK (both entry points).

- [ ] **Step 4: SSR-safety audit**

Run a grep for unsafe module-scope globals in the library source:
```bash
grep -rnE '\b(new Date\(|Date\.now\(|document\.|window\.|localStorage|navigator\.)' \
  projects/ngx-datetime-picker/src projects/ngx-datetime-picker/temporal/src \
  --include='*.ts' | grep -v '\.spec\.ts'
```
Expected: no matches at module scope. Time/date are obtained via `Temporal.Now.*` **inside** methods (lazy), and `Intl.DateTimeFormat` is SSR-safe. If any real module-scope global access is found, move it lazily into a method/computed and re-run tests. Note the audit result in the task report.

- [ ] **Step 5: Lighthouse a11y on the new surfaces**

Start the dev server (`npm start`), then with chrome-devtools-mcp: navigate to the demo, open each new overlay (dual-calendar range, draft-mode date, filtered datetime), and run `lighthouse_audit` in **snapshot mode** on the open overlay (navigation mode reloads and closes it; flush the overlay one rAF after the open click via `evaluate_script`). Target **a11y = 100** on each (`meta-description` is an SEO failure, ignore it).

- [ ] **Step 6: RTL spot-check**

Temporarily wrap the demo root (or one section) in `<div dir="rtl">` (or set `dir="rtl"` on `<html>` via devtools), open a picker, and confirm the overlay flips to the start/end mirrored position and the panel renders `dir="rtl"`. Revert any temporary demo change (keep the demo LTR by default).

- [ ] **Step 7: Commit the demo**

```bash
git add src/app/
git commit -m "$(cat <<'EOF'
feat(demo): dual-calendar, draft mode, and dateFilter/timeFilter demos

Showcase monthsToDisplay=2, draftMode, and weekday+business-hours filters
with hourCycle=12. Verified: npm test green, ng build OK, Lighthouse a11y=100,
RTL spot-check, SSR audit clean.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**1. Spec coverage (Phase 6 + carried deferrals):**
- AXE/keyboard/focus-trap/screen-reader pass → Task 4 (keys) + Task 11 (Lighthouse on every variant). ✓
- RTL → Task 7. ✓
- `--mat-sys-*` theming for custom parts (stepper, range inputs, toggle) → Task 8 (toggle was the only unstyled part; stepper/picker already tokenized; range inputs are bare and inherit). ✓
- reduced-motion → Task 8. ✓
- SSR → Task 11 Step 4 audit (+ fix if needed). ✓
- demo page per variant → existing single demo page extended in Task 11 (per-variant routes deemed unnecessary churn; the one-page demo already covers all variants and scores a11y=100). ✓
- README + API docs → Task 10. ✓
- `:disabled` sweep → Task 8 (toggle + time inputs; actions/steps/meridiem already had rules). ✓
- input-side `dateFilter` validator → Task 2. ✓
- `format()` honoring `hourCycle` → Task 1. ✓
- draft/Apply-Cancel revert → Task 6. ✓
- Home/End/PageUp/Down + `timeFilter` → Tasks 4 + 3. ✓
- dual synced calendars → Task 5. ✓
- `withTime(null)` today-anchoring kept (intentional) + a step-before-date test → Task 9 (documents/asserts it; does not change it). ✓
- step-time-before-date test + symmetric `startTimePanelMin`/`endTimePanelMax` assertions + same-day pre-clamp comment → Task 9. ✓
- **Excluded by user:** `MatTimepicker` list mode — not in this plan. ✓
- **Documented limitation (not a gap):** dual-calendar keyboard date-arrow past a month edge desyncs the shared header (Task 10 README). Group-level `MatFormFieldControl` for range inputs remains out of scope (not selected; range inputs stay `role="group"` fields).

**2. Placeholder scan:** No "TBD"/"add validation"/"similar to Task N" without code. Every code step shows the code. The few illustrative lines (e.g., the `setValueFromPicker?.(...)` line in Task 1 Step 6) are explicitly flagged for removal with the real assertion stated. Helper test factories (`createDualHost`, `createDraftHost`, `createDateTimeRangePicker`) are described with their exact shape because each spec's existing host differs; the implementer reads the live spec and matches its pattern.

**3. Type consistency:** New picker inputs typed against `<D>`: `monthsToDisplay: input<1 | 2>`, `draftMode: input<boolean>`, `timeFilter: input<(time: D) => boolean>`. Panel `timeFilter: input<(time: T) => boolean>`. Filter predicates are evaluated on the date part (datetime inputs) / time part (panels) via documented `as unknown as D`/`as unknown as T` seam casts — consistent with the existing `datePart`/`timePartOf` helpers. `resolveHourCycle(12 | 24 | null, string): 12 | 24` is used identically in the panel and all inputs. Error keys reuse the established `ngxDtFilter`. Draft signals (`_draftValue: D | null`, `_draftRange: DateRange<D> | null`) match `value`/`range` model types. `Direction = 'ltr' | 'rtl'` matches the `_direction` signal.

**4. Ordering/coupling:** Tasks 5→6→7→8 all edit the picker template/styles in sequence; each implementer reads the live file and integrates (footer is independent of the calendar block; `[attr.dir]` and styles are additive). Task 3 establishes the filter-aware `commit`/`step`; Task 4 consumes them. No task depends on a later task.
