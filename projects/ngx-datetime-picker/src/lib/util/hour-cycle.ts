/**
 * Resolve the effective hour cycle for display. An explicit `12`/`24` wins;
 * `null` derives the cycle from the resolved locale (e.g. `en-US`→12, `en-GB`→24),
 * matching Material's locale-aware `MatTimepicker` behaviour.
 */
export function resolveHourCycle(explicit: 12 | 24 | null, locale: string): 12 | 24 {
  if (explicit === 12 || explicit === 24) {
    return explicit;
  }
  const hour12 =
    new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions().hour12 === true;
  return hour12 ? 12 : 24;
}
