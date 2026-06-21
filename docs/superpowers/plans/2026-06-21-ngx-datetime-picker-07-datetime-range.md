# Datetime-Range Picker (`type="datetime-range"`) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a **datetime-range** variant (`type="datetime-range"`) that composes the existing range `MatCalendar` (two date parts) with **two** `NgxDtTimePanel`s (start time + end time) into one `DateRange<Temporal.PlainDateTime>`, with same-day order enforced both by clamping the time panels and by an `ngxDtRangeOrder` validator, plus a Now / Clear / Done action footer and a matching `[ngxDtStartDateTime]`/`[ngxDtEndDateTime]` two-input form-control container.

**Architecture:** Reuse the Plan 6 bridge `NgxDtDateTimeAdapter<DT, D, T>` unchanged except for one new concrete `compareTime` helper. The existing `NgxDtPicker<D>` gains a `datetime-range` branch: the calendar's `[selected]` binds to a `DateRange` of the value's **date parts**, `(_userSelection)` lifts the strategy's date-part range back into a `DateRange<PlainDateTime>` (carrying each end's time or defaulting to midnight, clamped to `[min, max]`), and two time panels edit each end's time. Same-day ordering is prevented up front by cross-constraining each panel's `[min]`/`[max]` (end-panel floor = start time; start-panel ceiling = end time) and backstopped by an `ngxDtRangeOrder` validator on the input container. A new `NgxDtDateTimeRangeInput` (parallel sibling of `NgxDtDateRangeInput`, but datetime-typed) owns the `DateRange<PlainDateTime>` as a `ControlValueAccessor` + `Validator` and registers through the existing `NgxDtPickerRangeInput<D>` seam.

**Tech Stack:** Angular 22 (standalone, signals, zoneless), `@angular/material` `MatCalendar` + range strategy (`DefaultMatCalendarRangeStrategy`, `MAT_DATE_RANGE_SELECTION_STRATEGY`, `MatRangeDateSelectionModel`), `DateRange`, `@angular/cdk` overlay/a11y, `temporal-polyfill` (`Temporal.PlainDateTime`/`PlainDate`/`PlainTime`), Vitest (`@angular/build:unit-test`).

## Global Constraints

Copied from `.claude/CLAUDE.md` and the design doc — every task implicitly includes these:

- Standalone components/directives. Do **NOT** set `standalone: true`. Do **NOT** set `changeDetection: ChangeDetectionStrategy.OnPush` (both are defaults in v22).
- Use signals: `input()`, `output()`, `model()`, `computed()`. No `@HostBinding`/`@HostListener` — put bindings in the `host` object. No `ngClass`/`ngStyle` — use `class`/`style` bindings. Native control flow (`@if`/`@for`/`@switch`).
- `inject()` over constructor injection. No new singletons in this plan (the bridge adapter `compareTime` is a concrete method on the existing abstract class; no new DI tokens).
- TypeScript strict; avoid `any`, use `unknown`. The picker bridges two type-worlds (whole `PlainDateTime` vs. `PlainDate`/`PlainTime` parts); the few unavoidable casts at the `MatCalendar`/`NgxDtTimePanel` template seams are written `as unknown as D` with an explanatory comment, exactly as the Plan 6 `datetime` branch already does.
- Accessibility: MUST pass AXE / WCAG AA — focus management, color contrast, ARIA. Each time panel is a labelled group (`ariaLabel="Choose a start time"` / `"Choose an end time"`) with a visible caption; action-footer buttons are real tab stops with visible focus and ≥24px targets; custom parts consume `--mat-sys-*` tokens.
- Every commit ends with the trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Library test command: `npx ng test --project ngx-datetime-picker` (focus a file with `-- <spec-substring>`). Full suite: `npm test`.
- Baseline before this plan (on `main`, merge commit `986b97d`): library **176** tests green, app **5** tests green.

## Decisions locked during planning (datetime-range UX)

- **Single calendar + two time panels.** Plan 4 shipped a single `MatCalendar` in range mode (not the dual calendar from the master sketch); datetime-range follows the actual implementation — one range calendar plus a start-time panel and an end-time panel stacked below it.
- **Immediate-commit (no draft state).** Every calendar/time edit updates the `DateRange` value immediately, consistent with all other variants. Cancel-revert is deferred to the Polish plan.
- **Same-day order = clamp panels AND validator (belt + suspenders).** When start and end fall on the same calendar day, the end-time panel's floor is the start time and the start-time panel's ceiling is the end time, so an out-of-order time cannot be picked in the panel. The `NgxDtDateTimeRangeInput` validator additionally reports `ngxDtRangeOrder` when a directly-typed `end < start` (full datetime compare) slips through.
- **Footer = Now / Clear / Done.** `Now` fills the first empty end (start first, else end) with the clamped current datetime; if both ends are already set it is a no-op. `Clear` empties both ends. `Done` closes the overlay (popup mode only; absent inline). The range never auto-closes on calendar completion — the time still needs setting.

## File Structure

**Modify (core):**
- `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.ts` — add one concrete `compareTime(a, b)` method (date-independent time compare via `combine` + `compareDateTime`).
- `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.spec.ts` — add a `compareTime` test.
- `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts` — add `'datetime-range'` to `NgxDtPickerType`; add `isDateTimeRange`/`calendarRangeMode`/`isAnyDateTime` computeds; extend `calendarSelection`/`calendarMin`/`calendarMax`/`effectiveStartAt`; add the `onUserSelection` datetime-range lift + a `commitRange` helper; add the two time-panel computeds/handlers; extend the footer handlers; restructure the `#panel` template + styles.
- `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts` — datetime-range integration tests (calendar composition in Task 2; time panels + footer in Task 3).

**Create:**
- `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.ts` — `NgxDtDateTimeRangeInput` container + `NgxDtDateTimeRangePartBase` + `NgxDtStartDateTime`/`NgxDtEndDateTime` part directives (CVA + Validator + `NgxDtPickerRangeInput<T>`).
- `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.spec.ts` — text I/O + picker bridge.
- `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.validators.spec.ts` — min/max/order/parse validation.
- `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.forms.spec.ts` — Reactive + ngModel + Signal Forms integration.

**Modify (exports + demo):**
- `projects/ngx-datetime-picker/src/public-api.ts` — export `NgxDtDateTimeRangeInput`, `NgxDtStartDateTime`, `NgxDtEndDateTime`.
- `src/app/app.ts`, `src/app/app.html` — datetime-range demo section.

**No temporal entry-point changes:** `TemporalDateTimeAdapter` + `provideTemporalDateTimeAdapter()` (Plan 6) already supply everything datetime-range needs, and `compareTime` is concrete on the base class so the temporal adapter inherits it.

## Interfaces (the contract every task shares)

The Plan 6 bridge (unchanged abstract surface) plus one new concrete method:

```ts
export abstract class NgxDtDateTimeAdapter<DT, D = unknown, T = unknown> {
  // ...existing abstract: now/getDate/getTime/combine/compareDateTime/compareDate/isValid/invalid/parse/format, protected startOfDayTime()
  // ...existing concrete: sameDateTime/sameDatePart/clampDateTime/withDate/withTime
  compareTime(a: T, b: T): number; // NEW (Task 1): <0 / 0 / >0, date-independent
}
```

Picker additions (Tasks 2–3), all `protected`/private except the type union:

```ts
export type NgxDtPickerType = 'date' | 'date-range' | 'time' | 'datetime' | 'datetime-range';

// computeds
isDateTimeRange(): boolean;        // type() === 'datetime-range'
calendarRangeMode(): boolean;      // isRange() || isDateTimeRange()
isAnyDateTime(): boolean;          // isDateTime() || isDateTimeRange()
startTimePanelValue(): D | null;   // time part of range start (cast)
endTimePanelValue(): D | null;     // time part of range end (cast)
startTimePanelMin(): D | null;     // picker-min floor on start's day
startTimePanelMax(): D | null;     // earlier of picker-max ceiling and (same-day) end time
endTimePanelMin(): D | null;       // later of picker-min floor and (same-day) start time
endTimePanelMax(): D | null;       // picker-max ceiling on end's day

// handlers
onStartTimeChange(time: D | null): void;
onEndTimeChange(time: D | null): void;
// onUserSelection / onNowClick / onClearClick gain datetime-range branches
// commitRange(range: DateRange<D>): void  (private helper)
```

Range input container (Task 4) — registers through the **existing** `NgxDtPickerRangeInput<D>` seam (`range`, `setRangeFromPicker`, `getOverlayOrigin`):

```ts
export class NgxDtDateTimeRangeInput<T = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerRangeInput<T> {
  readonly picker: InputSignal<NgxDtPicker<T>>;   // alias 'rangePicker'
  readonly range: Signal<DateRange<T>>;
  readonly rangeChange: OutputEmitterRef<DateRange<T>>;
  // validator error keys: ngxDtRangeStart, ngxDtRangeEnd, ngxDtMin, ngxDtMax, ngxDtRangeOrder
}
export class NgxDtStartDateTime<T> { /* input[ngxDtStartDateTime] */ }
export class NgxDtEndDateTime<T>   { /* input[ngxDtEndDateTime] */ }
```

---

### Task 1: Bridge `compareTime` (core adapter)

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.ts`
- Test: `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.spec.ts`

**Interfaces:**
- Produces: `compareTime(a: T, b: T): number` (concrete on the abstract class). Consumed by the picker time-panel clamp computeds (Task 3).

- [ ] **Step 1: Write the failing test**

Append to `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.spec.ts`, inside the existing `describe('NgxDtDateTimeAdapter (concrete bridge)', ...)` block (after the `withTime` test):

```ts
  it('compareTime orders time parts independent of date', () => {
    // Fake: time = minute-of-day. now() === 0 so getDate(now()) === 0.
    expect(a.compareTime(30, 45)).toBeLessThan(0);
    expect(a.compareTime(45, 30)).toBeGreaterThan(0);
    expect(a.compareTime(30, 30)).toBe(0);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-adapter`
Expected: FAIL — `a.compareTime is not a function`.

- [ ] **Step 3: Implement `compareTime`**

In `projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.ts`, add this concrete method immediately after `sameDatePart(...)` (keep it grouped with the other concrete helpers):

```ts
  /**
   * Compare two time parts independent of any date: combine each with a common
   * (today's) date and compare the resulting datetimes. Negative if `a` is
   * earlier than `b`, 0 if equal, positive if later.
   */
  compareTime(a: T, b: T): number {
    const date = this.getDate(this.now());
    return this.compareDateTime(this.combine(date, a), this.combine(date, b));
  }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-adapter`
Expected: PASS (all bridge tests green).

- [ ] **Step 5: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.ts \
        projects/ngx-datetime-picker/src/lib/datetime/ngx-dt-datetime-adapter.spec.ts
git commit -m "$(cat <<'EOF'
feat(datetime): NgxDtDateTimeAdapter.compareTime (date-independent time compare)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Picker — `datetime-range` calendar composition

Add the `datetime-range` branch that makes the range calendar compose a `DateRange<PlainDateTime>` (carrying each end's time or midnight, clamped to `[min, max]`) routed through the existing range seam. No time panels or footer yet (Task 3) — the calendar alone is testable via the `[(range)]` model.

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Consumes: `NgxDtDateTimeAdapter` (`getDate`/`getTime`/`withDate`/`compareDate`/`clampDateTime`/`isValid`), `DateRange`, `DefaultMatCalendarRangeStrategy`/`MAT_DATE_RANGE_SELECTION_STRATEGY`/`MatDateRangeSelectionStrategy` (already imported), the existing `datePart(value)` private helper, and the existing `rangeDisplayValue()` computed (returns `DateRange<D> | null`).
- Produces: `'datetime-range'` in `NgxDtPickerType`; `isDateTimeRange`/`calendarRangeMode`/`isAnyDateTime` computeds; a `commitRange` private helper. Consumed by Task 3 (time panels/footer) and Task 4 (range input bridge).

- [ ] **Step 1: Write the failing tests**

Append to `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts` (the file already imports `provideTemporalDateTimeAdapter`, `DateRange`, `NgxDtPickerRangeInput`, `signal`, `viewChild`, `ElementRef`, and has the `rangeCells` helper):

```ts
// --- Plan 7: datetime-range — calendar composition -----------------------

@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker #picker type="datetime-range" [inline]="true" [(range)]="range" />
  `,
})
class InlineDateTimeRangeHost {
  range = signal<DateRange<Temporal.PlainDateTime> | null>(null);
}

@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker
      #picker
      type="datetime-range"
      [inline]="true"
      [(range)]="range"
      [min]="min()"
      [max]="max()"
    />
  `,
})
class ConstrainedDateTimeRangeHost {
  range = signal<DateRange<Temporal.PlainDateTime> | null>(null);
  min = signal<Temporal.PlainDateTime | null>(null);
  max = signal<Temporal.PlainDateTime | null>(null);
}

/** Minimal fake datetime range input implementing the picker's range contract. */
class FakeDateTimeRangeInput
  implements NgxDtPickerRangeInput<Temporal.PlainDateTime>
{
  readonly _range = signal<DateRange<Temporal.PlainDateTime> | null>(null);
  readonly range = this._range.asReadonly();
  fromPicker: DateRange<Temporal.PlainDateTime> | undefined;
  readonly origin = document.createElement('div');
  setRangeFromPicker(range: DateRange<Temporal.PlainDateTime>): void {
    this.fromPicker = range;
    this._range.set(range);
  }
  getOverlayOrigin(): HTMLElement {
    return this.origin;
  }
}

describe('NgxDtPicker — datetime-range calendar composition', () => {
  function setupDateTimeRange() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateTimeAdapter(),
      ],
    });
  }
  beforeEach(setupDateTimeRange);

  it('renders a range calendar inline', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('mat-calendar')).toBeTruthy();
  });

  it('first click sets the start at midnight with a null end', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    rangeCells(fixture)[4].click(); // 5th
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range();
    expect(r?.start).toBeInstanceOf(Temporal.PlainDateTime);
    expect(r?.start?.day).toBe(5);
    expect(r?.start?.hour).toBe(0);
    expect(r?.end).toBeNull();
  });

  it('a second click completes the range (end at midnight, ordered)', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const cells = rangeCells(fixture);
    cells[4].click(); // start = 5th
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click(); // end = 10th
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range()!;
    expect(r.start?.day).toBe(5);
    expect(r.end?.day).toBe(10);
    expect(r.end?.hour).toBe(0);
    expect(
      Temporal.PlainDateTime.compare(r.end!, r.start!),
    ).toBeGreaterThanOrEqual(0);
  });

  it('carries the start time across a date re-pick and defaults a new end to midnight', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.componentInstance.range.set(
      new DateRange(Temporal.PlainDateTime.from('2026-06-21T09:30'), null),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    rangeCells(fixture)[24].click(); // 25th -> completes the range (after the 21st)
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range()!;
    expect(r.start?.day).toBe(21);
    expect(r.start?.hour).toBe(9); // start time carried
    expect(r.start?.minute).toBe(30);
    expect(r.end?.day).toBe(25);
    expect(r.end?.hour).toBe(0); // brand-new end -> midnight
  });

  it('clamps a calendar pick onto the min day up to the min time', async () => {
    const fixture = TestBed.createComponent(ConstrainedDateTimeRangeHost);
    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-21T14:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    // First click on the 21st -> 2026-06-21T00:00 -> below min -> clamp to 14:00.
    const cells = rangeCells(fixture);
    cells[20].click(); // 21st
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range()!;
    expect(r.start?.day).toBe(21);
    expect(r.start?.hour).toBe(14);
    expect(r.start?.minute).toBe(0);
  });

  it('routes range selection to the registered range input, not [(range)]', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const picker = fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDateTime>;
    const input = new FakeDateTimeRangeInput();
    picker.registerRangeInput(input);

    rangeCells(fixture)[4].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.fromPicker?.start).toBeInstanceOf(Temporal.PlainDateTime);
    expect(fixture.componentInstance.range()).toBeNull();
  });

  it('does not auto-close in overlay datetime-range mode after completing the range', async () => {
    @Component({
      imports: [NgxDtPicker],
      template: `
        <button #trigger type="button">open</button>
        <ngx-dt-picker #picker type="datetime-range" [(range)]="range" />
      `,
    })
    class OverlayDateTimeRangeHost {
      range = signal<DateRange<Temporal.PlainDateTime> | null>(null);
      readonly picker =
        viewChild.required<NgxDtPicker<Temporal.PlainDateTime>>('picker');
      readonly trigger = viewChild.required<unknown, ElementRef<HTMLButtonElement>>(
        'trigger',
        { read: ElementRef },
      );
    }
    const fixture = TestBed.createComponent(OverlayDateTimeRangeHost);
    fixture.detectChanges();
    fixture.componentInstance.picker().open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    const cells = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.cdk-overlay-container .mat-calendar-body-cell',
      ),
    );
    cells[4].click();
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker`
Expected: FAIL — `datetime-range` is not assignable to `NgxDtPickerType` (compile error) and/or the calendar composes the wrong values.

- [ ] **Step 3: Add the type, computeds, and `commitRange` helper**

In `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`:

3a. Extend the type union (and its doc comment):

```ts
/** Picker variants. All five are implemented. */
export type NgxDtPickerType =
  | 'date'
  | 'date-range'
  | 'time'
  | 'datetime'
  | 'datetime-range';
```

3b. Add these computeds next to the existing `isDateTime` computed:

```ts
  readonly isDateTimeRange = computed(() => this.type() === 'datetime-range');

  /** The calendar runs in range-selection mode for both range variants. */
  readonly calendarRangeMode = computed(
    () => this.isRange() || this.isDateTimeRange(),
  );

  /** Either datetime variant decomposes the value into date + time parts. */
  readonly isAnyDateTime = computed(
    () => this.isDateTime() || this.isDateTimeRange(),
  );
```

3c. Add the `commitRange` private helper next to the existing `commitValue` helper:

```ts
  /** Write a range through the registered range input seam, else the model. */
  private commitRange(range: DateRange<D>): void {
    const input = this._rangeInput();
    if (input) {
      input.setRangeFromPicker(range);
    } else {
      this.range.set(range);
    }
  }
```

- [ ] **Step 4: Wire the datetime-range branches into the calendar computeds and handlers**

4a. Extend `calendarSelection` — add the `isDateTimeRange` branch (date parts of the range), keeping the existing branches:

```ts
  /** What the calendar's `[selected]` binds to — a range, a date, or a date part. */
  protected readonly calendarSelection = computed<DateRange<D> | D | null>(() => {
    if (this.isRange()) {
      return this.rangeDisplayValue() ?? this._emptyRange;
    }
    if (this.isDateTimeRange()) {
      // The calendar runs the PlainDate adapter, so it consumes the date parts
      // of the datetime range. `datePart` already casts via `as unknown as D`.
      const r = this.rangeDisplayValue();
      return new DateRange<D>(
        this.datePart(r?.start ?? null),
        this.datePart(r?.end ?? null),
      );
    }
    if (this.isDateTime()) {
      return this.datePart(this.displayValue());
    }
    return this.displayValue();
  });
```

4b. Switch `calendarMin`/`calendarMax` to `isAnyDateTime()` (was `isDateTime()`):

```ts
  /** Calendar `[minDate]`/`[maxDate]` — date parts in either datetime mode. */
  protected readonly calendarMin = computed<D | null>(() =>
    this.isAnyDateTime() ? this.datePart(this.min()) : this.min(),
  );
  protected readonly calendarMax = computed<D | null>(() =>
    this.isAnyDateTime() ? this.datePart(this.max()) : this.max(),
  );
```

4c. Extend `effectiveStartAt` with the datetime-range anchor:

```ts
  protected readonly effectiveStartAt = computed(() => {
    const adapter = this.adapter;
    if (!adapter) {
      return null;
    }
    let anchor: D | null;
    if (this.isDateTimeRange()) {
      anchor = this.datePart(this.rangeDisplayValue()?.start ?? null);
    } else if (this.isRange()) {
      anchor = this.rangeDisplayValue()?.start ?? null;
    } else if (this.isDateTime()) {
      anchor = this.datePart(this.displayValue());
    } else {
      anchor = this.displayValue();
    }
    const startAt = this.isAnyDateTime()
      ? this.datePart(this.startAt())
      : this.startAt();
    return anchor ?? startAt ?? adapter.today();
  });
```

4d. Guard `onSelectedChange` against both range modes (was `isRange()`):

```ts
  protected onSelectedChange(date: D | null): void {
    if (this.calendarRangeMode()) {
      return; // range selection is handled via (_userSelection)
    }
    // ...unchanged datetime / single-date body...
```

4e. Replace `onUserSelection` with the version that handles both range modes and lifts date parts back into datetimes for datetime-range. (The date-range path is unchanged except it now calls `commitRange`.)

```ts
  protected onUserSelection(event: MatCalendarUserEvent<D | null>): void {
    if (!this.calendarRangeMode()) {
      return; // single-date selection is handled via (selectedChange)
    }
    const strategy = this.injector.get<MatDateRangeSelectionStrategy<D>>(
      MAT_DATE_RANGE_SELECTION_STRATEGY,
    );

    if (this.isDateTimeRange()) {
      const dt = this.dtAdapter;
      if (!dt) return;
      const current = this.rangeDisplayValue() ?? this._emptyRange;
      // Feed the strategy a date-part range (it compares dates); then lift each
      // end back to a datetime, carrying its existing time (or midnight) and
      // clamping the composed value into [min, max].
      const currentDates = new DateRange<D>(
        this.datePart(current.start),
        this.datePart(current.end),
      );
      const nextDates = strategy.selectionFinished(
        event.value,
        currentDates,
        event.event,
      );
      const start =
        nextDates.start == null
          ? null
          : dt.clampDateTime(
              dt.withDate(current.start, nextDates.start),
              this.min(),
              this.max(),
            );
      const end =
        nextDates.end == null
          ? null
          : dt.clampDateTime(
              dt.withDate(current.end, nextDates.end),
              this.min(),
              this.max(),
            );
      this.commitRange(new DateRange<D>(start, end));
      return; // datetime-range stays open — the time still needs setting
    }

    const current = this.rangeDisplayValue() ?? this._emptyRange;
    const next = strategy.selectionFinished(event.value, current, event.event);
    this.commitRange(next);
    if (!this.inline() && next.start !== null && next.end !== null) {
      this.close();
    }
  }
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker`
Expected: PASS — the new datetime-range composition tests pass and every pre-existing picker test (date, date-range, time, datetime) stays green.

- [ ] **Step 6: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts \
        projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts
git commit -m "$(cat <<'EOF'
feat(picker): type="datetime-range" calendar composes a DateRange of PlainDateTime

Calendar selection lifts date-part range -> datetime range (carry time / midnight),
clamped to [min, max], routed through the existing range seam. No time panels yet.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Picker — two time panels + same-day clamp + footer

Render the start-time and end-time panels under the calendar, cross-constrain them so same-day order cannot be broken, and extend the action footer (Now / Clear / Done) to range semantics.

**Files:**
- Modify: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`
- Test: `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

**Interfaces:**
- Consumes: `compareTime` (Task 1) via `dtAdapter`; `getTime`/`withTime`/`compareDate`/`clampDateTime`/`isValid`/`now`; `rangeDisplayValue()`, `commitRange`, `isDateTimeRange`, `isAnyDateTime` (Task 2); `NgxDtTimePanel` (already imported).
- Produces: `startTimePanelValue`/`endTimePanelValue`/`startTimePanelMin`/`startTimePanelMax`/`endTimePanelMin`/`endTimePanelMax` computeds; `onStartTimeChange`/`onEndTimeChange` handlers; datetime-range branches in `onNowClick`/`onClearClick`.

- [ ] **Step 1: Write the failing tests**

Append to `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`:

```ts
// --- Plan 7: datetime-range — time panels + footer -----------------------

@Component({
  imports: [NgxDtPicker],
  template: `
    <button #trigger type="button">open</button>
    <ngx-dt-picker #picker type="datetime-range" [(range)]="range" />
  `,
})
class OverlayDtRangeHost {
  range = signal<DateRange<Temporal.PlainDateTime> | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDateTime>>('picker');
  readonly trigger = viewChild.required<unknown, ElementRef<HTMLButtonElement>>(
    'trigger',
    { read: ElementRef },
  );
}

describe('NgxDtPicker — datetime-range time panels + footer', () => {
  function setupDtRange() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateTimeAdapter(),
      ],
    });
  }
  beforeEach(setupDtRange);

  function root(fixture: { nativeElement: HTMLElement }): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders two time panels inline', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(root(fixture).querySelectorAll('ngx-dt-time-panel').length).toBe(2);
  });

  it('editing the start time recombines the start, leaving the end intact', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.componentInstance.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:00'),
        Temporal.PlainDateTime.from('2026-06-20T17:00'),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const upHours = root(fixture).querySelectorAll<HTMLButtonElement>(
      '[data-testid="up-hour"]',
    );
    upHours[0].click(); // start panel
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range()!;
    expect(r.start?.day).toBe(10);
    expect(r.start?.hour).toBe(10);
    expect(r.end?.hour).toBe(17); // unchanged
  });

  it('editing the end time recombines the end, leaving the start intact', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.componentInstance.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:00'),
        Temporal.PlainDateTime.from('2026-06-20T17:00'),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const upHours = root(fixture).querySelectorAll<HTMLButtonElement>(
      '[data-testid="up-hour"]',
    );
    upHours[1].click(); // end panel
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range()!;
    expect(r.start?.hour).toBe(9); // unchanged
    expect(r.end?.day).toBe(20);
    expect(r.end?.hour).toBe(18);
  });

  it('exposes same-day order bounds on the panel computeds, null across days', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.componentInstance.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T10:00'),
        Temporal.PlainDateTime.from('2026-06-10T15:00'),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const picker = fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDateTime>;
    const internals = picker as unknown as {
      startTimePanelMax: () => Temporal.PlainTime | null;
      endTimePanelMin: () => Temporal.PlainTime | null;
    };
    // Same day: start ceiling = end time (15:00); end floor = start time (10:00).
    expect(internals.startTimePanelMax()).toBeInstanceOf(Temporal.PlainTime);
    expect(internals.startTimePanelMax()!.hour).toBe(15);
    expect(internals.endTimePanelMin()).toBeInstanceOf(Temporal.PlainTime);
    expect(internals.endTimePanelMin()!.hour).toBe(10);

    // Different days: no cross constraint.
    fixture.componentInstance.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T10:00'),
        Temporal.PlainDateTime.from('2026-06-12T15:00'),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    expect(internals.startTimePanelMax()).toBeNull();
    expect(internals.endTimePanelMin()).toBeNull();
  });

  it('clamps the end time up to the start time on the same day (cannot go earlier)', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.componentInstance.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T10:00'),
        Temporal.PlainDateTime.from('2026-06-10T10:00'),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    const downHours = root(fixture).querySelectorAll<HTMLButtonElement>(
      '[data-testid="down-hour"]',
    );
    downHours[1].click(); // end down -> 09:00 -> clamped back to start 10:00
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range()!;
    expect(r.end?.hour).toBe(10);
  });

  it('Now fills the first empty end, then the other, then no-ops', async () => {
    const fixture = TestBed.createComponent(OverlayDtRangeHost);
    fixture.detectChanges();
    fixture.componentInstance.picker().open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    const now = () =>
      document.querySelector<HTMLButtonElement>(
        '.cdk-overlay-container [data-testid="dt-now"]',
      )!;
    now().click();
    fixture.detectChanges();
    await fixture.whenStable();
    let r = fixture.componentInstance.range()!;
    expect(r.start).toBeInstanceOf(Temporal.PlainDateTime);
    expect(r.end).toBeNull();

    now().click();
    fixture.detectChanges();
    await fixture.whenStable();
    r = fixture.componentInstance.range()!;
    expect(r.end).toBeInstanceOf(Temporal.PlainDateTime);
    const filled = r;

    now().click(); // both set -> no-op
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.range()).toBe(filled);
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });

  it('Clear empties both ends', async () => {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.componentInstance.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:00'),
        Temporal.PlainDateTime.from('2026-06-20T17:00'),
      ),
    );
    fixture.detectChanges();
    await fixture.whenStable();
    root(fixture)
      .querySelector<HTMLButtonElement>('[data-testid="dt-clear"]')!
      .click();
    fixture.detectChanges();
    await fixture.whenStable();
    const r = fixture.componentInstance.range();
    expect(r?.start).toBeNull();
    expect(r?.end).toBeNull();
  });

  it('Done closes the overlay; it is absent inline', async () => {
    const overlay = TestBed.createComponent(OverlayDtRangeHost);
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

    const inline = TestBed.createComponent(InlineDateTimeRangeHost);
    inline.detectChanges();
    await inline.whenStable();
    expect(
      (inline.nativeElement as HTMLElement).querySelector('[data-testid="dt-done"]'),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker`
Expected: FAIL — only one (or zero) `ngx-dt-time-panel` rendered in datetime-range; the panel computeds and `onStartTimeChange`/`onEndTimeChange` don't exist.

- [ ] **Step 3: Add the time-part + boundary helpers and panel computeds**

In `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`, first refactor the existing `boundaryTime` to delegate to a value-anchored helper, then add the range helpers and computeds. Replace the existing `boundaryTime` method with:

```ts
  /**
   * The bound's time (as `D` for the time-panel binding) iff `v` falls on the
   * bound's calendar day, else null. `null` bounds/values yield null.
   */
  private boundOnDay(v: D | null, bound: D | null): D | null {
    const dt = this.dtAdapter;
    if (!dt || v == null || bound == null || !dt.isValid(v) || !dt.isValid(bound)) {
      return null;
    }
    return dt.compareDate(v, bound) === 0
      ? (dt.getTime(bound) as unknown as D)
      : null;
  }

  /**
   * Time-panel floor for the single-datetime variant: the bound's time only on
   * the bound's day (anchored to the current value). In pure-time mode the
   * caller uses `min()`/`max()` directly.
   */
  private boundaryTime(bound: D | null): D | null {
    return this.boundOnDay(this.displayValue(), bound);
  }
```

Then add these range helpers and computeds (place them after the existing `timePanelMin`/`timePanelMax`):

```ts
  /** Time part (cast as `D` for the time-panel binding) of a datetime value. */
  private timePartOf(value: D | null): D | null {
    const dt = this.dtAdapter;
    return dt && value != null && dt.isValid(value)
      ? (dt.getTime(value) as unknown as D)
      : null;
  }

  /** Whether two datetime values fall on the same calendar day. */
  private sameDay(a: D | null, b: D | null): boolean {
    const dt = this.dtAdapter;
    return (
      !!dt &&
      a != null &&
      b != null &&
      dt.isValid(a) &&
      dt.isValid(b) &&
      dt.compareDate(a, b) === 0
    );
  }

  /** The earlier of two times (null = unbounded). */
  private earlierTime(a: D | null, b: D | null): D | null {
    const dt = this.dtAdapter;
    if (a == null) return b;
    if (b == null) return a;
    if (!dt) return a;
    return dt.compareTime(a, b) <= 0 ? a : b;
  }

  /** The later of two times (null = unbounded). */
  private laterTime(a: D | null, b: D | null): D | null {
    const dt = this.dtAdapter;
    if (a == null) return b;
    if (b == null) return a;
    if (!dt) return a;
    return dt.compareTime(a, b) >= 0 ? a : b;
  }

  protected readonly startTimePanelValue = computed<D | null>(() =>
    this.timePartOf(this.rangeDisplayValue()?.start ?? null),
  );
  protected readonly endTimePanelValue = computed<D | null>(() =>
    this.timePartOf(this.rangeDisplayValue()?.end ?? null),
  );

  // Start panel: floor from the picker min on the start's day; ceiling is the
  // earlier of the picker max (on the start's day) and the end time on a shared
  // day — so the start can never be pushed past the end.
  protected readonly startTimePanelMin = computed<D | null>(() =>
    this.boundOnDay(this.rangeDisplayValue()?.start ?? null, this.min()),
  );
  protected readonly startTimePanelMax = computed<D | null>(() => {
    const r = this.rangeDisplayValue();
    const start = r?.start ?? null;
    const end = r?.end ?? null;
    const pickerCeil = this.boundOnDay(start, this.max());
    const sameDayEnd = this.sameDay(start, end) ? this.timePartOf(end) : null;
    return this.earlierTime(pickerCeil, sameDayEnd);
  });

  // End panel: ceiling from the picker max on the end's day; floor is the later
  // of the picker min (on the end's day) and the start time on a shared day.
  protected readonly endTimePanelMin = computed<D | null>(() => {
    const r = this.rangeDisplayValue();
    const start = r?.start ?? null;
    const end = r?.end ?? null;
    const pickerFloor = this.boundOnDay(end, this.min());
    const sameDayStart = this.sameDay(start, end) ? this.timePartOf(start) : null;
    return this.laterTime(pickerFloor, sameDayStart);
  });
  protected readonly endTimePanelMax = computed<D | null>(() =>
    this.boundOnDay(this.rangeDisplayValue()?.end ?? null, this.max()),
  );
```

- [ ] **Step 4: Add the time-change handlers and extend the footer handlers**

Add the two range time handlers (next to the existing `onTimeChange`):

```ts
  protected onStartTimeChange(time: D | null): void {
    if (!this.isDateTimeRange()) return;
    const dt = this.dtAdapter;
    if (!dt) return;
    const r = this.rangeDisplayValue() ?? this._emptyRange;
    const start =
      time == null
        ? null
        : dt.clampDateTime(dt.withTime(r.start, time), this.min(), this.max());
    this.commitRange(new DateRange<D>(start, r.end));
  }

  protected onEndTimeChange(time: D | null): void {
    if (!this.isDateTimeRange()) return;
    const dt = this.dtAdapter;
    if (!dt) return;
    const r = this.rangeDisplayValue() ?? this._emptyRange;
    const end =
      time == null
        ? null
        : dt.clampDateTime(dt.withTime(r.end, time), this.min(), this.max());
    this.commitRange(new DateRange<D>(r.start, end));
  }
```

Extend `onNowClick` and `onClearClick` with datetime-range branches:

```ts
  protected onNowClick(): void {
    const dt = this.dtAdapter;
    if (!dt) return;
    const now = dt.clampDateTime(dt.now(), this.min(), this.max());
    if (this.isDateTimeRange()) {
      const r = this.rangeDisplayValue() ?? this._emptyRange;
      if (r.start == null) {
        this.commitRange(new DateRange<D>(now, r.end));
      } else if (r.end == null) {
        this.commitRange(new DateRange<D>(r.start, now));
      }
      // both ends already set -> no-op
      return;
    }
    this.commitValue(now);
  }

  protected onClearClick(): void {
    if (this.isDateTimeRange()) {
      this.commitRange(this._emptyRange);
      return;
    }
    this.commitValue(null);
  }
```

(`onDoneClick` is unchanged — it just `close()`s.)

- [ ] **Step 5: Restructure the `#panel` template and add styles**

Replace the entire `<ng-template #panel> ... </ng-template>` block with the version below (the `@if (isTime())` branch is unchanged; the `@else` branch now uses `isAnyDateTime()` for layout/footer, keeps the single datetime panel under `@if (isDateTime())`, and adds the two range panels under `@if (isDateTimeRange())`):

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
        <div class="ngx-dt-body" [class.ngx-dt-body-datetime]="isAnyDateTime()">
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
          @if (isDateTimeRange()) {
            <div class="ngx-dt-range-times">
              <div class="ngx-dt-range-time">
                <span class="ngx-dt-range-time-label">Start time</span>
                <ngx-dt-time-panel
                  [value]="startTimePanelValue()"
                  (valueChange)="onStartTimeChange($event)"
                  [min]="startTimePanelMin()"
                  [max]="startTimePanelMax()"
                  [hourCycle]="hourCycle()"
                  [minuteStep]="minuteStep()"
                  [showSeconds]="showSeconds()"
                  [disabled]="disabled()"
                  ariaLabel="Choose a start time"
                />
              </div>
              <div class="ngx-dt-range-time">
                <span class="ngx-dt-range-time-label">End time</span>
                <ngx-dt-time-panel
                  [value]="endTimePanelValue()"
                  (valueChange)="onEndTimeChange($event)"
                  [min]="endTimePanelMin()"
                  [max]="endTimePanelMax()"
                  [hourCycle]="hourCycle()"
                  [minuteStep]="minuteStep()"
                  [showSeconds]="showSeconds()"
                  [disabled]="disabled()"
                  ariaLabel="Choose an end time"
                />
              </div>
            </div>
          }
          @if (isAnyDateTime()) {
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
          }
        </div>
      }
    </ng-template>
```

Add these rules to the existing `styles` array (after the `.ngx-dt-body-datetime` rule):

```css
      .ngx-dt-range-times {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .ngx-dt-range-time {
        display: flex;
        flex-direction: column;
      }
      .ngx-dt-range-time-label {
        padding: 0 8px;
        font: var(--mat-sys-label-small, inherit);
        color: var(--mat-sys-on-surface-variant, inherit);
      }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-picker`
Expected: PASS — datetime-range time-panel + footer tests pass; all earlier picker tests (including Task 2's) stay green.

- [ ] **Step 7: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts \
        projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts
git commit -m "$(cat <<'EOF'
feat(picker): datetime-range start/end time panels + same-day clamp + footer

Two labelled time panels under the range calendar; panel min/max cross-constrain
so same-day order can't be broken; Now/Clear/Done footer (Now fills first empty end).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `NgxDtDateTimeRangeInput` two-input container

A parallel sibling of `NgxDtDateRangeInput`, datetime-typed: parses/formats via `NgxDtDateTimeAdapter`, owns a `DateRange<PlainDateTime>` as a `ControlValueAccessor` + `Validator`, and registers through the existing `NgxDtPickerRangeInput<T>` seam. The order validator uses the full datetime compare (`compareDateTime`), so same-day `end < start` typed directly is flagged. (Like the single `NgxDtDateTimeInput`, the input-side validator does **not** apply `dateFilter` — that input-side filter is a Polish-plan item.)

**Files:**
- Create: `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.ts`
- Test: `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.spec.ts`
- Test: `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.validators.spec.ts`
- Test: `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.forms.spec.ts`
- Modify: `projects/ngx-datetime-picker/src/public-api.ts`

**Interfaces:**
- Consumes: `NgxDtPicker`, `NgxDtOrigin`, `NgxDtPickerRangeInput` (from the picker), `NgxDtDateTimeAdapter` (`parse`/`format`/`isValid`/`sameDateTime`/`compareDateTime`), `DateRange`, `picker.min()`/`picker.max()`.
- Produces: `NgxDtDateTimeRangeInput<T>`, `NgxDtStartDateTime<T>`, `NgxDtEndDateTime<T>`; validator error keys `ngxDtRangeStart`/`ngxDtRangeEnd`/`ngxDtMin`/`ngxDtMax`/`ngxDtRangeOrder`.

- [ ] **Step 1: Write the failing text-I/O + picker-bridge spec**

Create `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.spec.ts`:

```ts
import { Component, signal, viewChild } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { By } from '@angular/platform-browser';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import {
  NgxDtDateTimeRangeInput,
  NgxDtEndDateTime,
  NgxDtStartDateTime,
} from './ngx-dt-datetime-range-input';

@Component({
  imports: [
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
    NgxDtPicker,
    ReactiveFormsModule,
  ],
  template: `
    <ngx-dt-datetime-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDateTime #start="ngxDtStartDateTime" />
      <input ngxDtEndDateTime #end="ngxDtEndDateTime" />
    </ngx-dt-datetime-range-input>
    <ngx-dt-picker #picker [inline]="true" type="datetime-range" />
  `,
})
class Host {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDateTime>>('picker');
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

function inputs(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = fixture.nativeElement.querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateTimeRangeInput — text I/O', () => {
  beforeEach(setup);

  it('aggregates typed start + end into a DateRange of PlainDateTime', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = inputs(fixture);
    type(start, '2026-06-10T09:30');
    type(end, '2026-06-20T17:45');
    fixture.detectChanges();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDateTime.from('2026-06-10T09:30'));
    expect(value.end).toEqual(Temporal.PlainDateTime.from('2026-06-20T17:45'));
  });

  it('writes a DateRange model down into both inputs (formatted)', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:30'),
        Temporal.PlainDateTime.from('2026-06-20T17:45'),
      ),
    );
    fixture.detectChanges();

    const { start, end } = inputs(fixture);
    // Locale display: date + 24h time. Assert robustly rather than exact glyphs.
    expect(start.value).toMatch(/2026/);
    expect(start.value).toMatch(/09:30/);
    expect(end.value).toMatch(/2026/);
    expect(end.value).toMatch(/17:45/);
  });

  it('disables both inputs through the control', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.ctrl.disable();
    fixture.detectChanges();
    const { start, end } = inputs(fixture);
    expect(start.disabled).toBe(true);
    expect(end.disabled).toBe(true);
  });

  it('does not re-emit when an invalid keystroke leaves the value unchanged', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const directive = fixture.debugElement.query(
      By.directive(NgxDtDateTimeRangeInput),
    ).componentInstance as NgxDtDateTimeRangeInput<Temporal.PlainDateTime>;
    const emissions: DateRange<Temporal.PlainDateTime>[] = [];
    directive.rangeChange.subscribe((r) => emissions.push(r));

    const { start } = inputs(fixture);
    type(start, 'garbage');
    type(start, 'still garbage');
    fixture.detectChanges();

    expect(emissions.length).toBe(0);
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeStart')).toBe(true);
  });
});

describe('NgxDtDateTimeRangeInput — picker bridge', () => {
  beforeEach(setup);

  it('reflects a calendar range selection into both inputs and the model', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.mat-calendar-body-cell',
      ),
    );
    cells[4].click(); // start
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click(); // end
    fixture.detectChanges();
    await fixture.whenStable();

    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toBeInstanceOf(Temporal.PlainDateTime);
    expect(value.start?.day).toBe(5);
    expect(value.end?.day).toBe(10);
    const { start, end } = inputs(fixture);
    expect(start.value).toMatch(/2026/);
    expect(end.value).toMatch(/2026/);
  });

  it('setRangeFromPicker does not re-emit when the range is unchanged', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const container = fixture.debugElement.query(
      By.directive(NgxDtDateTimeRangeInput),
    ).componentInstance as NgxDtDateTimeRangeInput<Temporal.PlainDateTime>;
    const emissions: DateRange<Temporal.PlainDateTime>[] = [];
    container.rangeChange.subscribe((r) => emissions.push(r));

    container.setRangeFromPicker(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:00'),
        Temporal.PlainDateTime.from('2026-06-20T17:00'),
      ),
    );
    container.setRangeFromPicker(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:00'),
        Temporal.PlainDateTime.from('2026-06-20T17:00'),
      ),
    );

    expect(emissions.length).toBe(1);
  });

  it('opens the picker on Alt+ArrowDown from the start input', async () => {
    @Component({
      imports: [
        NgxDtDateTimeRangeInput,
        NgxDtStartDateTime,
        NgxDtEndDateTime,
        NgxDtPicker,
      ],
      template: `
        <ngx-dt-datetime-range-input [rangePicker]="picker">
          <input ngxDtStartDateTime />
          <input ngxDtEndDateTime />
        </ngx-dt-datetime-range-input>
        <ngx-dt-picker #picker type="datetime-range" />
      `,
    })
    class OverlayHost {
      readonly picker =
        viewChild.required<NgxDtPicker<Temporal.PlainDateTime>>('picker');
    }
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const start = fixture.nativeElement.querySelector('input')!;
    start.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-range-input`
Expected: FAIL — module `./ngx-dt-datetime-range-input` not found.

- [ ] **Step 3: Implement the container + parts**

Create `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.ts`:

```ts
import {
  Component,
  Directive,
  ElementRef,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  output,
  signal,
  type OnInit,
} from '@angular/core';
import {
  type AbstractControl,
  type ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  type ValidationErrors,
  type Validator,
} from '@angular/forms';
import { DateRange } from '@angular/material/datepicker';
import {
  NgxDtPicker,
  type NgxDtOrigin,
  type NgxDtPickerRangeInput,
} from '../picker/ngx-dt-picker';
import { NgxDtDateTimeAdapter } from '../datetime/ngx-dt-datetime-adapter';

/** I/O contract one end (start/end input) exposes to the container. */
interface NgxDtDateTimeRangePart<T> {
  /** Writes formatted text (or empty) into the part's input element. */
  formatValue(value: T | null): void;
  /** Toggles the part's disabled state. */
  setDisabled(isDisabled: boolean): void;
  /** Current raw text in the input (for parse-error reporting). */
  rawText(): string;
}

/**
 * Two-input range container for datetime values. Owns one
 * `DateRange<PlainDateTime>` as a `ControlValueAccessor` + `Validator`, registers
 * with an `NgxDtPicker` (`type="datetime-range"`) through the
 * `NgxDtPickerRangeInput<T>` seam, and coordinates the two part directives.
 * Parallel sibling of `NgxDtDateRangeInput`, but datetime-typed.
 */
@Component({
  selector: 'ngx-dt-datetime-range-input',
  exportAs: 'ngxDtDateTimeRangeInput',
  template: `<ng-content />`,
  host: {
    class: 'ngx-dt-datetime-range-input',
    role: 'group',
    '[attr.aria-label]': 'ariaLabel()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NgxDtDateTimeRangeInput),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NgxDtDateTimeRangeInput),
      multi: true,
    },
  ],
})
export class NgxDtDateTimeRangeInput<T = unknown>
  implements ControlValueAccessor, Validator, OnInit, NgxDtPickerRangeInput<T>
{
  private readonly elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly adapter = inject<NgxDtDateTimeAdapter<T>>(NgxDtDateTimeAdapter);

  /** The picker this range field feeds; bind a ref: `[rangePicker]="picker"`. */
  readonly picker = input.required<NgxDtPicker<T>>({ alias: 'rangePicker' });
  readonly ariaLabel = input('Datetime range');

  /** Emits whenever the committed range changes (typed or chosen). */
  readonly rangeChange = output<DateRange<T>>();

  private readonly _start = signal<T | null>(null);
  private readonly _end = signal<T | null>(null);
  /** Current start/end (read by the parts for reformatting). */
  readonly startValue = this._start.asReadonly();
  readonly endValue = this._end.asReadonly();

  /** Whether the latest text for each end parsed to a valid (or empty) value. */
  _startValid = true;
  _endValid = true;

  private _startPart: NgxDtDateTimeRangePart<T> | null = null;
  private _endPart: NgxDtDateTimeRangePart<T> | null = null;
  private _disabledState = false;

  /** Current range value (read by the picker for `[selected]`). */
  readonly range = computed<DateRange<T>>(
    () => new DateRange<T>(this._start(), this._end()),
  );

  private _onChange: (value: DateRange<T>) => void = () => {};
  private _onTouched: () => void = () => {};
  private _onValidatorChange: () => void = () => {};

  constructor() {
    // The picker holds min/max; re-validate when they change.
    effect(() => {
      const picker = this.picker();
      picker.min();
      picker.max();
      this._onValidatorChange();
    });
  }

  ngOnInit(): void {
    this.picker().registerRangeInput(this);
  }

  // --- part registration (part -> container) --------------------------------

  _registerStart(part: NgxDtDateTimeRangePart<T>): void {
    this._startPart = part;
    part.setDisabled(this._disabledState);
    part.formatValue(this._start());
  }
  _registerEnd(part: NgxDtDateTimeRangePart<T>): void {
    this._endPart = part;
    part.setDisabled(this._disabledState);
    part.formatValue(this._end());
  }

  _setStart(value: T | null, valid: boolean): void {
    this._startValid = valid;
    if (!this.adapter.sameDateTime(value, this._start())) {
      this._start.set(value);
      this._emitChange();
    }
    this._onValidatorChange();
  }
  _setEnd(value: T | null, valid: boolean): void {
    this._endValid = valid;
    if (!this.adapter.sameDateTime(value, this._end())) {
      this._end.set(value);
      this._emitChange();
    }
    this._onValidatorChange();
  }
  _markTouched(): void {
    this._onTouched();
  }
  openPicker(): void {
    this.picker().open(this.elementRef);
  }

  private _emitChange(): void {
    const range = this.range();
    this._onChange(range);
    this.rangeChange.emit(range);
  }

  // --- ControlValueAccessor -------------------------------------------------

  writeValue(value: DateRange<T> | null): void {
    const start = this._coerce(value?.start ?? null);
    const end = this._coerce(value?.end ?? null);
    this._startValid = true;
    this._endValid = true;
    this._start.set(start);
    this._end.set(end);
    this._startPart?.formatValue(start);
    this._endPart?.formatValue(end);
  }
  registerOnChange(fn: (value: DateRange<T>) => void): void {
    this._onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }
  setDisabledState(isDisabled: boolean): void {
    this._disabledState = isDisabled;
    this._startPart?.setDisabled(isDisabled);
    this._endPart?.setDisabled(isDisabled);
  }

  // --- Validator ------------------------------------------------------------

  validate(control: AbstractControl): ValidationErrors | null {
    if (!this._startValid) {
      return { ngxDtRangeStart: { text: this._startPart?.rawText() ?? '' } };
    }
    if (!this._endValid) {
      return { ngxDtRangeEnd: { text: this._endPart?.rawText() ?? '' } };
    }
    const value = control.value as DateRange<T> | null;
    const start = value?.start ?? null;
    const end = value?.end ?? null;
    const picker = this.picker();
    const min = picker.min();
    const max = picker.max();
    for (const dt of [start, end]) {
      if (dt === null) {
        continue;
      }
      if (min && this.adapter.compareDateTime(min, dt) > 0) {
        return { ngxDtMin: { min, actual: dt } };
      }
      if (max && this.adapter.compareDateTime(max, dt) < 0) {
        return { ngxDtMax: { max, actual: dt } };
      }
    }
    if (
      start !== null &&
      end !== null &&
      this.adapter.compareDateTime(end, start) < 0
    ) {
      return { ngxDtRangeOrder: { start, end } };
    }
    return null;
  }
  registerOnValidatorChange(fn: () => void): void {
    this._onValidatorChange = fn;
  }

  // --- NgxDtPickerRangeInput (picker -> container) --------------------------

  setRangeFromPicker(range: DateRange<T>): void {
    this._startValid = true;
    this._endValid = true;
    const prevStart = this._start();
    const prevEnd = this._end();
    this._start.set(range.start);
    this._end.set(range.end);
    this._startPart?.formatValue(range.start);
    this._endPart?.formatValue(range.end);
    if (
      !this.adapter.sameDateTime(range.start, prevStart) ||
      !this.adapter.sameDateTime(range.end, prevEnd)
    ) {
      this._onChange(range);
      this.rangeChange.emit(range);
    }
    this._onTouched();
    this._onValidatorChange();
  }
  getOverlayOrigin(): NgxDtOrigin {
    return this.elementRef;
  }

  /** Coerce a control value to a valid datetime or null (already-`T` or text). */
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
}

/**
 * Shared parse/format/IO for one end of a datetime range. Subclassed by the
 * start and end directives; each reports its parsed value to, and reads its
 * current value from, the parent container. Parallel sibling of
 * `NgxDtDateRangePartBase`, but uses the datetime adapter (single-arg
 * `parse`/`format`).
 */
@Directive()
export abstract class NgxDtDateTimeRangePartBase<T = unknown>
  implements NgxDtDateTimeRangePart<T>
{
  protected readonly elementRef =
    inject<ElementRef<HTMLInputElement>>(ElementRef);
  protected readonly adapter = inject<NgxDtDateTimeAdapter<T>>(NgxDtDateTimeAdapter);
  protected readonly parent =
    inject<NgxDtDateTimeRangeInput<T>>(NgxDtDateTimeRangeInput);

  protected readonly _disabled = signal(false);
  _lastValueValid = true;

  /** Reports the parsed value + parse-validity to the container. */
  protected abstract _report(value: T | null, valid: boolean): void;
  /** The value the container currently holds for this end (for reformatting). */
  protected abstract _currentValue(): T | null;
  /** Registers this part with the container. */
  protected abstract _register(): void;

  ngOnInit(): void {
    this._register();
  }

  protected _onInput(event: Event): void {
    const text = (event.target as HTMLInputElement).value;
    const parsed = this.adapter.parse(text);
    this._lastValueValid = parsed === null || this.adapter.isValid(parsed);
    const value =
      parsed !== null && this.adapter.isValid(parsed) ? parsed : null;
    this._report(value, this._lastValueValid);
  }

  protected _onBlur(): void {
    if (this._lastValueValid) {
      this.formatValue(this._currentValue());
    }
    this.parent._markTouched();
  }

  protected _onKeydown(event: KeyboardEvent): void {
    if (event.altKey && event.key === 'ArrowDown' && !this._disabled()) {
      this.parent.openPicker();
      event.preventDefault();
    }
  }

  formatValue(value: T | null): void {
    this.elementRef.nativeElement.value =
      value && this.adapter.isValid(value) ? this.adapter.format(value) : '';
  }
  setDisabled(isDisabled: boolean): void {
    this._disabled.set(isDisabled);
  }
  rawText(): string {
    return this.elementRef.nativeElement.value;
  }
}

@Directive({
  selector: 'input[ngxDtStartDateTime]',
  exportAs: 'ngxDtStartDateTime',
  host: {
    class: 'ngx-dt-range-start',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
})
export class NgxDtStartDateTime<T = unknown>
  extends NgxDtDateTimeRangePartBase<T>
  implements OnInit
{
  protected _report(value: T | null, valid: boolean): void {
    this.parent._setStart(value, valid);
  }
  protected _currentValue(): T | null {
    return this.parent.startValue();
  }
  protected _register(): void {
    this.parent._registerStart(this);
  }
}

@Directive({
  selector: 'input[ngxDtEndDateTime]',
  exportAs: 'ngxDtEndDateTime',
  host: {
    class: 'ngx-dt-range-end',
    '[disabled]': '_disabled()',
    '(input)': '_onInput($event)',
    '(blur)': '_onBlur()',
    '(keydown)': '_onKeydown($event)',
  },
})
export class NgxDtEndDateTime<T = unknown>
  extends NgxDtDateTimeRangePartBase<T>
  implements OnInit
{
  protected _report(value: T | null, valid: boolean): void {
    this.parent._setEnd(value, valid);
  }
  protected _currentValue(): T | null {
    return this.parent.endValue();
  }
  protected _register(): void {
    this.parent._registerEnd(this);
  }
}
```

- [ ] **Step 4: Export from the public API**

In `projects/ngx-datetime-picker/src/public-api.ts`, append after the `NgxDtDateTimeInput` export:

```ts
export {
  NgxDtDateTimeRangeInput,
  NgxDtStartDateTime,
  NgxDtEndDateTime,
} from './lib/datetime-range-input/ngx-dt-datetime-range-input';
```

- [ ] **Step 5: Run the text-I/O + bridge spec to verify it passes**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-range-input`
Expected: PASS for `ngx-dt-datetime-range-input.spec.ts`.

- [ ] **Step 6: Write the validators spec**

Create `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.validators.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { DateRange } from '@angular/material/datepicker';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import {
  NgxDtDateTimeRangeInput,
  NgxDtEndDateTime,
  NgxDtStartDateTime,
} from './ngx-dt-datetime-range-input';

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

@Component({
  imports: [
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
    NgxDtPicker,
    ReactiveFormsModule,
  ],
  template: `
    <ngx-dt-datetime-range-input [rangePicker]="picker" [formControl]="ctrl">
      <input ngxDtStartDateTime />
      <input ngxDtEndDateTime />
    </ngx-dt-datetime-range-input>
    <ngx-dt-picker
      #picker
      [inline]="true"
      type="datetime-range"
      [min]="min()"
      [max]="max"
    />
  `,
})
class ValidatedHost {
  readonly ctrl = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
  readonly min = signal(Temporal.PlainDateTime.from('2026-06-10T08:00'));
  max = Temporal.PlainDateTime.from('2026-06-20T20:00');
}

function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(el: HTMLInputElement, text: string): void {
  el.value = text;
  el.dispatchEvent(new Event('input'));
}

describe('NgxDtDateTimeRangeInput — validation', () => {
  beforeEach(setup);

  it('reports ngxDtRangeStart for an unparseable start', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeStart')).toBe(true);
  });

  it('reports ngxDtRangeEnd for an unparseable end', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).end, 'garbage');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeEnd')).toBe(true);
  });

  it('reports ngxDtRangeOrder when end is before start on a different day', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-18T09:00');
    type(end, '2026-06-15T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeOrder')).toBe(true);
  });

  it('reports ngxDtRangeOrder when end is earlier than start on the SAME day', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-15T14:00');
    type(end, '2026-06-15T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtRangeOrder')).toBe(true);
  });

  it('reports ngxDtMin when an end is below the picker min', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).start, '2026-06-09T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });

  it('reports ngxDtMax when an end is above the picker max', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    type(startEnd(fixture).end, '2026-06-25T09:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMax')).toBe(true);
  });

  it('passes for an in-range, ordered range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13T10:00');
    type(end, '2026-06-18T16:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();
  });

  it('re-validates when the picker min tightens past the current range', async () => {
    const fixture = TestBed.createComponent(ValidatedHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const { start, end } = startEnd(fixture);
    type(start, '2026-06-13T10:00');
    type(end, '2026-06-18T16:00');
    fixture.detectChanges();
    expect(fixture.componentInstance.ctrl.errors).toBeNull();

    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-15T10:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.ctrl.hasError('ngxDtMin')).toBe(true);
  });
});
```

- [ ] **Step 7: Write the forms-integration spec**

Create `projects/ngx-datetime-picker/src/lib/datetime-range-input/ngx-dt-datetime-range-input.forms.spec.ts`:

```ts
import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { form, FormField } from '@angular/forms/signals';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateTimeAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DateRange,
  NgxDtDateTimeRangeInput,
  NgxDtEndDateTime,
  NgxDtPicker,
  NgxDtStartDateTime,
} from 'ngx-datetime-picker';

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
function startEnd(fixture: { nativeElement: HTMLElement }): {
  start: HTMLInputElement;
  end: HTMLInputElement;
} {
  const els = (fixture.nativeElement as HTMLElement).querySelectorAll('input');
  return { start: els[0], end: els[1] };
}
function type(input: HTMLInputElement, text: string): void {
  input.value = text;
  input.dispatchEvent(new Event('input'));
}

describe('NgxDtDateTimeRangeInput — Reactive Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateTimeRangeInput,
      NgxDtStartDateTime,
      NgxDtEndDateTime,
      NgxDtPicker,
      ReactiveFormsModule,
    ],
    template: `
      <ngx-dt-datetime-range-input [rangePicker]="picker" [formControl]="ctrl">
        <input ngxDtStartDateTime />
        <input ngxDtEndDateTime />
      </ngx-dt-datetime-range-input>
      <ngx-dt-picker #picker [inline]="true" type="datetime-range" />
    `,
  })
  class ReactiveHost {
    readonly ctrl = new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
  }

  it('round-trips model <-> view', async () => {
    const fixture = TestBed.createComponent(ReactiveHost);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentInstance.ctrl.setValue(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-10T09:30'),
        Temporal.PlainDateTime.from('2026-06-20T17:45'),
      ),
    );
    fixture.detectChanges();
    const { start, end } = startEnd(fixture);
    expect(start.value).toMatch(/09:30/);
    expect(end.value).toMatch(/17:45/);

    type(start, '2026-07-01T08:00');
    type(end, '2026-07-09T18:00');
    fixture.detectChanges();
    const value = fixture.componentInstance.ctrl.value!;
    expect(value.start).toEqual(Temporal.PlainDateTime.from('2026-07-01T08:00'));
    expect(value.end).toEqual(Temporal.PlainDateTime.from('2026-07-09T18:00'));
  });
});

describe('NgxDtDateTimeRangeInput — ngModel', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateTimeRangeInput,
      NgxDtStartDateTime,
      NgxDtEndDateTime,
      NgxDtPicker,
      FormsModule,
    ],
    template: `
      <ngx-dt-datetime-range-input [rangePicker]="picker" [(ngModel)]="value">
        <input ngxDtStartDateTime />
        <input ngxDtEndDateTime />
      </ngx-dt-datetime-range-input>
      <ngx-dt-picker #picker [inline]="true" type="datetime-range" />
    `,
  })
  class NgModelHost {
    value: DateRange<Temporal.PlainDateTime> | null = null;
  }

  it('two-way binds through ngModel', async () => {
    const fixture = TestBed.createComponent(NgModelHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10T09:30');
    type(end, '2026-06-20T17:45');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.value?.start).toEqual(
      Temporal.PlainDateTime.from('2026-06-10T09:30'),
    );
    expect(fixture.componentInstance.value?.end).toEqual(
      Temporal.PlainDateTime.from('2026-06-20T17:45'),
    );
  });
});

describe('NgxDtDateTimeRangeInput — Signal Forms', () => {
  beforeEach(setup);

  @Component({
    imports: [
      NgxDtDateTimeRangeInput,
      NgxDtStartDateTime,
      NgxDtEndDateTime,
      NgxDtPicker,
      FormField,
    ],
    template: `
      <ngx-dt-datetime-range-input [rangePicker]="picker" [formField]="f.range">
        <input ngxDtStartDateTime />
        <input ngxDtEndDateTime />
      </ngx-dt-datetime-range-input>
      <ngx-dt-picker #picker [inline]="true" type="datetime-range" />
    `,
  })
  class SignalFormHost {
    readonly model = signal<{ range: DateRange<Temporal.PlainDateTime> }>({
      range: new DateRange<Temporal.PlainDateTime>(null, null),
    });
    readonly f = form(this.model);
  }

  it('binds the range through the [formField] CVA-compat path', async () => {
    const fixture = TestBed.createComponent(SignalFormHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const { start, end } = startEnd(fixture);
    type(start, '2026-06-10T09:30');
    type(end, '2026-06-20T17:45');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.f.range().value().start).toEqual(
      Temporal.PlainDateTime.from('2026-06-10T09:30'),
    );
    expect(fixture.componentInstance.f.range().value().end).toEqual(
      Temporal.PlainDateTime.from('2026-06-20T17:45'),
    );
  });
});
```

- [ ] **Step 8: Run the full input test set to verify it passes**

Run: `npx ng test --project ngx-datetime-picker -- ngx-dt-datetime-range-input`
Expected: PASS — all three datetime-range-input spec files green.

- [ ] **Step 9: Commit**

```bash
git add projects/ngx-datetime-picker/src/lib/datetime-range-input/ \
        projects/ngx-datetime-picker/src/public-api.ts
git commit -m "$(cat <<'EOF'
feat(datetime-range-input): [ngxDtStartDateTime]/[ngxDtEndDateTime] CVA + Validator

Two-input DateRange<PlainDateTime> container; ngxDtRangeOrder uses full datetime
compare (same-day end<start flagged). Reactive/ngModel/Signal Forms covered.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Demo wiring + full-suite verification

Add a datetime-range demo section (popup, Reactive Forms) so the variant is exercised end-to-end in the demo app, and verify the whole suite plus the library build.

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`

**Interfaces:**
- Consumes: `NgxDtDateTimeRangeInput`, `NgxDtStartDateTime`, `NgxDtEndDateTime` (from `ngx-datetime-picker`), `NgxDtPicker`, `NgxDtToggle`, `DateRange`.

- [ ] **Step 1: Add the form control + imports to the demo component**

In `src/app/app.ts`, add the three directives to the `imports` array (after `NgxDtDateTimeInput`):

```ts
    NgxDtDateTimeRangeInput,
    NgxDtStartDateTime,
    NgxDtEndDateTime,
```

Update the import statement from `'ngx-datetime-picker'` to include them (keep the list alphabetical-ish, matching the existing grouping):

```ts
import {
  DateRange,
  NgxDtDateRangeInput,
  NgxDtDateTimeInput,
  NgxDtDateTimeRangeInput,
  NgxDtEndDate,
  NgxDtEndDateTime,
  NgxDtInput,
  NgxDtPicker,
  NgxDtStartDate,
  NgxDtStartDateTime,
  NgxDtTimeInput,
  NgxDtToggle,
} from 'ngx-datetime-picker';
```

And add the control field (after `dateTimeCtrl`):

```ts
  // Datetime range (Reactive Forms)
  protected readonly dateTimeRangeCtrl =
    new FormControl<DateRange<Temporal.PlainDateTime> | null>(null);
```

- [ ] **Step 2: Add the demo section to the template**

In `src/app/app.html`, add a new `<section>` after the "Datetime (popup, Reactive Forms)" section (before the closing `</main>`):

```html
  <section>
    <h2>Datetime range (popup, Reactive Forms)</h2>
    <div class="ngx-dt-range-field">
      <ngx-dt-datetime-range-input
        [rangePicker]="dtRangePick"
        [formControl]="dateTimeRangeCtrl"
        ariaLabel="Trip start and end"
      >
        <input ngxDtStartDateTime placeholder="Start" aria-label="Start date and time" />
        <span class="ngx-dt-range-sep" aria-hidden="true">–</span>
        <input ngxDtEndDateTime placeholder="End" aria-label="End date and time" />
      </ngx-dt-datetime-range-input>
      <ngx-dt-toggle [for]="dtRangePick" ariaLabel="Open datetime range picker" />
    </div>
    <ngx-dt-picker #dtRangePick type="datetime-range" [hourCycle]="12" />
    <p>
      Range:
      {{ dateTimeRangeCtrl.value?.start?.toString() ?? '—' }}
      →
      {{ dateTimeRangeCtrl.value?.end?.toString() ?? '—' }}
    </p>
  </section>
```

- [ ] **Step 3: Run the app tests to verify they still pass**

Run: `npx ng test`
Expected: PASS — the 5 app tests stay green (the demo additions don't break `app.spec.ts`/`temporal-calendar.spec.ts`).

- [ ] **Step 4: Run the full suite**

Run: `npm test`
Expected: PASS — library tests (176 baseline + the new datetime-range tests) and app 5 all green.

- [ ] **Step 5: Build the library (ng-packagr)**

Run: `npx ng build ngx-datetime-picker`
Expected: SUCCESS — the new files compile into the package; the new exports resolve.

- [ ] **Step 6: Commit**

```bash
git add src/app/app.ts src/app/app.html
git commit -m "$(cat <<'EOF'
feat(demo): datetime-range demo (popup, Reactive Forms, 12h)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Accessibility verification (after Task 5, before merge)

The controller (not a task) runs a Lighthouse accessibility audit on the datetime-range surfaces, per the established cadence:
- The popup datetime-range overlay (open it, audit the live DOM in snapshot mode — both time panels + footer present).
- Confirm score = 100 and no AXE violations (focus order across the two panels + footer, labelled groups, contrast on `--mat-sys-*`-driven controls).

## Self-Review

**1. Spec coverage** (against the locked decisions):
- Single calendar + two time panels → Task 3 template (`@if (isDateTimeRange())` renders two `ngx-dt-time-panel`s under the one calendar). ✓
- Immediate commit, never auto-closes → Task 2 `onUserSelection` returns without `close()` for datetime-range; Task 3 time handlers commit immediately. ✓
- Same-day order: clamp panels → Task 3 `startTimePanelMax`/`endTimePanelMin` cross-constraints (using `compareTime` from Task 1); validator backstop → Task 4 `ngxDtRangeOrder` via `compareDateTime` (with a dedicated same-day test). ✓
- Footer Now/Clear/Done; Now fills first empty end; Done overlay-only → Task 3 handlers + template (`@if (!inline())` on Done). ✓
- Form-control container parity with date-range → Task 4 (`NgxDtDateTimeRangeInput` + parts, CVA + Validator, Reactive/ngModel/Signal Forms). ✓
- Demo coverage → Task 5. ✓

**2. Placeholder scan:** No TBD/TODO; every code step has complete code; every test step has full test bodies and exact run commands with expected outcomes. ✓

**3. Type consistency:**
- `compareTime(a: T, b: T): number` defined in Task 1, consumed in Task 3 `earlierTime`/`laterTime` (via `dtAdapter`, T erased to `unknown` — assignable). ✓
- `commitRange(range: DateRange<D>)` defined in Task 2, used in Task 2 `onUserSelection` and Task 3 `onStartTimeChange`/`onEndTimeChange`/`onNowClick`/`onClearClick`. ✓
- Time-panel `(valueChange)` emits `D | null` (the panel's `value` model is bound to a `D | null` computed → `T` infers to `D`), matching `onStartTimeChange(time: D | null)`/`onEndTimeChange(time: D | null)` — same pattern as the existing `onTimeChange`. ✓
- Selectors/exports: container `ngx-dt-datetime-range-input` (exportAs `ngxDtDateTimeRangeInput`); parts `input[ngxDtStartDateTime]`/`input[ngxDtEndDateTime]` (exportAs `ngxDtStartDateTime`/`ngxDtEndDateTime`); all three exported from `public-api.ts` (Task 4) and imported by the forms spec + demo. ✓
- `isAnyDateTime()` (Task 2) used by `calendarMin`/`calendarMax` (Task 2) and the template layout/footer (Task 3); `isDateTimeRange()`/`calendarRangeMode()` consistent across `calendarSelection`/`onSelectedChange`/`onUserSelection`. ✓
