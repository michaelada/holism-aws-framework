import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import TimeSlotConfigurationSection from '../TimeSlotConfigurationSection';
import type { TimeSlotConfigurationFormData } from '../../types/calendar.types';

/**
 * Where a club decides what is bookable, when, and for how long.
 *
 * Everything the slot calculator later works from is entered here, so the
 * defaults matter as much as the edits: a configuration created without a
 * `startTime` or with `placesAvailable` at zero generates no slots at all, and
 * the club sees an empty calendar with nothing on screen explaining why.
 *
 * A duration option is the other half — it is both the length a member books
 * *and* the price they pay, so the two travel together and an option edited in
 * one configuration must not leak into another.
 */

const duration = (over: Record<string, unknown> = {}) => ({
  duration: 60,
  price: 20,
  label: 'One hour',
  ...over,
});

const configuration = (
  over: Partial<TimeSlotConfigurationFormData> = {}
): TimeSlotConfigurationFormData =>
  ({
    daysOfWeek: [1, 3],
    startTime: '09:00',
    effectiveDateStart: new Date('2026-04-01'),
    recurrenceWeeks: 1,
    placesAvailable: 2,
    durationOptions: [duration()],
    ...over,
  }) as TimeSlotConfigurationFormData;

let onChange: ReturnType<typeof vi.fn>;

const renderSection = (configs: TimeSlotConfigurationFormData[] = []) => {
  onChange = vi.fn();
  return render(
    <TimeSlotConfigurationSection configurations={configs} onChange={onChange} />
  );
};

const reported = (): TimeSlotConfigurationFormData[] => onChange.mock.calls.at(-1)![0];

const addButton = () =>
  screen.getAllByRole('button').find((b) => /add configuration|add slot|add/i.test(b.textContent ?? ''))!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TimeSlotConfigurationSection — adding and removing', () => {
  it('creates a configuration that would generate slots the moment it is saved', () => {
    renderSection();

    fireEvent.click(addButton());

    const config = reported()[0];
    // Each of these is read by `generateSlotsFromConfiguration`; a missing one
    // produces a calendar with nothing on it and no explanation.
    expect(config.startTime).toBe('09:00');
    expect(config.recurrenceWeeks).toBe(1);
    expect(config.placesAvailable).toBeGreaterThan(0);
    expect(config.effectiveDateStart).toBeInstanceOf(Date);
    expect(config.durationOptions).toEqual([]);
  });

  it('keeps the configurations already there when another is added', () => {
    renderSection([configuration({ startTime: '08:00' })]);

    fireEvent.click(addButton());

    expect(reported()).toHaveLength(2);
    expect(reported()[0].startTime).toBe('08:00');
  });

  it('removes the configuration that was chosen, not the last one', () => {
    renderSection([
      configuration({ startTime: '08:00' }),
      configuration({ startTime: '18:00' }),
    ]);

    const deleteButtons = screen
      .getAllByRole('button')
      .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
    fireEvent.click(deleteButtons[0]);

    expect(reported()).toHaveLength(1);
    expect(reported()[0].startTime).toBe('18:00');
  });
});

describe('TimeSlotConfigurationSection — the days it runs on', () => {
  it('adds a day that was not selected', () => {
    renderSection([configuration({ daysOfWeek: [1] })]);

    // Indexed as `Date#getDay` counts: Sunday is 0, so Friday is 5.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Fri' }));

    expect(reported()[0].daysOfWeek).toContain(5);
    expect(reported()[0].daysOfWeek).toContain(1);
  });

  it('removes a day that was already selected', () => {
    renderSection([configuration({ daysOfWeek: [1, 3] })]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mon' }));

    expect(reported()[0].daysOfWeek).toEqual([3]);
  });

  it('copes with a configuration that names no days yet', () => {
    renderSection([configuration({ daysOfWeek: [] })]);

    fireEvent.click(screen.getByRole('checkbox', { name: 'Sun' }));

    expect(reported()[0].daysOfWeek).toEqual([0]);
  });
});

describe('TimeSlotConfigurationSection — capacity and timing', () => {
  it('changes the start time of the configuration being edited', () => {
    renderSection([configuration()]);

    const timeInputs = document.querySelectorAll('input[type="time"]');
    fireEvent.change(timeInputs[0], { target: { value: '07:30' } });

    expect(reported()[0].startTime).toBe('07:30');
  });

  it('changes how many places a slot has', () => {
    renderSection([configuration({ placesAvailable: 2 })]);

    const numberInputs = Array.from(
      document.querySelectorAll('input[type="number"]')
    ) as HTMLInputElement[];
    const places = numberInputs.find((i) => i.value === '2')!;
    fireEvent.change(places, { target: { value: '6' } });

    expect(onChange).toHaveBeenCalled();
  });

  it('edits one configuration without disturbing the other', () => {
    renderSection([
      configuration({ startTime: '08:00' }),
      configuration({ startTime: '18:00' }),
    ]);

    const timeInputs = document.querySelectorAll('input[type="time"]');
    fireEvent.change(timeInputs[0], { target: { value: '07:00' } });

    expect(reported()[0].startTime).toBe('07:00');
    expect(reported()[1].startTime).toBe('18:00');
  });
});

describe('TimeSlotConfigurationSection — the durations a member can book', () => {
  it('adds an hour at no charge, as a starting point to edit', () => {
    renderSection([configuration({ durationOptions: [] })]);

    const addOption = screen
      .getAllByRole('button')
      .find((b) => /duration|option/i.test(b.textContent ?? ''))!;
    fireEvent.click(addOption);

    expect(reported()[0].durationOptions).toHaveLength(1);
    expect(reported()[0].durationOptions[0].duration).toBe(60);
    expect(reported()[0].durationOptions[0].price).toBe(0);
  });

  it('removes the duration option that was chosen', () => {
    renderSection([
      configuration({
        durationOptions: [duration({ label: 'Half hour' }), duration({ label: 'One hour' })],
      }),
    ]);

    const deleteButtons = screen
      .getAllByRole('button')
      .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
    // The last delete buttons belong to the duration rows, not the configuration.
    fireEvent.click(deleteButtons[deleteButtons.length - 2]);

    expect(reported()[0].durationOptions).toHaveLength(1);
  });

  it('changes an option’s label without touching its price', () => {
    renderSection([configuration({ durationOptions: [duration({ label: 'One hour' })] })]);

    fireEvent.change(screen.getByDisplayValue('One hour'), { target: { value: 'Full hour' } });

    expect(reported()[0].durationOptions[0].label).toBe('Full hour');
    expect(reported()[0].durationOptions[0].price).toBe(20);
  });

  it('keeps each configuration’s durations to itself', () => {
    renderSection([
      configuration({ durationOptions: [duration({ label: 'Morning hour' })] }),
      configuration({ durationOptions: [duration({ label: 'Evening hour' })] }),
    ]);

    fireEvent.change(screen.getByDisplayValue('Morning hour'), {
      target: { value: 'Early hour' },
    });

    expect(reported()[0].durationOptions[0].label).toBe('Early hour');
    expect(reported()[1].durationOptions[0].label).toBe('Evening hour');
  });
});

describe('TimeSlotConfigurationSection — with nothing configured', () => {
  it('still offers a way to add the first configuration', () => {
    renderSection([]);

    expect(addButton()).toBeInTheDocument();
  });

  it('reports nothing until something is done', () => {
    renderSection([]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
