import { Component } from '@angular/core';

/**
 * An empty `MatCalendar` header. Passed via `[headerComponent]` to suppress the
 * calendar's built-in month/year label + navigation arrows in dual-calendar
 * mode, where a single shared header (rendered by the picker) drives both months.
 */
@Component({
  selector: 'ngx-dt-empty-calendar-header',
  template: '',
})
export class NgxDtEmptyCalendarHeader {}
