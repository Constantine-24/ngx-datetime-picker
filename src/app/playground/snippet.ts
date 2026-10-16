import type { NgxDtPickerType } from '@constantine-24/ngx-datetime-picker';

/** Everything the playground lets a visitor configure. */
export interface PlaygroundConfig {
  readonly type: NgxDtPickerType;
  readonly inline: boolean;
  readonly hourCycle: 12 | 24 | null;
  readonly minuteStep: number;
  readonly showSeconds: boolean;
  readonly monthsToDisplay: 1 | 2;
  readonly draftMode: boolean;
  readonly weekdaysOnly: boolean;
}

export const DEFAULT_PLAYGROUND_CONFIG: PlaygroundConfig = {
  type: 'date',
  inline: true,
  hourCycle: null,
  minuteStep: 1,
  showSeconds: false,
  monthsToDisplay: 1,
  draftMode: false,
  weekdaysOnly: false,
};

/** The copy-pasteable code shown next to the live playground picker. */
export interface PlaygroundSnippet {
  readonly config: string;
  readonly template: string;
}

export const hasTime = (type: NgxDtPickerType): boolean =>
  type === 'time' || type === 'datetime' || type === 'datetime-range';

export const hasDate = (type: NgxDtPickerType): boolean => type !== 'time';

export const isRange = (type: NgxDtPickerType): boolean =>
  type === 'date-range' || type === 'datetime-range';

const PROVIDERS: Record<NgxDtPickerType, string> = {
  date: 'provideTemporalDateAdapter',
  'date-range': 'provideTemporalDateAdapter',
  time: 'provideTemporalTimeAdapter',
  datetime: 'provideTemporalDateTimeAdapter',
  'datetime-range': 'provideTemporalDateTimeAdapter',
};

/** Builds the provider setup and template that reproduce `config`. */
export function buildSnippet(config: PlaygroundConfig): PlaygroundSnippet {
  const provider = PROVIDERS[config.type];
  return {
    config: [
      `import { ${provider} } from '@constantine-24/ngx-datetime-picker/temporal';`,
      '',
      `providers: [${provider}()]`,
    ].join('\n'),
    template: config.inline ? inlineTemplate(config) : popupTemplate(config),
  };
}

function pickerAttributes(config: PlaygroundConfig): string[] {
  const { type } = config;
  const attributes: string[] = [];
  if (type !== 'date') attributes.push(`type="${type}"`);
  if (hasTime(type) && config.hourCycle !== null) {
    attributes.push(`[hourCycle]="${config.hourCycle}"`);
  }
  if (hasTime(type) && config.minuteStep !== 1) {
    attributes.push(`[minuteStep]="${config.minuteStep}"`);
  }
  if (hasTime(type) && config.showSeconds) attributes.push('[showSeconds]="true"');
  if (isRange(type) && config.monthsToDisplay === 2) attributes.push('[monthsToDisplay]="2"');
  if (hasDate(type) && config.weekdaysOnly) attributes.push('[dateFilter]="weekdaysOnly"');
  if (!config.inline && config.draftMode) attributes.push('[draftMode]="true"');
  return attributes;
}

function pickerElement(leading: string[], config: PlaygroundConfig): string {
  const attributes = [...leading, ...pickerAttributes(config)];
  const singleLine = `<ngx-dt-picker ${attributes.join(' ')} />`;
  if (singleLine.length <= 80) return singleLine;
  return ['<ngx-dt-picker', ...attributes.map((attribute) => `  ${attribute}`), '/>'].join('\n');
}

function inlineTemplate(config: PlaygroundConfig): string {
  const model = isRange(config.type) ? '[(range)]="range"' : '[(value)]="value"';
  return pickerElement(['[inline]="true"', model], config);
}

const SINGLE_INPUTS: Record<'date' | 'time' | 'datetime', { directive: string; label: string }> = {
  date: { directive: 'ngxDtInput', label: 'Date' },
  time: { directive: 'ngxDtTimeInput', label: 'Time' },
  datetime: { directive: 'ngxDtDateTimeInput', label: 'Date & time' },
};

function popupTemplate(config: PlaygroundConfig): string {
  const picker = pickerElement(['#picker'], config);
  const { type } = config;

  if (type === 'date-range' || type === 'datetime-range') {
    const [container, start, end] =
      type === 'date-range'
        ? ['ngx-dt-date-range-input', 'ngxDtStartDate', 'ngxDtEndDate']
        : ['ngx-dt-datetime-range-input', 'ngxDtStartDateTime', 'ngxDtEndDateTime'];
    return [
      `<${container} [rangePicker]="picker" [formField]="form.period" ariaLabel="Period">`,
      `  <input ${start} aria-label="Start" />`,
      `  <input ${end} aria-label="End" />`,
      `</${container}>`,
      '<ngx-dt-toggle [for]="picker" ariaLabel="Open picker" />',
      picker,
    ].join('\n');
  }

  const { directive, label } = SINGLE_INPUTS[type];
  return [
    '<mat-form-field>',
    `  <mat-label>${label}</mat-label>`,
    `  <input matInput [${directive}]="picker" [formField]="form.selected" />`,
    '  <ngx-dt-toggle matSuffix [for]="picker" />',
    '</mat-form-field>',
    picker,
  ].join('\n');
}
