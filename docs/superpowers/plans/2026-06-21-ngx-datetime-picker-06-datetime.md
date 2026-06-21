# Datetime Picker (`type="datetime"`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single-value **datetime** variant (`type="datetime"`) that composes the existing `MatCalendar` (date part) with the existing `NgxDtTimePanel` (time part) into one `Temporal.PlainDateTime` value, with an immediate-commit action footer (Now / Clear / Done) and a matching `[ngxDtDateTimeInput]` form-control directive.

**Architecture:** A new **calendar-free bridge adapter** `NgxDtDateTimeAdapter<DT, D, T>` (core) decomposes a datetime `DT` into a date part `D` and a time part `T` and recombines them; the flagship `TemporalDateTimeAdapter` implements it over `Temporal.PlainDateTime`, delegating locale parsing to the existing date/time adapters. The existing `NgxDtPicker<D>` gains a `datetime` branch that binds the calendar to the value's date part and the time panel to its time part, carries the unedited part across edits, clamps the composed value to `[min, max]`, and applies time-panel `[min]`/`[max]` only on boundary days. `[ngxDtDateTimeInput]` mirrors `[ngxDtTimeInput]` using the new adapter and the shared `NgxDtPickerInput<D>` value seam.

**Tech Stack:** Angular 22 (standalone, signals, zoneless), `@angular/material` `MatCalendar` + `DateAdapter`, `@angular/cdk` overlay/a11y, `temporal-polyfill` (`Temporal.PlainDateTime`/`PlainDate`/`PlainTime`), Vitest (`@angular/build:unit-test`).

## Global Constraints

Copied from `.claude/CLAUDE.md` and the design doc — every task implicitly includes these:

- Standalone components/directives. Do **NOT** set `standalone: true`. Do **NOT** set `changeDetection: ChangeDetectionStrategy.OnPush` (both are defaults in v22).
- Use signals: `input()`, `output()`, `model()`, `computed()`. No `@HostBinding`/`@HostListener` — put bindings in the `host` object. No `ngClass`/`ngStyle` — use `class`/`style` bindings. Native control flow (`@if`/`@for`/`@switch`).
- `inject()` over constructor injection. New singletons use `@Injectable` only where they are DI-provided implementations of an abstract token (adapters use `@Injectable()` + `useClass`, matching `TemporalDateAdapter`/`TemporalTimeAdapter`).
- TypeScript strict; avoid `any`, use `unknown`. The picker bridges two type-worlds (whole `PlainDateTime` vs. `PlainDate`/`PlainTime` parts); the few unavoidable casts at the `MatCalendar`/`NgxDtTimePanel` template seams are written `as unknown as D` with an explanatory comment.
- Accessibility: MUST pass AXE / WCAG AA — focus management, color contrast, ARIA. Action-footer buttons are real tab stops with visible focus and ≥24px targets; custom parts consume `--mat-sys-*` tokens.
- Every commit ends with the trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Library test command: `npx ng test --project ngx-datetime-picker`. Full suite: `npm test`.
- Baseline before this plan (on `main`): library **143** tests green, app **5** tests green.

## File Structure

**Create (core):**
- `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.ts` — abstract `NgxDtDateTimeAdapter<DT, D, T>` bridge (abstract primitives + concrete `sameDateTime`/`sameDatePart`/`clampDateTime`/`withDate`/`withTime`).
- `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.spec.ts` — fake-adapter unit tests for the concrete methods.
- `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.ts` — `[ngxDtDateTimeInput]` directive (CVA + Validator + `NgxDtPickerInput<T>`).
- `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.spec.ts` — unit tests.
- `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.forms.spec.ts` — Reactive + ngModel integration tests.

**Create (temporal entry point):**
- `projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.ts` — `TemporalDateTimeAdapter`.
- `projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.spec.ts` — adapter tests.
- `projects/ngx-datetime-picker/temporal/src/provide-temporal-datetime-adapter.ts` — `provideTemporalDateTimeAdapter()` (date + time + datetime adapters in one call).

**Modify:**
- `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts` — add `'datetime'` to `NgxDtPickerType`; inject `NgxDtDateTimeAdapter` optionally; add datetime computeds, handlers, footer; restructure the `#panel` template.
- `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts` — datetime integration tests.
- `projects/ngx-datetime-picker/src/public-api.ts` — export `NgxDtDateTimeAdapter`, `NgxDtDateTimeInput`.
- `projects/ngx-datetime-picker/temporal/src/public-api.ts` — export `TemporalDateTimeAdapter`, `provideTemporalDateTimeAdapter`.
- `src/app/app.config.ts` — provide the datetime adapter.
- `src/app/app.ts`, `src/app/app.html`, `src/app/app.spec.ts` — datetime demo sections.

## Interfaces (the contract every task shares)

The bridge adapter (Task 1) is the spine. Exact signatures every later task relies on:

```ts
export abstract class NgxDtDateTimeAdapter<DT, D = unknown, T = unknown> {
  abstract now(): DT;
  abstract getDate(value: DT): D;            // date part
  abstract getTime(value: DT): T;            // time part
  abstract combine(date: D, time: T): DT;    // compose
  abstract compareDateTime(a: DT, b: DT): number;
  abstract compareDate(a: DT, b: DT): number; // compares DATE parts only (ignores time)
  abstract isValid(value: DT): boolean;
  abstract invalid(): DT;
  abstract parse(value: unknown): DT | null;
  abstract format(value: DT, options?: Intl.DateTimeFormatOptions): string;
  protected abstract startOfDayTime(): T;     // the "00:00:00" time part

  // concrete (Task 1):
  sameDateTime(a: DT | null, b: DT | null): boolean;
  sameDatePart(a: DT, b: DT): boolean;
  clampDateTime(value: DT, min: DT | null, max: DT | null): DT;
  withDate(value: DT | null, date: D): DT;    // date + value's time (or midnight)
  withTime(value: DT | null, time: T): DT;    // value's date (or today) + time
}
```

---

### Task 1: Core bridge adapter `NgxDtDateTimeAdapter`

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.ts`
- Test: `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.spec.ts`

**Interfaces:**
- Produces: the abstract class + concrete methods listed in "Interfaces" above. Consumed by Tasks 2–7.

- [ ] **Step 1: Write the failing test**

`projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NgxDtDateTimeAdapter } from './ngx-dt-datetime-adapter';

/**
 * Fake adapter: a datetime is "minutes since an epoch" (a single number).
 * date part = whole days; time part = minute-of-day. Lets us exercise the
 * concrete bridge logic without Temporal.
 */
class FakeDateTimeAdapter extends NgxDtDateTimeAdapter<number, number, number> {
  now(): number {
    return 0;
  }
  getDate(v: number): number {
    return Math.floor(v / 1440);
  }
  getTime(v: number): number {
    return ((v % 1440) + 1440) % 1440;
  }
  combine(date: number, time: number): number {
    return date * 1440 + time;
  }
  protected startOfDayTime(): number {
    return 0;
  }
  compareDateTime(a: number, b: number): number {
    return a - b;
  }
  compareDate(a: number, b: number): number {
    return this.getDate(a) - this.getDate(b);
  }
  isValid(v: number): boolean {
    return Number.isFinite(v) && v >= 0;
  }
  invalid(): number {
    return -1;
  }
  parse(v: unknown): number | null {
    return v == null || v === '' ? null : Number(v);
  }
  format(v: number): string {
    return String(v);
  }
}

describe('NgxDtDateTimeAdapter (concrete bridge)', () => {
  const a = new FakeDateTimeAdapter();

  it('sameDateTime is null-tolerant and uses compareDateTime', () => {
    expect(a.sameDateTime(null, null)).toBe(true);
    expect(a.sameDateTime(null, 5)).toBe(false);
    expect(a.sameDateTime(2910, 2910)).toBe(true);
    expect(a.sameDateTime(2910, 2911)).toBe(false);
    // two invalids are equal; valid vs invalid is not
    expect(a.sameDateTime(a.invalid(), a.invalid())).toBe(true);
    expect(a.sameDateTime(a.invalid(), 5)).toBe(false);
  });

  it('sameDatePart compares date parts only', () => {
    expect(a.sameDatePart(a.combine(2, 30), a.combine(2, 59))).toBe(true);
    expect(a.sameDatePart(a.combine(2, 30), a.combine(3, 30))).toBe(false);
  });

  it('clampDateTime clamps to the inclusive window', () => {
    expect(a.clampDateTime(2910, 1440, 4320)).toBe(2910);
    expect(a.clampDateTime(1000, 1440, null)).toBe(1440);
    expect(a.clampDateTime(5000, null, 4320)).toBe(4320);
  });

  it('withDate keeps the value time, or midnight when value is null', () => {
    expect(a.withDate(null, 3)).toBe(a.combine(3, 0)); // midnight
    expect(a.withDate(a.combine(2, 30), 5)).toBe(a.combine(5, 30)); // time carried
  });

  it('withTime keeps the value date, or today() when value is null', () => {
    expect(a.withTime(null, 45)).toBe(a.combine(a.getDate(a.now()), 45));
    expect(a.withTime(a.combine(2, 30), 45)).toBe(a.combine(2, 45)); // date carried
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-adapter.spec`
Expected: FAIL — `Cannot find module './ngx-dt-datetime-adapter'`.

- [ ] **Step 3: Write the implementation**

`projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.ts`:

```ts
/**
 * Bridge abstraction for a combined date+time value `DT` (e.g.
 * `Temporal.PlainDateTime`). The core picker is adapter-agnostic and cannot
 * know how to split a datetime into a calendar date `D` (for `MatCalendar`) and
 * a wall-clock time `T` (for `NgxDtTimePanel`) or how to recombine them — that
 * is exactly what this adapter supplies. Used as its own DI token (mirrors how
 * Material uses the `DateAdapter` abstract class as a token).
 */
export abstract class NgxDtDateTimeAdapter<DT, D = unknown, T = unknown> {
  /** The current wall-clock date+time. */
  abstract now(): DT;

  /** The calendar (date) part of a datetime. */
  abstract getDate(value: DT): D;
  /** The wall-clock (time) part of a datetime. */
  abstract getTime(value: DT): T;
  /** Compose a date part and a time part into a datetime. */
  abstract combine(date: D, time: T): DT;

  /** Negative if `a` < `b`, 0 if equal, positive if `a` > `b` (full datetime). */
  abstract compareDateTime(a: DT, b: DT): number;
  /** Compare the DATE parts only, ignoring time. */
  abstract compareDate(a: DT, b: DT): number;

  /** Whether `value` is a valid instance produced by this adapter. */
  abstract isValid(value: DT): boolean;
  /** A sentinel "invalid" value (mirrors `DateAdapter.invalid()`). */
  abstract invalid(): DT;

  /**
   * Parse user text into a datetime. Returns `null` for empty input and the
   * `invalid()` sentinel for non-empty, unparseable input (Material convention).
   */
  abstract parse(value: unknown): DT | null;

  /** Format a datetime for display. */
  abstract format(value: DT, options?: Intl.DateTimeFormatOptions): string;

  /** The time part representing the start of a day (00:00:00). */
  protected abstract startOfDayTime(): T;

  /**
   * Null-tolerant equality: two `null`s are equal; `null` and a value are not;
   * two invalids are equal. Mirrors `DateAdapter.sameDate`/`NgxDtTimeAdapter.sameTime`.
   */
  sameDateTime(a: DT | null, b: DT | null): boolean {
    if (a == null || b == null) {
      return a == b;
    }
    const aValid = this.isValid(a);
    const bValid = this.isValid(b);
    if (aValid && bValid) {
      return this.compareDateTime(a, b) === 0;
    }
    return aValid === bValid;
  }

  /** Whether two (valid) datetimes fall on the same calendar day. */
  sameDatePart(a: DT, b: DT): boolean {
    return this.compareDate(a, b) === 0;
  }

  /** Clamp `value` into the inclusive `[min, max]` window (nulls = unbounded). */
  clampDateTime(value: DT, min: DT | null, max: DT | null): DT {
    if (min && this.compareDateTime(value, min) < 0) {
      return min;
    }
    if (max && this.compareDateTime(value, max) > 0) {
      return max;
    }
    return value;
  }

  /**
   * Replace the date part of `value`, keeping its time part. When `value` is
   * null/invalid, the time defaults to the start of the day.
   */
  withDate(value: DT | null, date: D): DT {
    const time =
      value != null && this.isValid(value) ? this.getTime(value) : this.startOfDayTime();
    return this.combine(date, time);
  }

  /**
   * Replace the time part of `value`, keeping its date part. When `value` is
   * null/invalid, the date defaults to today.
   */
  withTime(value: DT | null, time: T): DT {
    const date =
      value != null && this.isValid(value) ? this.getDate(value) : this.getDate(this.now());
    return this.combine(date, time);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-adapter.spec`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/datetime/
git commit -m "feat(datetime): NgxDtDateTimeAdapter bridge (decompose/recompose date+time)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `TemporalDateTimeAdapter` + `provideTemporalDateTimeAdapter()`

**Files:**
- Create: `projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.ts`
- Create: `projects/ngx-datetime-picker/temporal/src/provide-temporal-datetime-adapter.ts`
- Test: `projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.spec.ts`

**Interfaces:**
- Consumes: `NgxDtDateTimeAdapter` (Task 1); existing `provideTemporalDateAdapter()` and `provideTemporalTimeAdapter()`; existing `DateAdapter` (Temporal `PlainDate`) and `NgxDtTimeAdapter` (Temporal `PlainTime`) — both available because the provider wires them.
- Produces: `TemporalDateTimeAdapter extends NgxDtDateTimeAdapter<Temporal.PlainDateTime, Temporal.PlainDate, Temporal.PlainTime>` and `provideTemporalDateTimeAdapter(): Provider[]`.

Verified Temporal APIs (`node_modules/temporal-spec/index.d.ts`): `Temporal.Now.plainDateTimeISO()`; `PlainDateTime.toPlainDate()` / `.toPlainTime()` / `.toLocaleString(locale, opts)`; `Temporal.PlainDateTime.from(string, {overflow:'reject'})` and `.compare(a,b)`; `PlainDate.toPlainDateTime(time?)`; `new Temporal.PlainTime(0,0,0)`. `DateAdapter.parse(value, parseFormat)` takes two args (pass `null` as the format — `TemporalDateAdapter` ignores it).

- [ ] **Step 1: Write the failing test**

`projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxDtDateTimeAdapter } from 'ngx-datetime-picker';
import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { TemporalDateTimeAdapter } from './temporal-datetime-adapter';
import { provideTemporalDateTimeAdapter } from './provide-temporal-datetime-adapter';

function adapter(locale = 'en-US'): TemporalDateTimeAdapter {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideTemporalDateTimeAdapter(),
      { provide: MAT_DATE_LOCALE, useValue: locale },
    ],
  });
  return TestBed.inject(NgxDtDateTimeAdapter) as TemporalDateTimeAdapter;
}

describe('TemporalDateTimeAdapter', () => {
  const dt = Temporal.PlainDateTime.from('2026-06-21T14:30:00');

  it('splits and recombines a PlainDateTime losslessly', () => {
    const a = adapter();
    const date = a.getDate(dt);
    const time = a.getTime(dt);
    expect(date).toBeInstanceOf(Temporal.PlainDate);
    expect(time).toBeInstanceOf(Temporal.PlainTime);
    const back = a.combine(date, time);
    expect(a.compareDateTime(back, dt)).toBe(0);
  });

  it('compareDate ignores the time component', () => {
    const a = adapter();
    const morning = Temporal.PlainDateTime.from('2026-06-21T08:00');
    const evening = Temporal.PlainDateTime.from('2026-06-21T20:00');
    expect(a.compareDate(morning, evening)).toBe(0);
    expect(a.compareDateTime(morning, evening)).toBeLessThan(0);
  });

  it('parses ISO datetime strings', () => {
    const a = adapter();
    const v = a.parse('2026-06-21T14:30') as Temporal.PlainDateTime;
    expect(v).toBeInstanceOf(Temporal.PlainDateTime);
    expect(v.hour).toBe(14);
    expect(v.day).toBe(21);
  });

  it('parses locale "date time" by delegating to date+time adapters', () => {
    const a = adapter('en-US'); // MDY + 12h
    const v = a.parse('06/21/2026 2:30 PM') as Temporal.PlainDateTime;
    expect(v).toBeInstanceOf(Temporal.PlainDateTime);
    expect(v.year).toBe(2026);
    expect(v.month).toBe(6);
    expect(v.day).toBe(21);
    expect(v.hour).toBe(14);
    expect(v.minute).toBe(30);
  });

  it('parses a date-only string at the start of day', () => {
    const a = adapter();
    const v = a.parse('2026-06-21') as Temporal.PlainDateTime;
    expect(v.hour).toBe(0);
    expect(v.minute).toBe(0);
  });

  it('returns null for empty, invalid() for garbage', () => {
    const a = adapter();
    expect(a.parse('')).toBeNull();
    expect(a.parse(null)).toBeNull();
    expect(a.isValid(a.parse('nonsense') as Temporal.PlainDateTime)).toBe(false);
  });

  it('withDate carries the time; withTime carries the date', () => {
    const a = adapter();
    const moved = a.withDate(dt, Temporal.PlainDate.from('2026-12-25'));
    expect(moved.month).toBe(12);
    expect(moved.hour).toBe(14);
    expect(moved.minute).toBe(30);
    const retimed = a.withTime(dt, Temporal.PlainTime.from('09:05'));
    expect(retimed.day).toBe(21);
    expect(retimed.hour).toBe(9);
    expect(retimed.minute).toBe(5);
  });

  it('formats with a sensible default and throws on invalid', () => {
    const a = adapter();
    const out = a.format(dt);
    expect(out).toContain('14'); // hour present in en-US 2-digit
    expect(() => a.format(a.invalid())).toThrow();
  });

  it('now() returns a PlainDateTime', () => {
    expect(adapter().now()).toBeInstanceOf(Temporal.PlainDateTime);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --project ngx-datetime-picker -- temporal-datetime-adapter.spec`
Expected: FAIL — cannot find `./temporal-datetime-adapter` / `./provide-temporal-datetime-adapter`.

- [ ] **Step 3: Write the implementation**

`projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxDtDateTimeAdapter, NgxDtTimeAdapter } from 'ngx-datetime-picker';
import { Temporal } from 'temporal-polyfill';

/** Internal sentinel returned by `invalid()`; never an instanceof PlainDateTime. */
const INVALID = {} as Temporal.PlainDateTime;

/** Default display format: locale date + 2-digit hour/minute (no seconds). */
const DEFAULT_FORMAT: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
};

@Injectable()
export class TemporalDateTimeAdapter extends NgxDtDateTimeAdapter<
  Temporal.PlainDateTime,
  Temporal.PlainDate,
  Temporal.PlainTime
> {
  private readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';
  // Reuse the already-tested date/time locale parsers for the locale fallback.
  private readonly dateAdapter = inject<DateAdapter<Temporal.PlainDate>>(DateAdapter);
  private readonly timeAdapter = inject<NgxDtTimeAdapter<Temporal.PlainTime>>(NgxDtTimeAdapter);

  now(): Temporal.PlainDateTime {
    return Temporal.Now.plainDateTimeISO();
  }

  getDate(value: Temporal.PlainDateTime): Temporal.PlainDate {
    return value.toPlainDate();
  }
  getTime(value: Temporal.PlainDateTime): Temporal.PlainTime {
    return value.toPlainTime();
  }
  combine(date: Temporal.PlainDate, time: Temporal.PlainTime): Temporal.PlainDateTime {
    return date.toPlainDateTime(time);
  }
  protected startOfDayTime(): Temporal.PlainTime {
    return new Temporal.PlainTime(0, 0, 0);
  }

  compareDateTime(a: Temporal.PlainDateTime, b: Temporal.PlainDateTime): number {
    return Temporal.PlainDateTime.compare(a, b);
  }
  compareDate(a: Temporal.PlainDateTime, b: Temporal.PlainDateTime): number {
    return Temporal.PlainDate.compare(a.toPlainDate(), b.toPlainDate());
  }

  isValid(value: Temporal.PlainDateTime): boolean {
    return value instanceof Temporal.PlainDateTime;
  }
  invalid(): Temporal.PlainDateTime {
    return INVALID;
  }

  parse(value: unknown): Temporal.PlainDateTime | null {
    if (value == null) return null;
    if (value instanceof Temporal.PlainDateTime) return value;
    if (value instanceof Temporal.PlainDate) return value.toPlainDateTime();
    const str = String(value).trim();
    if (!str) return null;
    // ISO fast path ("2026-06-21T14:30", and lenient space separator).
    try {
      return Temporal.PlainDateTime.from(str, { overflow: 'reject' });
    } catch {
      /* fall through to locale parse */
    }
    return this.parseLocale(str) ?? this.invalid();
  }

  /**
   * Locale fallback: locate a time token (`HH:MM[:SS]` with optional am/pm),
   * delegate it to the time adapter and the remainder to the date adapter.
   * A string with no time token is parsed as a date at the start of the day.
   */
  private parseLocale(str: string): Temporal.PlainDateTime | null {
    const timeMatch = str.match(/\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?m\.?)?/i);
    if (!timeMatch) {
      const dateOnly = this.dateAdapter.parse(str, null);
      return dateOnly && this.dateAdapter.isValid(dateOnly)
        ? this.combine(dateOnly, this.startOfDayTime())
        : null;
    }
    const timeStr = timeMatch[0];
    const dateStr = (
      str.slice(0, timeMatch.index) + str.slice(timeMatch.index! + timeStr.length)
    )
      .replace(/,/g, ' ')
      .trim();
    const date = this.dateAdapter.parse(dateStr, null);
    const time = this.timeAdapter.parse(timeStr);
    if (
      date &&
      this.dateAdapter.isValid(date) &&
      time &&
      this.timeAdapter.isValid(time)
    ) {
      return this.combine(date, time);
    }
    return null;
  }

  format(
    value: Temporal.PlainDateTime,
    options: Intl.DateTimeFormatOptions = DEFAULT_FORMAT,
  ): string {
    if (!this.isValid(value)) {
      throw new Error('TemporalDateTimeAdapter: Cannot format invalid datetime.');
    }
    return value.toLocaleString(this.locale, options);
  }
}
```

`projects/ngx-datetime-picker/temporal/src/provide-temporal-datetime-adapter.ts`:

```ts
import { Provider } from '@angular/core';
import { NgxDtDateTimeAdapter } from 'ngx-datetime-picker';
import { provideTemporalDateAdapter } from './provide-temporal-date-adapter';
import { provideTemporalTimeAdapter } from './provide-temporal-time-adapter';
import { TemporalDateTimeAdapter } from './temporal-datetime-adapter';

/**
 * Wires everything a `type="datetime"` picker needs: the Temporal `PlainDate`
 * `DateAdapter` (for the calendar), the Temporal `PlainTime` `NgxDtTimeAdapter`
 * (for the time panel), and the `PlainDateTime` bridge adapter. One call sets up
 * a datetime-capable app; it also covers date/date-range/time pickers.
 */
export function provideTemporalDateTimeAdapter(): Provider[] {
  return [
    ...provideTemporalDateAdapter(),
    ...provideTemporalTimeAdapter(),
    { provide: NgxDtDateTimeAdapter, useClass: TemporalDateTimeAdapter },
  ];
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --project ngx-datetime-picker -- temporal-datetime-adapter.spec`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.ts \
        projects/ngx-datetime-picker/temporal/src/provide-temporal-datetime-adapter.ts \
        projects/ngx-datetime-picker/temporal/src/temporal-datetime-adapter.spec.ts
git commit -m "feat(temporal): TemporalDateTimeAdapter + provideTemporalDateTimeAdapter

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Picker `type="datetime"` — value bridging (calendar + time panel)

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Consumes: `NgxDtDateTimeAdapter` (Task 1), the existing `NgxDtPickerInput<D>` seam, `NgxDtTimePanel`, `MatCalendar`.
- Produces: `NgxDtPickerType` now includes `'datetime'`; new `protected` computeds `timePanelValue`, `calendarMin`, `calendarMax` and helper `datePart`; `isDateTime` computed; `commitValue` helper; reworked `onSelectedChange`/`onTimeChange`; reworked `#panel` template. (Task 4 adds `timePanelMin`/`timePanelMax`; Task 5 adds the footer handlers.) Until Task 4 lands, the datetime time panel is rendered with `[min]="null"`/`[max]="null"`.

This task wires datetime value flow with **immediate commit** and **no auto-close**. The calendar binds to the value's date part; the time panel binds to its time part; editing one part carries the other.

- [ ] **Step 1: Write the failing tests**

Append to `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`:

```ts
// --- Plan 6: datetime mode -----------------------------------------------

import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';

@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker #picker type="datetime" [inline]="true" [(value)]="value" />
  `,
})
class InlineDateTimeHost {
  value = signal<Temporal.PlainDateTime | null>(null);
}

@Component({
  imports: [NgxDtPicker],
  template: `
    <button #trigger type="button">open</button>
    <ngx-dt-picker #picker type="datetime" [(value)]="value" />
  `,
})
class OverlayDateTimeHost {
  value = signal<Temporal.PlainDateTime | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDateTime>>('picker');
  readonly trigger = viewChild.required<unknown, ElementRef<HTMLButtonElement>>(
    'trigger',
    { read: ElementRef },
  );
}

describe('NgxDtPicker — datetime mode', () => {
  function setupDateTime() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateTimeAdapter(),
      ],
    });
  }
  beforeEach(setupDateTime);

  it('renders BOTH a calendar and a time panel inline', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('mat-calendar')).toBeTruthy();
    expect(root.querySelector('ngx-dt-time-panel')).toBeTruthy();
  });

  it('picking a day with no prior value yields that date at midnight', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const cell: HTMLElement = fixture.nativeElement.querySelector(
      '.mat-calendar-body-cell',
    );
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v).toBeInstanceOf(Temporal.PlainDateTime);
    expect(v.hour).toBe(0);
    expect(v.minute).toBe(0);
  });

  it('carries the time across a date change', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeHost);
    fixture.componentInstance.value.set(
      Temporal.PlainDateTime.from('2026-06-21T09:30'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    // Click a different day in the same (June 2026) view.
    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.mat-calendar-body-cell',
      ),
    );
    cells[24].click(); // 25th of the month
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v.day).toBe(25);
    expect(v.hour).toBe(9);
    expect(v.minute).toBe(30);
  });

  it('carries the date across a time change (stepper)', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeHost);
    fixture.componentInstance.value.set(
      Temporal.PlainDateTime.from('2026-06-21T09:30'),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="up-hour"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v.day).toBe(21);
    expect(v.hour).toBe(10);
    expect(v.minute).toBe(30);
  });

  it('does NOT auto-close on a date pick in overlay datetime mode', async () => {
    const fixture = TestBed.createComponent(OverlayDateTimeHost);
    fixture.detectChanges();
    fixture.componentInstance.picker().open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    const cell = document.querySelector<HTMLElement>(
      '.cdk-overlay-container .mat-calendar-body-cell',
    )!;
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
    expect(fixture.componentInstance.value()).toBeInstanceOf(Temporal.PlainDateTime);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker.spec`
Expected: FAIL — `type="datetime"` renders no time panel / type error on `'datetime'`.

- [ ] **Step 3: Implement the picker datetime branch**

In `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`:

(a) Add the import near the other lib imports:

```ts
import { NgxDtDateTimeAdapter } from '../datetime/ngx-dt-datetime-adapter';
```

(b) Widen the type union:

```ts
/** Picker variants. `date`, `date-range`, `time`, and `datetime` are implemented. */
export type NgxDtPickerType = 'date' | 'date-range' | 'time' | 'datetime';
```

(c) Inject the bridge adapter optionally (next to the existing `adapter`/`injector` injects):

```ts
  private readonly dtAdapter = inject<NgxDtDateTimeAdapter<D>>(NgxDtDateTimeAdapter, {
    optional: true,
  });
```

(d) Add the `isDateTime` computed next to `isTime`:

```ts
  readonly isDateTime = computed(() => this.type() === 'datetime');
```

(e) Add the date-part helper and replace the `calendarSelection`/`effectiveStartAt` computeds. The calendar runs with the `PlainDate` `DateAdapter`, so a date-part value is exactly what its loosely-typed bindings expect — the `as unknown as D` casts bridge the picker's `D` (the whole `PlainDateTime`) to the calendar's date type:

```ts
  /**
   * The date part of a datetime value, cast to `D` for the loosely-typed
   * MatCalendar bindings. (In datetime mode the calendar is backed by the
   * PlainDate DateAdapter, so a date part is what it actually consumes.)
   */
  private datePart(value: D | null): D | null {
    const dt = this.dtAdapter;
    return dt && value != null && dt.isValid(value)
      ? (dt.getDate(value) as unknown as D)
      : null;
  }

  /** What the calendar's `[selected]` binds to — a range, a date, or a date part. */
  protected readonly calendarSelection = computed<DateRange<D> | D | null>(() => {
    if (this.isRange()) {
      return this.rangeDisplayValue() ?? this._emptyRange;
    }
    if (this.isDateTime()) {
      return this.datePart(this.displayValue());
    }
    return this.displayValue();
  });

  /** Calendar `[minDate]`/`[maxDate]` — date parts in datetime mode. */
  protected readonly calendarMin = computed<D | null>(() =>
    this.isDateTime() ? this.datePart(this.min()) : this.min(),
  );
  protected readonly calendarMax = computed<D | null>(() =>
    this.isDateTime() ? this.datePart(this.max()) : this.max(),
  );

  /** Value bound to the time panel — the time part in datetime mode, else the value. */
  protected readonly timePanelValue = computed<D | null>(() => {
    if (this.isDateTime()) {
      const dt = this.dtAdapter;
      const v = this.displayValue();
      return dt && v != null && dt.isValid(v) ? (dt.getTime(v) as unknown as D) : null;
    }
    return this.displayValue();
  });

  protected readonly effectiveStartAt = computed(() => {
    const adapter = this.adapter;
    if (!adapter) {
      return null;
    }
    const anchor = this.isRange()
      ? (this.rangeDisplayValue()?.start ?? null)
      : this.isDateTime()
        ? this.datePart(this.displayValue())
        : this.displayValue();
    const startAt = this.isDateTime() ? this.datePart(this.startAt()) : this.startAt();
    return anchor ?? startAt ?? adapter.today();
  });
```

(NB: the existing `effectiveStartAt` is replaced by the version above; delete the old one.)

(f) Add the shared commit helper and rework the two handlers:

```ts
  /** Write a value through the registered input seam, else the model. */
  private commitValue(value: D | null): void {
    const input = this._input();
    if (input) {
      input.setValueFromPicker(value);
    } else {
      this.value.set(value);
    }
  }

  protected onSelectedChange(date: D | null): void {
    if (this.isRange()) {
      return; // range selection is handled via (_userSelection)
    }
    if (this.isDateTime()) {
      const dt = this.dtAdapter;
      if (!dt) return;
      const next =
        date == null
          ? null
          : dt.clampDateTime(dt.withDate(this.displayValue(), date), this.min(), this.max());
      this.commitValue(next);
      return; // datetime stays open — the time still needs setting
    }
    this.commitValue(date);
    if (!this.inline()) {
      this.close();
    }
  }

  protected onTimeChange(time: D | null): void {
    if (this.isDateTime()) {
      const dt = this.dtAdapter;
      if (!dt) return;
      const next =
        time == null
          ? null
          : dt.clampDateTime(dt.withTime(this.displayValue(), time), this.min(), this.max());
      this.commitValue(next);
      return; // never auto-close
    }
    this.commitValue(time); // pure time mode
  }
```

(g) Replace the `#panel` template (the `<ng-template #panel> … </ng-template>` block) with:

```html
    <ng-template #panel>
      @if (isTime()) {
        <ngx-dt-time-panel
          [value]="timePanelValue()"
          (valueChange)="onTimeChange($event)"
          [min]="timePanelMin()"
          [max]="timePanelMax()"
          [hourCycle]="hourCycle()"
          [minuteStep]="minuteStep()"
          [showSeconds]="showSeconds()"
          [disabled]="disabled()"
          [ariaLabel]="ariaLabel()"
        />
      } @else {
        <div class="ngx-dt-body" [class.ngx-dt-body-datetime]="isDateTime()">
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
          @if (isDateTime()) {
            <ngx-dt-time-panel
              [value]="timePanelValue()"
              (valueChange)="onTimeChange($event)"
              [min]="timePanelMin()"
              [max]="timePanelMax()"
              [hourCycle]="hourCycle()"
              [minuteStep]="minuteStep()"
              [showSeconds]="showSeconds()"
              [disabled]="disabled()"
              ariaLabel="Choose a time"
            />
          }
        </div>
      }
    </ng-template>
```

(h) Add `timePanelMin`/`timePanelMax` as **temporary** stubs so this task compiles (Task 4 replaces them):

```ts
  // Replaced with boundary-aware logic in Task 4.
  protected readonly timePanelMin = computed<D | null>(() =>
    this.isTime() ? this.min() : null,
  );
  protected readonly timePanelMax = computed<D | null>(() =>
    this.isTime() ? this.max() : null,
  );
```

(i) Add the `ngx-dt-body` layout to the component `styles` array (create a `styles` entry if none exists — the picker currently has none, so add `styles: [...]` to the decorator):

```ts
  styles: [
    `
      .ngx-dt-body-datetime {
        display: flex;
        flex-direction: column;
        align-items: stretch;
      }
    `,
  ],
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker.spec`
Expected: PASS — all datetime tests plus the existing date/range/time tests stay green.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/
git commit -m "feat(picker): type=\"datetime\" composes calendar + time panel (immediate commit, no auto-close)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Datetime boundary `min`/`max` on the time panel + clamping

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Consumes: `NgxDtDateTimeAdapter.compareDate`/`getTime`; the Task 3 computeds.
- Produces: real `timePanelMin`/`timePanelMax` (boundary-aware) replacing the Task 3 stubs.

The time panel must constrain times only on the boundary day: when the selected day equals the min's day, the time floor is the min's time; on any later day there is no floor. Symmetrically for max. The handlers already clamp the composed `PlainDateTime` to `[min, max]` (Task 3), so this task adds the **visual/UX** constraint and verifies the **clamp-on-date-change** behavior.

- [ ] **Step 1: Write the failing tests**

The existing datetime hosts have no `min`/`max` inputs, so add a dedicated constrained host near the other datetime hosts in `ngx-dt-picker.spec.ts`:

```ts
@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker
      #picker
      type="datetime"
      [inline]="true"
      [(value)]="value"
      [min]="min()"
      [max]="max()"
    />
  `,
})
class ConstrainedDateTimeHost {
  value = signal<Temporal.PlainDateTime | null>(null);
  min = signal<Temporal.PlainDateTime | null>(null);
  max = signal<Temporal.PlainDateTime | null>(null);
}
```

Then append these three boundary tests inside the `describe('NgxDtPicker — datetime mode', …)` block, using `ConstrainedDateTimeHost`:

```ts
  it('clamps the time to min on the min day', async () => {
    const fixture = TestBed.createComponent(ConstrainedDateTimeHost);
    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-21T14:00'));
    fixture.componentInstance.value.set(Temporal.PlainDateTime.from('2026-06-21T14:30'));
    fixture.detectChanges();
    await fixture.whenStable();
    // 14:30 -> down-hour -> 13:30 -> clamp to 14:00.
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="down-hour"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v.hour).toBe(14);
    expect(v.minute).toBe(0);
  });

  it('does not floor the time on a later day', async () => {
    const fixture = TestBed.createComponent(ConstrainedDateTimeHost);
    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-21T14:00'));
    fixture.componentInstance.value.set(Temporal.PlainDateTime.from('2026-06-22T09:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="down-hour"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v.day).toBe(22);
    expect(v.hour).toBe(8); // freely below 14:00 on a later day
  });

  it('clamps a date change onto the min day up to the min time', async () => {
    const fixture = TestBed.createComponent(ConstrainedDateTimeHost);
    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-21T14:00'));
    fixture.componentInstance.value.set(Temporal.PlainDateTime.from('2026-06-22T09:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    // Click the 21st (min day). 2026-06-21T09:00 < min -> clamp to 2026-06-21T14:00.
    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.mat-calendar-body-cell',
      ),
    );
    cells[20].click(); // 21st
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v.day).toBe(21);
    expect(v.hour).toBe(14);
    expect(v.minute).toBe(0);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker.spec`
Expected: FAIL — "does not floor the time on a later day" passes by luck, but "clamps the time to min on the min day" fails (stub passes `null` min to the panel, so down-hour yields 13:30).

- [ ] **Step 3: Replace the `timePanelMin`/`timePanelMax` stubs**

In `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`, replace the Task 3 stub computeds with:

```ts
  /**
   * Time-panel floor: the min's time, but only on the min's day. On any later
   * day there is no time floor. In pure-time mode the picker `min` is itself a
   * time. (`max` is symmetric.)
   */
  private boundaryTime(bound: D | null): D | null {
    if (!this.isDateTime()) return null;
    const dt = this.dtAdapter;
    const v = this.displayValue();
    if (!dt || bound == null || v == null || !dt.isValid(bound) || !dt.isValid(v)) {
      return null;
    }
    return dt.compareDate(v, bound) === 0 ? (dt.getTime(bound) as unknown as D) : null;
  }

  protected readonly timePanelMin = computed<D | null>(() =>
    this.isTime() ? this.min() : this.boundaryTime(this.min()),
  );
  protected readonly timePanelMax = computed<D | null>(() =>
    this.isTime() ? this.max() : this.boundaryTime(this.max()),
  );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker.spec`
Expected: PASS (all datetime + existing tests).

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/
git commit -m "feat(picker): datetime min/max constrain the time panel on boundary days

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Datetime action footer (Now / Clear / Done)

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Consumes: `commitValue` (Task 3), `NgxDtDateTimeAdapter.now`/`clampDateTime`, `close()`.
- Produces: `onNowClick`/`onClearClick`/`onDoneClick`; footer markup in the datetime template branch.

Immediate-commit footer: **Now** sets the value to the current datetime (clamped) and keeps the panel open; **Clear** sets it to null; **Done** closes the overlay (the value is already committed). **Done** is shown only in overlay mode (inline has nothing to close). True Cancel-revert (draft state) is deferred to the Polish plan.

- [ ] **Step 1: Write the failing tests**

Append inside `describe('NgxDtPicker — datetime mode', …)`:

```ts
  it('Now sets the value to a datetime and keeps the panel open', async () => {
    const fixture = TestBed.createComponent(OverlayDateTimeHost);
    fixture.detectChanges();
    fixture.componentInstance.picker().open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    document
      .querySelector<HTMLButtonElement>('.cdk-overlay-container [data-testid="dt-now"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBeInstanceOf(Temporal.PlainDateTime);
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });

  it('Clear sets the value to null', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeHost);
    fixture.componentInstance.value.set(Temporal.PlainDateTime.from('2026-06-21T09:30'));
    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="dt-clear"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('Done closes the overlay; it is absent inline', async () => {
    const overlay = TestBed.createComponent(OverlayDateTimeHost);
    overlay.detectChanges();
    overlay.componentInstance.picker().open(overlay.componentInstance.trigger());
    overlay.detectChanges();
    await overlay.whenStable();
    const done = document.querySelector<HTMLButtonElement>(
      '.cdk-overlay-container [data-testid="dt-done"]',
    )!;
    expect(done).toBeTruthy();
    done.click();
    overlay.detectChanges();
    await overlay.whenStable();
    expect(overlay.componentInstance.picker().isOpen()).toBe(false);

    const inline = TestBed.createComponent(InlineDateTimeHost);
    inline.detectChanges();
    await inline.whenStable();
    expect(
      (inline.nativeElement as HTMLElement).querySelector('[data-testid="dt-done"]'),
    ).toBeNull();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker.spec`
Expected: FAIL — no `[data-testid="dt-now"]`/`dt-clear`/`dt-done` elements.

- [ ] **Step 3: Implement the footer**

(a) Add the handlers to `NgxDtPicker`:

```ts
  protected onNowClick(): void {
    const dt = this.dtAdapter;
    if (!dt) return;
    this.commitValue(dt.clampDateTime(dt.now(), this.min(), this.max()));
  }

  protected onClearClick(): void {
    this.commitValue(null);
  }

  protected onDoneClick(): void {
    this.close();
  }
```

(b) Add the footer inside the `@if (isDateTime()) { … }` block in the template, right after the `<ngx-dt-time-panel … ariaLabel="Choose a time" />`:

```html
            <div class="ngx-dt-actions" role="group" aria-label="Datetime actions">
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
              @if (!inline()) {
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
```

(c) Extend the component `styles` array (≥24px targets, `--mat-sys-*` theming, visible focus):

```ts
      .ngx-dt-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        padding: 8px;
      }
      .ngx-dt-action {
        min-height: 32px;
        min-width: 48px;
        padding: 4px 12px;
        border: 1px solid var(--mat-sys-outline, currentColor);
        border-radius: 4px;
        background: transparent;
        color: var(--mat-sys-on-surface, inherit);
        font: inherit;
        cursor: pointer;
      }
      .ngx-dt-action:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-action:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 1px;
      }
      .ngx-dt-action[disabled] {
        opacity: 0.38;
        cursor: default;
      }
      .ngx-dt-action-primary {
        background: var(--mat-sys-primary, Highlight);
        color: var(--mat-sys-on-primary, HighlightText);
        border-color: transparent;
      }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker.spec`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/
git commit -m "feat(picker): datetime action footer (Now/Clear/Done, immediate commit)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: `[ngxDtDateTimeInput]` directive (CVA + Validator + forms)

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.ts`
- Test: `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.spec.ts`
- Test: `projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.forms.spec.ts`

**Interfaces:**
- Consumes: `NgxDtDateTimeAdapter` (Task 1), `NgxDtPicker`/`NgxDtPickerInput`/`NgxDtOrigin` seam.
- Produces: `NgxDtDateTimeInput<T>` (`input[ngxDtDateTimeInput]`, exportAs `ngxDtDateTimeInput`), `timeChange`-style output `dateTimeChange`, errors `ngxDtParse`/`ngxDtMin`/`ngxDtMax`.

Mirrors `NgxDtTimeInput` exactly, swapping the time adapter for the datetime adapter and using `compareDateTime` for min/max. Like the time input, it does not register a `dateFilter` validator (the calendar enforces `dateFilter` visually; an input-side `dateFilter` error is deferred to Polish).

- [ ] **Step 1: Write the failing tests**

`projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.spec.ts`:

```ts
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtDateTimeInput } from './ngx-dt-datetime-input';

@Component({
  imports: [NgxDtPicker, NgxDtDateTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtDateTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="datetime" [min]="min()" [max]="max()" />
  `,
})
class Host {
  picker = viewChild.required(NgxDtPicker);
  ctrl = new FormControl<Temporal.PlainDateTime | null>(null);
  min = signal<Temporal.PlainDateTime | null>(null);
  max = signal<Temporal.PlainDateTime | null>(null);
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateTimeAdapter(),
    ],
  });
}

async function render() {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function input(fixture: { nativeElement: HTMLElement }): HTMLInputElement {
  return fixture.nativeElement.querySelector('input')!;
}

describe('NgxDtDateTimeInput', () => {
  beforeEach(setup);

  it('parses typed ISO datetime into a PlainDateTime on the control', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.value = '2026-06-21T14:30';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.ctrl.value!;
    expect(v.day).toBe(21);
    expect(v.hour).toBe(14);
    expect(v.minute).toBe(30);
  });

  it('flags unparseable text with a parse error and null value', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.value = 'nonsense';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.value).toBeNull();
    expect(fixture.componentInstance.ctrl.errors).toEqual({
      ngxDtParse: { text: 'nonsense' },
    });
  });

  it('reports ngxDtMin / ngxDtMax against the picker bounds', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-21T09:00'));
    fixture.componentInstance.max.set(Temporal.PlainDateTime.from('2026-06-21T17:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T08:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMin']).toBeTruthy();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T18:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMax']).toBeTruthy();
  });

  it('setValueFromPicker formats into the field and updates the control', async () => {
    const fixture = await render();
    const dir = fixture.debugElement
      .query(By.directive(NgxDtDateTimeInput))
      .injector.get(NgxDtDateTimeInput);
    dir.setValueFromPicker(Temporal.PlainDateTime.from('2026-06-21T07:05'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(input(fixture).value).toContain('07');
    expect(fixture.componentInstance.ctrl.value!.hour).toBe(7);
  });

  it('Alt+ArrowDown opens the picker', async () => {
    const fixture = await render();
    input(fixture).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });
});
```

`projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.forms.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtDateTimeInput } from './ngx-dt-datetime-input';

@Component({
  imports: [NgxDtPicker, NgxDtDateTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtDateTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="datetime" />
  `,
})
class ReactiveHost {
  ctrl = new FormControl<Temporal.PlainDateTime | null>(null);
}

@Component({
  imports: [NgxDtPicker, NgxDtDateTimeInput, FormsModule],
  template: `
    <input [ngxDtDateTimeInput]="picker" [(ngModel)]="value" />
    <ngx-dt-picker #picker type="datetime" />
  `,
})
class NgModelHost {
  value: Temporal.PlainDateTime | null = null;
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateTimeAdapter(),
    ],
  });
}

describe('NgxDtDateTimeInput — forms', () => {
  beforeEach(setup);

  it('Reactive: writeValue formats the field, typing updates the control', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    fixture.componentInstance.ctrl.setValue(Temporal.PlainDateTime.from('2026-06-21T08:15'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(el.value).toContain('08');

    el.value = '2026-06-21T20:45';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.value!.hour).toBe(20);
  });

  it('ngModel: round-trips a PlainDateTime', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.componentInstance.value = Temporal.PlainDateTime.from('2026-06-21T11:00');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(el.value).toContain('11');

    el.value = '2026-06-21T12:30';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value!.hour).toBe(12);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-input`
Expected: FAIL — cannot find `./ngx-dt-datetime-input`.

- [ ] **Step 3: Write the directive**

`projects/ngx-datetime-picker/src/lib/datetime-input/ngx-dt-datetime-input.ts`:

```ts
import {
  Directive,
  ElementRef,
  effect,
  type OnInit,
  forwardRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import {
  type AbstractControl,
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import {
  NgxDtPicker,
  type NgxDtOrigin,
  type NgxDtPickerInput,
} from '../picker/ngx-dt-picker';
import { NgxDtDateTimeAdapter } from '../datetime/ngx-dt-datetime-adapter';

/**
 * Text-field directive for datetime values: parses/formats via
 * `NgxDtDateTimeAdapter`, owns the value as a `ControlValueAccessor`, and bridges
 * it to a registered `NgxDtPicker` (`type="datetime"`) through the shared
 * `NgxDtPickerInput` seam. Mirrors `NgxDtTimeInput`.
 */
@Directive({
  selector: 'input[ngxDtDateTimeInput]',
  exportAs: 'ngxDtDateTimeInput',
  host: {
    class: 'ngx-dt-datetime-input',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxDtDateTimeInput),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NgxDtDateTimeInput),
      multi: true,
    },
  ],
})
export class NgxDtDateTimeInput<T = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerInput<T>
{
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly adapter = inject<NgxDtDateTimeAdapter<T>>(NgxDtDateTimeAdapter);

  /** The picker this input feeds; bind a template ref: `[ngxDtDateTimeInput]="picker"`. */
  readonly picker = input.required<NgxDtPicker<T>>({ alias: 'ngxDtDateTimeInput' });

  /** Emits whenever the committed datetime changes (typed, parsed, or chosen). */
  readonly dateTimeChange = output<T | null>();

  private readonly _value = signal<T | null>(null);
  /** Current model value (read by the picker). */
  readonly value = this._value.asReadonly();

  protected readonly _disabled = signal(false);

  /** Whether the latest text input parsed to a valid (or empty) datetime. */
  protected _lastValueValid = true;

  protected _onChange: (value: T | null) => void = () => {};
  protected _onTouched: () => void = () => {};
  protected _onValidatorChange: () => void = () => {};

  constructor() {
    // The picker holds min/max; re-run validation when they change.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      this._onValidatorChange();
    });
  }

  ngOnInit(): void {
    this.picker().registerInput(this);
  }

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: T | null): void {
    const v = this._coerce(value);
    this._lastValueValid = true;
    this._value.set(v);
    this._formatToInput(v);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }

  // --- Validator ------------------------------------------------------------

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._lastValueValid) {
      return { ngxDtParse: { text: this.elementRef.nativeElement.value } };
    }
    const value = this._coerce(control.value);
    if (value === null) {
      return null;
    }
    const picker = this.picker();
    const min = picker.min();
    if (min && this.adapter.compareDateTime(min, value) > 0) {
      return { ngxDtMin: { min, actual: value } };
    }
    const max = picker.max();
    if (max && this.adapter.compareDateTime(max, value) < 0) {
      return { ngxDtMax: { max, actual: value } };
    }
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // --- NgxDtPickerInput (picker -> input) -----------------------------------

  setValueFromPicker(value: T | null): void {
    const v = this._coerce(value);
    this._lastValueValid = true;
    this._formatToInput(v);
    if (!this.adapter.sameDateTime(v, this._value())) {
      this._value.set(v);
      this._onChange(v);
      this.dateTimeChange.emit(v);
    }
    this._onTouched();
    this._onValidatorChange();
  }

  getOverlayOrigin(): NgxDtOrigin {
    return this.elementRef;
  }

  // --- host handlers --------------------------------------------------------

  protected _onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const parsed = this.adapter.parse(text);
    this._lastValueValid = parsed === null || this.adapter.isValid(parsed);
    const value = parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
    if (!this.adapter.sameDateTime(value, this._value())) {
      this._value.set(value);
      this._onChange(value);
      this.dateTimeChange.emit(value);
    }
    this._onValidatorChange();
  }

  protected _onBlur(): void {
    if (this._lastValueValid) {
      this._formatToInput(this._value());
    }
    this._onTouched();
  }

  protected _onKeydown(event: KeyboardEvent): void {
    if (event.altKey && event.key === 'ArrowDown' && !this._disabled()) {
      this.picker().open(this.elementRef);
      event.preventDefault();
    }
  }

  /** Coerce a control value to a valid datetime or null (already-`T` or parseable text). */
  private _coerce(value: unknown): T | null {
    if (value == null) {
      return null;
    }
    if (this.adapter.isValid(value as T)) {
      return value as T;
    }
    const parsed = this.adapter.parse(value);
    return parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
  }

  private _formatToInput(value: T | null): void {
    this.elementRef.nativeElement.value =
      value && this.adapter.isValid(value) ? this.adapter.format(value) : '';
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-input`
Expected: PASS (unit + forms specs).

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/datetime-input/
git commit -m "feat(datetime-input): [ngxDtDateTimeInput] CVA + Validator across reactive/ngModel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Public API exports + demo + a11y verification

**Files:**
- Modify: `projects/ngx-datetime-picker/src/public-api.ts`
- Modify: `projects/ngx-datetime-picker/temporal/src/public-api.ts`
- Modify: `src/app/app.config.ts`
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.spec.ts`

**Interfaces:**
- Consumes: all prior tasks.
- Produces: public exports + a working datetime demo. No new library types.

- [ ] **Step 1: Export from the public APIs**

Append to `projects/ngx-datetime-picker/src/public-api.ts`:

```ts
export { NgxDtDateTimeAdapter } from './lib/datetime/ngx-dt-datetime-adapter';
export { NgxDtDateTimeInput } from './lib/datetime-input/ngx-dt-datetime-input';
```

Append to `projects/ngx-datetime-picker/temporal/src/public-api.ts`:

```ts
export { TemporalDateTimeAdapter } from './temporal-datetime-adapter';
export { provideTemporalDateTimeAdapter } from './provide-temporal-datetime-adapter';
```

- [ ] **Step 2: Wire the demo provider**

In `src/app/app.config.ts`, replace the two existing provider calls with the single datetime provider (it also wires date/time, so date/range/time demos keep working). Change the import line:

```ts
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
```

and the providers array entries `provideTemporalDateAdapter(), provideTemporalTimeAdapter(),` to:

```ts
    provideTemporalDateTimeAdapter(),
```

- [ ] **Step 3: Add demo state + import**

In `src/app/app.ts`, add `NgxDtDateTimeInput` to the imports array (alongside `NgxDtTimeInput`) and to the named import from `ngx-datetime-picker`. Add demo state to the `App` class:

```ts
  // Datetime picker
  protected readonly inlineDateTime = signal<Temporal.PlainDateTime | null>(null);
  protected readonly dateTimeCtrl = new FormControl<Temporal.PlainDateTime | null>(null);
```

- [ ] **Step 4: Add demo markup**

Append two sections before the closing `</main>` in `src/app/app.html`:

```html
  <section>
    <h2>Datetime (inline, with seconds)</h2>
    <ngx-dt-picker
      type="datetime"
      [inline]="true"
      [(value)]="inlineDateTime"
      [showSeconds]="true"
    />
    <p>Selected: {{ inlineDateTime()?.toString() ?? 'none' }}</p>
  </section>

  <section>
    <h2>Datetime (popup, Reactive Forms)</h2>
    <mat-form-field>
      <mat-label>Pick a date &amp; time</mat-label>
      <input matInput [ngxDtDateTimeInput]="dtp" [formControl]="dateTimeCtrl" />
      <ngx-dt-toggle matSuffix [for]="dtp" ariaLabel="Open datetime picker" />
    </mat-form-field>
    <ngx-dt-picker #dtp type="datetime" [hourCycle]="12" />
    <p>Datetime: {{ dateTimeCtrl.value?.toString() ?? 'none' }}</p>
  </section>
```

- [ ] **Step 5: Keep the app spec green**

In `src/app/app.spec.ts`, update the TestBed providers to use `provideTemporalDateTimeAdapter()` in place of the date/time provider calls (mirror the `app.config.ts` change). Run:

Run: `npm test`
Expected: app **5/5** green, library **all** green (143 baseline + the new datetime tests).

- [ ] **Step 6: Build the library (entry points resolve)**

Run: `npx ng build ngx-datetime-picker`
Expected: ng-packagr build succeeds; the `ngx-datetime-picker/temporal` entry point resolves `provideTemporalDateTimeAdapter`.

- [ ] **Step 7: Live a11y verification**

Start the dev server (`npm start`), then run a Lighthouse accessibility audit (chrome-devtools `lighthouse_audit`, navigation mode) on `http://localhost:4200`. Interact with the datetime overlay (open via the toggle) and confirm:
- AXE/Lighthouse accessibility category = 100 (the `meta-description` finding is SEO, not a11y — ignore).
- The overlay dialog traps focus; Escape closes and restores focus to the toggle.
- The footer buttons are reachable by keyboard, have visible focus, and ≥24px targets.
- Color contrast holds in both light and dark OS color-schemes (the `body` surface binding added in Plan 5 already covers this).

Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
git add projects/ngx-datetime-picker/src/public-api.ts \
        projects/ngx-datetime-picker/temporal/src/public-api.ts \
        src/app/app.config.ts src/app/app.ts src/app/app.html src/app/app.spec.ts
git commit -m "feat(demo): datetime picker demos + public API exports

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review (against the design doc, Phase 5 — datetime half)

- **Compose calendar + time panel into one `D`:** Tasks 1–3 (bridge adapter + picker datetime branch). ✓
- **Action footer (Now/Clear/Done) + immediate commit:** Task 5. Apply/Cancel *draft-revert* deliberately deferred (user chose immediate-commit); recorded as a Polish deferral. ✓ (scoped)
- **Time carried across date changes (and date across time changes):** Task 3 (`withDate`/`withTime`) + tests. ✓
- **min/max constrain the time panel on boundary dates:** Task 4 (`boundaryTime`) + clamp-on-change tests. ✓
- **Validation (parse/min/max):** Task 6. `dateFilter` input-side error deferred (parity with the time input; calendar enforces it visually). ✓ (scoped)
- **Forms (Reactive + ngModel):** Task 6 forms spec. Signal Forms ride on the CVA (verified live in Plan 3); not separately re-tested here. ✓
- **Tree-shakeable Temporal entry point:** Task 2 `provideTemporalDateTimeAdapter` composes the existing providers; Task 7 builds the library. ✓
- **Out of scope for this plan (next plans):** `datetime-range` (own plan), draft/Apply-Cancel revert, input-side `dateFilter`, `Home`/`End`/`PageUp`/`PageDown` on steppers, `timeFilter` — all deferred to the range plan or Polish.

**Type-consistency check:** `NgxDtDateTimeAdapter` member names (`getDate`/`getTime`/`combine`/`compareDate`/`compareDateTime`/`withDate`/`withTime`/`clampDateTime`/`sameDateTime`/`startOfDayTime`) are identical across the abstract class (Task 1), the Temporal impl (Task 2), and every picker/input call site (Tasks 3–6). Error keys (`ngxDtParse`/`ngxDtMin`/`ngxDtMax`) match the time input. Provider name `provideTemporalDateTimeAdapter` is identical in Tasks 2, 7. Test `data-testid`s (`up-hour`/`down-hour` from the time panel; `dt-now`/`dt-clear`/`dt-done` added in Task 5) are consistent.
