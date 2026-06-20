import { describe, expect, it } from 'vitest';
import { Temporal } from 'temporal-polyfill';
import { TemporalTimeAdapter } from './temporal-time-adapter';

function adapter(): TemporalTimeAdapter {
  // No DI: MAT_DATE_LOCALE is optional, defaults to 'en-US'.
  return new TemporalTimeAdapter();
}

describe('TemporalTimeAdapter', () => {
  it('reads hour/minute/second components', () => {
    const a = adapter();
    const t = Temporal.PlainTime.from('14:30:45');
    expect(a.getHour(t)).toBe(14);
    expect(a.getMinute(t)).toBe(30);
    expect(a.getSecond(t)).toBe(45);
  });

  it('createTime builds a PlainTime', () => {
    const a = adapter();
    const t = a.createTime(9, 5, 0);
    expect(t).toBeInstanceOf(Temporal.PlainTime);
    expect(t.hour).toBe(9);
    expect(t.minute).toBe(5);
  });

  it('compareTime orders times', () => {
    const a = adapter();
    const early = Temporal.PlainTime.from('08:00');
    const late = Temporal.PlainTime.from('20:00');
    expect(a.compareTime(early, late)).toBeLessThan(0);
    expect(a.compareTime(late, early)).toBeGreaterThan(0);
    expect(a.compareTime(early, early)).toBe(0);
  });

  it('parses ISO times', () => {
    const a = adapter();
    expect(a.parse('14:30')).toBeInstanceOf(Temporal.PlainTime);
    expect((a.parse('14:30') as Temporal.PlainTime).hour).toBe(14);
  });

  it('parses locale 12-hour times', () => {
    const a = adapter();
    const pm = a.parse('2:30 PM') as Temporal.PlainTime;
    expect(pm.hour).toBe(14);
    expect(pm.minute).toBe(30);
    const am = a.parse('12:15 AM') as Temporal.PlainTime;
    expect(am.hour).toBe(0);
    expect(am.minute).toBe(15);
  });

  it('returns null for empty and invalid() for garbage', () => {
    const a = adapter();
    expect(a.parse('')).toBeNull();
    expect(a.parse(null)).toBeNull();
    expect(a.isValid(a.parse('nope') as Temporal.PlainTime)).toBe(false);
  });

  it('formats with default hour/minute options', () => {
    const a = adapter();
    const out = a.format(Temporal.PlainTime.from('09:05'));
    expect(out).toContain('09');
    expect(out).toContain('05');
  });

  it('now() returns a PlainTime', () => {
    expect(adapter().now()).toBeInstanceOf(Temporal.PlainTime);
  });

  it('sameTime/clampTime work on real values', () => {
    const a = adapter();
    const t = Temporal.PlainTime.from('10:00');
    const min = Temporal.PlainTime.from('11:00');
    expect(a.sameTime(t, Temporal.PlainTime.from('10:00'))).toBe(true);
    expect(a.compareTime(a.clampTime(t, min, null), min)).toBe(0);
  });
});
