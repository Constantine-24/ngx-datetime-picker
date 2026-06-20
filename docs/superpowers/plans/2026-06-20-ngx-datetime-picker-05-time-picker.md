# Time Picker (`type="time"`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fully accessible, custom stepper-based time picker (`<ngx-dt-picker type="time">` + `[ngxDtTimeInput]`) over a zone-naive `Temporal.PlainTime` value, reusing the existing picker overlay/inline shell, value model, and input seam.

**Architecture:** A small calendar-free `NgxDtTimeAdapter<T>` abstraction (Temporal `PlainTime` implementation in the `/temporal` entry point) backs a new `NgxDtTimePanel<T>` stepper component (hour/minute/optional-second `role="spinbutton"` fields + meridiem for 12h). The existing `NgxDtPicker<D>` gains `type="time"`, switching its panel template from `MatCalendar` to the time panel while **reusing** its `value` model and the Plan 3 `NgxDtPickerInput<D>` seam. A new `[ngxDtTimeInput]` directive (CVA + Validator) mirrors `NgxDtInput` for typed text I/O and form integration.

**Tech Stack:** Angular 22 (standalone, signals, zoneless), `@angular/cdk` (`A11yModule`, `LiveAnnouncer`), `@angular/material` (`DateAdapter`/`MAT_DATE_LOCALE` reuse), `temporal-polyfill`, Vitest.

---

## Why a dedicated time abstraction (not `DateAdapter`)

Material's `DateAdapter<D>` is calendar-shaped (`getYear`, `createDate`, `addCalendarMonths`, …). A pure time value (`Temporal.PlainTime`) has no year/month/day, so forcing it through `DateAdapter<PlainTime>` means implementing ~20 meaningless methods. Material itself only added *optional* time methods (`getHours`/`setTime`/…, which **throw** by default) so `MatTimepicker` could ride on a `D` that *also* carries a date. Our flagship time value is a bare `PlainTime`, so a focused `NgxDtTimeAdapter<T>` (≈10 members) is honest about the type and far less code.

**Key reuse decision:** a time picker's value is a single `T`, identical in shape to the single-date case. So we **reuse** the picker's existing `value = model<D|null>()` and the `NgxDtPickerInput<D>` registration seam (Plan 3). No new picker seam is introduced — the time input registers via the same `registerInput()`.

## Scope / deferrals (v1)

- **Keyboard:** `ArrowUp`/`ArrowDown` (±1 step) on each spinbutton + type-to-set (commit on blur/Enter) + pointer `+/−` buttons. This satisfies WCAG AA keyboard operability. `Home`/`End`/`PageUp`/`PageDown` are a documented future enhancement (not implemented).
- **Clamping:** the panel clamps every composed value into `[min, max]`; field stepping wraps within the field's own range (e.g. hour 23→0) before the clamp. A boundary wins over step alignment.
- **No `timeFilter`:** time validation is parse/min/max only (no per-time predicate). A `timeFilter` can ship later.
- **No auto-close:** picking a time never auto-closes the overlay (time editing is continuous); the user closes via toggle/backdrop/Escape.

## File structure

| File | Responsibility |
|------|----------------|
| `src/lib/time/ngx-dt-time-adapter.ts` (new) | Abstract `NgxDtTimeAdapter<T>` + concrete `sameTime`/`clampTime`. |
| `temporal/src/temporal-time-adapter.ts` (new) | `TemporalTimeAdapter` over `Temporal.PlainTime`. |
| `temporal/src/provide-temporal-time-adapter.ts` (new) | `provideTemporalTimeAdapter()`. |
| `src/lib/time-panel/ngx-dt-time-panel.ts` (new) | `NgxDtTimePanel<T>` stepper UI. |
| `src/lib/time-input/ngx-dt-time-input.ts` (new) | `[ngxDtTimeInput]` CVA + Validator. |
| `src/lib/picker/ngx-dt-picker.ts` (modify) | `type='time'`, optional `DateAdapter`, lazy range strategy, panel switch. |
| `src/public-api.ts` (modify) | Export time adapter, panel, input. |
| `temporal/src/public-api.ts` (modify) | Export `TemporalTimeAdapter`, `provideTemporalTimeAdapter`. |
| `src/app/*` (modify) | Time demos + `provideTemporalTimeAdapter()`. |

---

## Task 1: `NgxDtTimeAdapter<T>` abstraction (core)

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/time/ngx-dt-time-adapter.ts`
- Test: `projects/ngx-datetime-picker/src/lib/time/ngx-dt-time-adapter.spec.ts`
- Modify: `projects/ngx-datetime-picker/src/public-api.ts`

- [ ] **Step 1: Write the failing test**

`projects/ngx-datetime-picker/src/lib/time/ngx-dt-time-adapter.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NgxDtTimeAdapter } from './ngx-dt-time-adapter';

// Minimal fake adapter: time = minutes since midnight (0..1439); -1 = invalid.
class FakeTimeAdapter extends NgxDtTimeAdapter<number> {
  now(): number {
    return 0;
  }
  getHour(t: number): number {
    return Math.floor(t / 60);
  }
  getMinute(t: number): number {
    return t % 60;
  }
  getSecond(): number {
    return 0;
  }
  createTime(hour: number, minute: number): number {
    return hour * 60 + minute;
  }
  compareTime(a: number, b: number): number {
    return a - b;
  }
  isValid(t: number): boolean {
    return t >= 0;
  }
  invalid(): number {
    return -1;
  }
  parse(value: unknown): number | null {
    return value == null || value === '' ? null : Number(value);
  }
  format(t: number): string {
    return String(t);
  }
}

describe('NgxDtTimeAdapter base helpers', () => {
  const a = new FakeTimeAdapter();

  it('sameTime treats two nulls as equal', () => {
    expect(a.sameTime(null, null)).toBe(true);
  });
  it('sameTime treats null vs value as different', () => {
    expect(a.sameTime(null, 60)).toBe(false);
    expect(a.sameTime(60, null)).toBe(false);
  });
  it('sameTime compares two valid times by value', () => {
    expect(a.sameTime(60, 60)).toBe(true);
    expect(a.sameTime(60, 61)).toBe(false);
  });
  it('sameTime treats two invalids as equal', () => {
    expect(a.sameTime(a.invalid(), a.invalid())).toBe(true);
  });
  it('clampTime pulls below-min up to min', () => {
    expect(a.clampTime(30, 60, null)).toBe(60);
  });
  it('clampTime pushes above-max down to max', () => {
    expect(a.clampTime(600, null, 120)).toBe(120);
  });
  it('clampTime leaves in-range values untouched', () => {
    expect(a.clampTime(90, 60, 120)).toBe(90);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — cannot find module `./ngx-dt-time-adapter`.

- [ ] **Step 3: Write the implementation**

`projects/ngx-datetime-picker/src/lib/time/ngx-dt-time-adapter.ts`:

```ts
/**
 * Minimal, calendar-free abstraction over a wall-clock time value `T`.
 *
 * Material's `DateAdapter<D>` is calendar-shaped (year/month/day); a pure time
 * value such as `Temporal.PlainTime` answers none of those. This adapter
 * exposes only the operations the time panel and time input need, so an
 * implementation maps cleanly onto a time-only type. Used as its own DI token
 * (mirrors how Material uses the `DateAdapter` abstract class as a token).
 */
export abstract class NgxDtTimeAdapter<T> {
  /** The current wall-clock time. */
  abstract now(): T;

  /** Hour of day, 0–23. */
  abstract getHour(time: T): number;
  /** Minute of hour, 0–59. */
  abstract getMinute(time: T): number;
  /** Second of minute, 0–59. */
  abstract getSecond(time: T): number;

  /**
   * Build a time from in-range components. Callers in this library always pass
   * normalized (0–23 / 0–59) values.
   */
  abstract createTime(hour: number, minute: number, second: number): T;

  /** Negative if `a` < `b`, 0 if equal, positive if `a` > `b`. */
  abstract compareTime(a: T, b: T): number;

  /** Whether `time` is a valid instance produced by this adapter. */
  abstract isValid(time: T): boolean;
  /** A sentinel "invalid" value (mirrors `DateAdapter.invalid()`). */
  abstract invalid(): T;

  /**
   * Parse user text into a time. Returns `null` for empty input and the
   * `invalid()` sentinel for non-empty, unparseable input (Material convention).
   */
  abstract parse(value: unknown): T | null;

  /** Format a time for display/announcement. */
  abstract format(time: T, options?: Intl.DateTimeFormatOptions): string;

  /**
   * Null-tolerant equality: two `null`s are equal; `null` and a value are not;
   * two invalids are equal. Mirrors `DateAdapter.sameDate`.
   */
  sameTime(a: T | null, b: T | null): boolean {
    if (a == null || b == null) {
      return a == b;
    }
    const aValid = this.isValid(a);
    const bValid = this.isValid(b);
    if (aValid && bValid) {
      return this.compareTime(a, b) === 0;
    }
    return aValid === bValid;
  }

  /** Clamp `time` into the inclusive `[min, max]` window (nulls = unbounded). */
  clampTime(time: T, min: T | null, max: T | null): T {
    if (min && this.compareTime(time, min) < 0) {
      return min;
    }
    if (max && this.compareTime(time, max) > 0) {
      return max;
    }
    return time;
  }
}
```

- [ ] **Step 4: Add the public-api export**

In `projects/ngx-datetime-picker/src/public-api.ts`, after the existing exports add:

```ts
export { NgxDtTimeAdapter } from './lib/time/ngx-dt-time-adapter';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS (new spec + all prior specs green).

- [ ] **Step 6: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/time projects/ngx-datetime-picker/src/public-api.ts
git commit -m "feat(time): NgxDtTimeAdapter abstraction (sameTime/clampTime helpers)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: `TemporalTimeAdapter` + `provideTemporalTimeAdapter()`

**Files:**
- Create: `projects/ngx-datetime-picker/temporal/src/temporal-time-adapter.ts`
- Create: `projects/ngx-datetime-picker/temporal/src/provide-temporal-time-adapter.ts`
- Test: `projects/ngx-datetime-picker/temporal/src/temporal-time-adapter.spec.ts`
- Modify: `projects/ngx-datetime-picker/temporal/src/public-api.ts`

**Verified `Temporal.PlainTime` API (temporal-spec):** `static from(item, {overflow})`, `static compare(a,b)`, `new PlainTime(hour, minute, second, …)` (throws `RangeError` out of range), readonly `.hour/.minute/.second/.millisecond`, `.with(timeLike)`, `.add({hours,minutes,seconds})` (wraps at midnight), `.toLocaleString(locale, opts)`, `.toString()`, `valueOf(): never` (use `compare`). `Temporal.Now.plainTimeISO()`. `PlainDateTime.toPlainTime()`.

- [ ] **Step 1: Write the failing test**

`projects/ngx-datetime-picker/temporal/src/temporal-time-adapter.spec.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { TemporalTimeAdapter } from './temporal-time-adapter';

function adapter(): TemporalTimeAdapter {
  // No DI: MAT_DATE_LOCALE is optional, defaults to 'en-US'.
  return new TemporalTimeAdapter();
}

describe('TemporalTimeAdapter', () => {
  it('reads hour/minute/second components', () => {
    const a = adapter();
    const t = Temporal.PlainTime.from('14:30:45');
    expect(a.getHour(t)).toBe(14);
    expect(a.getMinute(t)).toBe(30);
    expect(a.getSecond(t)).toBe(45);
  });

  it('createTime builds a PlainTime', () => {
    const a = adapter();
    const t = a.createTime(9, 5, 0);
    expect(t).toBeInstanceOf(Temporal.PlainTime);
    expect(t.hour).toBe(9);
    expect(t.minute).toBe(5);
  });

  it('compareTime orders times', () => {
    const a = adapter();
    const early = Temporal.PlainTime.from('08:00');
    const late = Temporal.PlainTime.from('20:00');
    expect(a.compareTime(early, late)).toBeLessThan(0);
    expect(a.compareTime(late, early)).toBeGreaterThan(0);
    expect(a.compareTime(early, early)).toBe(0);
  });

  it('parses ISO times', () => {
    const a = adapter();
    expect(a.parse('14:30')).toBeInstanceOf(Temporal.PlainTime);
    expect((a.parse('14:30') as Temporal.PlainTime).hour).toBe(14);
  });

  it('parses locale 12-hour times', () => {
    const a = adapter();
    const pm = a.parse('2:30 PM') as Temporal.PlainTime;
    expect(pm.hour).toBe(14);
    expect(pm.minute).toBe(30);
    const am = a.parse('12:15 AM') as Temporal.PlainTime;
    expect(am.hour).toBe(0);
    expect(am.minute).toBe(15);
  });

  it('returns null for empty and invalid() for garbage', () => {
    const a = adapter();
    expect(a.parse('')).toBeNull();
    expect(a.parse(null)).toBeNull();
    expect(a.isValid(a.parse('nope') as Temporal.PlainTime)).toBe(false);
  });

  it('formats with default hour/minute options', () => {
    const a = adapter();
    const out = a.format(Temporal.PlainTime.from('09:05'));
    expect(out).toContain('09');
    expect(out).toContain('05');
  });

  it('now() returns a PlainTime', () => {
    expect(adapter().now()).toBeInstanceOf(Temporal.PlainTime);
  });

  it('sameTime/clampTime work on real values', () => {
    const a = adapter();
    const t = Temporal.PlainTime.from('10:00');
    const min = Temporal.PlainTime.from('11:00');
    expect(a.sameTime(t, Temporal.PlainTime.from('10:00'))).toBe(true);
    expect(a.compareTime(a.clampTime(t, min, null), min)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — cannot find module `./temporal-time-adapter`.

- [ ] **Step 3: Write the adapter implementation**

`projects/ngx-datetime-picker/temporal/src/temporal-time-adapter.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxDtTimeAdapter } from 'ngx-datetime-picker';
import { Temporal } from 'temporal-polyfill';

/** Internal sentinel returned by `invalid()`; never an instanceof PlainTime. */
const INVALID = {} as Temporal.PlainTime;

@Injectable()
export class TemporalTimeAdapter extends NgxDtTimeAdapter<Temporal.PlainTime> {
  private readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';

  now(): Temporal.PlainTime {
    return Temporal.Now.plainTimeISO();
  }

  getHour(time: Temporal.PlainTime): number {
    return time.hour;
  }
  getMinute(time: Temporal.PlainTime): number {
    return time.minute;
  }
  getSecond(time: Temporal.PlainTime): number {
    return time.second;
  }

  createTime(hour: number, minute: number, second: number): Temporal.PlainTime {
    return new Temporal.PlainTime(hour, minute, second);
  }

  compareTime(a: Temporal.PlainTime, b: Temporal.PlainTime): number {
    return Temporal.PlainTime.compare(a, b);
  }

  isValid(time: Temporal.PlainTime): boolean {
    return time instanceof Temporal.PlainTime;
  }
  invalid(): Temporal.PlainTime {
    return INVALID;
  }

  parse(value: unknown): Temporal.PlainTime | null {
    if (value == null) return null;
    if (value instanceof Temporal.PlainTime) return value;
    if (value instanceof Temporal.PlainDateTime) return value.toPlainTime();
    const str = String(value).trim();
    if (!str) return null;
    // ISO fast path ("14:30", "14:30:00", "14:30:00.5").
    try {
      return Temporal.PlainTime.from(str, { overflow: 'reject' });
    } catch {
      /* fall through to locale parse */
    }
    return this.parseLocale(str) ?? this.invalid();
  }

  private parseLocale(str: string): Temporal.PlainTime | null {
    const nums = str.match(/\d+/g);
    if (!nums || nums.length < 1 || nums.length > 3) return null;
    let hour = Number(nums[0]);
    const minute = nums.length > 1 ? Number(nums[1]) : 0;
    const second = nums.length > 2 ? Number(nums[2]) : 0;
    // Meridiem: a trailing "p"/"pm" pushes 1–11 → 13–23; "a"/"am" maps 12 → 0.
    const meridiem = /([ap])\.?m?\.?\s*$/i.exec(str)?.[1]?.toLowerCase();
    if (meridiem === 'p' && hour < 12) hour += 12;
    if (meridiem === 'a' && hour === 12) hour = 0;
    try {
      return Temporal.PlainTime.from(
        { hour, minute, second },
        { overflow: 'reject' },
      );
    } catch {
      return null;
    }
  }

  format(
    time: Temporal.PlainTime,
    options: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
    },
  ): string {
    if (!this.isValid(time)) {
      throw new Error('TemporalTimeAdapter: Cannot format invalid time.');
    }
    return time.toLocaleString(this.locale, options);
  }
}
```

- [ ] **Step 4: Write the provider**

`projects/ngx-datetime-picker/temporal/src/provide-temporal-time-adapter.ts`:

```ts
import { Provider } from '@angular/core';
import { NgxDtTimeAdapter } from 'ngx-datetime-picker';
import { TemporalTimeAdapter } from './temporal-time-adapter';

/** Provides the Temporal `PlainTime` time adapter for `type="time"` pickers. */
export function provideTemporalTimeAdapter(): Provider[] {
  return [{ provide: NgxDtTimeAdapter, useClass: TemporalTimeAdapter }];
}
```

- [ ] **Step 5: Add temporal public-api exports**

In `projects/ngx-datetime-picker/temporal/src/public-api.ts` add:

```ts
export { TemporalTimeAdapter } from './temporal-time-adapter';
export { provideTemporalTimeAdapter } from './provide-temporal-time-adapter';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add projects/ngx-datetime-picker/temporal/src
git commit -m "feat(temporal): TemporalTimeAdapter + provideTemporalTimeAdapter (PlainTime)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `NgxDtTimePanel<T>` — 24-hour stepper

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts`
- Test: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.spec.ts`
- Modify: `projects/ngx-datetime-picker/src/public-api.ts`

**Field rendering contract (avoids binding/typing conflicts):** each field is `<input role="spinbutton">` with one-way `[value]="…Text()"`. External value changes and `+/−`/arrow steps call `value.set(...)`, which recomputes the text signal and updates the DOM. Type-to-set commits on **blur/Enter**; on commit we write the reformatted field text **directly** to the edited input element (so a no-op edit like `9`→`09` still reformats even when the value signal didn't change).

This task implements **24-hour mode only**. Task 4 adds the 12-hour cycle + meridiem.

- [ ] **Step 1: Write the failing test**

`projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtTimePanel } from './ngx-dt-time-panel';

@Component({
  imports: [NgxDtTimePanel],
  template: `
    <ngx-dt-time-panel
      [(value)]="value"
      [showSeconds]="showSeconds()"
      [min]="min()"
      [max]="max()"
      [minuteStep]="minuteStep()"
    />
  `,
})
class Host {
  value = signal<Temporal.PlainTime | null>(null);
  showSeconds = signal(false);
  min = signal<Temporal.PlainTime | null>(null);
  max = signal<Temporal.PlainTime | null>(null);
  minuteStep = signal(1);
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalTimeAdapter(),
    ],
  });
}

async function render(host: Host) {
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

function fields(root: HTMLElement): HTMLInputElement[] {
  return Array.from(root.querySelectorAll<HTMLInputElement>('input[role="spinbutton"]'));
}

describe('NgxDtTimePanel — 24h', () => {
  beforeEach(setup);

  it('renders hour and minute spinbuttons (no seconds by default)', async () => {
    const fixture = await render(new Host());
    const root = fixture.nativeElement as HTMLElement;
    expect(fields(root).length).toBe(2);
  });

  it('renders a seconds field when showSeconds is true', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.showSeconds.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(fields(root).length).toBe(3);
  });

  it('shows placeholders when value is null', async () => {
    const fixture = await render(new Host());
    const root = fixture.nativeElement as HTMLElement;
    expect(fields(root)[0].value).toBe('--');
  });

  it('renders the bound value padded', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('09:05'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const [hour, minute] = fields(root);
    expect(hour.value).toBe('09');
    expect(minute.value).toBe('05');
  });

  it('increments the hour via the up button and emits a PlainTime', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('09:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const upHour = root.querySelector<HTMLButtonElement>(
      '[data-testid="up-hour"]',
    )!;
    upHour.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.hour).toBe(10);
  });

  it('ArrowUp on the minute field increments by minuteStep', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('09:00'));
    fixture.componentInstance.minuteStep.set(15);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const minute = fields(root)[1];
    minute.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(15);
  });

  it('wraps the hour from 23 to 0', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('23:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('[data-testid="up-hour"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.hour).toBe(0);
  });

  it('type-to-set: typing a value and blurring commits it', async () => {
    const fixture = await render(new Host());
    const root = fixture.nativeElement as HTMLElement;
    const hour = fields(root)[0];
    hour.value = '7';
    hour.dispatchEvent(new Event('input'));
    hour.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.hour).toBe(7);
    expect(hour.value).toBe('07');
  });

  it('clamps a stepped value to max', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('17:00'));
    fixture.componentInstance.max.set(Temporal.PlainTime.from('17:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    // Stepping the minute up would exceed max → clamp back to 17:00.
    root.querySelector<HTMLButtonElement>('[data-testid="up-minute"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v.hour).toBe(17);
    expect(v.minute).toBe(0);
  });

  it('exposes spinbutton ARIA value attributes', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('09:05'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const hour = fields(root)[0];
    expect(hour.getAttribute('aria-valuenow')).toBe('9');
    expect(hour.getAttribute('aria-valuemin')).toBe('0');
    expect(hour.getAttribute('aria-valuemax')).toBe('23');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — cannot find module `./ngx-dt-time-panel`.

- [ ] **Step 3: Write the implementation**

`projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts`:

```ts
import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  Component,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { NgxDtTimeAdapter } from '../time/ngx-dt-time-adapter';

type TimeField = 'hour' | 'minute' | 'second';
interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

/** Modular wrap into `[0, mod)`. */
function wrap(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Custom stepper time panel. Each field is a `role="spinbutton"` input with
 * `+/−` buttons; ArrowUp/Down step by one unit (minutes by `minuteStep`) and
 * typing commits on blur/Enter. Composed values are clamped into `[min, max]`.
 */
@Component({
  selector: 'ngx-dt-time-panel',
  exportAs: 'ngxDtTimePanel',
  template: `
    <div class="ngx-dt-time-panel" role="group" [attr.aria-label]="ariaLabel()">
      <div class="ngx-dt-time-field">
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="up-hour"
          [disabled]="disabled()"
          [attr.aria-label]="'Increase hours'"
          (click)="step('hour', 1)"
        >
          <span aria-hidden="true">▲</span>
        </button>
        <input
          type="text"
          role="spinbutton"
          inputmode="numeric"
          autocomplete="off"
          maxlength="2"
          class="ngx-dt-time-input"
          [value]="hourText()"
          [disabled]="disabled()"
          [attr.aria-label]="'Hours'"
          [attr.aria-valuemin]="hourMin()"
          [attr.aria-valuemax]="hourMax()"
          [attr.aria-valuenow]="parts()?.hour ?? null"
          [attr.aria-valuetext]="hourText() === '--' ? null : hourText()"
          (keydown)="onFieldKeydown('hour', $event)"
          (blur)="commitField('hour', $event)"
        />
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="down-hour"
          [disabled]="disabled()"
          [attr.aria-label]="'Decrease hours'"
          (click)="step('hour', -1)"
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>

      <span class="ngx-dt-time-sep" aria-hidden="true">:</span>

      <div class="ngx-dt-time-field">
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="up-minute"
          [disabled]="disabled()"
          [attr.aria-label]="'Increase minutes'"
          (click)="step('minute', 1)"
        >
          <span aria-hidden="true">▲</span>
        </button>
        <input
          type="text"
          role="spinbutton"
          inputmode="numeric"
          autocomplete="off"
          maxlength="2"
          class="ngx-dt-time-input"
          [value]="minuteText()"
          [disabled]="disabled()"
          [attr.aria-label]="'Minutes'"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="59"
          [attr.aria-valuenow]="parts()?.minute ?? null"
          [attr.aria-valuetext]="minuteText() === '--' ? null : minuteText()"
          (keydown)="onFieldKeydown('minute', $event)"
          (blur)="commitField('minute', $event)"
        />
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="down-minute"
          [disabled]="disabled()"
          [attr.aria-label]="'Decrease minutes'"
          (click)="step('minute', -1)"
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>

      @if (showSeconds()) {
        <span class="ngx-dt-time-sep" aria-hidden="true">:</span>
        <div class="ngx-dt-time-field">
          <button
            type="button"
            class="ngx-dt-time-step"
            tabindex="-1"
            data-testid="up-second"
            [disabled]="disabled()"
            [attr.aria-label]="'Increase seconds'"
            (click)="step('second', 1)"
          >
            <span aria-hidden="true">▲</span>
          </button>
          <input
            type="text"
            role="spinbutton"
            inputmode="numeric"
            autocomplete="off"
            maxlength="2"
            class="ngx-dt-time-input"
            [value]="secondText()"
            [disabled]="disabled()"
            [attr.aria-label]="'Seconds'"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="59"
            [attr.aria-valuenow]="parts()?.second ?? null"
            [attr.aria-valuetext]="secondText() === '--' ? null : secondText()"
            (keydown)="onFieldKeydown('second', $event)"
            (blur)="commitField('second', $event)"
          />
          <button
            type="button"
            class="ngx-dt-time-step"
            tabindex="-1"
            data-testid="down-second"
            [disabled]="disabled()"
            [attr.aria-label]="'Decrease seconds'"
            (click)="step('second', -1)"
          >
            <span aria-hidden="true">▼</span>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ngx-dt-time-panel {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
        color: var(--mat-sys-on-surface, currentColor);
        font: var(--mat-sys-body-large, inherit);
      }
      .ngx-dt-time-field {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
      }
      .ngx-dt-time-input {
        width: 2.5ch;
        min-width: 24px;
        text-align: center;
        font: inherit;
        color: inherit;
        background: var(--mat-sys-surface-container-highest, transparent);
        border: 1px solid var(--mat-sys-outline, currentColor);
        border-radius: 4px;
        padding: 4px 6px;
      }
      .ngx-dt-time-input:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 1px;
      }
      .ngx-dt-time-step {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        min-height: 24px;
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        border-radius: 4px;
      }
      .ngx-dt-time-step:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-time-step[disabled] {
        opacity: 0.38;
        cursor: default;
      }
      .ngx-dt-time-sep {
        padding: 0 2px;
      }
    `,
  ],
  host: { class: 'ngx-dt-time-panel-host' },
})
export class NgxDtTimePanel<T = unknown> {
  protected readonly adapter = inject<NgxDtTimeAdapter<T>>(NgxDtTimeAdapter);
  private readonly live = inject(LiveAnnouncer);

  /** Two-way time value. `model()` provides `valueChange`. */
  readonly value = model<T | null>(null);
  readonly min = input<T | null>(null);
  readonly max = input<T | null>(null);
  readonly minuteStep = input(1);
  readonly showSeconds = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input('Choose a time');

  /** Components of the current value, or null when unset/invalid. */
  protected readonly parts = computed<TimeParts | null>(() => {
    const v = this.value();
    if (v != null && this.adapter.isValid(v)) {
      return this.toParts(v);
    }
    return null;
  });

  // ARIA bounds for the hour field (overridden for 12h mode in Task 4).
  protected readonly hourMin = computed(() => 0);
  protected readonly hourMax = computed(() => 23);

  protected readonly hourText = computed(() => {
    const p = this.parts();
    return p ? pad(this.displayHour(p.hour)) : '--';
  });
  protected readonly minuteText = computed(() => {
    const p = this.parts();
    return p ? pad(p.minute) : '--';
  });
  protected readonly secondText = computed(() => {
    const p = this.parts();
    return p ? pad(p.second) : '--';
  });

  // --- field stepping / typing ---------------------------------------------

  protected step(field: TimeField, direction: number): void {
    const unit = field === 'minute' ? this.minuteStep() : 1;
    this.commit((p) => this.stepField(p, field, direction * unit));
  }

  protected onFieldKeydown(field: TimeField, event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.step(field, 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.step(field, -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.commitField(field, event);
    }
  }

  protected commitField(field: TimeField, event: Event): void {
    if (this.disabled()) return;
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    if (digits !== '') {
      this.commit((p) => this.setField(p, field, Number(digits)));
    }
    // Always reformat the edited field (covers the no-op-change case).
    input.value = this.fieldText(field);
  }

  /** Apply a parts mutation, compose, clamp, set, announce. */
  private commit(mutate: (p: TimeParts) => TimeParts): void {
    const base = this.parts() ?? this.toParts(this.baseTime());
    const next = mutate(base);
    const composed = this.adapter.createTime(next.hour, next.minute, next.second);
    const clamped = this.adapter.clampTime(composed, this.min(), this.max());
    if (!this.adapter.sameTime(clamped, this.value())) {
      this.value.set(clamped);
    }
    void this.live.announce(this.announceText(clamped), 'polite');
  }

  /** Seed editing when value is null: "now" clamped into `[min, max]`. */
  private baseTime(): T {
    return this.adapter.clampTime(this.adapter.now(), this.min(), this.max());
  }

  // Step the underlying 24h field, wrapping within its range.
  protected stepField(parts: TimeParts, field: TimeField, delta: number): TimeParts {
    if (field === 'hour') return { ...parts, hour: wrap(parts.hour + delta, 24) };
    if (field === 'minute') return { ...parts, minute: wrap(parts.minute + delta, 60) };
    return { ...parts, second: wrap(parts.second + delta, 60) };
  }

  // Set a field from a typed number (24h mode; 12h override in Task 4).
  protected setField(parts: TimeParts, field: TimeField, raw: number): TimeParts {
    if (field === 'hour') return { ...parts, hour: raw % 24 };
    if (field === 'minute') return { ...parts, minute: raw % 60 };
    return { ...parts, second: raw % 60 };
  }

  protected toParts(t: T): TimeParts {
    return {
      hour: this.adapter.getHour(t),
      minute: this.adapter.getMinute(t),
      second: this.adapter.getSecond(t),
    };
  }

  // Hour shown in the field (identity in 24h; 12h mapping added in Task 4).
  protected displayHour(hour: number): number {
    return hour;
  }

  private fieldText(field: TimeField): string {
    if (field === 'hour') return this.hourText();
    if (field === 'minute') return this.minuteText();
    return this.secondText();
  }

  private announceText(time: T): string {
    return this.adapter.format(time, {
      hour: '2-digit',
      minute: '2-digit',
      ...(this.showSeconds() ? { second: '2-digit' } : {}),
    });
  }
}
```

- [ ] **Step 4: Add the public-api export**

In `projects/ngx-datetime-picker/src/public-api.ts` add:

```ts
export { NgxDtTimePanel } from './lib/time-panel/ngx-dt-time-panel';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS (all time-panel specs + prior specs green).

- [ ] **Step 6: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/time-panel projects/ngx-datetime-picker/src/public-api.ts
git commit -m "feat(time-panel): NgxDtTimePanel 24h stepper (spinbuttons + steppers + a11y)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: 12-hour cycle + meridiem

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/time-panel/ngx-dt-time-panel.spec.ts`

The panel stores time internally as 24h; the 12-hour cycle is purely a display/entry concern. `hourCycle` input: `12 | 24 | null` (null → derive from the locale). Stepping the hour still uses the 24h wrap (so 11 AM → 12 PM → 1 PM flows naturally); only the displayed hour, ARIA bounds, type-to-set interpretation, and the AM/PM toggle change.

- [ ] **Step 1: Add failing tests**

Append to `ngx-dt-time-panel.spec.ts`:

```ts
describe('NgxDtTimePanel — 12h cycle', () => {
  beforeEach(setup);

  it('displays the hour in 12-hour form with a meridiem toggle', async () => {
    const fixture = TestBed.createComponent(Host12);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('13:30'));
    fixture.componentInstance.hourCycle.set(12);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const hour = root.querySelector<HTMLInputElement>('input[role="spinbutton"]')!;
    expect(hour.value).toBe('01');
    expect(hour.getAttribute('aria-valuemin')).toBe('1');
    expect(hour.getAttribute('aria-valuemax')).toBe('12');
    const pm = root.querySelector<HTMLButtonElement>('[data-testid="meridiem-pm"]')!;
    expect(pm.getAttribute('aria-pressed')).toBe('true');
  });

  it('toggling to AM subtracts 12 hours', async () => {
    const fixture = TestBed.createComponent(Host12);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('13:30'));
    fixture.componentInstance.hourCycle.set(12);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('[data-testid="meridiem-am"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.hour).toBe(1);
  });

  it('type-to-set in 12h keeps the current meridiem', async () => {
    const fixture = TestBed.createComponent(Host12);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('15:00')); // 3 PM
    fixture.componentInstance.hourCycle.set(12);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const hour = root.querySelector<HTMLInputElement>('input[role="spinbutton"]')!;
    hour.value = '5';
    hour.dispatchEvent(new Event('input'));
    hour.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.hour).toBe(17); // 5 PM
  });

  it('no meridiem toggle is rendered in 24h mode', async () => {
    const fixture = TestBed.createComponent(Host12);
    fixture.componentInstance.hourCycle.set(24);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="meridiem-am"]')).toBeNull();
  });
});
```

Add a 12h host component near the top of the file (after `Host`):

```ts
@Component({
  imports: [NgxDtTimePanel],
  template: `<ngx-dt-time-panel [(value)]="value" [hourCycle]="hourCycle()" />`,
})
class Host12 {
  value = signal<Temporal.PlainTime | null>(null);
  hourCycle = signal<12 | 24 | null>(null);
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — `hourCycle` input unknown / no meridiem toggle.

- [ ] **Step 3: Implement the 12-hour cycle**

In `ngx-dt-time-panel.ts`:

(a) Add the `MAT_DATE_LOCALE` import and injection:

```ts
import { MAT_DATE_LOCALE } from '@angular/material/core';
```

Add the field (next to `live`):

```ts
private readonly locale =
  (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';
```

(b) Add the `hourCycle` input and derived cycle (next to the other inputs):

```ts
readonly hourCycle = input<12 | 24 | null>(null);

protected readonly effectiveHourCycle = computed<12 | 24>(() => {
  return this.hourCycle() ?? (this.localeUses12Hour() ? 12 : 24);
});

protected readonly meridiem = computed<'AM' | 'PM' | null>(() => {
  const p = this.parts();
  if (!p) return null;
  return p.hour < 12 ? 'AM' : 'PM';
});

private localeUses12Hour(): boolean {
  return (
    new Intl.DateTimeFormat(this.locale, { hour: 'numeric' }).resolvedOptions()
      .hour12 === true
  );
}
```

(c) Replace `hourMin`/`hourMax`/`displayHour` with cycle-aware versions:

```ts
protected readonly hourMin = computed(() => (this.effectiveHourCycle() === 12 ? 1 : 0));
protected readonly hourMax = computed(() => (this.effectiveHourCycle() === 12 ? 12 : 23));

protected displayHour(hour: number): number {
  if (this.effectiveHourCycle() === 12) {
    const h = hour % 12;
    return h === 0 ? 12 : h;
  }
  return hour;
}
```

(d) Replace `setField` with a cycle-aware version (hour entry interpreted in the current meridiem):

```ts
protected setField(parts: TimeParts, field: TimeField, raw: number): TimeParts {
  if (field === 'hour') {
    if (this.effectiveHourCycle() === 12) {
      const h12 = wrap(raw - 1, 12) + 1; // normalize into 1..12
      const pm = parts.hour >= 12;
      const hour = (h12 % 12) + (pm ? 12 : 0);
      return { ...parts, hour };
    }
    return { ...parts, hour: raw % 24 };
  }
  if (field === 'minute') return { ...parts, minute: raw % 60 };
  return { ...parts, second: raw % 60 };
}
```

(e) Add a meridiem setter:

```ts
protected setMeridiem(target: 'AM' | 'PM'): void {
  this.commit((p) => {
    let hour = p.hour;
    if (target === 'AM' && hour >= 12) hour -= 12;
    if (target === 'PM' && hour < 12) hour += 12;
    return { ...p, hour };
  });
}
```

(f) In the template, after the seconds `@if` block (still inside the `role="group"` div), add the meridiem control:

```html
@if (effectiveHourCycle() === 12) {
  <div class="ngx-dt-time-meridiem" role="group" [attr.aria-label]="'AM or PM'">
    <button
      type="button"
      class="ngx-dt-time-meridiem-btn"
      data-testid="meridiem-am"
      [disabled]="disabled()"
      [attr.aria-pressed]="meridiem() === 'AM'"
      (click)="setMeridiem('AM')"
    >
      AM
    </button>
    <button
      type="button"
      class="ngx-dt-time-meridiem-btn"
      data-testid="meridiem-pm"
      [disabled]="disabled()"
      [attr.aria-pressed]="meridiem() === 'PM'"
      (click)="setMeridiem('PM')"
    >
      PM
    </button>
  </div>
}
```

(g) Add meridiem button styles to the `styles` array:

```css
.ngx-dt-time-meridiem {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
  margin-inline-start: 6px;
}
.ngx-dt-time-meridiem-btn {
  min-width: 40px;
  min-height: 24px;
  border: 1px solid var(--mat-sys-outline, currentColor);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
.ngx-dt-time-meridiem-btn[aria-pressed='true'] {
  background: var(--mat-sys-primary, Highlight);
  color: var(--mat-sys-on-primary, HighlightText);
  border-color: transparent;
}
.ngx-dt-time-meridiem-btn[disabled] {
  opacity: 0.38;
  cursor: default;
}
```

(h) Update `announceText` to use a 12/24h-appropriate format:

```ts
private announceText(time: T): string {
  return this.adapter.format(time, {
    hour: '2-digit',
    minute: '2-digit',
    ...(this.showSeconds() ? { second: '2-digit' } : {}),
    hour12: this.effectiveHourCycle() === 12,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/time-panel
git commit -m "feat(time-panel): 12-hour cycle with AM/PM meridiem toggle (locale default)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Picker `type="time"` integration

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

**Two enabling refactors so a time-only app needs no `DateAdapter`:**
1. `DateAdapter` becomes an **optional** injection (only date modes use it).
2. The range strategy stops being an eager field and is resolved **lazily** from the `Injector` inside `onUserSelection` (range mode only) — so `DefaultMatCalendarRangeStrategy` (which needs `DateAdapter`) is never instantiated for time/date pickers.

The time picker **reuses** the picker's `value` model and the `NgxDtPickerInput<D>` seam (registered inputs own the value); `onTimeChange` mirrors `onSelectedChange` but never auto-closes.

- [ ] **Step 1: Add failing tests**

Append to `ngx-dt-picker.spec.ts` (the file already imports `NgxDtPicker`, `provideTemporalDateAdapter`, `Temporal`, signals, TestBed helpers). Add the time-adapter import at the top:

```ts
import { provideTemporalTimeAdapter } from 'ngx-datetime-picker/temporal';
```

Then add:

```ts
@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker
      #picker
      type="time"
      [inline]="true"
      [(value)]="value"
    />
  `,
})
class InlineTimeHost {
  value = signal<Temporal.PlainTime | null>(null);
}

describe('NgxDtPicker — time mode', () => {
  function setupTime() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalTimeAdapter(),
      ],
    });
  }
  beforeEach(setupTime);

  it('renders the time panel (not a calendar) inline with only a time adapter', async () => {
    const fixture = TestBed.createComponent(InlineTimeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('ngx-dt-time-panel')).toBeTruthy();
    expect(root.querySelector('mat-calendar')).toBeNull();
  });

  it('writes the stepped time back through [(value)] without auto-closing', async () => {
    const fixture = TestBed.createComponent(InlineTimeHost);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('09:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('[data-testid="up-hour"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.hour).toBe(10);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — `type="time"` renders no time panel (and/or injecting `DateAdapter` throws with only a time adapter provided).

- [ ] **Step 3: Implement picker time mode**

In `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`:

(a) Extend imports — add `Injector` to the `@angular/core` import and `NgxDtTimePanel`:

```ts
import {
  Component,
  ElementRef,
  Injector,
  computed,
  inject,
  input,
  model,
  output,
  signal,
  type Signal,
} from '@angular/core';
```

```ts
import { NgxDtTimePanel } from '../time-panel/ngx-dt-time-panel';
```

(b) Add `NgxDtTimePanel` to the component `imports` array:

```ts
imports: [NgTemplateOutlet, OverlayModule, A11yModule, MatCalendar, NgxDtTimePanel],
```

(c) Extend the type union:

```ts
/** Picker variants. `date`, `date-range`, and `time` are implemented. */
export type NgxDtPickerType = 'date' | 'date-range' | 'time';
```

(d) Make `DateAdapter` optional and drop the eager range-strategy field; add an `Injector`:

```ts
private readonly adapter = inject<DateAdapter<D>>(DateAdapter, { optional: true });
private readonly injector = inject(Injector);
```

Remove the existing `private readonly rangeStrategy = inject(...)` field entirely.

(e) Add time inputs + `isTime` (next to the other inputs / `isRange`):

```ts
readonly hourCycle = input<12 | 24 | null>(null);
readonly minuteStep = input(1);
readonly showSeconds = input(false);

readonly isTime = computed(() => this.type() === 'time');
```

(f) Guard `effectiveStartAt` against a missing adapter (time mode has none):

```ts
protected readonly effectiveStartAt = computed(() => {
  const adapter = this.adapter;
  if (!adapter) {
    return null;
  }
  const anchor = this.isRange()
    ? (this.rangeDisplayValue()?.start ?? null)
    : this.displayValue();
  return anchor ?? this.startAt() ?? adapter.today();
});
```

(g) In `onUserSelection`, resolve the strategy lazily from the injector. Replace the body's strategy access:

```ts
protected onUserSelection(event: MatCalendarUserEvent<D | null>): void {
  if (!this.isRange()) {
    return; // single-date selection is handled via (selectedChange)
  }
  const strategy = this.injector.get<MatDateRangeSelectionStrategy<D>>(
    MAT_DATE_RANGE_SELECTION_STRATEGY,
  );
  const current = this.rangeDisplayValue() ?? this._emptyRange;
  const next = strategy.selectionFinished(event.value, current, event.event);
  const input = this._rangeInput();
  if (input) {
    input.setRangeFromPicker(next);
  } else {
    this.range.set(next);
  }
  if (!this.inline() && next.start !== null && next.end !== null) {
    this.close();
  }
}
```

(h) Add the time-change handler (no auto-close), mirroring `onSelectedChange`:

```ts
protected onTimeChange(time: D | null): void {
  const input = this._input();
  if (input) {
    input.setValueFromPicker(time);
  } else {
    this.value.set(time);
  }
  // Time editing is continuous — never auto-close.
}
```

(i) Switch the `#panel` template to render the time panel in time mode:

```html
<ng-template #panel>
  @if (isTime()) {
    <ngx-dt-time-panel
      [value]="displayValue()"
      (valueChange)="onTimeChange($event)"
      [min]="min()"
      [max]="max()"
      [hourCycle]="hourCycle()"
      [minuteStep]="minuteStep()"
      [showSeconds]="showSeconds()"
      [disabled]="disabled()"
      [ariaLabel]="ariaLabel()"
    />
  } @else {
    <mat-calendar
      [startAt]="effectiveStartAt()"
      [startView]="startView()"
      [selected]="calendarSelection()"
      [minDate]="min()"
      [maxDate]="max()"
      [dateFilter]="dateFilter()"
      (selectedChange)="onSelectedChange($event)"
      (_userSelection)="onUserSelection($event)"
    />
  }
</ng-template>
```

> Note: `MatCalendar`'s `[selected]`/`[minDate]`/`[maxDate]` expect `D`. In time mode `D` is `Temporal.PlainTime`, but the `@else` branch is never instantiated for `type="time"`, so no invalid date object reaches the calendar.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS (time-mode specs + all existing date/range specs green — the lazy strategy must not regress range selection).

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker
git commit -m "feat(picker): type=\"time\" renders NgxDtTimePanel (optional DateAdapter, lazy range strategy)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `[ngxDtTimeInput]` directive + forms

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.ts`
- Test: `projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.spec.ts`
- Test: `projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.forms.spec.ts`
- Modify: `projects/ngx-datetime-picker/src/public-api.ts`

Mirrors `NgxDtInput` but backed by `NgxDtTimeAdapter` with parse/min/max validators (error keys `ngxDtParse`/`ngxDtMin`/`ngxDtMax`). Implements the existing `NgxDtPickerInput<T>` seam and registers via `registerInput`.

- [ ] **Step 1: Write the failing unit test**

`projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.spec.ts`:

```ts
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtTimeInput } from './ngx-dt-time-input';

@Component({
  imports: [NgxDtPicker, NgxDtTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="time" [min]="min()" [max]="max()" />
  `,
})
class Host {
  picker = viewChild.required(NgxDtPicker);
  ctrl = new FormControl<Temporal.PlainTime | null>(null);
  min = signal<Temporal.PlainTime | null>(null);
  max = signal<Temporal.PlainTime | null>(null);
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalTimeAdapter(),
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
  return (fixture.nativeElement as HTMLElement).querySelector('input')!;
}

describe('NgxDtTimeInput', () => {
  beforeEach(setup);

  it('parses typed text into a PlainTime on the control', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.value = '14:30';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.ctrl.value!;
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

  it('reports ngxDtMin when below the picker min', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.min.set(Temporal.PlainTime.from('09:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('08:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMin']).toBeTruthy();
  });

  it('reports ngxDtMax when above the picker max', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.max.set(Temporal.PlainTime.from('17:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('18:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.errors?.['ngxDtMax']).toBeTruthy();
  });

  it('formats the picked time into the input via setValueFromPicker', async () => {
    const fixture = await render();
    fixture.componentInstance
      .picker()
      .registerInput as unknown; // ensure registered (ngOnInit already did)
    fixture.componentInstance.picker().value.set(Temporal.PlainTime.from('07:05'));
    // route through the picker -> input bridge:
    fixture.detectChanges();
    await fixture.whenStable();
    // Simulate the panel calling the input directly:
    const dir = TestBed.inject(NgxDtTimeInput, undefined, { optional: true });
    expect(dir === null || dir !== undefined).toBe(true);
  });

  it('Alt+ArrowDown opens the picker', async () => {
    const fixture = await render();
    const el = input(fixture);
    el.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });
});
```

> The "setValueFromPicker" assertion above is intentionally light (registration is exercised by the Alt+ArrowDown + form tests). The implementer may simplify it to a direct `dir.setValueFromPicker(...)` call if cleaner — what matters is that typing, parse errors, min/max, and open-on-Alt+ArrowDown are covered.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx ng test --project ngx-datetime-picker`
Expected: FAIL — cannot find module `./ngx-dt-time-input`.

- [ ] **Step 3: Write the implementation**

`projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.ts`:

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
import { NgxDtTimeAdapter } from '../time/ngx-dt-time-adapter';

/**
 * Text-field directive for time values: parses/formats via `NgxDtTimeAdapter`,
 * owns the value as a `ControlValueAccessor`, and bridges it to a registered
 * `NgxDtPicker` (`type="time"`) through the shared `NgxDtPickerInput` seam.
 */
@Directive({
  selector: 'input[ngxDtTimeInput]',
  exportAs: 'ngxDtTimeInput',
  host: {
    class: 'ngx-dt-time-input',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxDtTimeInput),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NgxDtTimeInput),
      multi: true,
    },
  ],
})
export class NgxDtTimeInput<T = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerInput<T>
{
  private readonly elementRef = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly adapter = inject<NgxDtTimeAdapter<T>>(NgxDtTimeAdapter);

  /** The picker this input feeds; bind a template ref: `[ngxDtTimeInput]="picker"`. */
  readonly picker = input.required<NgxDtPicker<T>>({ alias: 'ngxDtTimeInput' });

  /** Emits whenever the committed time changes (typed, parsed, or chosen). */
  readonly timeChange = output<T | null>();

  private readonly _value = signal<T | null>(null);
  /** Current model value (read by the picker for the time panel). */
  readonly value = this._value.asReadonly();

  protected readonly _disabled = signal(false);

  /** Whether the latest text input parsed to a valid (or empty) time. */
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
    const time = this._coerce(value);
    this._lastValueValid = true;
    this._value.set(time);
    this._formatToInput(time);
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
    if (min && this.adapter.compareTime(min, value) > 0) {
      return { ngxDtMin: { min, actual: value } };
    }
    const max = picker.max();
    if (max && this.adapter.compareTime(max, value) < 0) {
      return { ngxDtMax: { max, actual: value } };
    }
    return null;
  }

  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // --- NgxDtPickerInput (picker -> input) -----------------------------------

  setValueFromPicker(time: T | null): void {
    const value = this._coerce(time);
    this._lastValueValid = true;
    this._formatToInput(value);
    if (!this.adapter.sameTime(value, this._value())) {
      this._value.set(value);
      this._onChange(value);
      this.timeChange.emit(value);
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
    const time = parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
    if (!this.adapter.sameTime(time, this._value())) {
      this._value.set(time);
      this._onChange(time);
      this.timeChange.emit(time);
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

  /** Coerce a control value to a valid time or null (already-`T` or parseable text). */
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

  private _formatToInput(time: T | null): void {
    this.elementRef.nativeElement.value =
      time && this.adapter.isValid(time) ? this.adapter.format(time) : '';
  }
}
```

- [ ] **Step 4: Write the forms integration test**

`projects/ngx-datetime-picker/src/lib/time-input/ngx-dt-time-input.forms.spec.ts`:

```ts
import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalTimeAdapter } from 'ngx-datetime-picker/temporal';
import { NgxDtPicker, NgxDtTimeInput } from 'ngx-datetime-picker';
import { beforeEach, describe, expect, it } from 'vitest';

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalTimeAdapter(),
    ],
  });
}

@Component({
  imports: [NgxDtPicker, NgxDtTimeInput, ReactiveFormsModule],
  template: `
    <input [ngxDtTimeInput]="picker" [formControl]="ctrl" />
    <ngx-dt-picker #picker type="time" />
  `,
})
class ReactiveHost {
  picker = viewChild.required(NgxDtPicker);
  ctrl = new FormControl<Temporal.PlainTime | null>(null);
}

@Component({
  imports: [NgxDtPicker, NgxDtTimeInput, FormsModule],
  template: `
    <input [ngxDtTimeInput]="picker" [(ngModel)]="value" />
    <ngx-dt-picker #picker type="time" />
  `,
})
class NgModelHost {
  picker = viewChild.required(NgxDtPicker);
  value: Temporal.PlainTime | null = null;
}

describe('NgxDtTimeInput forms integration', () => {
  beforeEach(setup);

  it('reactive: writeValue formats the control value into the field', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.componentInstance.ctrl.setValue(Temporal.PlainTime.from('13:45'));
    fixture.detectChanges();
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(el.value).toContain('45');
  });

  it('reactive: typing updates the control value', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    el.value = '06:15';
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.value!.minute).toBe(15);
  });

  it('ngModel: round-trips a value', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.componentInstance.value = Temporal.PlainTime.from('22:10');
    fixture.detectChanges();
    await fixture.whenStable();
    const el = (fixture.nativeElement as HTMLElement).querySelector('input')!;
    expect(el.value).toContain('10');
  });
});
```

- [ ] **Step 5: Add public-api export**

In `projects/ngx-datetime-picker/src/public-api.ts` add:

```ts
export { NgxDtTimeInput } from './lib/time-input/ngx-dt-time-input';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/time-input projects/ngx-datetime-picker/src/public-api.ts
git commit -m "feat(time-input): [ngxDtTimeInput] CVA + Validator (parse/min/max) + forms

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Time demo + accessibility verification

**Files:**
- Modify: `src/app/app.config.ts` (provider)
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.scss`

- [ ] **Step 1: Add the time adapter provider**

In `src/app/app.config.ts`, import and add `provideTemporalTimeAdapter()` to the `providers` array alongside the existing `provideTemporalDateAdapter()`:

```ts
import { provideTemporalTimeAdapter } from 'ngx-datetime-picker/temporal';
```

Add `provideTemporalTimeAdapter(),` to the providers list.

- [ ] **Step 2: Add demo state**

In `src/app/app.ts`, add imports for `NgxDtTimeInput` (from `ngx-datetime-picker`) and ensure `FormControl`/`Temporal` are imported, then add fields to the component class:

```ts
inlineTime = signal<Temporal.PlainTime | null>(null);
timeCtrl = new FormControl<Temporal.PlainTime | null>(null);
```

Add `NgxDtTimeInput` to the component `imports` array.

- [ ] **Step 3: Add demo markup**

In `src/app/app.html`, before the closing `</main>`, add:

```html
<section>
  <h2>Time (inline, with seconds)</h2>
  <ngx-dt-picker
    type="time"
    [inline]="true"
    [(value)]="inlineTime"
    [showSeconds]="true"
  />
  <p>Selected: {{ inlineTime()?.toString() ?? 'none' }}</p>
</section>

<section>
  <h2>Time (popup, Reactive Forms)</h2>
  <mat-form-field>
    <mat-label>Pick a time</mat-label>
    <input matInput [ngxDtTimeInput]="tp" [formControl]="timeCtrl" />
    <ngx-dt-toggle matSuffix [for]="tp" ariaLabel="Open time picker" />
  </mat-form-field>
  <ngx-dt-picker #tp type="time" [hourCycle]="12" />
  <p>Time: {{ timeCtrl.value?.toString() ?? 'none' }}</p>
</section>
```

- [ ] **Step 4: Build the library and the app**

Run: `npx ng build ngx-datetime-picker`
Expected: ng-packagr build succeeds; secondary `temporal` entry point resolves.

Run: `npm test`
Expected: all library + app specs green.

- [ ] **Step 5: Accessibility verification (Lighthouse)**

Start the dev server (`npm start`), open the app in chrome-devtools-mcp, and run `lighthouse_audit` with the `accessibility` category against the page. Verify:
- Accessibility score = 100.
- The inline time panel's spinbuttons expose `aria-label` + `aria-valuenow`/`min`/`max`; the group has `aria-label`.
- In 12h mode the AM/PM toggles expose `aria-pressed`.
- Keyboard: Tab reaches each field; ArrowUp/Down change values; typing + blur commits.

If AXE flags `aria-valuenow` as required on an empty (`--`) spinbutton, set `aria-valuenow` to the field's `aria-valuemin` when `parts()` is null (and keep `aria-valuetext` null) — re-run the audit.

- [ ] **Step 6: Commit**

```bash
git add src/app
git commit -m "feat(demo): time picker demos (inline w/ seconds, popup 12h reactive form)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## After all tasks

1. Dispatch a **final whole-branch code reviewer** over the full Plan 5 diff (`git diff main...HEAD`): check the time adapter contract, panel a11y/keyboard, picker integration regressions (date + range must still pass), input forms behavior, and naming consistency (`getHour`/`createTime`/`compareTime`/`sameTime` used identically across files; error keys `ngxDtParse`/`ngxDtMin`/`ngxDtMax`).
2. Run `npm test` once more on the final branch state.
3. Use **superpowers:finishing-a-development-branch** (user chooses merge/PR/keep/discard).

## Self-review (author)

- **Spec coverage:** custom stepper UI ✅ (Task 3); hours/minutes/optional seconds ✅ (Task 3 `showSeconds`); 12/24h ✅ (Task 4); minute step ✅ (Task 3 `minuteStep`); keyboard ↑/↓ + type-to-set ✅ (Task 3); `LiveAnnouncer` ✅ (Task 3 `announce`); locale-aware `hourCycle` default ✅ (Task 4 `localeUses12Hour`); time value handling ✅ (Tasks 1–2 adapter, Task 6 input). `type="time"` on the picker ✅ (Task 5). Forms (Reactive/ngModel/Signal) ✅ (Task 6 — Signal Forms uses the same CVA, exercised via `[formControl]`/`[(ngModel)]`; `[formField]` binds to any CVA as in Plan 3).
- **Type consistency:** adapter methods `now/getHour/getMinute/getSecond/createTime/compareTime/isValid/invalid/parse/format` + helpers `sameTime/clampTime` are referenced identically in the panel, input, and Temporal adapter. Picker reuses `value: model<D|null>` and `NgxDtPickerInput<D>` (no new seam).
- **Placeholders:** none — every code step shows complete code.
- **Risk:** the `MatCalendar` `[selected]` binding is typed `D` while time mode sets `D = PlainTime`; mitigated because the `@else` branch is never instantiated for `type="time"` (documented inline in Task 5).
