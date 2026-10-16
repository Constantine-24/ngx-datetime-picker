import { Component, signal } from '@angular/core';
import { Temporal } from 'temporal-polyfill';
import { NgxDtPicker } from '@constantine-24/ngx-datetime-picker';
import { Examples } from './examples/examples';
import { Playground } from './playground/playground';
import { CodeBlock } from './shared/code-block';
import { ThemeToggle } from './shared/theme-toggle';

/** The demo page: hero, interactive playground, and real-world examples. */
@Component({
  selector: 'app-root',
  imports: [NgxDtPicker, CodeBlock, ThemeToggle, Playground, Examples],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly repositoryUrl = 'https://github.com/Constantine-24/ngx-datetime-picker';
  protected readonly npmUrl = 'https://www.npmjs.com/package/@constantine-24/ngx-datetime-picker';
  protected readonly installCommand =
    'npm install @constantine-24/ngx-datetime-picker temporal-polyfill';

  protected readonly features = [
    '5 variants',
    'Signal Forms',
    'Reactive Forms & ngModel',
    'Temporal-first',
    'WCAG 2.2 AA',
    'Keyboard-first',
    'RTL',
    'Material 3 theming',
  ];

  protected readonly heroValue = signal<Temporal.PlainDateTime | null>(
    Temporal.Now.plainDateTimeISO().round({ smallestUnit: 'hour', roundingMode: 'ceil' }),
  );
}
