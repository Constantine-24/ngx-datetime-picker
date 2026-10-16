import { Component, computed, input } from '@angular/core';
import { CodeBlock } from './code-block';

/** A showcase card: heading, one-line description, the live example, and its code on demand. */
@Component({
  selector: 'app-example-card',
  imports: [CodeBlock],
  template: `
    <article class="card" [attr.aria-labelledby]="headingId()">
      <header>
        <h3 [id]="headingId()">{{ heading() }}</h3>
        <p>{{ description() }}</p>
      </header>
      <div class="demo">
        <ng-content />
      </div>
      <details>
        <summary>Show code</summary>
        <div class="code">
          @if (componentCode(); as component) {
            <app-code-block label="Component" [code]="component" />
          }
          <app-code-block label="Template" [code]="code()" />
        </div>
      </details>
    </article>
  `,
  styles: `
    .card {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      block-size: 100%;
      box-sizing: border-box;
      padding: 1.5rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-extra-large);
      background: var(--mat-sys-surface-container-low);
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-on-surface);
    }
    header p {
      margin: 0.25rem 0 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .demo {
      flex: 1;
    }
    summary {
      inline-size: fit-content;
      padding-block: 0.375rem;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-primary);
      cursor: pointer;
    }
    summary:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: 2px;
      border-radius: var(--mat-sys-corner-extra-small);
    }
    .code {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    details[open] summary {
      margin-block-end: 0.75rem;
    }
  `,
})
export class ExampleCard {
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
  readonly code = input.required<string>();
  /** Optional TypeScript (component members) the template relies on. */
  readonly componentCode = input<string>();

  protected readonly headingId = computed(
    () =>
      `example-${this.heading()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')}`,
  );
}
