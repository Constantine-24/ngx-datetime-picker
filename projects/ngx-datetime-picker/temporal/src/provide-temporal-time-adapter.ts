import { Provider } from '@angular/core';
import { NgxDtTimeAdapter } from '@constantine-24/ngx-datetime-picker';
import { TemporalTimeAdapter } from './temporal-time-adapter';

/** Provides the Temporal `PlainTime` time adapter for `type="time"` pickers. */
export function provideTemporalTimeAdapter(): Provider[] {
  return [{ provide: NgxDtTimeAdapter, useClass: TemporalTimeAdapter }];
}
