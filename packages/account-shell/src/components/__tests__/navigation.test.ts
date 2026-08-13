import { describe, it, expect } from 'vitest';
import { NAV_SECTIONS, visibleSections } from '../navigation';

/**
 * The capability gate, tested without rendering.
 *
 * This is the rule that decides what a member can see, and it is the part that
 * breaks silently when a capability is renamed — a mistyped name simply hides a
 * feature rather than throwing.
 */
const gate = (enabled: string[]) => (capability: string) => enabled.includes(capability);

describe('visibleSections', () => {
  it('shows only the areas an organisation has enabled', () => {
    const sections = visibleSections(gate(['memberships']));
    const labels = sections.flatMap((s) => s.items.map((i) => i.labelKey));

    expect(labels).toContain('memberships');
    /*
     * Events and memberships are now separate destinations, so a
     * memberships-only club gets the memberships catalogue and **not** an
     * events one — the whole point of splitting them.
     */
    expect(labels).toContain('browseMemberships');
    expect(labels).not.toContain('browseEvents');
    expect(labels).not.toContain('merchandise');
  });

  it('keeps the ungated items whatever the organisation has enabled', () => {
    const labels = visibleSections(gate([])).flatMap((s) => s.items.map((i) => i.labelKey));

    // Home, payments and profile are not capability-gated — a member always has
    // somewhere to land and a way to reach their own details.
    expect(labels).toEqual(expect.arrayContaining(['home', 'payments', 'profile']));
  });

  it('drops a section entirely once every item in it is gated out', () => {
    const sections = visibleSections(gate([]));
    const titles = sections.map((s) => s.titleKey);

    // "My activity" and "Browse" contain only gated items, so a club with no
    // capabilities must not show two empty headings.
    expect(titles).not.toContain('myActivity');
    expect(titles).not.toContain('browse');
  });

  it('shows an item when any one of its capabilities is enabled', () => {
    // "My entries & bookings" covers two separate features and is worth showing
    // if the member can have either.
    const withEvents = visibleSections(gate(['event-management']))
      .flatMap((s) => s.items.map((i) => i.labelKey));
    expect(withEvents).toContain('browseEvents');
    expect(withEvents).not.toContain('browseMemberships');
    const withBookings = visibleSections(gate(['calendar-bookings']))
      .flatMap((s) => s.items.map((i) => i.labelKey));

    expect(withEvents).toContain('entries');
    expect(withBookings).toContain('entries');
  });

  it('shows every area to an organisation with everything enabled', () => {
    const all = NAV_SECTIONS.flatMap((s) => s.items.flatMap((i) => i.capabilities));
    const labels = visibleSections(gate(all)).flatMap((s) => s.items.map((i) => i.labelKey));

    expect(labels).toHaveLength(NAV_SECTIONS.flatMap((s) => s.items).length);
  });

  it('never produces a section with no items', () => {
    for (const enabled of [[], ['memberships'], ['merchandise'], ['registrations']]) {
      for (const section of visibleSections(gate(enabled))) {
        expect(section.items.length).toBeGreaterThan(0);
      }
    }
  });
});

/**
 * Every item needs an icon: a menu where one row has none is read as a
 * rendering fault rather than a design choice, and the gap is exactly as wide
 * as the icons beside it.
 */
describe('nav icons', () => {
  it('gives every item an icon', () => {
    const missing = NAV_SECTIONS.flatMap((section) =>
      section.items.filter((item) => !item.icon).map((item) => item.labelKey)
    );

    expect(missing).toEqual([]);
  });
});
