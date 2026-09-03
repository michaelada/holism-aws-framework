/**
 * Cards do not move under the pointer.
 *
 * They used to rise 4px on hover, which reads as the page shifting beneath the
 * mouse — distracting on a dense list, where crossing a grid of cards sets each
 * one moving in turn, and worse for anyone tracking the pointer against what is
 * under it. The shadow still lifts, which says "this responds" without
 * displacing anything.
 *
 * Pinned here because the lift was written in five places — the theme and four
 * dashboard cards that each set it again in `sx` — so removing it from the
 * theme alone left every card on the dashboard still rising.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { warmTheme } from '../warmTheme';

const COMPONENTS = join(__dirname, '..', '..', 'components');

const hoverOf = (component: 'MuiCard' | 'MuiPaper') => {
  const root = (warmTheme.components?.[component]?.styleOverrides as any)?.root ?? {};
  return root['&:hover'] ?? {};
};

describe('warmTheme card hover', () => {
  it('lifts the shadow', () => {
    // The affordance is kept; only the movement goes.
    expect(hoverOf('MuiCard').boxShadow).toBeTruthy();
  });

  it('does not move the card', () => {
    expect(hoverOf('MuiCard').transform).toBeUndefined();
  });

  it('transitions the shadow rather than everything', () => {
    /*
     * `all` animates whatever a page happens to change on hover — a width, a
     * position — which is how a card that no longer sets `transform` could
     * still appear to drift.
     */
    const root = (warmTheme.components?.MuiCard?.styleOverrides as any)?.root ?? {};
    expect(root.transition).toContain('box-shadow');
    expect(root.transition).not.toContain('all ');
  });
});

describe('the dashboard cards', () => {
  const cards = readdirSync(COMPONENTS).filter((file) => /^DashboardCard.*\.tsx$/.test(file));

  it('are all covered by this check', () => {
    // A guard on the guard: four today, and a fifth must not slip past.
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });

  it.each(cards)('%s does not rise on hover', (file) => {
    expect(readFileSync(join(COMPONENTS, file), 'utf-8')).not.toContain('translateY(-');
  });
});
