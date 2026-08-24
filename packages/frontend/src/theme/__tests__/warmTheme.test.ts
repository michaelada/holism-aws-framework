import { describe, it, expect } from 'vitest';
import { warmTheme } from '../warmTheme';
import { warmTheme as viaBarrel, defaultTheme } from '../index';

/**
 * The theme's contrast contract, as an executable check.
 *
 * DESIGN.md's Measured Value Rule exists because a colour once shipped claiming
 * 4.6:1 while measuring 3.79:1 — a comment cannot be wrong loudly. This file
 * measures instead: every value the theme uses to carry text is computed against
 * the ground it is actually painted on, and fails if it drops below the
 * threshold for its size.
 *
 * It matters most *here*. This theme is one of three near-identical copies
 * (`orgadmin-shell` and `admin` carry the others), which is exactly the shape
 * that drifts: a correction made in one copy and forgotten in the others is
 * invisible until someone opens this app and cannot read a button.
 */

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const channel = parseInt(full.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Number(((light + 0.05) / (dark + 0.05)).toFixed(2));
}

const WHITE = '#ffffff';
const AA_NORMAL = 4.5;

describe('warmTheme — the contrast contract', () => {
  it('measures a known pair correctly, so the failures below mean something', () => {
    // Guard on the maths itself: black on white is 21:1, white on white is 1:1.
    expect(contrast('#000000', WHITE)).toBe(21);
    expect(contrast(WHITE, WHITE)).toBe(1);
  });

  it.each([
    ['primary'],
    ['secondary'],
    ['error'],
    ['warning'],
    ['success'],
    ['info'],
  ])('paints white text on %s at 4.5:1 or better', (name) => {
    const palette = warmTheme.palette as unknown as Record<string, { main: string }>;
    const main = palette[name].main;

    // Every one of these is used as a filled button or chip with white text.
    expect(contrast(main, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('keeps primary text legible on the page', () => {
    expect(contrast(warmTheme.palette.text.primary, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('keeps secondary text legible too — muted is not an excuse', () => {
    // The most commonly broken value in a warm palette: light enough to look
    // calm, too light to read.
    expect(contrast(warmTheme.palette.text.secondary, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('declares white as the contrast text wherever it says it does', () => {
    for (const name of ['primary', 'secondary'] as const) {
      const entry = warmTheme.palette[name] as { main: string; contrastText?: string };
      if (!entry.contrastText) continue;
      expect(contrast(entry.main, entry.contrastText)).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });
});

describe('warmTheme — the rules that survive six locales', () => {
  it('does not uppercase button labels', () => {
    // German and Portuguese are long already; uppercase costs width the layout
    // does not have and readability a hurried volunteer needs.
    expect(warmTheme.typography.button.textTransform).toBe('none');
  });

  it('uppercases nothing that carries a sentence', () => {
    const typography = warmTheme.typography as unknown as Record<
      string,
      { textTransform?: string } | undefined
    >;

    for (const role of ['body1', 'body2', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6']) {
      expect(typography[role]?.textTransform).not.toBe('uppercase');
    }
  });

  it('leaves body text to inherit rather than forcing it muted', () => {
    // A theme that colours `body1` overrides every heading and label that does
    // not set its own colour — which is how page titles end up grey.
    const body1 = warmTheme.typography.body1 as { color?: string };
    expect(body1.color).toBeUndefined();
  });
});

describe('warmTheme — what the app imports', () => {
  it('is the same object however it is reached', () => {
    // `defaultTheme` is an alias kept for callers that predate the rename;
    // two different themes behind two names would be a very quiet bug.
    expect(viaBarrel).toBe(warmTheme);
    expect(defaultTheme).toBe(warmTheme);
  });

  it('is a usable MUI theme, not a bare object', () => {
    expect(typeof warmTheme.spacing).toBe('function');
    expect(warmTheme.spacing(2)).toBe('16px');
    expect(warmTheme.shape.borderRadius).toBeGreaterThan(0);
    expect(warmTheme.palette.mode).toBe('light');
  });

  it('gives the page a light ground, so the palette it was measured against holds', () => {
    expect(contrast(warmTheme.palette.background.default, WHITE)).toBeLessThan(1.5);
  });
});
