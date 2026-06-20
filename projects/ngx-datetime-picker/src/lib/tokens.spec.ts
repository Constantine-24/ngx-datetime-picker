import { describe, expect, it } from 'vitest';
import { NGX_DT_DEFAULT_OPTIONS, NGX_DT_DEFAULT_OPTIONS_VALUE } from './tokens';

describe('NGX_DT_DEFAULT_OPTIONS', () => {
  it('exposes an injection token', () => {
    expect(NGX_DT_DEFAULT_OPTIONS.toString()).toContain('NGX_DT_DEFAULT_OPTIONS');
  });
  it('ships sensible defaults', () => {
    expect(NGX_DT_DEFAULT_OPTIONS_VALUE).toEqual({
      hasBackdrop: true,
      restoreFocus: true,
    });
  });
});
