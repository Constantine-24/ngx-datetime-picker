import { NgTemplateOutlet } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  model,
} from '@angular/core';
import { DateAdapter } from '@angular/material/core';
import { MatCalendar } from '@angular/material/datepicker';

/** Picker variants. Only `date` is implemented in this plan. */
export type NgxDtPickerType = 'date';

@Component({
  selector: 'ngx-dt-picker',
  exportAs: 'ngxDtPicker',
  imports: [NgTemplateOutlet, MatCalendar],
  template: `
    @if (inline()) {
      <div class="ngx-dt-panel" role="group">
        <ng-container [ngTemplateOutlet]="panel" />
      </div>
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

  readonly type = input<NgxDtPickerType>('date');
  readonly inline = input(false);
  readonly startAt = input<D | null>(null);
  readonly startView = input<'month' | 'year' | 'multi-year'>('month');
  readonly min = input<D | null>(null);
  readonly max = input<D | null>(null);
  readonly dateFilter = input<(date: D) => boolean>(() => true);
  readonly disabled = input(false);

  /** Two-way selected value. `model()` provides the `valueChange` output. */
  readonly value = model<D | null>(null);

  /** Lazily resolves the month to open on (value → startAt → today). */
  protected readonly effectiveStartAt = computed(
    () => this.value() ?? this.startAt() ?? this.adapter.today(),
  );

  protected onSelectedChange(date: D | null): void {
    this.value.set(date);
  }
}
