import { describe, expect, it } from 'vitest';
import { buildSnippet, DEFAULT_PLAYGROUND_CONFIG, PlaygroundConfig } from './snippet';

const config = (overrides: Partial<PlaygroundConfig>): PlaygroundConfig => ({
  ...DEFAULT_PLAYGROUND_CONFIG,
  inline: false,
  ...overrides,
});

describe('buildSnippet', () => {
  it('uses the provider that matches the variant', () => {
    expect(buildSnippet(config({ type: 'date' })).config).toContain('provideTemporalDateAdapter()');
    expect(buildSnippet(config({ type: 'date-range' })).config).toContain(
      'provideTemporalDateAdapter()',
    );
    expect(buildSnippet(config({ type: 'time' })).config).toContain('provideTemporalTimeAdapter()');
    expect(buildSnippet(config({ type: 'datetime-range' })).config).toContain(
      'provideTemporalDateTimeAdapter()',
    );
  });

  it('renders a popup date field with the matching input directive and no type attribute', () => {
    const { template } = buildSnippet(config({ type: 'date' }));
    expect(template).toContain('<input matInput [ngxDtInput]="picker"');
    expect(template).toContain('<ngx-dt-toggle matSuffix [for]="picker"');
    expect(template).toContain('<ngx-dt-picker #picker />');
    expect(template).not.toContain('type=');
  });

  it('renders a range container with start and end parts for range variants', () => {
    const { template } = buildSnippet(config({ type: 'datetime-range' }));
    expect(template).toContain('<ngx-dt-datetime-range-input [rangePicker]="picker"');
    expect(template).toContain('<input ngxDtStartDateTime');
    expect(template).toContain('<input ngxDtEndDateTime');
    expect(template).toContain('type="datetime-range"');
  });

  it('renders an inline picker bound with the right two-way model', () => {
    expect(buildSnippet(config({ type: 'time', inline: true })).template).toContain(
      '[(value)]="value"',
    );
    expect(buildSnippet(config({ type: 'date-range', inline: true })).template).toContain(
      '[(range)]="range"',
    );
  });

  it('includes only the options that apply to the variant', () => {
    const allOn = {
      hourCycle: 12,
      minuteStep: 15,
      showSeconds: true,
      monthsToDisplay: 2,
      draftMode: true,
      weekdaysOnly: true,
    } as const;

    const date = buildSnippet(config({ type: 'date', ...allOn })).template;
    expect(date).toContain('[dateFilter]="weekdaysOnly"');
    expect(date).toContain('[draftMode]="true"');
    expect(date).not.toContain('hourCycle');
    expect(date).not.toContain('monthsToDisplay');

    const time = buildSnippet(config({ type: 'time', ...allOn })).template;
    expect(time).toContain('[hourCycle]="12"');
    expect(time).toContain('[minuteStep]="15"');
    expect(time).toContain('[showSeconds]="true"');
    expect(time).not.toContain('dateFilter');

    const range = buildSnippet(config({ type: 'datetime-range', ...allOn })).template;
    expect(range).toContain('[monthsToDisplay]="2"');
    expect(range).toContain('[hourCycle]="12"');
  });

  it('omits options left at their defaults', () => {
    const { template } = buildSnippet(config({ type: 'datetime' }));
    expect(template).toContain('<ngx-dt-picker #picker type="datetime" />');
  });

  it('drops draft mode for inline pickers, which commit immediately', () => {
    const { template } = buildSnippet(config({ type: 'date', inline: true, draftMode: true }));
    expect(template).not.toContain('draftMode');
  });

  it('declares the Signal Forms model a popup template binds to', () => {
    const single = buildSnippet(config({ type: 'time' }));
    expect(single.template).toContain('[formField]="pickerForm.selected"');
    expect(single.component).toContain(
      'pickerForm = form(signal<{ selected: Temporal.PlainTime | null }>({ selected: null }))',
    );

    const range = buildSnippet(config({ type: 'datetime-range' }));
    expect(range.template).toContain('[formField]="pickerForm.period"');
    expect(range.component).toContain(
      'signal<{ period: DateRange<Temporal.PlainDateTime> | null }>({ period: null })',
    );
  });

  it('declares the signal an inline template binds to', () => {
    expect(buildSnippet(config({ type: 'datetime', inline: true })).component).toContain(
      'value = signal<Temporal.PlainDateTime | null>(null)',
    );
    expect(buildSnippet(config({ type: 'date-range', inline: true })).component).toContain(
      'range = signal<DateRange<Temporal.PlainDate> | null>(null)',
    );
  });

  it('types the date filter parameter as unknown so the picker stays NgxDtPicker<unknown>', () => {
    const { component } = buildSnippet(config({ type: 'datetime', weekdaysOnly: true }));
    expect(component).toContain(
      'weekdaysOnly = (date: unknown) => (date as Temporal.PlainDate).dayOfWeek <= 5',
    );
    expect(buildSnippet(config({ type: 'date' })).component).not.toContain('weekdaysOnly');
  });
});
