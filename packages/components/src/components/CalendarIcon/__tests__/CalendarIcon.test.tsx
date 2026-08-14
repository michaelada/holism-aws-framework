import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CalendarIcon } from '../CalendarIcon';
import { CALENDAR_ICON_KEYS, CALENDAR_ICON_LABELS, isCalendarIconKey } from '../calendarIcons';

const testIdOf = (container: HTMLElement) =>
  container.querySelector('svg')?.getAttribute('data-testid');

describe('CalendarIcon', () => {
  it('renders the icon a calendar chose', () => {
    const { container } = render(<CalendarIcon name="tennis" />);

    expect(testIdOf(container)).toBe('SportsTennisIcon');
  });

  it('draws it in the calendar’s own colour', () => {
    const { container } = render(<CalendarIcon name="tennis" colour="#2e7d32" />);

    expect(container.querySelector('svg')).toHaveStyle({ color: '#2e7d32' });
  });

  it('falls back to the calendar mark when none was chosen', () => {
    // A card with a hole where its icon should be reads as a broken setup.
    const { container } = render(<CalendarIcon name={null} />);

    expect(testIdOf(container)).toBe('CalendarMonthIcon');
  });

  it('falls back when the stored icon is one this build no longer ships', () => {
    const { container } = render(<CalendarIcon name="removed-in-a-later-version" />);

    expect(testIdOf(container)).toBe('CalendarMonthIcon');
  });

  it('renders every key in the set, so the picker cannot offer a blank', () => {
    for (const key of CALENDAR_ICON_KEYS) {
      const { container } = render(<CalendarIcon name={key} />);
      expect(testIdOf(container)).toBeTruthy();
    }
  });
});

describe('calendar icon set', () => {
  it('labels every key', () => {
    for (const key of CALENDAR_ICON_KEYS) {
      expect(CALENDAR_ICON_LABELS[key]).toBeTruthy();
    }
  });

  it('recognises its own keys and nothing else', () => {
    expect(isCalendarIconKey('tennis')).toBe(true);
    expect(isCalendarIconKey('not-an-icon')).toBe(false);
    expect(isCalendarIconKey(null)).toBe(false);
    expect(isCalendarIconKey(42)).toBe(false);
  });
});
