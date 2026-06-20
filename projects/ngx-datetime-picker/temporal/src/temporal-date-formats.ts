import { MatDateFormats } from '@angular/material/core';

export const NGX_DT_TEMPORAL_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: null, // parse() ignores the format (ISO + locale-numeric strategy)
  },
  display: {
    dateInput: { year: 'numeric', month: 'numeric', day: 'numeric' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
  },
};
