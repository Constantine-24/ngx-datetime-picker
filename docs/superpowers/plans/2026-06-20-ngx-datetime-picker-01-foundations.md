# ngx-datetime-picker — Plan 1: Workspace + Temporal DateAdapter Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the publishable Angular library workspace and ship a fully tested `DateAdapter<Temporal.PlainDate>` (with locale-aware parse↔format) on a `temporal` secondary entry point — no UI yet.

**Architecture:** Convert the single-app workspace into an app + ng-packagr library (`projects/ngx-datetime-picker`). The Temporal adapter lives in a `ngx-datetime-picker/temporal` secondary entry point so the `temporal-polyfill` runtime tree-shakes away for consumers who don't use it. The adapter implements Material's abstract `DateAdapter<D>` contract over zone-naive `Temporal.PlainDate`; parsing uses an ISO fast-path plus an `Intl.DateTimeFormat.formatToParts`-derived numeric fallback (Temporal has no format-based parser).

**Tech Stack:** Angular 22, `@angular/material`/`@angular/cdk` 22, `temporal-polyfill`, Vitest (`@angular/build:unit-test`), ng-packagr, TypeScript 6.

This is **Plan 1 of a 6-plan series** (Foundations → Date picker → Date range → Time picker → Datetime + datetime-range → Polish). Later plans are authored just-in-time so they reflect this plan's outcomes (chiefly the parse strategy verified in Tasks 6–8).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `projects/ngx-datetime-picker/` | ng-packagr library root (generated) |
| `projects/ngx-datetime-picker/src/public-api.ts` | Primary (adapter-agnostic core) entry point — empty for now |
| `projects/ngx-datetime-picker/temporal/ng-package.json` | Declares the `temporal` secondary entry point |
| `projects/ngx-datetime-picker/temporal/src/public-api.ts` | Temporal entry exports |
| `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.ts` | `TemporalDateAdapter` (the 22 `DateAdapter` methods) |
| `projects/ngx-datetime-picker/temporal/src/temporal-date-formats.ts` | `NGX_DT_TEMPORAL_DATE_FORMATS` (Intl-options-based `MatDateFormats`) |
| `projects/ngx-datetime-picker/temporal/src/provide-temporal-date-adapter.ts` | `provideTemporalDateAdapter()` DI helper |
| `projects/ngx-datetime-picker/temporal/src/*.spec.ts` | Vitest conformance + parse/format tests |
| `angular.json` | Registers the library build + Vitest test target |
| `tsconfig.json` | Path mappings for both entry points |
| `src/styles.scss`, `src/app/app.config.ts` | Demo: Material M3 theme + async animations |

---

## Task 1: Install Material/CDK + Temporal polyfill

**Files:** Modify: `package.json`

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @angular/material@^22 @angular/cdk@^22 temporal-polyfill@^0.3
```
Expected: `package.json` gains `@angular/material`, `@angular/cdk`, `temporal-polyfill`; install completes with no peer-dep errors.

- [ ] **Step 2: Verify versions align with Angular 22**

Run: `npx ng version`
Expected: `@angular/material` and `@angular/cdk` both report `22.x`, matching `@angular/core`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add @angular/material, @angular/cdk, temporal-polyfill"
```

---

## Task 2: Generate the ng-packagr library

**Files:** Create: `projects/ngx-datetime-picker/**`; Modify: `angular.json`, `tsconfig.json`

- [ ] **Step 1: Generate the library**

Run:
```bash
npx ng generate library ngx-datetime-picker --prefix ngx-dt
```
Expected: creates `projects/ngx-datetime-picker/` (with `ng-package.json`, `package.json`, `src/public-api.ts`, `tsconfig.lib.json`, `tsconfig.spec.json`, a sample component + service), registers the project in `angular.json`, and adds a `"ngx-datetime-picker"` path mapping to `tsconfig.json`.

- [ ] **Step 2: Remove the generated sample files**

Run:
```bash
rm projects/ngx-datetime-picker/src/lib/ngx-datetime-picker.ts \
   projects/ngx-datetime-picker/src/lib/ngx-datetime-picker.spec.ts
```
(Delete the generated sample component/service whatever their exact names are — list them with `ls projects/ngx-datetime-picker/src/lib` first.)

- [ ] **Step 3: Empty the primary public-api**

Replace `projects/ngx-datetime-picker/src/public-api.ts` with:
```ts
// Adapter-agnostic core entry point. Components land here in later plans.
export {};
```

- [ ] **Step 4: Verify the library builds**

Run: `npx ng build ngx-datetime-picker`
Expected: ng-packagr build SUCCEEDS, emitting `dist/ngx-datetime-picker/`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold ngx-datetime-picker library"
```

---

## Task 3: Configure Vitest for the library

**Files:** Modify: `angular.json`, `projects/ngx-datetime-picker/tsconfig.spec.json`

- [ ] **Step 1: Point the library test target at the Vitest unit-test builder**

In `angular.json`, under `projects.ngx-datetime-picker.architect`, replace the generated `test` target with (mirroring the app's target):
```json
"test": {
  "builder": "@angular/build:unit-test",
  "options": {
    "tsConfig": "projects/ngx-datetime-picker/tsconfig.spec.json",
    "buildTarget": "ngx-datetime-picker:build"
  }
}
```

- [ ] **Step 2: Ensure the spec tsconfig uses vitest globals**

Confirm `projects/ngx-datetime-picker/tsconfig.spec.json` `compilerOptions.types` includes `"vitest/globals"` (copy from `tsconfig.spec.json` at the repo root if missing).

- [ ] **Step 3: Add a temporary smoke test**

Create `projects/ngx-datetime-picker/src/smoke.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('library test harness', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run the library test suite**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Remove the smoke test and commit**

```bash
rm projects/ngx-datetime-picker/src/smoke.spec.ts
git add -A
git commit -m "test: configure Vitest unit-test target for the library"
```

---

## Task 4: Add the `temporal` secondary entry point + tsconfig path

**Files:** Create: `projects/ngx-datetime-picker/temporal/ng-package.json`, `projects/ngx-datetime-picker/temporal/src/public-api.ts`; Modify: `tsconfig.json`

- [ ] **Step 1: Declare the secondary entry point**

Create `projects/ngx-datetime-picker/temporal/ng-package.json`:
```json
{
  "lib": {
    "entryFile": "src/public-api.ts"
  }
}
```

- [ ] **Step 2: Create the entry's public-api (empty for now)**

Create `projects/ngx-datetime-picker/temporal/src/public-api.ts`:
```ts
export {};
```

- [ ] **Step 3: Add a dev-time path mapping**

In `tsconfig.json` `compilerOptions.paths`, alongside the existing `"ngx-datetime-picker"` mapping, add:
```json
"ngx-datetime-picker/temporal": ["./projects/ngx-datetime-picker/temporal/src/public-api.ts"]
```

- [ ] **Step 4: Verify both entry points build**

Run: `npx ng build ngx-datetime-picker`
Expected: build SUCCEEDS and logs both `ngx-datetime-picker` and `ngx-datetime-picker/temporal` entry points; `dist/ngx-datetime-picker/temporal/` exists.

- [ ] **Step 5: Declare temporal-polyfill as an optional peer dependency of the library**

In `projects/ngx-datetime-picker/package.json`, add:
```json
"peerDependencies": {
  "@angular/cdk": "^22.0.0",
  "@angular/material": "^22.0.0",
  "temporal-polyfill": "^0.3.0"
},
"peerDependenciesMeta": {
  "temporal-polyfill": { "optional": true }
}
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(temporal): add temporal secondary entry point"
```

---

## Task 5: `TemporalDateAdapter` skeleton + injection wiring

This task creates the class and proves it can be constructed via DI with a locale. The 22 methods come in Tasks 6–10 (red/green per group).

**Files:**
- Create: `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.ts`
- Test: `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { Temporal } from 'temporal-polyfill';
import { beforeEach, describe, expect, it } from 'vitest';
import { TemporalDateAdapter } from './temporal-date-adapter';

function makeAdapter(locale = 'en-US'): TemporalDateAdapter {
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DATE_LOCALE, useValue: locale },
      { provide: DateAdapter, useClass: TemporalDateAdapter },
    ],
  });
  return TestBed.inject(DateAdapter) as TemporalDateAdapter;
}

describe('TemporalDateAdapter — construction', () => {
  let adapter: TemporalDateAdapter;
  beforeEach(() => (adapter = makeAdapter()));

  it('is a DateAdapter', () => {
    expect(adapter).toBeInstanceOf(DateAdapter);
  });

  it('createDate uses 0-indexed months (Material contract)', () => {
    const d = adapter.createDate(2026, 5, 20); // month 5 === June
    expect(d).toBeInstanceOf(Temporal.PlainDate);
    expect(d.month).toBe(6);
    expect(d.day).toBe(20);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — cannot find module `./temporal-date-adapter`.

- [ ] **Step 3: Write the minimal skeleton**

Create `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.ts`:
```ts
import { Injectable, inject } from '@angular/core';
import { DateAdapter, MAT_DATE_LOCALE } from '@angular/material/core';
import { Temporal } from 'temporal-polyfill';

/** Internal sentinel returned by `invalid()`; never an instanceof PlainDate. */
const INVALID = {} as Temporal.PlainDate;

function range<T>(length: number, fn: (i: number) => T): T[] {
  return Array.from({ length }, (_, i) => fn(i));
}

@Injectable()
export class TemporalDateAdapter extends DateAdapter<Temporal.PlainDate> {
  constructor() {
    super();
    this.setLocale(inject(MAT_DATE_LOCALE, { optional: true }) ?? 'en-US');
  }

  createDate(year: number, month: number, date: number): Temporal.PlainDate {
    if (month < 0 || month > 11) {
      throw new Error(`Invalid month index "${month}". Expected 0-11.`);
    }
    if (date < 1) {
      throw new Error(`Invalid date "${date}". Date must be greater than 0.`);
    }
    return Temporal.PlainDate.from(
      { year, month: month + 1, day: date },
      { overflow: 'reject' },
    );
  }

  // --- remaining abstract members are filled in by Tasks 6-10 ---
  getYear(date: Temporal.PlainDate): number { return date.year; }
  getMonth(date: Temporal.PlainDate): number { return date.month - 1; }
  getDate(date: Temporal.PlainDate): number { return date.day; }
  getDayOfWeek(date: Temporal.PlainDate): number { return date.dayOfWeek % 7; }
  getMonthNames(): string[] { return range(12, () => ''); }
  getDateNames(): string[] { return range(31, (i) => String(i + 1)); }
  getDayOfWeekNames(): string[] { return range(7, () => ''); }
  getYearName(date: Temporal.PlainDate): string { return String(date.year); }
  getFirstDayOfWeek(): number { return 0; }
  getNumDaysInMonth(date: Temporal.PlainDate): number { return date.daysInMonth; }
  clone(date: Temporal.PlainDate): Temporal.PlainDate { return Temporal.PlainDate.from(date); }
  today(): Temporal.PlainDate { return Temporal.Now.plainDateISO(); }
  parse(value: unknown): Temporal.PlainDate | null { return value == null ? null : INVALID; }
  format(date: Temporal.PlainDate): string { return date.toString(); }
  addCalendarYears(date: Temporal.PlainDate, years: number): Temporal.PlainDate { return date.add({ years }); }
  addCalendarMonths(date: Temporal.PlainDate, months: number): Temporal.PlainDate { return date.add({ months }); }
  addCalendarDays(date: Temporal.PlainDate, days: number): Temporal.PlainDate { return date.add({ days }); }
  toIso8601(date: Temporal.PlainDate): string { return date.toString(); }
  isDateInstance(obj: unknown): boolean { return obj instanceof Temporal.PlainDate; }
  isValid(date: Temporal.PlainDate): boolean { return date instanceof Temporal.PlainDate; }
  invalid(): Temporal.PlainDate { return INVALID; }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — both construction tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(temporal): TemporalDateAdapter skeleton + DI wiring"
```

---

## Task 6: Field accessors + arithmetic (0-indexed months, ISO weekday mapping)

**Files:** Test: `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.spec.ts`; the implementation already exists from Task 5 — this task locks it with tests and fixes any mismatch.

- [ ] **Step 1: Write the failing tests**

Append to the spec:
```ts
describe('TemporalDateAdapter — field accessors & arithmetic', () => {
  let adapter: TemporalDateAdapter;
  beforeEach(() => (adapter = makeAdapter()));
  const jun20 = Temporal.PlainDate.from('2026-06-20'); // a Saturday

  it('getMonth is 0-indexed', () => expect(adapter.getMonth(jun20)).toBe(5));
  it('getDate returns day of month', () => expect(adapter.getDate(jun20)).toBe(20));
  it('getYear returns the year', () => expect(adapter.getYear(jun20)).toBe(2026));
  it('getDayOfWeek maps Sunday→0 .. Saturday→6', () => {
    expect(adapter.getDayOfWeek(jun20)).toBe(6); // Saturday
    expect(adapter.getDayOfWeek(Temporal.PlainDate.from('2026-06-21'))).toBe(0); // Sunday
  });
  it('getNumDaysInMonth', () => expect(adapter.getNumDaysInMonth(jun20)).toBe(30));
  it('addCalendarMonths rolls the year', () => {
    expect(adapter.addCalendarMonths(jun20, 8).toString()).toBe('2027-02-20');
  });
  it('addCalendarDays', () => {
    expect(adapter.addCalendarDays(jun20, 12).toString()).toBe('2026-07-02');
  });
  it('clone is value-equal but a distinct object handling', () => {
    expect(adapter.clone(jun20).equals(jun20)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS (implementation from Task 5 already satisfies these). If `getDayOfWeek` fails, confirm the `% 7` mapping is present.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(temporal): lock field accessors & calendar arithmetic"
```

---

## Task 7: Locale display names (`getMonthNames`/`getDayOfWeekNames`/`getYearName`/`getFirstDayOfWeek`)

**Files:** Modify: `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.ts`; Test: the spec.

- [ ] **Step 1: Write the failing tests**

Append to the spec:
```ts
describe('TemporalDateAdapter — localized names', () => {
  it('English month names (long)', () => {
    const a = makeAdapter('en-US');
    expect(a.getMonthNames('long')[5]).toBe('June');
    expect(a.getMonthNames('short')[5]).toBe('Jun');
  });
  it('German month names', () => {
    expect(makeAdapter('de-DE').getMonthNames('long')[5]).toBe('Juni');
  });
  it('day-of-week names start on Sunday', () => {
    const names = makeAdapter('en-US').getDayOfWeekNames('long');
    expect(names[0]).toBe('Sunday');
    expect(names[6]).toBe('Saturday');
  });
  it('first day of week is locale-aware', () => {
    expect(makeAdapter('en-US').getFirstDayOfWeek()).toBe(0); // Sunday
    expect(makeAdapter('de-DE').getFirstDayOfWeek()).toBe(1); // Monday
  });
  it('year name', () => {
    expect(makeAdapter('en-US').getYearName(Temporal.PlainDate.from('2026-06-20'))).toBe('2026');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — `getMonthNames` returns empty strings; `getFirstDayOfWeek` returns 0 for de-DE.

- [ ] **Step 3: Implement the localized methods**

In `temporal-date-adapter.ts`, replace the placeholder `getMonthNames`/`getDayOfWeekNames`/`getYearName`/`getFirstDayOfWeek` with:
```ts
override getMonthNames(style: 'long' | 'short' | 'narrow'): string[] {
  const fmt = new Intl.DateTimeFormat(this.locale, { month: style, timeZone: 'UTC' });
  return range(12, (i) => fmt.format(new Date(Date.UTC(2026, i, 1))));
}

override getDayOfWeekNames(style: 'long' | 'short' | 'narrow'): string[] {
  const fmt = new Intl.DateTimeFormat(this.locale, { weekday: style, timeZone: 'UTC' });
  // 2023-01-01 is a Sunday → iterate Sun..Sat.
  return range(7, (i) => fmt.format(new Date(Date.UTC(2023, 0, 1 + i))));
}

override getYearName(date: Temporal.PlainDate): string {
  return date.toLocaleString(this.locale, { year: 'numeric' });
}

override getFirstDayOfWeek(): number {
  try {
    const locale = new Intl.Locale(this.locale);
    // weekInfo.firstDay is 1=Mon .. 7=Sun; map to 0=Sun .. 6=Sat.
    const firstDay = (locale as { weekInfo?: { firstDay?: number } }).weekInfo?.firstDay;
    return firstDay == null ? 0 : firstDay % 7;
  } catch {
    return 0;
  }
}
```
(Remove the now-unused placeholder versions of these four methods.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS. If `getFirstDayOfWeek` for `de-DE` returns 0, the runtime lacks `Intl.Locale.weekInfo` — note it and relax the assertion to `expect([0,1]).toContain(...)`, then file a follow-up.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(temporal): locale-aware month/weekday/year names + first day"
```

---

## Task 8: Parsing — ISO fast-path + locale numeric fallback (the #1 risk)

**Files:** Modify: `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.ts`; Test: the spec.

- [ ] **Step 1: Write the failing tests**

Append to the spec:
```ts
describe('TemporalDateAdapter — parse', () => {
  it('parses ISO-8601', () => {
    expect(makeAdapter().parse('2026-06-20')!.toString()).toBe('2026-06-20');
  });
  it('parses en-US m/d/y', () => {
    expect(makeAdapter('en-US').parse('06/20/2026')!.toString()).toBe('2026-06-20');
  });
  it('parses de-DE d.m.y', () => {
    expect(makeAdapter('de-DE').parse('20.06.2026')!.toString()).toBe('2026-06-20');
  });
  it('expands 2-digit years', () => {
    expect(makeAdapter('en-US').parse('6/20/26')!.toString()).toBe('2026-06-20');
  });
  it('passes through an existing PlainDate', () => {
    const d = Temporal.PlainDate.from('2026-06-20');
    expect(makeAdapter().parse(d)).toBe(d);
  });
  it('null/empty → null', () => {
    expect(makeAdapter().parse(null)).toBeNull();
    expect(makeAdapter().parse('')).toBeNull();
  });
  it('garbage → invalid (not valid)', () => {
    const a = makeAdapter('en-US');
    const r = a.parse('not a date');
    expect(a.isValid(r as Temporal.PlainDate)).toBe(false);
  });
  it('out-of-range numeric → invalid', () => {
    const a = makeAdapter('en-US');
    expect(a.isValid(a.parse('13/40/2026') as Temporal.PlainDate)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — current `parse` returns `INVALID` for everything non-null.

- [ ] **Step 3: Implement parse + numeric fallback**

In `temporal-date-adapter.ts`, replace the placeholder `parse` with the following, and add the two private helpers:
```ts
override parse(value: unknown): Temporal.PlainDate | null {
  if (value == null) return null;
  if (value instanceof Temporal.PlainDate) return value;
  const str = String(value).trim();
  if (!str) return null;

  // 1) ISO-8601 fast path (the only format Temporal.from understands).
  try {
    return Temporal.PlainDate.from(str, { overflow: 'reject' });
  } catch {
    /* fall through */
  }
  // 2) Locale numeric fallback.
  return this.parseLocaleNumeric(str) ?? this.invalid();
}

private parseLocaleNumeric(str: string): Temporal.PlainDate | null {
  const nums = str.match(/\d+/g);
  if (!nums || nums.length < 3) return null;
  const order = this.numericFieldOrder();
  const field: Record<'year' | 'month' | 'day', number> = { year: 0, month: 0, day: 0 };
  order.forEach((f, i) => (field[f] = Number(nums[i])));
  if (field.year < 100) field.year += 2000; // naive 2-digit-year expansion
  try {
    return Temporal.PlainDate.from(field, { overflow: 'reject' });
  } catch {
    return null;
  }
}

/** Derives field order (e.g. ['month','day','year'] for en-US) from Intl. */
private numericFieldOrder(): Array<'year' | 'month' | 'day'> {
  const ref = new Date(Date.UTC(2026, 0, 2)); // y=2026, m=01, d=02 — all distinct
  return new Intl.DateTimeFormat(this.locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  })
    .formatToParts(ref)
    .filter((p) => p.type === 'year' || p.type === 'month' || p.type === 'day')
    .map((p) => p.type as 'year' | 'month' | 'day');
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — all parse tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(temporal): locale-aware parsing (ISO + numeric fallback)"
```

---

## Task 9: Formatting, `toIso8601`, `deserialize`, `compareDate`, validity

**Files:** Modify: `projects/ngx-datetime-picker/temporal/src/temporal-date-adapter.ts`; Test: the spec.

- [ ] **Step 1: Write the failing tests**

Append to the spec:
```ts
describe('TemporalDateAdapter — format / compare / validity', () => {
  const d = Temporal.PlainDate.from('2026-06-20');

  it('formats via Intl options', () => {
    const out = makeAdapter('en-US').format(d, { year: 'numeric', month: 'short', day: 'numeric' });
    expect(out).toBe('Jun 20, 2026');
  });
  it('throws when formatting an invalid date', () => {
    const a = makeAdapter();
    expect(() => a.format(a.invalid(), { year: 'numeric' })).toThrow();
  });
  it('round-trips parse↔format (en-US)', () => {
    const a = makeAdapter('en-US');
    const fmt = { year: 'numeric', month: '2-digit', day: '2-digit' } as const;
    expect(a.parse(a.format(d, fmt))!.toString()).toBe('2026-06-20');
  });
  it('toIso8601', () => expect(makeAdapter().toIso8601(d)).toBe('2026-06-20'));
  it('deserialize accepts ISO strings and PlainDate', () => {
    const a = makeAdapter();
    expect(a.deserialize('2026-06-20')!.toString()).toBe('2026-06-20');
    expect(a.deserialize(d)).toBe(d);
    expect(a.deserialize(null)).toBeNull();
    expect(a.deserialize('')).toBeNull();
  });
  it('compareDate orders dates', () => {
    const a = makeAdapter();
    expect(a.compareDate(d, Temporal.PlainDate.from('2026-06-21'))).toBeLessThan(0);
    expect(a.compareDate(d, d)).toBe(0);
  });
  it('isValid distinguishes valid from invalid()', () => {
    const a = makeAdapter();
    expect(a.isValid(d)).toBe(true);
    expect(a.isValid(a.invalid())).toBe(false);
  });
  it('isDateInstance', () => {
    const a = makeAdapter();
    expect(a.isDateInstance(d)).toBe(true);
    expect(a.isDateInstance('2026-06-20')).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — `format` returns ISO, no `deserialize`/`compareDate` overrides.

- [ ] **Step 3: Implement**

In `temporal-date-adapter.ts`, replace the placeholder `format` and add overrides:
```ts
override format(date: Temporal.PlainDate, displayFormat: Intl.DateTimeFormatOptions): string {
  if (!this.isValid(date)) {
    throw new Error('TemporalDateAdapter: Cannot format invalid date.');
  }
  return date.toLocaleString(this.locale, displayFormat);
}

override deserialize(value: unknown): Temporal.PlainDate | null {
  if (value == null || value === '') return null;
  if (value instanceof Temporal.PlainDate) return value;
  if (value instanceof Temporal.PlainDateTime) return value.toPlainDate();
  if (value instanceof Temporal.ZonedDateTime) return value.toPlainDate();
  if (typeof value === 'string') {
    try {
      return Temporal.PlainDate.from(value, { overflow: 'reject' });
    } catch {
      return this.invalid();
    }
  }
  return super.deserialize(value);
}

override compareDate(first: Temporal.PlainDate, second: Temporal.PlainDate): number {
  return Temporal.PlainDate.compare(first, second);
}

override isValid(date: Temporal.PlainDate): boolean {
  return date instanceof Temporal.PlainDate;
}
```
(Remove the old placeholder `format` and `isValid`.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(temporal): format, deserialize, compareDate, validity"
```

---

## Task 10: `NGX_DT_TEMPORAL_DATE_FORMATS` + `provideTemporalDateAdapter()` + exports

**Files:**
- Create: `projects/ngx-datetime-picker/temporal/src/temporal-date-formats.ts`, `projects/ngx-datetime-picker/temporal/src/provide-temporal-date-adapter.ts`
- Modify: `projects/ngx-datetime-picker/temporal/src/public-api.ts`
- Test: `projects/ngx-datetime-picker/temporal/src/provide-temporal-date-adapter.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `projects/ngx-datetime-picker/temporal/src/provide-temporal-date-adapter.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { DateAdapter, MAT_DATE_FORMATS } from '@angular/material/core';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import { provideTemporalDateAdapter } from './provide-temporal-date-adapter';
import { TemporalDateAdapter } from './temporal-date-adapter';

describe('provideTemporalDateAdapter', () => {
  it('wires DateAdapter → TemporalDateAdapter and supplies formats', () => {
    TestBed.configureTestingModule({ providers: [provideTemporalDateAdapter()] });
    expect(TestBed.inject(DateAdapter)).toBeInstanceOf(TemporalDateAdapter);
    expect(TestBed.inject(MAT_DATE_FORMATS).display.dateInput).toBeTruthy();
  });

  it('the wired adapter produces PlainDate today()', () => {
    TestBed.configureTestingModule({ providers: [provideTemporalDateAdapter()] });
    expect(TestBed.inject(DateAdapter).today()).toBeInstanceOf(Temporal.PlainDate);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — modules `./provide-temporal-date-adapter` not found.

- [ ] **Step 3: Implement formats**

Create `projects/ngx-datetime-picker/temporal/src/temporal-date-formats.ts`:
```ts
import { MatDateFormats } from '@angular/material/core';

export const NGX_DT_TEMPORAL_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: null, // parse() ignores the format (ISO + locale-numeric strategy)
  },
  display: {
    dateInput: { year: 'numeric', month: 'numeric', day: 'numeric' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};
```

- [ ] **Step 4: Implement the provider**

Create `projects/ngx-datetime-picker/temporal/src/provide-temporal-date-adapter.ts`:
```ts
import { Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MatDateFormats } from '@angular/material/core';
import { NGX_DT_TEMPORAL_DATE_FORMATS } from './temporal-date-formats';
import { TemporalDateAdapter } from './temporal-date-adapter';

export function provideTemporalDateAdapter(
  formats: MatDateFormats = NGX_DT_TEMPORAL_DATE_FORMATS,
): Provider[] {
  return [
    { provide: DateAdapter, useClass: TemporalDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: formats },
  ];
}
```

- [ ] **Step 5: Export the public surface**

Replace `projects/ngx-datetime-picker/temporal/src/public-api.ts`:
```ts
export { TemporalDateAdapter } from './temporal-date-adapter';
export { NGX_DT_TEMPORAL_DATE_FORMATS } from './temporal-date-formats';
export { provideTemporalDateAdapter } from './provide-temporal-date-adapter';
```

- [ ] **Step 6: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — full adapter suite green.

- [ ] **Step 7: Verify the production build still emits both entry points**

Run: `npx ng build ngx-datetime-picker`
Expected: SUCCESS; `dist/ngx-datetime-picker/temporal/` contains the adapter.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(temporal): NGX_DT_TEMPORAL_DATE_FORMATS + provideTemporalDateAdapter"
```

---

## Task 11: Demo wiring — Material M3 theme, async animations, smoke calendar

Proves the adapter drives a real `MatCalendar` end-to-end in the demo app (also our manual a11y/theming harness for later plans).

**Files:** Modify: `src/styles.scss`, `src/app/app.config.ts`, `src/app/app.ts`, `src/app/app.html`

- [ ] **Step 1: Add the M3 theme**

Prepend to `src/styles.scss`:
```scss
@use '@angular/material' as mat;

html {
  color-scheme: light dark;
  @include mat.theme(
    (
      color: (primary: mat.$azure-palette, tertiary: mat.$blue-palette),
      typography: Roboto,
      density: 0,
    )
  );
}
```

- [ ] **Step 2: Provide async animations + the Temporal adapter app-wide**

In `src/app/app.config.ts`, add to the `providers` array:
```ts
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
// ...
providers: [
  // ...existing providers (keep provideZonelessChangeDetection if present),
  provideAnimationsAsync(),
  provideTemporalDateAdapter(),
],
```
(If `provideZonelessChangeDetection()` is not already present, add it — the library targets zoneless.)

- [ ] **Step 3: Render a standalone MatCalendar bound to the adapter**

In `src/app/app.ts`, import and add `MatCalendar` to `imports`, and add a signal:
```ts
import { MatCalendar } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
// in the component class:
protected readonly selected = signal<Temporal.PlainDate | null>(null);
protected onSelected(date: Temporal.PlainDate | null) { this.selected.set(date); }
```
In `src/app/app.html` add:
```html
<mat-calendar [selected]="selected()" (selectedChange)="onSelected($event)" />
<p>Selected: {{ selected()?.toString() ?? 'none' }}</p>
```

- [ ] **Step 4: Run the demo and verify**

Run: `npx ng serve`
Expected: app compiles; a themed month calendar renders; clicking a day updates "Selected: 2026-06-DD" with an ISO `PlainDate` string (proving the Temporal adapter is the active `DateAdapter`).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(demo): M3 theme + MatCalendar driven by TemporalDateAdapter"
```

---

## Self-Review (completed by plan author)

- **Spec coverage (this plan's slice):** workspace→Task 2/3; secondary entry point + tree-shakeable polyfill→Task 4; Temporal adapter (all abstract methods)→Tasks 5–10; the "Temporal has no parser" risk→Task 8 (ISO + numeric fallback, the spec's `formatToParts` reverse-map); zoneless baseline→Task 11 Step 2; M3 theming requirement→Task 11 Step 1; `provideTemporalDateAdapter()`→Task 10. Out of scope here (later plans): overlay/picker shell, inputs, forms contracts, time/datetime/range, full a11y pass.
- **Placeholder scan:** none — every code step shows full code; Task 5 placeholders are real interim implementations, each replaced by a later task with tests.
- **Type consistency:** `TemporalDateAdapter`, `provideTemporalDateAdapter()`, `NGX_DT_TEMPORAL_DATE_FORMATS`, and `INVALID` sentinel names are used identically across tasks; months 0-indexed at the Material boundary, 1-indexed inside Temporal, consistently.

## Definition of Done

- `npx ng test ngx-datetime-picker --watch=false` → all green.
- `npx ng build ngx-datetime-picker` → both entry points emitted.
- Demo serves a themed `MatCalendar` whose selection is a `Temporal.PlainDate`.
- Next: **Plan 2 — Overlay infra + Date picker** (authored after this plan lands).
