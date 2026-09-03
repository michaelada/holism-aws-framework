import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntrantNameField, EntrantOption, EntrantValue } from '../EntrantNameField';

/**
 * The field every event entry form opens with.
 *
 * Most of what matters here is about *refusing* rather than accepting. On a
 * members-only activity a typed name is exactly the thing being excluded, so
 * the field must not be able to hold one — and it has to say so at the field,
 * while the member is still looking at it, rather than letting them fill in the
 * rest of the club's form and meet a validation error at the end.
 *
 * See docs/ENTRANT_NAME.md.
 */

const labels = {
  label: 'Who is this entry for?',
  placeholder: 'Name',
  helperText: 'Start typing to find a member.',
  noMatches: 'No members found.',
  alreadyEntered: 'Already entered',
  loading: 'Searching…',
};

const saoirse: EntrantOption = {
  memberId: 'mem-1',
  name: 'Saoirse Byrne',
  membershipTypeName: 'Junior Member',
  membershipNumber: 'KHP-0241',
};

/** The field is controlled, so the tests need something to control it. */
const Harness: React.FC<
  Partial<React.ComponentProps<typeof EntrantNameField>> & { onValue?: (v: EntrantValue) => void }
> = ({ onValue, ...props }) => {
  const [value, setValue] = useState<EntrantValue>({ memberId: null, name: '' });
  return (
    <EntrantNameField
      {...props}
      value={props.value ?? value}
      labels={props.labels ?? labels}
      onChange={(next) => {
        setValue(next);
        onValue?.(next);
      }}
    />
  );
};

describe('a club with no membership roster', () => {
  it('asks for a name as a plain text box', async () => {
    /*
     * The right answer, not a degraded one: an Autocomplete that can never
     * suggest anything is a text field that also spins.
     */
    const onValue = vi.fn();
    render(<Harness autocomplete={false} onValue={onValue} />);

    await userEvent.type(screen.getByLabelText(/Who is this entry for/), 'Fionn Doyle');

    expect(onValue).toHaveBeenLastCalledWith({ memberId: null, name: 'Fionn Doyle' });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('an open activity', () => {
  it('accepts a name that matches nobody', async () => {
    const onValue = vi.fn();
    render(<Harness autocomplete allowFreeText options={[]} onValue={onValue} />);

    await userEvent.type(screen.getByRole('combobox'), 'Fionn Doyle');

    expect(onValue).toHaveBeenLastCalledWith({ memberId: null, name: 'Fionn Doyle' });
  });

  it('keeps a typed name on blur', async () => {
    // The counterpart to the members-only case below: here the typed name *is*
    // the answer, so leaving the field must not discard it.
    const onValue = vi.fn();
    render(
      <Harness
        autocomplete
        allowFreeText
        value={{ memberId: null, name: 'Fionn Doyle' }}
        onValue={onValue}
      />
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.tab();

    expect(onValue).not.toHaveBeenCalledWith({ memberId: null, name: '' });
  });

  it('still lets a member be chosen from the roster', async () => {
    const onValue = vi.fn();
    render(<Harness autocomplete allowFreeText options={[saoirse]} onValue={onValue} />);

    await userEvent.type(screen.getByRole('combobox'), 'byr');
    await userEvent.click(await screen.findByText('Saoirse Byrne'));

    expect(onValue).toHaveBeenLastCalledWith({ memberId: 'mem-1', name: 'Saoirse Byrne' });
  });
});

describe('a members-only activity', () => {
  it('clears a name that was typed rather than chosen', async () => {
    /*
     * The refusal, at the field. Without this the member fills in the whole of
     * the club's form and is told at the end that the name they typed is not a
     * member — by which point they have to find the field again.
     */
    const onValue = vi.fn();
    render(
      <Harness
        autocomplete
        allowFreeText={false}
        value={{ memberId: null, name: 'Not A Member' }}
        onValue={onValue}
      />
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.tab();

    expect(onValue).toHaveBeenLastCalledWith({ memberId: null, name: '' });
  });

  it('keeps a name that was chosen', async () => {
    const onValue = vi.fn();
    render(
      <Harness
        autocomplete
        allowFreeText={false}
        options={[saoirse]}
        value={{ memberId: 'mem-1', name: 'Saoirse Byrne' }}
        onValue={onValue}
      />
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.tab();

    expect(onValue).not.toHaveBeenCalledWith({ memberId: null, name: '' });
  });
});

describe('reading the roster', () => {
  it('reports the search term as the member types', async () => {
    const onSearch = vi.fn();
    render(<Harness autocomplete allowFreeText onSearch={onSearch} />);

    await userEvent.type(screen.getByRole('combobox'), 'byr');

    await waitFor(() => expect(onSearch).toHaveBeenLastCalledWith('byr'));
  });

  it('shows the membership type and number under the name', async () => {
    // Two children in a family share a surname; the number is what separates
    // them on a club's own paperwork.
    render(<Harness autocomplete allowFreeText options={[saoirse]} />);

    await userEvent.type(screen.getByRole('combobox'), 'byr');

    expect(await screen.findByText('Junior Member · KHP-0241')).toBeInTheDocument();
  });

  it('names the member’s own club when it is not this one', async () => {
    /*
     * Federation-wide entries only. Two members called Sarah Byrne from
     * different branches are otherwise identical rows, and the entrant is the
     * one thing this field must get right.
     */
    render(
      <Harness
        autocomplete
        allowFreeText={false}
        options={[{ ...saoirse, organisationName: 'Ward Union Pony Club' }]}
      />
    );

    await userEvent.type(screen.getByRole('combobox'), 'byr');

    expect(await screen.findByText('Ward Union Pony Club')).toBeInTheDocument();
  });

  /**
   * Said, and still selectable.
   *
   * An activity may be entered more than once — one rider on two horses is the
   * ordinary case — so having entered is worth telling the member and not worth
   * refusing. It used to be a disabled row, which reads as "you have made a
   * mistake" about something that is often deliberate.
   */
  it('says someone has already entered, and still lets them be chosen', async () => {
    const onValue = vi.fn();
    render(
      <Harness
        autocomplete
        allowFreeText={false}
        options={[{ ...saoirse, alreadyEntered: true }]}
        onValue={onValue}
      />
    );

    await userEvent.type(screen.getByRole('combobox'), 'byr');

    expect(await screen.findByText('Already entered')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Saoirse Byrne/ })).toHaveAttribute(
      'aria-disabled',
      'false'
    );

    await userEvent.click(screen.getByRole('option', { name: /Saoirse Byrne/ }));
    expect(onValue).toHaveBeenCalledWith({ memberId: 'mem-1', name: 'Saoirse Byrne' });
  });

  it('says when nothing matched rather than showing an empty box', async () => {
    render(<Harness autocomplete allowFreeText={false} options={[]} />);

    await userEvent.type(screen.getByRole('combobox'), 'zzz');

    expect(await screen.findByText('No members found.')).toBeInTheDocument();
  });
});

describe('errors', () => {
  it('shows the message it is given, in place of the hint', () => {
    render(<Harness autocomplete allowFreeText error="Choose an active member from the list." />);

    expect(screen.getByText('Choose an active member from the list.')).toBeInTheDocument();
    expect(screen.queryByText(labels.helperText)).not.toBeInTheDocument();
  });
});
