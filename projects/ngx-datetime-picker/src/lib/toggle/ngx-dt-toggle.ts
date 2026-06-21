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
  styles: [
    `
      .ngx-dt-toggle-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 40px;
        min-height: 40px;
        padding: 8px;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: var(--mat-sys-on-surface-variant, currentColor);
        cursor: pointer;
      }
      .ngx-dt-toggle-button:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-toggle-button:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 2px;
      }
      .ngx-dt-toggle-button[disabled] {
        opacity: 0.38;
        cursor: default;
      }
      .ngx-dt-toggle-icon {
        display: block;
      }
    `,
  ],
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
