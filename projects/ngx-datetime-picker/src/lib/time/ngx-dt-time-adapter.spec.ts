import { describe, expect, it } from 'vitest';
import { NgxDtTimeAdapter } from './ngx-dt-time-adapter';

// Minimal fake adapter: time = minutes since midnight (0..1439); -1 = invalid.
class FakeTimeAdapter extends NgxDtTimeAdapter<number> {
  now(): number {
    return 0;
  }
  getHour(t: number): number {
    return Math.floor(t / 60);
  }
  getMinute(t: number): number {
    return t % 60;
  }
  getSecond(): number {
    return 0;
  }
  createTime(hour: number, minute: number): number {
    return hour * 60 + minute;
  }
  compareTime(a: number, b: number): number {
    return a - b;
  }
  isValid(t: number): boolean {
    return t >= 0;
  }
  invalid(): number {
    return -1;
  }
  parse(value: unknown): number | null {
    return value == null || value === '' ? null : Number(value);
  }
  format(t: number): string {
    return String(t);
  }
}

describe('NgxDtTimeAdapter base helpers', () => {
  const a = new FakeTimeAdapter();

  it('sameTime treats two nulls as equal', () => {
    expect(a.sameTime(null, null)).toBe(true);
  });
  it('sameTime treats null vs value as different', () => {
    expect(a.sameTime(null, 60)).toBe(false);
    expect(a.sameTime(60, null)).toBe(false);
  });
  it('sameTime compares two valid times by value', () => {
    expect(a.sameTime(60, 60)).toBe(true);
    expect(a.sameTime(60, 61)).toBe(false);
  });
  it('sameTime treats two invalids as equal', () => {
    expect(a.sameTime(a.invalid(), a.invalid())).toBe(true);
  });
  it('clampTime pulls below-min up to min', () => {
    expect(a.clampTime(30, 60, null)).toBe(60);
  });
  it('clampTime pushes above-max down to max', () => {
    expect(a.clampTime(600, null, 120)).toBe(120);
  });
  it('clampTime leaves in-range values untouched', () => {
    expect(a.clampTime(90, 60, 120)).toBe(90);
  });
});
