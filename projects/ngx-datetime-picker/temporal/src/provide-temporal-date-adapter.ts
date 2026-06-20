import { Provider } from '@angular/core';
import {
  DateAdapter,
  MAT_DATE_FORMATS,
  MatDateFormats,
} from '@angular/material/core';
import { NGX_DT_TEMPORAL_DATE_FORMATS } from './temporal-date-formats';
import { TemporalDateAdapter } from './temporal-date-adapter';

export function provideTemporalDateAdapter(
  formats: MatDateFormats = NGX_DT_TEMPORAL_DATE_FORMATS,
): Provider[] {
  return [
    { provide: DateAdapter, useClass: TemporalDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: formats },
  ];
}
