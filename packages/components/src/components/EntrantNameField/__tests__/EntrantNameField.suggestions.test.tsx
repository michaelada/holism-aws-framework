import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EntrantNameField } from '../EntrantNameField';

/**
 * The names offered under the field.
 *
 * An account entering the same few people every fortnight was retyping them
 * each time — and on a members-only activity, typing is not even an answer.
 * Two lists: who this account may enter, and who it has entered.
 */
const labels = {
  label: 'Who is this entry for?',
  usedBefore: 'Used before',
  suggestionsHint: 'Select a name to fill it in.',
};

describe('EntrantNameField suggestions', () => {
  it('offers memberships and recent names, the second under its own heading', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        labels={labels}
        suggestions={{
          memberships: [{ name: 'Rónán McGrath', memberId: 'm-1', detail: 'Junior Member' }],
          recent: [{ name: 'Tadhg Nolan', memberId: null }],
        }}
      />
    );

    expect(screen.getByText('Rónán McGrath · Junior Member')).toBeInTheDocument();
    expect(screen.getByText('Used before')).toBeInTheDocument();
    expect(screen.getByText('Tadhg Nolan')).toBeInTheDocument();
  });

  /*
   * A membership chip carries its id, so the click *selects the membership*
   * rather than typing the name. On a members-only activity a bare name is
   * refused, so a suggestion that only filled the box in would look like it
   * had worked and then fail on submit.
   */
  it('selects the membership behind a name, not just the text', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={onChange}
        labels={labels}
        suggestions={{
          memberships: [{ name: 'Rónán McGrath', memberId: 'm-1', detail: 'Junior Member' }],
        }}
      />
    );

    await user.click(screen.getByText('Rónán McGrath · Junior Member'));

    expect(onChange).toHaveBeenCalledWith({ memberId: 'm-1', name: 'Rónán McGrath' });
  });

  it('fills the name alone for one that was only ever typed', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={onChange}
        labels={labels}
        suggestions={{ recent: [{ name: 'Tadhg Nolan', memberId: null }] }}
      />
    );

    await user.click(screen.getByText('Tadhg Nolan'));

    expect(onChange).toHaveBeenCalledWith({ memberId: null, name: 'Tadhg Nolan' });
  });

  /*
   * A club with no roster still has the names this account entered last time,
   * and those are the ones most worth a click when there is nothing to
   * complete against.
   */
  it('offers them on a plain box too, where there is no roster', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        autocomplete={false}
        labels={labels}
        suggestions={{ recent: [{ name: 'Tadhg Nolan', memberId: null }] }}
      />
    );

    expect(screen.getByText('Tadhg Nolan')).toBeInTheDocument();
  });

  /*
   * The memberships carry no heading of their own.
   *
   * The hint above the block already says what to do with every name under it,
   * and these are simply the names on the account — a heading there would have
   * been a label on the obvious, with the membership type already on each chip.
   * "Used before" keeps its heading because it says something the names cannot:
   * that they were typed on a previous entry rather than held as a membership.
   */
  it('heads the memberships with nothing at all', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        labels={labels}
        suggestions={{ memberships: [{ name: 'Rónán McGrath', memberId: 'm-1' }] }}
      />
    );

    expect(screen.getByText('Rónán McGrath')).toBeInTheDocument();
    expect(screen.queryByText(/your memberships/i)).not.toBeInTheDocument();
    // And nothing empty left in its place.
    expect(screen.queryByText('Used before')).not.toBeInTheDocument();
  });

  it('renders nothing when there is nothing to offer', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        labels={labels}
        suggestions={{ memberships: [], recent: [] }}
      />
    );

    expect(screen.queryByText('Used before')).not.toBeInTheDocument();
  });

  it('says nothing at all when the caller passes no suggestions', () => {
    render(
      <EntrantNameField value={{ memberId: null, name: '' }} onChange={vi.fn()} labels={labels} />
    );

    expect(screen.queryByText('Used before')).not.toBeInTheDocument();
  });
});

/**
 * That the names can be clicked, said in words.
 *
 * A row of chips under a form field reads as labels — a membership type, a
 * category, something the form is telling you — until something says
 * otherwise. A member who reads them that way types the name that was sitting
 * right there, which is the whole thing this feature exists to save.
 */
describe('EntrantNameField suggestion hint', () => {
  it('tells the member the names can be selected', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        labels={labels}
        suggestions={{ memberships: [{ name: 'Rónán McGrath', memberId: 'm-1' }] }}
      />
    );

    expect(screen.getByText('Select a name to fill it in.')).toBeInTheDocument();
  });

  it('says it once, however many lists there are', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        labels={labels}
        suggestions={{
          memberships: [{ name: 'Rónán McGrath', memberId: 'm-1' }],
          recent: [{ name: 'Tadhg Nolan', memberId: null }],
        }}
      />
    );

    // Twice would make two short lists look like two separate mechanisms.
    expect(screen.getAllByText('Select a name to fill it in.')).toHaveLength(1);
  });

  it('says nothing when there is nothing to select', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        labels={labels}
        suggestions={{ memberships: [], recent: [] }}
      />
    );

    expect(screen.queryByText('Select a name to fill it in.')).not.toBeInTheDocument();
  });

  it('leaves the hint out when the caller gives no wording for it', () => {
    render(
      <EntrantNameField
        value={{ memberId: null, name: '' }}
        onChange={vi.fn()}
        labels={{ label: 'Who is this entry for?', usedBefore: 'Used before' }}
        suggestions={{ recent: [{ name: 'Tadhg Nolan', memberId: null }] }}
      />
    );

    expect(screen.getByText('Tadhg Nolan')).toBeInTheDocument();
    expect(screen.queryByText(/select a name/i)).not.toBeInTheDocument();
  });
});
