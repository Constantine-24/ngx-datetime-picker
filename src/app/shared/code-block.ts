import { Component, DestroyRef, DOCUMENT, inject, input, signal } from '@angular/core';

/** A labelled, keyboard-scrollable code sample with a copy-to-clipboard button. */
@Component({
  selector: 'app-code-block',
  template: `
    <figure class="code-block">
      <figcaption>
        <span>{{ label() }}</span>
        <button type="button" class="copy" (click)="copy()" [attr.aria-label]="'Copy ' + label()">
          {{ copied() ? 'Copied' : 'Copy' }}
        </button>
      </figcaption>
      <pre tabindex="0" [attr.aria-label]="label() + ' code'"><code>{{ code() }}</code></pre>
      <span class="visually-hidden" aria-live="polite">{{
        copied() ? label() + ' copied to clipboard' : ''
      }}</span>
    </figure>
  `,
  styles: `
    .code-block {
      margin: 0;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      background: var(--mat-sys-surface-container-highest);
      overflow: hidden;
    }
    figcaption {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-block: 0.25rem;
      padding-inline: 1rem 0.25rem;
      font: var(--mat-sys-label-medium);
      color: var(--mat-sys-on-surface-variant);
      border-block-end: 1px solid var(--mat-sys-outline-variant);
    }
    .copy {
      min-block-size: 2rem;
      padding-inline: 0.75rem;
      border: 0;
      border-radius: var(--mat-sys-corner-full);
      background: transparent;
      color: var(--mat-sys-primary);
      font: var(--mat-sys-label-large);
      cursor: pointer;
    }
    .copy:hover {
      background: color-mix(in srgb, var(--mat-sys-primary) 8%, transparent);
    }
    .copy:focus-visible,
    pre:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -2px;
    }
    pre {
      margin: 0;
      padding: 1rem;
      overflow-x: auto;
      font:
        0.8125rem/1.6 ui-monospace,
        'SF Mono',
        'Cascadia Code',
        Menlo,
        Consolas,
        monospace;
      color: var(--mat-sys-on-surface);
      direction: ltr;
      text-align: start;
    }
    .visually-hidden {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
  `,
})
export class CodeBlock {
  readonly code = input.required<string>();
  readonly label = input('Code');

  protected readonly copied = signal(false);

  private readonly clipboard = inject(DOCUMENT).defaultView?.navigator.clipboard;
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.resetTimer));
  }

  protected async copy(): Promise<void> {
    if (!this.clipboard) return;
    try {
      await this.clipboard.writeText(this.code());
    } catch {
      // Clipboard permission denied (e.g. insecure context): leave the button unchanged.
      return;
    }
    this.copied.set(true);
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.copied.set(false), 2000);
  }
}
