import { resolveHourCycle } from './hour-cycle';

describe('resolveHourCycle', () => {
  it('returns the explicit cycle when set', () => {
    expect(resolveHourCycle(12, 'en-GB')).toBe(12);
    expect(resolveHourCycle(24, 'en-US')).toBe(24);
  });

  it('derives 12h for an en-US locale when explicit is null', () => {
    expect(resolveHourCycle(null, 'en-US')).toBe(12);
  });

  it('derives 24h for an en-GB locale when explicit is null', () => {
    expect(resolveHourCycle(null, 'en-GB')).toBe(24);
  });
});
