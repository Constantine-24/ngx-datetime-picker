/**
 * Minimal, calendar-free abstraction over a wall-clock time value `T`.
 *
 * Material's `DateAdapter<D>` is calendar-shaped (year/month/day); a pure time
 * value such as `Temporal.PlainTime` answers none of those. This adapter
 * exposes only the operations the time panel and time input need, so an
 * implementation maps cleanly onto a time-only type. Used as its own DI token
 * (mirrors how Material uses the `DateAdapter` abstract class as a token).
 */
export abstract class NgxDtTimeAdapter<T> {
  /** The current wall-clock time. */
  abstract now(): T;

  /** Hour of day, 0–23. */
  abstract getHour(time: T): number;
  /** Minute of hour, 0–59. */
  abstract getMinute(time: T): number;
  /** Second of minute, 0–59. */
  abstract getSecond(time: T): number;

  /**
   * Build a time from in-range components. Callers in this library always pass
   * normalized (0–23 / 0–59) values.
   */
  abstract createTime(hour: number, minute: number, second: number): T;

  /** Negative if `a` < `b`, 0 if equal, positive if `a` > `b`. */
  abstract compareTime(a: T, b: T): number;

  /** Whether `time` is a valid instance produced by this adapter. */
  abstract isValid(time: T): boolean;
  /** A sentinel "invalid" value (mirrors `DateAdapter.invalid()`). */
  abstract invalid(): T;

  /**
   * Parse user text into a time. Returns `null` for empty input and the
   * `invalid()` sentinel for non-empty, unparseable input (Material convention).
   */
  abstract parse(value: unknown): T | null;

  /** Format a time for display/announcement. */
  abstract format(time: T, options?: Intl.DateTimeFormatOptions): string;

  /**
   * Null-tolerant equality: two `null`s are equal; `null` and a value are not;
   * two invalids are equal. Mirrors `DateAdapter.sameDate`.
   */
  sameTime(a: T | null, b: T | null): boolean {
    if (a == null || b == null) {
      return a == b;
    }
    const aValid = this.isValid(a);
    const bValid = this.isValid(b);
    if (aValid && bValid) {
      return this.compareTime(a, b) === 0;
    }
    return aValid === bValid;
  }

  /** Clamp `time` into the inclusive `[min, max]` window (nulls = unbounded). */
  clampTime(time: T, min: T | null, max: T | null): T {
    if (min && this.compareTime(time, min) < 0) {
      return min;
    }
    if (max && this.compareTime(time, max) > 0) {
      return max;
    }
    return time;
  }
}
