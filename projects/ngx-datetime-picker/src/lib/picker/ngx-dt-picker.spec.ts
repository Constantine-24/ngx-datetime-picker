import { Component, ElementRef, signal, viewChild } from '@angular/core';
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
});
