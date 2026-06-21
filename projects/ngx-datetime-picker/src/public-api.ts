// Adapter-agnostic core entry point.
export { NGX_DT_DEFAULT_OPTIONS, NGX_DT_DEFAULT_OPTIONS_VALUE } from './lib/tokens';
export type { NgxDtDefaultOptions } from './lib/tokens';
export { NgxDtPicker } from './lib/picker/ngx-dt-picker';
export type { NgxDtPickerType, NgxDtOrigin } from './lib/picker/ngx-dt-picker';
export { NgxDtToggle } from './lib/toggle/ngx-dt-toggle';
export { NgxDtInput } from './lib/input/ngx-dt-input';
export type { NgxDtPickerInput } from './lib/picker/ngx-dt-picker';
export {
  NgxDtDateRangeInput,
  NgxDtStartDate,
  NgxDtEndDate,
} from './lib/range-input/ngx-dt-date-range-input';
export type { NgxDtPickerRangeInput } from './lib/picker/ngx-dt-picker';
// Re-exported for convenience so consumers can type range values without
// importing from `@angular/material/datepicker` directly.
export { DateRange } from '@angular/material/datepicker';
export { NgxDtTimeAdapter } from './lib/time/ngx-dt-time-adapter';
export { NgxDtTimePanel } from './lib/time-panel/ngx-dt-time-panel';
export { NgxDtTimeInput } from './lib/time-input/ngx-dt-time-input';
export { NgxDtDateTimeAdapter } from './lib/datetime/ngx-dt-datetime-adapter';
