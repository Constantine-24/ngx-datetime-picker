/**
 * Bridge abstraction for a combined date+time value `DT` (e.g.
 * `Temporal.PlainDateTime`). The core picker is adapter-agnostic and cannot
 * know how to split a datetime into a calendar date `D` (for `MatCalendar`) and
 * a wall-clock time `T` (for `NgxDtTimePanel`) or how to recombine them — that
 * is exactly what this adapter supplies. Used as its own DI token (mirrors how
 * Material uses the `DateAdapter` abstract class as a token).
 */
export abstract class NgxDtDateTimeAdapter<DT, D = unknown, T = unknown> {
  /** The current wall-clock date+time. */
  abstract now(): DT;

  /** The calendar (date) part of a datetime. */
  abstract getDate(value: DT): D;
  /** The wall-clock (time) part of a datetime. */
  abstract getTime(value: DT): T;
  /** Compose a date part and a time part into a datetime. */
  abstract combine(date: D, time: T): DT;

  /** Negative if `a` < `b`, 0 if equal, positive if `a` > `b` (full datetime). */
  abstract compareDateTime(a: DT, b: DT): number;
  /** Compare the DATE parts only, ignoring time. */
  abstract compareDate(a: DT, b: DT): number;

  /** Whether `value` is a valid instance produced by this adapter. */
  abstract isValid(value: DT): boolean;
  /** A sentinel "invalid" value (mirrors `DateAdapter.invalid()`). */
  abstract invalid(): DT;

  /**
   * Parse user text into a datetime. Returns `null` for empty input and the
   * `invalid()` sentinel for non-empty, unparseable input (Material convention).
   */
  abstract parse(value: unknown): DT | null;

  /** Format a datetime for display. */
  abstract format(value: DT, options?: Intl.DateTimeFormatOptions): string;

  /** The time part representing the start of a day (00:00:00). */
  protected abstract startOfDayTime(): T;

  /**
   * Null-tolerant equality: two `null`s are equal; `null` and a value are not;
   * two invalids are equal. Mirrors `DateAdapter.sameDate`/`NgxDtTimeAdapter.sameTime`.
   */
  sameDateTime(a: DT | null, b: DT | null): boolean {
    if (a == null || b == null) {
      return a == b;
    }
    const aValid = this.isValid(a);
    const bValid = this.isValid(b);
    if (aValid && bValid) {
      return this.compareDateTime(a, b) === 0;
    }
    return aValid === bValid;
  }

  /** Whether two (valid) datetimes fall on the same calendar day. */
  sameDatePart(a: DT, b: DT): boolean {
    return this.compareDate(a, b) === 0;
  }

  /** Clamp `value` into the inclusive `[min, max]` window (nulls = unbounded). */
  clampDateTime(value: DT, min: DT | null, max: DT | null): DT {
    if (min && this.compareDateTime(value, min) < 0) {
      return min;
    }
    if (max && this.compareDateTime(value, max) > 0) {
      return max;
    }
    return value;
  }

  /**
   * Replace the date part of `value`, keeping its time part. When `value` is
   * null/invalid, the time defaults to the start of the day.
   */
  withDate(value: DT | null, date: D): DT {
    const time =
      value != null && this.isValid(value) ? this.getTime(value) : this.startOfDayTime();
    return this.combine(date, time);
  }

  /**
   * Replace the time part of `value`, keeping its date part. When `value` is
   * null/invalid, the date defaults to today.
   */
  withTime(value: DT | null, time: T): DT {
    const date =
      value != null && this.isValid(value) ? this.getDate(value) : this.getDate(this.now());
    return this.combine(date, time);
  }
}
