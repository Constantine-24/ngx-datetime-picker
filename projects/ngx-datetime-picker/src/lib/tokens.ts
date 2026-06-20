import { InjectionToken } from '@angular/core';

/** Behaviour defaults for ngx-datetime-picker, overridable via DI. */
export interface NgxDtDefaultOptions {
  /** Whether the overlay renders a backdrop that dismisses on outside click. */
  hasBackdrop: boolean;
  /** Whether focus returns to the trigger element when the overlay closes. */
  restoreFocus: boolean;
}

export const NGX_DT_DEFAULT_OPTIONS_VALUE: NgxDtDefaultOptions = {
  hasBackdrop: true,
  restoreFocus: true,
};

export const NGX_DT_DEFAULT_OPTIONS = new InjectionToken<NgxDtDefaultOptions>(
  'NGX_DT_DEFAULT_OPTIONS',
  { providedIn: 'root', factory: () => NGX_DT_DEFAULT_OPTIONS_VALUE },
);
