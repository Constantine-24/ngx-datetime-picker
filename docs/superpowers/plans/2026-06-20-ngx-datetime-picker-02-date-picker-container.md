# ngx-datetime-picker — Plan 2: Overlay infrastructure + Date picker container

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a working `<ngx-dt-picker type="date">` that renders a Material `MatCalendar` **inline or in a CDK overlay**, is opened by a `<ngx-dt-toggle>`, exposes its selection via a two-way `[(value)]` and open/close outputs, and meets WCAG AA for the popup (focus trap, Escape, backdrop dismiss, focus restore).

**Architecture:** The picker is a generic standalone component over `DateAdapter<D>`. Its panel (a `MatCalendar` today; time/datetime panels in later plans) lives in one `<ng-template>` rendered either directly (inline) or through `CdkConnectedOverlay` anchored to a trigger element. Value flows `MatCalendar.selectedChange → value model → (valueChange)`; in overlay mode a selection auto-closes. The toggle is a thin button that calls `picker.toggle(triggerEl)` and mirrors `aria-expanded` from the picker's open signal.

**Tech Stack:** Angular 22 (standalone, signals, zoneless), `@angular/cdk/overlay` (`CdkConnectedOverlay`), `@angular/cdk/a11y` (`cdkTrapFocus`), `@angular/material/datepicker` (`MatCalendar`), `@angular/material/core` (`DateAdapter`), Vitest.

This is **Plan 2 of the series** (Foundations ✅ → **Date picker container** → Date input + forms → Date range → Time → Datetime + datetime-range → Polish). It builds on the `TemporalDateAdapter` from Plan 1; the demo already provides it app-wide. The text input + `ControlValueAccessor`/`MatFormFieldControl`/Signal-Forms contracts + validators are **Plan 3**, deliberately split out.

---

## Decisions locked for this plan

- **Display API:** `<ngx-dt-picker [inline]>` (default overlay). Overlay uses `CdkConnectedOverlay` (declarative) rather than an imperative `Overlay` service — less wiring, idiomatic, and the picker owns its panel template for both modes.
- **Value API for v1 container:** two-way `[(value)]` via `model<D | null>()`. `model()` already supplies the `valueChange` output named in the design — no separate output. The text-input/forms surface arrives in Plan 3.
- **Trigger/origin:** `picker.open(origin)` takes the element to anchor to. In this plan the origin is the `<ngx-dt-toggle>`; in Plan 3 the form field becomes the origin.
- **`type` input:** present and typed (`'date'` for now) so the public selector `<ngx-dt-picker type="date">` is stable; later plans add `@switch` panels. The panel renders the calendar (correct for `date`).
- **Out of scope here (later plans):** text input, forms contracts, validators, action footer (Apply/Cancel/Clear/Today) + projection seam, `touchUi` dialog mode, range/time/datetime, `prefers-reduced-motion`/RTL polish (basic correctness only).

---

## File Structure

| File | Responsibility |
|------|----------------|
| `projects/ngx-datetime-picker/src/lib/tokens.ts` | `NgxDtDefaultOptions` interface, `NGX_DT_DEFAULT_OPTIONS` token, default value |
| `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts` | `NgxDtPicker<D>` component (inline + overlay, value, open/close, a11y) |
| `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts` | Picker unit tests |
| `projects/ngx-datetime-picker/src/lib/toggle/ngx-dt-toggle.ts` | `NgxDtToggle` trigger button |
| `projects/ngx-datetime-picker/src/lib/toggle/ngx-dt-toggle.spec.ts` | Toggle unit tests |
| `projects/ngx-datetime-picker/src/public-api.ts` | Export the core component/toggle/tokens |
| `src/app/app.ts`, `src/app/app.html` | Demo: inline + overlay date pickers |

---

## Task 1: Core tokens + public-api seam

**Files:** Create `projects/ngx-datetime-picker/src/lib/tokens.ts`; Modify `projects/ngx-datetime-picker/src/public-api.ts`; Test `projects/ngx-datetime-picker/src/lib/tokens.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `projects/ngx-datetime-picker/src/lib/tokens.spec.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { NGX_DT_DEFAULT_OPTIONS, NGX_DT_DEFAULT_OPTIONS_VALUE } from './tokens';

describe('NGX_DT_DEFAULT_OPTIONS', () => {
  it('exposes an injection token', () => {
    expect(NGX_DT_DEFAULT_OPTIONS.toString()).toContain('NGX_DT_DEFAULT_OPTIONS');
  });
  it('ships sensible defaults', () => {
    expect(NGX_DT_DEFAULT_OPTIONS_VALUE).toEqual({
      hasBackdrop: true,
      restoreFocus: true,
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — cannot find module `./tokens`.

- [ ] **Step 3: Implement tokens**

Create `projects/ngx-datetime-picker/src/lib/tokens.ts`:
```ts
import { InjectionToken } from '@angular/core';

/** Behaviour defaults for ngx-datetime-picker, overridable via DI. */
export interface NgxDtDefaultOptions {
  /** Whether the overlay renders a backdrop that dismisses on outside click. */
  hasBackdrop: boolean;
  /** Whether focus returns to the trigger element when the overlay closes. */
  restoreFocus: boolean;
}

export const NGX_DT_DEFAULT_OPTIONS_VALUE: NgxDtDefaultOptions = {
  hasBackdrop: true,
  restoreFocus: true,
};

export const NGX_DT_DEFAULT_OPTIONS = new InjectionToken<NgxDtDefaultOptions>(
  'NGX_DT_DEFAULT_OPTIONS',
  { providedIn: 'root', factory: () => NGX_DT_DEFAULT_OPTIONS_VALUE },
);
```

- [ ] **Step 4: Export from the core public-api**

Replace `projects/ngx-datetime-picker/src/public-api.ts`:
```ts
// Adapter-agnostic core entry point.
export { NGX_DT_DEFAULT_OPTIONS, NGX_DT_DEFAULT_OPTIONS_VALUE } from './lib/tokens';
export type { NgxDtDefaultOptions } from './lib/tokens';
```

- [ ] **Step 5: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(core): NGX_DT_DEFAULT_OPTIONS token"
```

---

## Task 2: `NgxDtPicker` — inline calendar + two-way value

Builds the component rendering `MatCalendar` inline and wiring selection to `[(value)]`. Overlay comes in Task 3.

**Files:** Create `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`, `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.spec.ts`:
```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from './ngx-dt-picker';

@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker
      #picker
      [inline]="true"
      [(value)]="value"
    />
  `,
})
class InlineHost {
  value = signal<Temporal.PlainDate | null>(null);
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateAdapter(),
    ],
  });
}

describe('NgxDtPicker — inline', () => {
  beforeEach(setup);

  it('renders a MatCalendar inline', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelector('mat-calendar'),
    ).toBeTruthy();
  });

  it('writes the picked date back through [(value)]', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const cell: HTMLElement = fixture.nativeElement.querySelector(
      '.mat-calendar-body-cell',
    );
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()).toBeInstanceOf(
      Temporal.PlainDate,
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — cannot find module `./ngx-dt-picker`.

- [ ] **Step 3: Implement the picker (inline path)**

Create `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`:
```ts
import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { MatCalendar } from '@angular/material/datepicker';

/** Picker variants. Only `date` is implemented in this plan. */
export type NgxDtPickerType = 'date';

@Component({
  selector: 'ngx-dt-picker',
  exportAs: 'ngxDtPicker',
  imports: [NgTemplateOutlet, MatCalendar],
  template: `
    @if (inline()) {
      <div class="ngx-dt-panel" role="group">
        <ng-container [ngTemplateOutlet]="panel" />
      </div>
    }

    <ng-template #panel>
      <mat-calendar
        [startAt]="effectiveStartAt()"
        [startView]="startView()"
        [selected]="value()"
        [minDate]="min()"
        [maxDate]="max()"
        [dateFilter]="dateFilter()"
        (selectedChange)="onSelectedChange($event)"
      />
    </ng-template>
  `,
  host: { class: 'ngx-dt-picker' },
})
export class NgxDtPicker<D = unknown> {
  private readonly adapter = inject<DateAdapter<D>>(DateAdapter);

  readonly type = input<NgxDtPickerType>('date');
  readonly inline = input(false);
  readonly startAt = input<D | null>(null);
  readonly startView = input<'month' | 'year' | 'multi-year'>('month');
  readonly min = input<D | null>(null);
  readonly max = input<D | null>(null);
  readonly dateFilter = input<(date: D) => boolean>(() => true);
  readonly disabled = input(false);

  /** Two-way selected value. `model()` provides the `valueChange` output. */
  readonly value = model<D | null>(null);

  /** Lazily resolves the month to open on (value → startAt → today). */
  protected readonly effectiveStartAt = computed(
    () => this.value() ?? this.startAt() ?? this.adapter.today(),
  );

  protected onSelectedChange(date: D | null): void {
    this.value.set(date);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — both inline tests green.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(picker): NgxDtPicker inline MatCalendar + two-way value"
```

---

## Task 3: Overlay mode — open/close, origin, auto-close, outputs

Adds the `CdkConnectedOverlay` path and the imperative open/close API used by the toggle (and, later, the input).

**Files:** Modify `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts`; Test: the spec.

- [ ] **Step 1: Write the failing tests**

Append to `ngx-dt-picker.spec.ts`:
```ts
import { viewChild } from '@angular/core';

@Component({
  imports: [NgxDtPicker],
  template: `
    <button #trigger type="button">open</button>
    <ngx-dt-picker #picker [(value)]="value" />
  `,
})
class OverlayHost {
  value = signal<Temporal.PlainDate | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
  readonly trigger = viewChild.required<unknown, ElementRef<HTMLButtonElement>>(
    'trigger',
    { read: ElementRef },
  );
}

function overlayPanel(): HTMLElement | null {
  return document.querySelector('.cdk-overlay-container .ngx-dt-panel');
}

describe('NgxDtPicker — overlay', () => {
  beforeEach(setup);

  it('attaches the panel to the overlay container when opened', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    expect(overlayPanel()).toBeNull();

    fixture.componentInstance.picker().open(
      fixture.componentInstance.trigger(),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(overlayPanel()).toBeTruthy();
    expect(fixture.componentInstance.picker().isOpen()).toBe(true);
  });

  it('emits openedChange/opened/closed', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    const picker = fixture.componentInstance.picker();
    const events: string[] = [];
    picker.opened.subscribe(() => events.push('opened'));
    picker.closed.subscribe(() => events.push('closed'));
    picker.openedChange.subscribe((v) => events.push(`change:${v}`));

    picker.open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    picker.close();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(events).toEqual(['change:true', 'opened', 'change:false', 'closed']);
  });

  it('auto-closes after a date is picked in overlay mode', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    fixture.componentInstance.picker().open(
      fixture.componentInstance.trigger(),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const cell = document.querySelector<HTMLElement>(
      '.cdk-overlay-container .mat-calendar-body-cell',
    )!;
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(false);
    expect(fixture.componentInstance.value()).toBeInstanceOf(Temporal.PlainDate);
  });

  it('does not open when disabled', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.componentRef.setInput('value', null);
    fixture.detectChanges();
    const picker = fixture.componentInstance.picker();
    // disabled is an input on the picker; set via the host template is simplest,
    // but here we assert the guard directly:
    Object.defineProperty(picker, 'disabled', { value: () => true });
    picker.open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(picker.isOpen()).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — `open`/`isOpen`/`opened` not defined; no overlay rendered.

- [ ] **Step 3: Implement the overlay path**

Replace `projects/ngx-datetime-picker/src/lib/picker/ngx-dt-picker.ts` with:
```ts
import { NgTemplateOutlet } from '@angular/common';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule, type ConnectedPosition } from '@angular/cdk/overlay';
import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { MatCalendar } from '@angular/material/datepicker';
import { NGX_DT_DEFAULT_OPTIONS } from '../tokens';

/** Picker variants. Only `date` is implemented in this plan. */
export type NgxDtPickerType = 'date';

/** Element the overlay anchors to. */
export type NgxDtOrigin = ElementRef | HTMLElement;

const PICKER_POSITIONS: ConnectedPosition[] = [
  { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 8 },
  { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -8 },
  { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 8 },
  { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -8 },
];

@Component({
  selector: 'ngx-dt-picker',
  exportAs: 'ngxDtPicker',
  imports: [NgTemplateOutlet, OverlayModule, A11yModule, MatCalendar],
  template: `
    @if (inline()) {
      <div class="ngx-dt-panel" role="group">
        <ng-container [ngTemplateOutlet]="panel" />
      </div>
    } @else {
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin()!"
        [cdkConnectedOverlayOpen]="isOpen()"
        [cdkConnectedOverlayPositions]="positions"
        [cdkConnectedOverlayHasBackdrop]="hasBackdrop()"
        cdkConnectedOverlayBackdropClass="cdk-overlay-transparent-backdrop"
        (backdropClick)="close()"
        (overlayKeydown)="onOverlayKeydown($event)"
        (detach)="close()"
      >
        <div
          class="ngx-dt-panel"
          role="dialog"
          aria-modal="true"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
        >
          <ng-container [ngTemplateOutlet]="panel" />
        </div>
      </ng-template>
    }

    <ng-template #panel>
      <mat-calendar
        [startAt]="effectiveStartAt()"
        [startView]="startView()"
        [selected]="value()"
        [minDate]="min()"
        [maxDate]="max()"
        [dateFilter]="dateFilter()"
        (selectedChange)="onSelectedChange($event)"
      />
    </ng-template>
  `,
  host: { class: 'ngx-dt-picker' },
})
export class NgxDtPicker<D = unknown> {
  private readonly adapter = inject<DateAdapter<D>>(DateAdapter);
  private readonly options = inject(NGX_DT_DEFAULT_OPTIONS);

  readonly type = input<NgxDtPickerType>('date');
  readonly inline = input(false);
  readonly startAt = input<D | null>(null);
  readonly startView = input<'month' | 'year' | 'multi-year'>('month');
  readonly min = input<D | null>(null);
  readonly max = input<D | null>(null);
  readonly dateFilter = input<(date: D) => boolean>(() => true);
  readonly disabled = input(false);
  readonly hasBackdrop = input(this.options.hasBackdrop);
  readonly restoreFocus = input(this.options.restoreFocus);

  /** Two-way selected value. `model()` provides the `valueChange` output. */
  readonly value = model<D | null>(null);

  readonly openedChange = output<boolean>();
  readonly opened = output<void>();
  readonly closed = output<void>();

  protected readonly positions = PICKER_POSITIONS;

  private readonly _open = signal(false);
  /** Whether the overlay is currently open. */
  readonly isOpen = this._open.asReadonly();

  private readonly _origin = signal<NgxDtOrigin | null>(null);
  protected readonly origin = this._origin.asReadonly();

  protected readonly effectiveStartAt = computed(
    () => this.value() ?? this.startAt() ?? this.adapter.today(),
  );

  /** Open the overlay anchored to `origin`. No-op if disabled, inline, or already open. */
  open(origin?: NgxDtOrigin): void {
    if (this.disabled() || this.inline() || this._open()) {
      return;
    }
    if (origin) {
      this._origin.set(origin);
    }
    this._open.set(true);
    this.openedChange.emit(true);
    this.opened.emit();
  }

  /** Close the overlay and (optionally) restore focus to the trigger. */
  close(): void {
    if (!this._open()) {
      return;
    }
    this._open.set(false);
    this.openedChange.emit(false);
    this.closed.emit();
    if (this.restoreFocus()) {
      this.focusOrigin();
    }
  }

  toggle(origin?: NgxDtOrigin): void {
    this._open() ? this.close() : this.open(origin);
  }

  protected onSelectedChange(date: D | null): void {
    this.value.set(date);
    if (!this.inline()) {
      this.close();
    }
  }

  protected onOverlayKeydown(event: KeyboardEvent): void {
    const noModifier =
      !event.altKey && !event.shiftKey && !event.ctrlKey && !event.metaKey;
    if (event.key === 'Escape' && noModifier) {
      event.preventDefault();
      this.close();
    }
  }

  private focusOrigin(): void {
    const origin = this._origin();
    const el = origin instanceof ElementRef ? origin.nativeElement : origin;
    (el as HTMLElement | null)?.focus?.();
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — overlay attaches, events fire in order, picking auto-closes, disabled is a no-op.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(picker): CDK overlay open/close, origin, auto-close, outputs"
```

---

## Task 4: Overlay a11y — Escape, backdrop, focus restore

The behaviours are implemented in Task 3; this task locks them with dedicated tests (and fixes any gaps).

**Files:** Test: `ngx-dt-picker.spec.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `ngx-dt-picker.spec.ts`:
```ts
describe('NgxDtPicker — overlay a11y', () => {
  beforeEach(setup);

  it('closes on Escape and restores focus to the trigger', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    const trigger = fixture.componentInstance.trigger().nativeElement;
    trigger.focus();
    fixture.componentInstance.picker().open(
      fixture.componentInstance.trigger(),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayPanel()!;
    panel.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.picker().isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it('renders role="dialog" with aria-modal on the overlay panel', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    fixture.componentInstance.picker().open(
      fixture.componentInstance.trigger(),
    );
    fixture.detectChanges();
    await fixture.whenStable();

    const panel = overlayPanel()!;
    expect(panel.getAttribute('role')).toBe('dialog');
    expect(panel.getAttribute('aria-modal')).toBe('true');
  });
});
```

- [ ] **Step 2: Run to verify**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS. If focus restore fails, confirm `focusOrigin()` runs in `close()` and the origin is an `ElementRef`. If the Escape test fails because the key handler isn't bound, confirm `(overlayKeydown)` is on the `cdkConnectedOverlay` template.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(picker): lock overlay Escape, focus restore, dialog semantics"
```

---

## Task 5: `min` / `max` / `dateFilter` / `startAt` / `startView` passthrough

Locks the calendar configuration passthrough with behavioural tests.

**Files:** Test: `ngx-dt-picker.spec.ts`.

- [ ] **Step 1: Write the failing tests**

Append to `ngx-dt-picker.spec.ts`:
```ts
@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker
      [inline]="true"
      [(value)]="value"
      [min]="min"
      [max]="max"
      [dateFilter]="filter"
    />
  `,
})
class ConstrainedHost {
  value = signal<Temporal.PlainDate | null>(
    Temporal.PlainDate.from('2026-06-15'),
  );
  min = Temporal.PlainDate.from('2026-06-10');
  max = Temporal.PlainDate.from('2026-06-20');
  // disallow the 12th
  filter = (d: Temporal.PlainDate) => d.day !== 12;
}

describe('NgxDtPicker — constraints', () => {
  beforeEach(setup);

  it('disables out-of-range and filtered days', async () => {
    const fixture = TestBed.createComponent(ConstrainedHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const labelOf = (sel: string) =>
      Array.from(
        fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
          '.mat-calendar-body-cell',
        ),
      ).find((b) => b.getAttribute('aria-label')?.includes(sel));

    // June 5 is before min → disabled
    const june5 = labelOf('June 5, 2026');
    expect(june5?.getAttribute('aria-disabled')).toBe('true');
    // June 12 filtered out → disabled
    const june12 = labelOf('June 12, 2026');
    expect(june12?.getAttribute('aria-disabled')).toBe('true');
    // June 15 allowed → enabled
    const june15 = labelOf('June 15, 2026');
    expect(june15?.getAttribute('aria-disabled')).toBe('false');
  });
});
```

- [ ] **Step 2: Run to verify**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS (the passthrough bindings from Task 3 already wire `[minDate]`/`[maxDate]`/`[dateFilter]`). If the aria-disabled values differ in this Material version, inspect one cell's attributes and adjust the assertion to the real attribute MatCalendar sets for disabled cells — do NOT remove the constraint assertions.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "test(picker): lock min/max/dateFilter passthrough to MatCalendar"
```

---

## Task 6: `NgxDtToggle` trigger

**Files:** Create `projects/ngx-datetime-picker/src/lib/toggle/ngx-dt-toggle.ts`, `projects/ngx-datetime-picker/src/lib/toggle/ngx-dt-toggle.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `projects/ngx-datetime-picker/src/lib/toggle/ngx-dt-toggle.spec.ts`:
```ts
import { Component, signal } from '@angular/core';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from 'ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { NgxDtPicker } from '../picker/ngx-dt-picker';
import { NgxDtToggle } from './ngx-dt-toggle';

@Component({
  imports: [NgxDtPicker, NgxDtToggle],
  template: `
    <ngx-dt-toggle [for]="picker" />
    <ngx-dt-picker #picker="ngxDtPicker" [(value)]="value" />
  `,
})
class ToggleHost {
  value = signal<Temporal.PlainDate | null>(null);
}

function setup() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateAdapter(),
    ],
  });
}

describe('NgxDtToggle', () => {
  beforeEach(setup);

  function button(fixture: { nativeElement: HTMLElement }) {
    return fixture.nativeElement.querySelector<HTMLButtonElement>(
      'button.ngx-dt-toggle-button',
    )!;
  }

  it('renders a button with aria-haspopup=dialog and collapsed state', () => {
    const fixture = TestBed.createComponent(ToggleHost);
    fixture.detectChanges();
    const btn = button(fixture);
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the picker on click and reflects aria-expanded', async () => {
    const fixture = TestBed.createComponent(ToggleHost);
    fixture.detectChanges();
    button(fixture).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(
      document.querySelector('.cdk-overlay-container .ngx-dt-panel'),
    ).toBeTruthy();
    expect(button(fixture).getAttribute('aria-expanded')).toBe('true');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: FAIL — cannot find module `./ngx-dt-toggle`.

- [ ] **Step 3: Implement the toggle**

Create `projects/ngx-datetime-picker/src/lib/toggle/ngx-dt-toggle.ts`:
```ts
import { Component, ElementRef, inject, input } from '@angular/core';
import { NgxDtPicker } from '../picker/ngx-dt-picker';

@Component({
  selector: 'ngx-dt-toggle',
  exportAs: 'ngxDtToggle',
  template: `
    <button
      type="button"
      class="ngx-dt-toggle-button"
      aria-haspopup="dialog"
      [attr.aria-expanded]="picker().isOpen()"
      [attr.aria-label]="ariaLabel()"
      [disabled]="disabled()"
      (click)="onClick()"
    >
      <ng-content>
        <svg
          class="ngx-dt-toggle-icon"
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 16H5V9h14v11zm0-13H5V6h14v1z"
          />
        </svg>
      </ng-content>
    </button>
  `,
  host: { class: 'ngx-dt-toggle' },
})
export class NgxDtToggle {
  private readonly host =
    inject<ElementRef<HTMLElement>>(ElementRef);

  /** The picker this toggle controls; bind a template ref: `[for]="picker"`. */
  readonly picker = input.required<NgxDtPicker>({ alias: 'for' });
  readonly disabled = input(false);
  readonly ariaLabel = input('Open calendar');

  protected onClick(): void {
    this.picker().toggle(this.host);
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — button semantics correct; click opens overlay; `aria-expanded` flips to `true`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(toggle): NgxDtToggle trigger button"
```

---

## Task 7: Export the public surface + verify the build

**Files:** Modify `projects/ngx-datetime-picker/src/public-api.ts`

- [ ] **Step 1: Export the components**

Replace `projects/ngx-datetime-picker/src/public-api.ts`:
```ts
// Adapter-agnostic core entry point.
export { NGX_DT_DEFAULT_OPTIONS, NGX_DT_DEFAULT_OPTIONS_VALUE } from './lib/tokens';
export type { NgxDtDefaultOptions } from './lib/tokens';
export { NgxDtPicker } from './lib/picker/ngx-dt-picker';
export type { NgxDtPickerType, NgxDtOrigin } from './lib/picker/ngx-dt-picker';
export { NgxDtToggle } from './lib/toggle/ngx-dt-toggle';
```

- [ ] **Step 2: Verify the library builds**

Run: `npx ng build ngx-datetime-picker`
Expected: SUCCESS — both entry points still emit; the core entry now contains `NgxDtPicker`/`NgxDtToggle`.

- [ ] **Step 3: Run the whole library suite**

Run: `npx ng test ngx-datetime-picker --watch=false`
Expected: PASS — all Plan 1 + Plan 2 tests green.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(core): export NgxDtPicker + NgxDtToggle from public-api"
```

---

## Task 8: Demo — inline + overlay date pickers

Replace the Plan 1 smoke calendar with real picker examples; serves as the manual a11y/visual harness.

**Files:** Modify `src/app/app.ts`, `src/app/app.html`; update `src/app/temporal-calendar.spec.ts` if it asserts removed markup.

- [ ] **Step 1: Update the demo component**

Replace `src/app/app.ts`:
```ts
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Temporal } from 'temporal-polyfill';
import { NgxDtPicker, NgxDtToggle } from 'ngx-datetime-picker';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NgxDtPicker, NgxDtToggle],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('date-time-picker');
  protected readonly inlineValue = signal<Temporal.PlainDate | null>(null);
  protected readonly popupValue = signal<Temporal.PlainDate | null>(null);
}
```

- [ ] **Step 2: Update the demo template**

Replace `src/app/app.html`:
```html
<main class="demo">
  <h1>ngx-datetime-picker — date picker</h1>

  <section>
    <h2>Inline</h2>
    <ngx-dt-picker [inline]="true" [(value)]="inlineValue" />
    <p>Selected: {{ inlineValue()?.toString() ?? 'none' }}</p>
  </section>

  <section>
    <h2>Popup (toggle)</h2>
    <ngx-dt-toggle [for]="popup" />
    <ngx-dt-picker #popup="ngxDtPicker" [(value)]="popupValue" />
    <p>Selected: {{ popupValue()?.toString() ?? 'none' }}</p>
  </section>
</main>

<router-outlet />
```

- [ ] **Step 2b: Keep the existing app test green**

If `src/app/app.spec.ts` or `src/app/temporal-calendar.spec.ts` asserts removed markup (e.g. the old heading or a bare `<mat-calendar>`), update those assertions to match the new template (e.g. assert the `<ngx-dt-picker>` renders a `mat-calendar` inline). Do NOT delete the tests; adjust the minimal assertion. Run `npx ng test date-time-picker --watch=false` and confirm green.

- [ ] **Step 3: Build the app**

Run: `npx ng build date-time-picker`
Expected: SUCCESS — app compiles with `NgxDtPicker` + `NgxDtToggle`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(demo): inline + popup date pickers"
```

- [ ] **Step 5: Manual visual check (controller, not subagent)**

`npx ng serve date-time-picker --port 4275`, open it, confirm: the inline calendar renders themed; clicking the toggle opens a positioned overlay calendar with a backdrop; picking a day closes it and updates "Selected: 2026-06-DD"; Escape closes and returns focus to the toggle.

---

## Self-Review (completed by plan author)

- **Spec coverage (this plan's slice):** overlay popup + inline display → Tasks 2–4, 8; `<ngx-dt-picker type="date">` shell + value + outputs → Tasks 2–3; `<ngx-dt-toggle [for]>` → Task 6; `min`/`max`/`dateFilter`/`startView`/`startAt` → Tasks 3, 5; focus trap/Escape/backdrop/restore (WCAG AA) → Tasks 3–4; tokens → Task 1. **Deferred to later plans (explicitly):** text input + 3 forms contracts + validators (Plan 3); action footer + projection seam, range/time/datetime, `touchUi`, RTL/reduced-motion polish.
- **Placeholder scan:** none — every code step shows full component/test code. The `type` input is a real (single-member) union, extended later without rework.
- **Type/API consistency:** `MatCalendar` bound via classic inputs (`[startAt]`/`[selected]`/`[minDate]`/`[maxDate]`/`[dateFilter]`) per verified v22.0.2 signatures; `selectedChange` is `EventEmitter<D | null>`. Picker API names (`open`/`close`/`toggle`/`isOpen`/`value`/`openedChange`/`opened`/`closed`/`origin`) used identically across the picker, toggle, and tests. `NgxDtOrigin = ElementRef | HTMLElement` is the single origin type used by `open()` and the toggle.
- **Risk note:** overlay tests depend on the CDK overlay container in jsdom; tests use `await fixture.whenStable()` after opening and query `.cdk-overlay-container`. If `cdkTrapFocusAutoCapture` interferes with the Escape/focus-restore assertions under jsdom, the implementer should verify focus lands in the panel on open and is restored on close, adjusting only mechanics (not dropping assertions).

## Definition of Done

- `npx ng test ngx-datetime-picker --watch=false` → all green (Plan 1 + Plan 2).
- `npx ng test date-time-picker --watch=false` → green.
- `npx ng build ngx-datetime-picker` and `npx ng build date-time-picker` → SUCCESS.
- Demo: inline calendar + toggle-driven popup, both updating a `Temporal.PlainDate` value; popup is focus-trapped, Escape/backdrop dismiss, focus restores to the toggle.
- Next: **Plan 3 — Date input (`[ngxDtInput]`) + forms contracts + validators** (authored after this plan lands).
```
