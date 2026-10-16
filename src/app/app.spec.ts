import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideTemporalDateTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';
import { beforeEach, describe, expect, it } from 'vitest';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideZonelessChangeDetection(),
        provideNoopAnimations(),
        provideTemporalDateTimeAdapter(),
      ],
    }).compileComponents();
  });

  async function render(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the hero heading', async () => {
    const page = await render();
    expect(page.querySelector('h1')?.textContent).toContain('Date & time pickers');
  });

  it('renders the inline hero picker as a calendar with a time panel', async () => {
    const page = await render();
    const heroPicker = page.querySelector('.hero-picker ngx-dt-picker');
    expect(heroPicker?.querySelector('mat-calendar')).toBeTruthy();
    expect(heroPicker?.querySelector('ngx-dt-time-panel')).toBeTruthy();
  });

  it('renders the playground and the example gallery', async () => {
    const page = await render();
    expect(page.querySelector('app-playground')).toBeTruthy();
    expect(page.querySelectorAll('app-example-card').length).toBeGreaterThan(0);
  });
});
