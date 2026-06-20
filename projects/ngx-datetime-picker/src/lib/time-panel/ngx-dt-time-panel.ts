import { LiveAnnouncer } from '@angular/cdk/a11y';
import { Component, computed, inject, input, model } from '@angular/core';
import { MAT_DATE_LOCALE } from '@angular/material/core';
import { NgxDtTimeAdapter } from '../time/ngx-dt-time-adapter';

type TimeField = 'hour' | 'minute' | 'second';
interface TimeParts {
  hour: number;
  minute: number;
  second: number;
}

/** Modular wrap into `[0, mod)`. */
function wrap(value: number, mod: number): number {
  return ((value % mod) + mod) % mod;
}
function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/**
 * Custom stepper time panel. Each field is a `role="spinbutton"` input with
 * `+/−` buttons; ArrowUp/Down step by one unit (minutes by `minuteStep`) and
 * typing commits on blur/Enter. Composed values are clamped into `[min, max]`.
 */
@Component({
  selector: 'ngx-dt-time-panel',
  exportAs: 'ngxDtTimePanel',
  template: `
    <div class="ngx-dt-time-panel" role="group" [attr.aria-label]="ariaLabel()">
      <div class="ngx-dt-time-field">
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="up-hour"
          [disabled]="disabled()"
          [attr.aria-label]="'Increase hours'"
          (click)="step('hour', 1)"
        >
          <span aria-hidden="true">▲</span>
        </button>
        <input
          type="text"
          role="spinbutton"
          inputmode="numeric"
          autocomplete="off"
          maxlength="2"
          class="ngx-dt-time-input"
          [value]="hourText()"
          [disabled]="disabled()"
          [attr.aria-label]="'Hours'"
          [attr.aria-valuemin]="hourMin()"
          [attr.aria-valuemax]="hourMax()"
          [attr.aria-valuenow]="parts()?.hour ?? null"
          [attr.aria-valuetext]="hourText() === '--' ? null : hourText()"
          (keydown)="onFieldKeydown('hour', $event)"
          (blur)="commitField('hour', $event)"
        />
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="down-hour"
          [disabled]="disabled()"
          [attr.aria-label]="'Decrease hours'"
          (click)="step('hour', -1)"
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>

      <span class="ngx-dt-time-sep" aria-hidden="true">:</span>

      <div class="ngx-dt-time-field">
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="up-minute"
          [disabled]="disabled()"
          [attr.aria-label]="'Increase minutes'"
          (click)="step('minute', 1)"
        >
          <span aria-hidden="true">▲</span>
        </button>
        <input
          type="text"
          role="spinbutton"
          inputmode="numeric"
          autocomplete="off"
          maxlength="2"
          class="ngx-dt-time-input"
          [value]="minuteText()"
          [disabled]="disabled()"
          [attr.aria-label]="'Minutes'"
          [attr.aria-valuemin]="0"
          [attr.aria-valuemax]="59"
          [attr.aria-valuenow]="parts()?.minute ?? null"
          [attr.aria-valuetext]="minuteText() === '--' ? null : minuteText()"
          (keydown)="onFieldKeydown('minute', $event)"
          (blur)="commitField('minute', $event)"
        />
        <button
          type="button"
          class="ngx-dt-time-step"
          tabindex="-1"
          data-testid="down-minute"
          [disabled]="disabled()"
          [attr.aria-label]="'Decrease minutes'"
          (click)="step('minute', -1)"
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>

      @if (showSeconds()) {
        <span class="ngx-dt-time-sep" aria-hidden="true">:</span>
        <div class="ngx-dt-time-field">
          <button
            type="button"
            class="ngx-dt-time-step"
            tabindex="-1"
            data-testid="up-second"
            [disabled]="disabled()"
            [attr.aria-label]="'Increase seconds'"
            (click)="step('second', 1)"
          >
            <span aria-hidden="true">▲</span>
          </button>
          <input
            type="text"
            role="spinbutton"
            inputmode="numeric"
            autocomplete="off"
            maxlength="2"
            class="ngx-dt-time-input"
            [value]="secondText()"
            [disabled]="disabled()"
            [attr.aria-label]="'Seconds'"
            [attr.aria-valuemin]="0"
            [attr.aria-valuemax]="59"
            [attr.aria-valuenow]="parts()?.second ?? null"
            [attr.aria-valuetext]="secondText() === '--' ? null : secondText()"
            (keydown)="onFieldKeydown('second', $event)"
            (blur)="commitField('second', $event)"
          />
          <button
            type="button"
            class="ngx-dt-time-step"
            tabindex="-1"
            data-testid="down-second"
            [disabled]="disabled()"
            [attr.aria-label]="'Decrease seconds'"
            (click)="step('second', -1)"
          >
            <span aria-hidden="true">▼</span>
          </button>
        </div>
      }

      @if (effectiveHourCycle() === 12) {
        <div class="ngx-dt-time-meridiem" role="group" [attr.aria-label]="'AM or PM'">
          <button
            type="button"
            class="ngx-dt-time-meridiem-btn"
            data-testid="meridiem-am"
            [disabled]="disabled()"
            [attr.aria-pressed]="meridiem() === 'AM'"
            (click)="setMeridiem('AM')"
          >
            AM
          </button>
          <button
            type="button"
            class="ngx-dt-time-meridiem-btn"
            data-testid="meridiem-pm"
            [disabled]="disabled()"
            [attr.aria-pressed]="meridiem() === 'PM'"
            (click)="setMeridiem('PM')"
          >
            PM
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      .ngx-dt-time-panel {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 8px;
        color: var(--mat-sys-on-surface, currentColor);
        font: var(--mat-sys-body-large, inherit);
      }
      .ngx-dt-time-field {
        display: inline-flex;
        flex-direction: column;
        align-items: center;
      }
      .ngx-dt-time-input {
        width: 2.5ch;
        min-width: 24px;
        text-align: center;
        font: inherit;
        color: inherit;
        background: var(--mat-sys-surface-container-highest, transparent);
        border: 1px solid var(--mat-sys-outline, currentColor);
        border-radius: 4px;
        padding: 4px 6px;
      }
      .ngx-dt-time-input:focus-visible {
        outline: 2px solid var(--mat-sys-primary, Highlight);
        outline-offset: 1px;
      }
      .ngx-dt-time-step {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        min-height: 24px;
        border: none;
        background: transparent;
        color: inherit;
        cursor: pointer;
        border-radius: 4px;
      }
      .ngx-dt-time-step:hover:not([disabled]) {
        background: var(--mat-sys-surface-container-high, transparent);
      }
      .ngx-dt-time-step[disabled] {
        opacity: 0.38;
        cursor: default;
      }
      .ngx-dt-time-sep {
        padding: 0 2px;
      }
      .ngx-dt-time-meridiem {
        display: inline-flex;
        flex-direction: column;
        gap: 2px;
        margin-inline-start: 6px;
      }
      .ngx-dt-time-meridiem-btn {
        min-width: 40px;
        min-height: 24px;
        border: 1px solid var(--mat-sys-outline, currentColor);
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
      }
      .ngx-dt-time-meridiem-btn[aria-pressed='true'] {
        background: var(--mat-sys-primary, Highlight);
        color: var(--mat-sys-on-primary, HighlightText);
        border-color: transparent;
      }
      .ngx-dt-time-meridiem-btn[disabled] {
        opacity: 0.38;
        cursor: default;
      }
    `,
  ],
  host: { class: 'ngx-dt-time-panel-host' },
})
export class NgxDtTimePanel<T = unknown> {
  protected readonly adapter = inject<NgxDtTimeAdapter<T>>(NgxDtTimeAdapter);
  private readonly live = inject(LiveAnnouncer);
  private readonly locale =
    (inject(MAT_DATE_LOCALE, { optional: true }) as string | null) ?? 'en-US';

  /** Two-way time value. `model()` provides `valueChange`. */
  readonly value = model<T | null>(null);
  readonly min = input<T | null>(null);
  readonly max = input<T | null>(null);
  readonly minuteStep = input(1);
  readonly showSeconds = input(false);
  readonly disabled = input(false);
  readonly ariaLabel = input('Choose a time');
  readonly hourCycle = input<12 | 24 | null>(null);

  protected readonly effectiveHourCycle = computed<12 | 24>(() => {
    // `hourCycle` is the explicit opt-in. When unset we derive the cycle purely
    // from the resolved locale (`MAT_DATE_LOCALE`, defaulting to `'en-US'`),
    // matching Material's `MatTimepicker` locale-aware behaviour.
    const explicit = this.hourCycle();
    if (explicit != null) return explicit;
    return this.localeUses12Hour() ? 12 : 24;
  });

  protected readonly meridiem = computed<'AM' | 'PM' | null>(() => {
    const p = this.parts();
    if (!p) return null;
    return p.hour < 12 ? 'AM' : 'PM';
  });

  private localeUses12Hour(): boolean {
    return (
      new Intl.DateTimeFormat(this.locale, { hour: 'numeric' }).resolvedOptions()
        .hour12 === true
    );
  }

  /** Components of the current value, or null when unset/invalid. */
  protected readonly parts = computed<TimeParts | null>(() => {
    const v = this.value();
    if (v != null && this.adapter.isValid(v)) {
      return this.toParts(v);
    }
    return null;
  });

  // ARIA bounds for the hour field (cycle-aware).
  protected readonly hourMin = computed(() => (this.effectiveHourCycle() === 12 ? 1 : 0));
  protected readonly hourMax = computed(() => (this.effectiveHourCycle() === 12 ? 12 : 23));

  protected readonly hourText = computed(() => {
    const p = this.parts();
    return p ? pad(this.displayHour(p.hour)) : '--';
  });
  protected readonly minuteText = computed(() => {
    const p = this.parts();
    return p ? pad(p.minute) : '--';
  });
  protected readonly secondText = computed(() => {
    const p = this.parts();
    return p ? pad(p.second) : '--';
  });

  // --- field stepping / typing ---------------------------------------------

  protected step(field: TimeField, direction: number): void {
    const unit = field === 'minute' ? this.minuteStep() : 1;
    this.commit((p) => this.stepField(p, field, direction * unit));
  }

  protected onFieldKeydown(field: TimeField, event: KeyboardEvent): void {
    if (this.disabled()) return;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.step(field, 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.step(field, -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.commitField(field, event);
    }
  }

  protected commitField(field: TimeField, event: Event): void {
    if (this.disabled()) return;
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '');
    if (digits !== '') {
      this.commit((p) => this.setField(p, field, Number(digits)));
    }
    // Always reformat the edited field (covers the no-op-change case).
    input.value = this.fieldText(field);
  }

  protected setMeridiem(target: 'AM' | 'PM'): void {
    this.commit((p) => {
      let hour = p.hour;
      if (target === 'AM' && hour >= 12) hour -= 12;
      if (target === 'PM' && hour < 12) hour += 12;
      return { ...p, hour };
    });
  }

  /** Apply a parts mutation, compose, clamp, set, announce on change. */
  private commit(mutate: (p: TimeParts) => TimeParts): void {
    const base = this.parts() ?? this.toParts(this.baseTime());
    const next = mutate(base);
    const composed = this.adapter.createTime(next.hour, next.minute, next.second);
    const clamped = this.adapter.clampTime(composed, this.min(), this.max());
    if (!this.adapter.sameTime(clamped, this.value())) {
      this.value.set(clamped);
      void this.live.announce(this.announceText(clamped), 'polite');
    }
  }

  /** Seed editing when value is null: "now" clamped into `[min, max]`. */
  private baseTime(): T {
    return this.adapter.clampTime(this.adapter.now(), this.min(), this.max());
  }

  // Step the underlying 24h field, wrapping within its range.
  protected stepField(parts: TimeParts, field: TimeField, delta: number): TimeParts {
    if (field === 'hour') return { ...parts, hour: wrap(parts.hour + delta, 24) };
    if (field === 'minute') return { ...parts, minute: wrap(parts.minute + delta, 60) };
    return { ...parts, second: wrap(parts.second + delta, 60) };
  }

  // Set a field from a typed number; clamps into range (cycle-aware for hour).
  protected setField(parts: TimeParts, field: TimeField, raw: number): TimeParts {
    if (field === 'hour') {
      if (this.effectiveHourCycle() === 12) {
        const h12 = Math.min(Math.max(raw, 1), 12); // clamp into 1..12
        const pm = parts.hour >= 12;
        const hour = (h12 % 12) + (pm ? 12 : 0);
        return { ...parts, hour };
      }
      return { ...parts, hour: Math.min(raw, 23) };
    }
    if (field === 'minute') return { ...parts, minute: Math.min(raw, 59) };
    return { ...parts, second: Math.min(raw, 59) };
  }

  protected toParts(t: T): TimeParts {
    return {
      hour: this.adapter.getHour(t),
      minute: this.adapter.getMinute(t),
      second: this.adapter.getSecond(t),
    };
  }

  // Hour shown in the field (identity in 24h; 1..12 mapping in 12h).
  protected displayHour(hour: number): number {
    if (this.effectiveHourCycle() === 12) {
      const h = hour % 12;
      return h === 0 ? 12 : h;
    }
    return hour;
  }

  private fieldText(field: TimeField): string {
    if (field === 'hour') return this.hourText();
    if (field === 'minute') return this.minuteText();
    return this.secondText();
  }

  private announceText(time: T): string {
    return this.adapter.format(time, {
      hour: '2-digit',
      minute: '2-digit',
      ...(this.showSeconds() ? { second: '2-digit' } : {}),
      hour12: this.effectiveHourCycle() === 12,
    });
  }
}
