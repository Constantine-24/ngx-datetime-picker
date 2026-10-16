import { Component, DOCUMENT, effect, inject, signal } from '@angular/core';

const STORAGE_KEY = 'ngx-dt-demo-theme';

/**
 * Switches the page between light and dark by setting `color-scheme` on `<html>`.
 * `mat.theme()` emits `light-dark()` tokens, so every `--mat-sys-*` value follows.
 */
@Component({
  selector: 'app-theme-toggle',
  template: `
    <button
      type="button"
      class="theme-toggle"
      aria-label="Dark theme"
      [attr.aria-pressed]="dark()"
      (click)="toggle()"
    >
      @if (dark()) {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0-5 1 3h-2l1-3Zm0 20-1-3h2l-1 3ZM2 12l3-1v2l-3-1Zm20 0-3 1v-2l3 1ZM4.9 4.9l2.8 1.4-1.4 1.4-1.4-2.8Zm14.2 14.2-2.8-1.4 1.4-1.4 1.4 2.8ZM4.9 19.1l1.4-2.8 1.4 1.4-2.8 1.4ZM19.1 4.9l-1.4 2.8-1.4-1.4 2.8-1.4Z"
          />
        </svg>
      } @else {
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
        </svg>
      }
    </button>
  `,
  styles: `
    .theme-toggle {
      display: grid;
      place-items: center;
      inline-size: 2.5rem;
      block-size: 2.5rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-full);
      background: transparent;
      color: var(--mat-sys-on-surface);
      cursor: pointer;
    }
    .theme-toggle:hover {
      background: color-mix(in srgb, var(--mat-sys-on-surface) 8%, transparent);
    }
    .theme-toggle:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    svg {
      inline-size: 1.25rem;
      block-size: 1.25rem;
      fill: currentColor;
    }
  `,
})
export class ThemeToggle {
  private readonly document = inject(DOCUMENT);
  private readonly window = this.document.defaultView;

  protected readonly dark = signal(this.initialPreference());

  constructor() {
    effect(() => {
      this.document.documentElement.style.colorScheme = this.dark() ? 'dark' : 'light';
    });
  }

  /** Flips the theme and remembers the explicit choice (the OS preference is never stored). */
  protected toggle(): void {
    this.dark.update((dark) => !dark);
    try {
      this.window?.localStorage.setItem(STORAGE_KEY, this.dark() ? 'dark' : 'light');
    } catch {
      // Storage unavailable (private mode): the choice simply isn't remembered.
    }
  }

  private initialPreference(): boolean {
    try {
      const stored = this.window?.localStorage.getItem(STORAGE_KEY);
      if (stored) return stored === 'dark';
    } catch {
      // Fall through to the OS preference.
    }
    return this.window?.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
  }
}
