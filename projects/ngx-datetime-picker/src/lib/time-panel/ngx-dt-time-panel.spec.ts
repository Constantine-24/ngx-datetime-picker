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
