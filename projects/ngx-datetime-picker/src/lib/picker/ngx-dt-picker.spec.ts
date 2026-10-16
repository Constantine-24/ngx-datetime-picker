import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { provideTemporalDateAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { provideTemporalTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { DateRange } from '@angular/material/datepicker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NgxDtPicker, NgxDtPickerInput, NgxDtPickerRangeInput } from './ngx-dt-picker';
import { Directionality, type Direction } from '@angular/cdk/bidi';
import { Subject } from 'rxjs';

// Several specs click calendar cells by index and assume the calendar opens on
// June 2026. Pin "today" so they do not drift with the wall clock; only Date is
// faked, so real timers keep fixture.whenStable() working.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-06-20T12:00:00'));
});
afterEach(() => {
  vi.useRealTimers();
});

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

@Component({
  imports: [NgxDtPicker],
  template: `
    <button #trigger type="button">open</button>
    <ngx-dt-picker #picker [disabled]="true" [(value)]="value" />
  `,
})
class DisabledOverlayHost {
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

  it('does not open an overlay without an origin', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    const picker = fixture.componentInstance.picker();
    picker.open(); // no origin ever supplied
    fixture.detectChanges();
    await fixture.whenStable();
    expect(picker.isOpen()).toBe(false);
    expect(document.querySelector('.cdk-overlay-container .ngx-dt-panel')).toBeNull();
  });

  it('does not open when disabled', async () => {
    // `disabled` is bound true through the real signal input on the host
    // template (cleaner than monkey-patching the signal); open() must no-op.
    const fixture = TestBed.createComponent(DisabledOverlayHost);
    fixture.detectChanges();
    const picker = fixture.componentInstance.picker();
    expect(picker.disabled()).toBe(true);
    picker.open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    expect(picker.isOpen()).toBe(false);
    expect(overlayPanel()).toBeNull();
  });
});

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

  it('exposes an accessible name on the overlay dialog', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    fixture.componentInstance.picker().open(fixture.componentInstance.trigger());
    fixture.detectChanges();
    await fixture.whenStable();
    const panel = overlayPanel()!;
    expect(panel.getAttribute('aria-label')).toBe('Choose a date');
  });
});

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

    const root = fixture.nativeElement as HTMLElement;
    const labelOf = (sel: string) =>
      Array.from(
        root.querySelectorAll<HTMLButtonElement>('.mat-calendar-body-cell'),
      ).find((b) => b.getAttribute('aria-label')?.includes(sel));

    // June 5 is before min → disabled
    const june5 = labelOf('June 5, 2026');
    expect(june5?.getAttribute('aria-disabled')).toBe('true');
    // June 12 filtered out → disabled
    const june12 = labelOf('June 12, 2026');
    expect(june12?.getAttribute('aria-disabled')).toBe('true');
    // June 15 allowed → enabled. In Material v22 the body cell binds
    // `[attr.aria-disabled]="!item.enabled || null"`, so an enabled cell omits
    // the attribute (null) rather than setting it to "false".
    const june15 = labelOf('June 15, 2026');
    expect(june15).toBeTruthy();
    expect(june15?.getAttribute('aria-disabled')).toBeNull();
  });
});

// --- Plan 3: value-bridge seam ---------------------------------------------

/** Minimal fake input implementing the picker's registration contract. */
class FakeInput implements NgxDtPickerInput<Temporal.PlainDate> {
  readonly _value = signal<Temporal.PlainDate | null>(null);
  readonly value = this._value.asReadonly();
  fromPicker: Temporal.PlainDate | null | undefined;
  readonly origin = document.createElement('input');
  setValueFromPicker(date: Temporal.PlainDate | null): void {
    this.fromPicker = date;
    this._value.set(date);
  }
  getOverlayOrigin(): HTMLElement {
    return this.origin;
  }
}

describe('NgxDtPicker — value bridge', () => {
  beforeEach(setup);

  it('routes calendar selection to the registered input, not [(value)]', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const picker = fixture.debugElement.children[0].componentInstance as NgxDtPicker<Temporal.PlainDate>;
    const input = new FakeInput();
    picker.registerInput(input);

    const cell: HTMLElement = fixture.nativeElement.querySelector('.mat-calendar-body-cell');
    cell.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.fromPicker).toBeInstanceOf(Temporal.PlainDate);
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('drives the calendar [selected] from the registered input value', async () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance as NgxDtPicker<Temporal.PlainDate>;
    const input = new FakeInput();
    input._value.set(Temporal.PlainDate.from('2026-06-15'));
    picker.registerInput(input);
    fixture.detectChanges();
    await fixture.whenStable();

    const selected = fixture.nativeElement.querySelector('.mat-calendar-body-selected');
    expect(selected).toBeTruthy();
  });

  it('throws when a second, different input registers', () => {
    const fixture = TestBed.createComponent(InlineHost);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0].componentInstance as NgxDtPicker<Temporal.PlainDate>;
    picker.registerInput(new FakeInput());
    expect(() => picker.registerInput(new FakeInput())).toThrow(/single/);
  });
});

describe('NgxDtPicker — opens anchored to the input', () => {
  beforeEach(setup);

  it('open() with no origin uses the registered input element', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    const picker = fixture.componentInstance.picker();
    const input = new FakeInput();
    document.body.appendChild(input.origin);
    picker.registerInput(input);

    picker.open();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(picker.isOpen()).toBe(true);
    expect(overlayPanel()).toBeTruthy();
    input.origin.remove();
  });
});

// --- Plan 4: date-range engine -------------------------------------------

@Component({
  imports: [NgxDtPicker],
  template: `
    <ngx-dt-picker #picker [inline]="true" type="date-range" [(range)]="range" />
  `,
})
class InlineRangeHost {
  range = signal<DateRange<Temporal.PlainDate> | null>(null);
}

function rangeCells(fixture: { nativeElement: HTMLElement }): HTMLElement[] {
  return Array.from(
    fixture.nativeElement.querySelectorAll<HTMLElement>('.mat-calendar-body-cell'),
  );
}

describe('NgxDtPicker — date-range engine', () => {
  beforeEach(setup);

  it('first click sets the range start with a null end', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    rangeCells(fixture)[4].click(); // 5th of the active month
    fixture.detectChanges();
    await fixture.whenStable();

    const range = fixture.componentInstance.range();
    expect(range?.start).toBeInstanceOf(Temporal.PlainDate);
    expect(range?.end).toBeNull();
    expect(range?.start?.day).toBe(5);
  });

  it('a second click on/after the start completes the range', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = rangeCells(fixture);
    cells[4].click(); // start = 5th
    fixture.detectChanges();
    await fixture.whenStable();
    cells[9].click(); // end = 10th
    fixture.detectChanges();
    await fixture.whenStable();

    const range = fixture.componentInstance.range()!;
    expect(range.start?.day).toBe(5);
    expect(range.end?.day).toBe(10);
    expect(
      Temporal.PlainDate.compare(range.end!, range.start!),
    ).toBeGreaterThanOrEqual(0);
  });

  it('a click before the current start resets the start', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();

    const cells = rangeCells(fixture);
    cells[9].click(); // start = 10th
    fixture.detectChanges();
    await fixture.whenStable();
    cells[4].click(); // earlier than start → resets
    fixture.detectChanges();
    await fixture.whenStable();

    const range = fixture.componentInstance.range()!;
    expect(range.start?.day).toBe(5);
    expect(range.end).toBeNull();
  });
});

/** Minimal fake range input implementing the picker's range contract. */
class FakeRangeInput implements NgxDtPickerRangeInput<Temporal.PlainDate> {
  readonly _range = signal<DateRange<Temporal.PlainDate> | null>(null);
  readonly range = this._range.asReadonly();
  fromPicker: DateRange<Temporal.PlainDate> | undefined;
  readonly origin = document.createElement('div');
  setRangeFromPicker(range: DateRange<Temporal.PlainDate>): void {
    this.fromPicker = range;
    this._range.set(range);
  }
  getOverlayOrigin(): HTMLElement {
    return this.origin;
  }
}

describe('NgxDtPicker — range value bridge', () => {
  beforeEach(setup);

  it('routes range selection to the registered range input, not [(range)]', async () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    await fixture.whenStable();
    const picker = fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDate>;
    const input = new FakeRangeInput();
    picker.registerRangeInput(input);

    rangeCells(fixture)[4].click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(input.fromPicker?.start).toBeInstanceOf(Temporal.PlainDate);
    expect(fixture.componentInstance.range()).toBeNull();
  });

  it('throws when a second, different range input registers', () => {
    const fixture = TestBed.createComponent(InlineRangeHost);
    fixture.detectChanges();
    const picker = fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDate>;
    picker.registerRangeInput(new FakeRangeInput());
    expect(() => picker.registerRangeInput(new FakeRangeInput())).toThrow(/single/);
  });
});

describe('NgxDtPicker — range opens anchored to the input', () => {
  beforeEach(setup);

  it('open() with no origin uses the registered range input element', async () => {
    const fixture = TestBed.createComponent(OverlayHost);
    fixture.detectChanges();
    const picker = fixture.componentInstance.picker();
    const input = new FakeRangeInput();
    document.body.appendChild(input.origin);
    picker.registerRangeInput(input);

    picker.open();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(picker.isOpen()).toBe(true);
    expect(overlayPanel()).toBeTruthy();
    input.origin.remove();
  });
});

// --- Plan 5: time picker integration -------------------------------------

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

// --- Plan 6: datetime mode -----------------------------------------------

import { provideTemporalDateTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';

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

  it('timePanelMin/Max expose the bound time only on the boundary day', async () => {
    const fixture = TestBed.createComponent(ConstrainedDateTimeHost);
    fixture.componentInstance.min.set(Temporal.PlainDateTime.from('2026-06-21T14:00'));
    fixture.componentInstance.max.set(Temporal.PlainDateTime.from('2026-06-23T17:00'));
    // On the min day: floor = min time; max is a different day → no ceiling.
    fixture.componentInstance.value.set(Temporal.PlainDateTime.from('2026-06-21T16:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    const picker = fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDateTime>;
    const internals = picker as unknown as {
      timePanelMin: () => Temporal.PlainTime | null;
      timePanelMax: () => Temporal.PlainTime | null;
    };
    expect(internals.timePanelMin()).toBeInstanceOf(Temporal.PlainTime);
    expect(internals.timePanelMin()!.hour).toBe(14);
    expect(internals.timePanelMax()).toBeNull();

    // On the max day: ceiling = max time; floor disappears.
    fixture.componentInstance.value.set(Temporal.PlainDateTime.from('2026-06-23T10:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(internals.timePanelMin()).toBeNull();
    expect(internals.timePanelMax()).toBeInstanceOf(Temporal.PlainTime);
    expect(internals.timePanelMax()!.hour).toBe(17);

    // On a middle day: neither bound applies.
    fixture.componentInstance.value.set(Temporal.PlainDateTime.from('2026-06-22T09:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(internals.timePanelMin()).toBeNull();
    expect(internals.timePanelMax()).toBeNull();
  });

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
});

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

// --- Plan 8: dual synced calendars (monthsToDisplay=2) -------------------

@Component({
  imports: [NgxDtPicker],
  template: `<ngx-dt-picker [inline]="true" type="date-range" [monthsToDisplay]="months()" [startAt]="startAt()" />`,
})
class DualHost {
  months = signal<1 | 2>(2);
  startAt = signal<Temporal.PlainDate | null>(null);
}

@Component({
  imports: [NgxDtPicker],
  template: `<ngx-dt-picker [inline]="true" type="datetime-range" [monthsToDisplay]="2" [startAt]="startAt()" />`,
})
class DualDateTimeHost {
  startAt = signal<Temporal.PlainDateTime | null>(null);
}

describe('NgxDtPicker — dual calendars (monthsToDisplay)', () => {
  function setupDual() {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateAdapter(),
      ],
    });
  }
  beforeEach(setupDual);

  it('renders two calendars when monthsToDisplay is 2 (range mode)', async () => {
    const fixture = TestBed.createComponent(DualHost);
    fixture.componentInstance.startAt.set(Temporal.PlainDate.from('2026-06-15'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('mat-calendar').length).toBe(2);
  });

  it('renders a single calendar when monthsToDisplay is 1', async () => {
    const fixture = TestBed.createComponent(DualHost);
    fixture.componentInstance.months.set(1);
    fixture.componentInstance.startAt.set(Temporal.PlainDate.from('2026-06-15'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('mat-calendar').length).toBe(1);
  });

  it('the shared next-month control advances both month labels', async () => {
    const fixture = TestBed.createComponent(DualHost);
    fixture.componentInstance.startAt.set(Temporal.PlainDate.from('2026-06-15'));
    fixture.detectChanges();
    await fixture.whenStable();
    const labels = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.ngx-dt-cal-label'),
      ).map((el) => el.textContent?.trim());
    expect(labels()).toEqual(['June 2026', 'July 2026']);
    (fixture.nativeElement.querySelector('[data-testid="cal-next"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(labels()).toEqual(['July 2026', 'August 2026']);
  });

  it('renders two calendars for a datetime-range picker too', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateTimeAdapter(),
      ],
    });
    const fixture = TestBed.createComponent(DualDateTimeHost);
    fixture.componentInstance.startAt.set(Temporal.PlainDateTime.from('2026-06-15T00:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('mat-calendar').length).toBe(2);
  });
});

// --- Plan 8 (Task 6): draft / Apply-Cancel mode ---------------------------

@Component({
  imports: [NgxDtPicker],
  template: `
    <button #trigger type="button">open</button>
    <ngx-dt-picker #picker type="date" [draftMode]="true" [(value)]="value" />
  `,
})
class DraftHost {
  value = signal<Temporal.PlainDate | null>(null);
  readonly picker = viewChild.required<NgxDtPicker<Temporal.PlainDate>>('picker');
  readonly trigger = viewChild.required<unknown, ElementRef<HTMLButtonElement>>(
    'trigger',
    { read: ElementRef },
  );
}

function createDraftHost() {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideZonelessChangeDetection(),
      provideNoopAnimations(),
      provideTemporalDateAdapter(),
    ],
  });
  const fixture = TestBed.createComponent(DraftHost);
  fixture.detectChanges();
  return fixture;
}

describe('NgxDtPicker — draftMode', () => {
  it('draftMode: selecting buffers until Apply, then commits', async () => {
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
});

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

  /** Returns the NgxDtPicker instance from an InlineDateTimeRangeHost fixture. */
  function createDateTimeRangePicker(): NgxDtPicker<Temporal.PlainDateTime> {
    const fixture = TestBed.createComponent(InlineDateTimeRangeHost);
    fixture.detectChanges();
    return fixture.debugElement.children[0]
      .componentInstance as NgxDtPicker<Temporal.PlainDateTime>;
  }

  /** Template-only (protected) members these specs reach into. */
  interface DateTimeRangeInternals {
    startTimePanelMax(): Temporal.PlainDateTime | null;
    endTimePanelMin(): Temporal.PlainDateTime | null;
    onStartTimeChange(time: Temporal.PlainTime | null): void;
  }
  const internals = (picker: NgxDtPicker<Temporal.PlainDateTime>) =>
    picker as unknown as DateTimeRangeInternals;

  it('exposes symmetric start/end time-panel bounds on a shared day', async () => {
    // datetime-range picker with a range whose start and end fall on the same day.
    const p = createDateTimeRangePicker();
    p.range.set(
      new DateRange(
        Temporal.PlainDateTime.from('2026-06-21T09:00'),
        Temporal.PlainDateTime.from('2026-06-21T17:00'),
      ),
    );
    // start ceiling is the end time; end floor is the start time (same day).
    expect(internals(p).startTimePanelMax()?.toString()).toContain('17:00');
    expect(internals(p).endTimePanelMin()?.toString()).toContain('09:00');
  });

  it('stepping a start time before any date anchors to today (intentional parity)', async () => {
    const p = createDateTimeRangePicker();
    p.range.set(new DateRange<Temporal.PlainDateTime>(null, null));
    internals(p).onStartTimeChange(Temporal.PlainTime.from('08:30'));
    await Promise.resolve();
    const start = p.range()?.start;
    expect(start).not.toBeNull();
    expect(start!.toPlainTime().toString()).toContain('08:30');
  });
});

// --- Plan 8 (Task 7): RTL support -----------------------------------------

describe('NgxDtPicker — RTL support', () => {
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
});

// --- Task 9 (deferred Minor from Task 5): dualCalendars gates on calendarRangeMode ---------

@Component({
  imports: [NgxDtPicker],
  template: `<ngx-dt-picker [inline]="true" type="date" [monthsToDisplay]="2" />`,
})
class NonRangeDualHost {}

describe('NgxDtPicker — non-range monthsToDisplay=2 renders one calendar', () => {
  it('a non-range picker with monthsToDisplay=2 still renders ONE mat-calendar', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateAdapter(),
      ],
    });
    const fixture = TestBed.createComponent(NonRangeDualHost);
    fixture.detectChanges();
    await fixture.whenStable();
    // dualCalendars() gates on calendarRangeMode(); for type="date" it must be false.
    expect(fixture.nativeElement.querySelectorAll('mat-calendar').length).toBe(1);
  });
});
