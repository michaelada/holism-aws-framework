import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import ScheduleRulesSection from '../ScheduleRulesSection';

/**
 * The dated rules that open and close a facility for a season.
 *
 * Each rule collapses to a one-line summary, so the summary *is* the interface
 * for a club scanning a dozen of them — a rule that reads "Open" while holding
 * `close` is worse than no summary. The accordion state is the other half: it
 * has to follow the list when rules are added and removed, or a club edits a
 * panel belonging to a rule it just deleted.
 */

type ScheduleRule = {
  startDate: Date;
  endDate?: Date;
  action: 'open' | 'close';
  timeOfDay?: string;
  reason?: string;
};

const rule = (over: Partial<ScheduleRule> = {}): ScheduleRule => ({
  startDate: new Date('2026-04-01'),
  action: 'open',
  ...over,
});

let onChange: ReturnType<typeof vi.fn>;

const renderSection = (rules: ScheduleRule[] = []) => {
  onChange = vi.fn();
  return render(<ScheduleRulesSection rules={rules} onChange={onChange} />);
};

const reported = (): ScheduleRule[] => onChange.mock.calls.at(-1)![0];

/**
 * The collapsed one-line summaries, in order.
 *
 * Scoped to the summary rows rather than the whole component: MUI keeps an
 * accordion's details mounted while collapsed, so the action Select renders its
 * value too — and a bare `getByText(/Close/)` matches both the summary and the
 * hidden dropdown.
 */
const summaries = () =>
  Array.from(document.querySelectorAll('.MuiAccordionSummary-content')).map(
    (el) => el.textContent?.trim() ?? ''
  );

/** The clickable header of the nth rule. */
const summaryButton = (index = 0) =>
  document.querySelectorAll('.MuiAccordionSummary-root')[index] as HTMLElement;

/** The delete control that sits inside the nth rule's header. */
const deleteButton = (index = 0) =>
  within(summaryButton(index))
    .getAllByRole('button')
    .find((b) => b.querySelector('[data-testid="DeleteIcon"]'))!;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ScheduleRulesSection — adding and removing', () => {
  it('adds a rule that opens, since that is the common case', () => {
    renderSection();

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(reported()).toHaveLength(1);
    expect(reported()[0].action).toBe('open');
    expect(reported()[0].startDate).toBeInstanceOf(Date);
  });

  it('keeps the rules already there when another is added', () => {
    renderSection([rule({ reason: 'Season opens' })]);

    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(reported()).toHaveLength(2);
    expect(reported()[0].reason).toBe('Season opens');
  });

  it('removes the rule that was chosen, not the last one', () => {
    renderSection([
      rule({ reason: 'Season opens' }),
      rule({ reason: 'Winter closure', action: 'close' }),
    ]);

    fireEvent.click(deleteButton(0));

    expect(reported()).toHaveLength(1);
    expect(reported()[0].reason).toBe('Winter closure');
  });
});

describe('ScheduleRulesSection — the summary line', () => {
  it('says what the rule does, in words rather than a code', () => {
    renderSection([rule({ action: 'close' })]);

    // "close" is the stored value; a club reads "Close".
    expect(summaries()[0]).toMatch(/Close/);
  });

  it('distinguishes an opening rule from a closing one', () => {
    renderSection([rule({ action: 'open' })]);

    expect(summaries()[0]).toMatch(/Open/);
    expect(summaries()[0]).not.toMatch(/Close/);
  });

  it('survives a rule that has lost its action', () => {
    // Older rules predate the field; defaulting beats rendering "undefined".
    renderSection([{ startDate: new Date('2026-04-01') } as ScheduleRule]);

    expect(summaries()[0]).toMatch(/Open/);
  });

  it('survives a rule that has no start date at all', () => {
    renderSection([{ action: 'open' } as unknown as ScheduleRule]);

    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });
});

describe('ScheduleRulesSection — editing a rule', () => {
  it('opens a rule’s panel when its summary is clicked', () => {
    renderSection([rule({ reason: 'Season opens' })]);

    fireEvent.click(summaryButton(0));

    // The reason lives inside the panel, so its presence is the panel opening.
    expect(screen.getByDisplayValue('Season opens')).toBeInTheDocument();
  });

  it('changes a reason without touching the other rule', () => {
    renderSection([rule({ reason: 'Season opens' }), rule({ reason: 'Winter closure' })]);

    fireEvent.click(summaryButton(0));
    fireEvent.change(screen.getByDisplayValue('Season opens'), {
      target: { value: 'Season opens early' },
    });

    expect(reported()[0].reason).toBe('Season opens early');
    expect(reported()[1].reason).toBe('Winter closure');
  });

  it('changes the action of the rule being edited', () => {
    renderSection([rule({ action: 'open', reason: 'Season opens' })]);

    fireEvent.click(summaryButton(0));
    fireEvent.mouseDown(screen.getAllByRole('combobox')[0]);
    fireEvent.click(within(screen.getByRole('listbox')).getByText(/close/i));

    expect(reported()[0].action).toBe('close');
  });

  it('changes a date on the rule being edited', () => {
    renderSection([rule({ reason: 'Season opens' })]);

    fireEvent.click(summaryButton(0));
    const dateInputs = document.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: '2026-05-01' } });

    expect(onChange).toHaveBeenCalled();
  });
});

describe('ScheduleRulesSection — with nothing configured', () => {
  it('still offers a way to add the first rule', () => {
    renderSection([]);

    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument();
  });

  it('reports nothing until something is done', () => {
    renderSection([]);

    expect(onChange).not.toHaveBeenCalled();
  });
});
