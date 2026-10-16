// Code shown under each example card. Keep in sync with examples.html.

export const VALIDATION_SNIPPET = `<mat-form-field>
  <mat-label>Delivery date</mat-label>
  <input matInput [ngxDtInput]="picker" [formControl]="delivery" />
  <ngx-dt-toggle matSuffix [for]="picker" />
  @if (delivery.hasError('ngxDtParse')) {
    <mat-error>That doesn't look like a date.</mat-error>
  } @else if (delivery.hasError('ngxDtMin')) {
    <mat-error>Delivery can't be in the past.</mat-error>
  }
</mat-form-field>
<ngx-dt-picker #picker [min]="today" [max]="inAYear" />`;

export const STAY_SNIPPET = `<ngx-dt-date-range-input [rangePicker]="picker" [formField]="booking.stay"
  ariaLabel="Stay">
  <input ngxDtStartDate aria-label="Check-in" />
  <input ngxDtEndDate aria-label="Check-out" />
</ngx-dt-date-range-input>
<ngx-dt-toggle [for]="picker" ariaLabel="Open calendar" />
<ngx-dt-picker #picker type="date-range" [monthsToDisplay]="2" [min]="today" />`;

export const MEETING_SNIPPET = `<mat-form-field>
  <mat-label>Meeting</mat-label>
  <input matInput [ngxDtDateTimeInput]="picker" [formControl]="meeting" />
  <ngx-dt-toggle matSuffix [for]="picker" />
</mat-form-field>
<ngx-dt-picker
  #picker
  type="datetime"
  [hourCycle]="12"
  [minuteStep]="15"
  [dateFilter]="weekdaysOnly"
  [timeFilter]="businessHours"
/>`;

export const MEETING_COMPONENT_SNIPPET = `// The picker passes the date part to dateFilter and the time part to timeFilter.
// Typing the parameters as \`unknown\` keeps the picker generic, so the same
// #picker ref also fits <ngx-dt-toggle [for]>.
protected readonly meeting = new FormControl<Temporal.PlainDateTime | null>(null);
protected readonly weekdaysOnly = (date: unknown) => (date as Temporal.PlainDate).dayOfWeek <= 5;
protected readonly businessHours = (time: unknown) => {
  const { hour } = time as Temporal.PlainTime;
  return hour >= 9 && hour < 17;
};`;

export const SHIFT_SNIPPET = `<ngx-dt-datetime-range-input [rangePicker]="picker" [formControl]="shift"
  ariaLabel="Shift">
  <input ngxDtStartDateTime aria-label="Shift start" />
  <input ngxDtEndDateTime aria-label="Shift end" />
</ngx-dt-datetime-range-input>
<ngx-dt-toggle [for]="picker" ariaLabel="Open shift picker" />
<ngx-dt-picker #picker type="datetime-range" [hourCycle]="24" [minuteStep]="30" />`;

export const DRAFT_SNIPPET = `<mat-form-field>
  <mat-label>Report date</mat-label>
  <input matInput [ngxDtInput]="picker" [formControl]="report" />
  <ngx-dt-toggle matSuffix [for]="picker" />
</mat-form-field>
<ngx-dt-picker #picker [draftMode]="true" />`;

export const FORMS_SNIPPET = `<!-- Reactive Forms -->
<input matInput [ngxDtInput]="picker" [formControl]="dateControl" />

<!-- Template-driven -->
<input matInput [ngxDtInput]="picker" [(ngModel)]="date" />

<!-- Signal Forms -->
<input matInput [ngxDtInput]="picker" [formField]="form.date" />`;
