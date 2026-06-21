import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Temporal } from 'temporal-polyfill';
import { MAT_DATE_LOCALE } from '@angular/material/core';
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
      [hourCycle]="hourCycle()"
      [timeFilter]="timeFilter()"
    />
  `,
})
class Host {
  value = signal<Temporal.PlainTime | null>(null);
  showSeconds = signal(false);
  min = signal<Temporal.PlainTime | null>(null);
  max = signal<Temporal.PlainTime | null>(null);
  minuteStep = signal(1);
  hourCycle = signal<12 | 24 | null>(24);
  timeFilter = signal<(t: Temporal.PlainTime) => boolean>(() => true);
}

@Component({
  imports: [NgxDtTimePanel],
  template: `<ngx-dt-time-panel [(value)]="value" [hourCycle]="hourCycle()" />`,
})
class Host12 {
  value = signal<Temporal.PlainTime | null>(null);
  hourCycle = signal<12 | 24 | null>(null);
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

  it('does not re-announce when a step is a no-op at the boundary', async () => {
    const fixture = TestBed.createComponent(Host);
    // Use a value whose minute does NOT wrap on +1, so the composed time
    // (23:01) exceeds max and clamps straight back to 23:00 — a true no-op.
    // (The per-field minute wrap from :59 is intentional, so :59 is not a no-op.)
    fixture.componentInstance.value.set(Temporal.PlainTime.from('23:00'));
    fixture.componentInstance.max.set(Temporal.PlainTime.from('23:00'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    // Stepping minute up at the max is a no-op; value stays 23:00.
    root.querySelector<HTMLButtonElement>('[data-testid="up-minute"]')!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const v = fixture.componentInstance.value()!;
    expect(v.hour).toBe(23);
    expect(v.minute).toBe(0);
  });

  it('clamps typed input above the field max instead of wrapping', async () => {
    const fixture = await render(new Host());
    const root = fixture.nativeElement as HTMLElement;
    const minute = fields(root)[1];
    minute.value = '99';
    minute.dispatchEvent(new Event('input'));
    minute.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.value()!.minute).toBe(59);
  });

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
});

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

  it('defaults to 12h for an en-US locale when hourCycle is null', async () => {
    const fixture = TestBed.createComponent(Host12);
    // hourCycle left at null (default); en-US is the ambient test locale.
    fixture.componentInstance.value.set(Temporal.PlainTime.from('13:30'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const hour = root.querySelector<HTMLInputElement>('input[role="spinbutton"]')!;
    expect(hour.getAttribute('aria-valuemax')).toBe('12');
    expect(hour.value).toBe('01');
    expect(root.querySelector('[data-testid="meridiem-pm"]')).toBeTruthy();
  });

  it('defaults to 24h for an en-GB locale when hourCycle is null', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalTimeAdapter(),
        { provide: MAT_DATE_LOCALE, useValue: 'en-GB' },
      ],
    });
    const fixture = TestBed.createComponent(Host12);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('13:30'));
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const hour = root.querySelector<HTMLInputElement>('input[role="spinbutton"]')!;
    expect(hour.getAttribute('aria-valuemax')).toBe('23');
    expect(hour.value).toBe('13');
    expect(root.querySelector('[data-testid="meridiem-am"]')).toBeNull();
  });

  it('no meridiem toggle is rendered in 24h mode', async () => {
    const fixture = TestBed.createComponent(Host12);
    fixture.componentInstance.hourCycle.set(24);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="meridiem-am"]')).toBeNull();
  });

  it('reports aria-valuenow as the 12h hour within [valuemin, valuemax]', async () => {
    const fixture = TestBed.createComponent(Host12);
    fixture.componentInstance.value.set(Temporal.PlainTime.from('13:30'));
    fixture.componentInstance.hourCycle.set(12);
    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    const hour = root.querySelector<HTMLInputElement>('input[role="spinbutton"]')!;
    expect(hour.getAttribute('aria-valuenow')).toBe('1');
  });
});
