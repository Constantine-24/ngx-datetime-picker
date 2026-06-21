import { Provider } from '@angular/core';
import { NgxDtDateTimeAdapter } from 'ngx-datetime-picker';
import { provideTemporalDateAdapter } from './provide-temporal-date-adapter';
import { provideTemporalTimeAdapter } from './provide-temporal-time-adapter';
import { TemporalDateTimeAdapter } from './temporal-datetime-adapter';

/**
 * Wires everything a `type="datetime"` picker needs: the Temporal `PlainDate`
 * `DateAdapter` (for the calendar), the Temporal `PlainTime` `NgxDtTimeAdapter`
 * (for the time panel), and the `PlainDateTime` bridge adapter. One call sets up
 * a datetime-capable app; it also covers date/date-range/time pickers.
 */
export function provideTemporalDateTimeAdapter(): Provider[] {
  return [
    ...provideTemporalDateAdapter(),
    ...provideTemporalTimeAdapter(),
    { provide: NgxDtDateTimeAdapter, useClass: TemporalDateTimeAdapter },
  ];
}
