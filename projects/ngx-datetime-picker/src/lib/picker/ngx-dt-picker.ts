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
  type Signal,
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { MatCalendar } from '@angular/material/datepicker';
import { NGX_DT_DEFAULT_OPTIONS } from '../tokens';

/** Picker variants. Only `date` is implemented in this plan. */
export type NgxDtPickerType = 'date';

/** Element the overlay anchors to. */
export type NgxDtOrigin = ElementRef | HTMLElement;

/**
 * Contract a text input must satisfy to own a picker's value.
 * Kept here (not imported from the input) so the picker has no dependency on
 * the input directive — the input imports this, not the other way around.
 */
export interface NgxDtPickerInput<D> {
  /** Current model value as a signal — read reactively inside the calendar binding. */
  readonly value: Signal<D | null>;
  /** Called by the picker when the calendar selection changes. */
  setValueFromPicker(date: D | null): void;
  /** Element the overlay anchors to when the picker is opened from the input. */
  getOverlayOrigin(): NgxDtOrigin;
}

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
      <div class="ngx-dt-panel" role="group" [attr.aria-label]="ariaLabel()">
        <ng-container [ngTemplateOutlet]="panel" />
      </div>
    } @else if (origin(); as originEl) {
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="originEl"
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
          [attr.aria-label]="ariaLabel()"
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
        [selected]="displayValue()"
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
  readonly ariaLabel = input('Choose a date');

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

  private readonly _input = signal<NgxDtPickerInput<D> | null>(null);

  /**
   * Registers the text input that owns this picker's value. Idempotent for the
   * same input; throws if a different input tries to register.
   */
  registerInput(input: NgxDtPickerInput<D>): void {
    const existing = this._input();
    if (existing && existing !== input) {
      throw new Error('NgxDtPicker can only be associated with a single ngxDtInput.');
    }
    this._input.set(input);
  }

  /** Value shown by the calendar: the registered input's value, else the model value. */
  protected readonly displayValue = computed<D | null>(() => {
    const input = this._input();
    return input ? input.value() : this.value();
  });

  protected readonly effectiveStartAt = computed(
    () => this.displayValue() ?? this.startAt() ?? this.adapter.today(),
  );

  /** Open the overlay anchored to `origin`. No-op if disabled, inline, or already open. */
  open(origin?: NgxDtOrigin): void {
    if (this.disabled() || this.inline() || this._open()) {
      return;
    }
    // Anchor precedence: an explicit origin wins; otherwise prefer the
    // registered input (the canonical anchor for a text-field picker), falling
    // back to any previously-set origin.
    const anchor =
      origin ?? this._input()?.getOverlayOrigin() ?? this._origin();
    if (!anchor) {
      return; // overlay requires an anchor element
    }
    this._origin.set(anchor);
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
    const input = this._input();
    if (input) {
      input.setValueFromPicker(date);
    } else {
      this.value.set(date);
    }
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
