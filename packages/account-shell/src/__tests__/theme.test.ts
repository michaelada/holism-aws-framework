import { describe, it, expect } from 'vitest';
import { buildTheme, isValidHexColour, DEFAULT_PRIMARY } from '../theme';

describe('buildTheme', () => {
  it("uses the club's own colour", () => {
    expect(buildTheme('#2e7d32').palette.primary.main).toBe('#2e7d32');
  });

  it('falls back when a club has no branding', () => {
    expect(buildTheme(null).palette.primary.main).toBe(DEFAULT_PRIMARY);
    expect(buildTheme(undefined).palette.primary.main).toBe(DEFAULT_PRIMARY);
  });

  it('falls back rather than throwing on a malformed colour', () => {
    // A club with a bad branding value should look wrong, not be unreachable —
    // createTheme throws on an unparseable colour, which would blank the app.
    for (const bad of ['not-a-colour', '#12', 'rgb(1,2,3)', '#1234567']) {
      expect(buildTheme(bad).palette.primary.main).toBe(DEFAULT_PRIMARY);
    }
  });

  it('accepts both three- and six-digit hex', () => {
    expect(isValidHexColour('#abc')).toBe(true);
    expect(isValidHexColour('#AABBCC')).toBe(true);
    expect(isValidHexColour('#abcd')).toBe(false);
  });
});
