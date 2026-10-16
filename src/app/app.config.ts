import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideTemporalDateTimeAdapter } from '@constantine-24/ngx-datetime-picker/temporal';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideAnimationsAsync(),
    // One call covers every variant: it composes the date and time adapters and the bridge.
    provideTemporalDateTimeAdapter(),
  ],
};
