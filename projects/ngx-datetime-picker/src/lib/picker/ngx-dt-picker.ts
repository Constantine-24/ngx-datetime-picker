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
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { MatCalendar } from '@angular/material/datepicker';
import { NGX_DT_DEFAULT_OPTIONS } from '../tokens';

/** Picker variants. Only `date` is implemented in this plan. */
export type NgxDtPickerType = 'date';

/** Element the overlay anchors to. */
export type NgxDtOrigin = ElementRef | HTMLElement;

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
      <div class="ngx-dt-panel" role="group">
        <ng-container [ngTemplateOutlet]="panel" />
      </div>
    } @else {
      <ng-template
        cdkConnectedOverlay
        [cdkConnectedOverlayOrigin]="origin()!"
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
        [selected]="value()"
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

  protected readonly effectiveStartAt = computed(
    () => this.value() ?? this.startAt() ?? this.adapter.today(),
  );

  /** Open the overlay anchored to `origin`. No-op if disabled, inline, or already open. */
  open(origin?: NgxDtOrigin): void {
    if (this.disabled() || this.inline() || this._open()) {
      return;
    }
    if (origin) {
      this._origin.set(origin);
    }
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
    this.value.set(date);
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
