import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import EntryFormPage from '../EntryFormPage';
import { makeOrganisationContext, renderWithProviders } from '../../test/renderWithProviders';
import { AccountOrganisationContextValue } from '../../context/AccountOrganisationContext';

const mockExecute = vi.fn();
const mockNavigate = vi.fn();
let contextValue: AccountOrganisationContextValue = makeOrganisationContext();

vi.mock('../../hooks/useAccountApi', async () => {
  const actual = await vi.importActual<typeof import('../../hooks/useAccountApi')>(
    '../../hooks/useAccountApi'
  );
  return {
    ...actual,
    useAccountApi: () => ({
      execute: mockExecute,
      loading: false,
      error: null,
      reset: () => undefined,
    }),
  };
});

vi.mock('../../context/AccountOrganisationContext', async () => {
  const actual = await vi.importActual<
    typeof import('../../context/AccountOrganisationContext')
  >('../../context/AccountOrganisationContext');
  return { ...actual, useAccountOrganisation: () => contextValue };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ itemId: 'act-1' }),
  };
});

const activity = (over: Record<string, unknown> = {}) => ({
  id: 'act-1',
  name: 'Junior Single Sculls',
  description: null,
  fee: 2500,
  handlingFeeIncluded: true,
  applicationFormId: null,
  allowSpecifyQuantity: false,
  supportedPaymentMethodIds: ['pm-card'],
  entriesLimit: null,
  placesRemaining: null,
  termsAndConditions: null,
  available: true,
  unavailableReason: null,
  membersOnly: false,
  eligibleMembers: [],
  ...over,
});

const eventWith = (act: Record<string, unknown>) => ({
  id: 'event-1',
  name: 'Summer Regatta',
  description: null,
  startDate: '2026-07-01',
  endDate: '2026-07-02',
  entriesOpenDate: null,
  entriesClosingDate: null,
  entriesLimit: null,
  placesRemaining: null,
  available: true,
  unavailableReason: null,
  activities: [act],
});

/**
 * How the entrant name field behaves, per test.
 *
 * Defaults to a plain text box — the commonest case, a club that does not run
 * memberships — so the tests that are about terms and forms are not also tests
 * about autocompletion.
 */
let entrants: { autocomplete: boolean; allowFreeText: boolean; matches: unknown[] } = {
  autocomplete: false,
  allowFreeText: true,
  matches: [],
};

/** Routes by URL: catalogue, form definition, entrants, submission, cart. */
const respond = (act: Record<string, unknown>, form?: Record<string, unknown>) => {
  mockExecute.mockImplementation((request: { url: string; method?: string }) => {
    if (request.method === 'POST' && request.url.includes('form-submissions')) {
      return Promise.resolve({ id: 'sub-1' });
    }
    if (request.method === 'POST') return Promise.resolve({});
    if (request.url.includes('/entrants')) return Promise.resolve(entrants);
    if (request.url.includes('/forms/')) return Promise.resolve(form ?? null);
    return Promise.resolve([eventWith(act)]);
  });
};

/**
 * Name the entry, which every event entry now requires.
 *
 * A helper because it is a precondition of almost every test in this file
 * rather than the subject of them — the ones that *are* about the name say so.
 */
const nameTheEntrant = async (name = 'Saoirse Byrne') => {
  await userEvent.type(await screen.findByLabelText(/Who is this entry for/), name);
};

const render = () => renderWithProviders(<EntryFormPage kind="event" />);

/**
 * Entering as a page rather than a dialog, and the terms gate.
 *
 * The gate is the part worth pinning down: a member must not be able to reach
 * the basket without having ticked the box, because the club's position is that
 * they agreed to something before paying.
 */
describe('EntryFormPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contextValue = makeOrganisationContext();
    entrants = { autocomplete: false, allowFreeText: true, matches: [] };
    respond(activity());
  });

  it('shows what is being entered and what it costs', async () => {
    render();

    expect(await screen.findByText('Summer Regatta')).toBeInTheDocument();
    expect(screen.getByText('Junior Single Sculls')).toBeInTheDocument();
    expect(screen.getByText('€25.00')).toBeInTheDocument();
  });

  it('adds to the basket and moves on when there is nothing to agree to', async () => {
    render();
    await nameTheEntrant();

    await userEvent.click(await screen.findByRole('button', { name: 'Add to basket' }));

    await waitFor(() =>
      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: `/api/account/${contextValue.orgCode}/cart/items`,
        })
      )
    );
    expect(mockNavigate).toHaveBeenCalledWith(`/${contextValue.orgCode}/cart`);
  });

  describe('terms and conditions', () => {
    beforeEach(() => respond(activity({ termsAndConditions: 'No refunds after 1 June.' })));

    it('shows the club’s terms in full', async () => {
      render();

      expect(await screen.findByText('No refunds after 1 June.')).toBeInTheDocument();
    });

    it('will not add to the basket until the member agrees', async () => {
      render();

      const submit = await screen.findByRole('button', { name: 'Add to basket' });
      expect(submit).toBeDisabled();

      // And says why, rather than leaving a dead button.
      expect(screen.getByText(/must agree/i)).toBeInTheDocument();
    });

    it('adds once the member has agreed', async () => {
      render();
      await nameTheEntrant();

      await userEvent.click(await screen.findByRole('checkbox'));
      await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({ method: 'POST', url: expect.stringContaining('cart/items') })
        )
      );
    });
  });

  describe('application form', () => {
    const form = {
      id: 'form-1',
      name: 'Entry details',
      description: null,
      fields: [
        {
          id: 'f1',
          name: 'horse',
          label: 'Horse name',
          datatype: 'text',
          order: 1,
          validation: { required: true },
        },
      ],
    };

    beforeEach(() => respond(activity({ applicationFormId: 'form-1' }), form));

    /**
     * A club that puts a date, time or datetime field on its form.
     *
     * `DateRenderer` reads MUI's picker localisation context and throws without
     * it, and a throw during render unwinds the whole tree — so the member got
     * a blank screen, not a broken field. The page supplies the provider
     * itself; the shared library deliberately does not (see
     * `FormLocalizationProvider`).
     */
    it('renders date, time and datetime fields rather than blanking the page', async () => {
      respond(activity({ applicationFormId: 'form-1' }), {
        id: 'form-1',
        name: 'Entry details',
        description: null,
        fields: [
          { id: 'f1', name: 'dob', label: 'Date of birth', datatype: 'date', order: 1 },
          { id: 'f2', name: 'start', label: 'Preferred start', datatype: 'time', order: 2 },
          { id: 'f3', name: 'arrival', label: 'Arriving at', datatype: 'datetime', order: 3 },
        ],
      });

      render();

      // The page is still standing, and every picker drew its own label.
      expect(await screen.findByText('Junior Single Sculls')).toBeInTheDocument();
      expect(screen.getByLabelText(/Date of birth/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Preferred start/)).toBeInTheDocument();
      expect(screen.getByLabelText(/Arriving at/)).toBeInTheDocument();
    });

    /**
     * Required-ness arrives in two places, and the form builder writes the one
     * this originally ignored.
     *
     * `application_form_fields.required` says "mandatory on this form";
     * `application_fields.validation.required` says "mandatory wherever this
     * field is used". Real data has the first set and `validation` null, so
     * checking only `validation` let the button light up with an empty
     * mandatory field — which is exactly what happened on KHPC's Cross Country
     * Training.
     */
    it('treats the join-table required flag as mandatory', async () => {
      respond(activity({ applicationFormId: 'form-1' }), {
        id: 'form-1',
        name: 'Entry details',
        description: null,
        fields: [
          {
            id: 'f1',
            name: 'name',
            label: 'Name',
            datatype: 'text',
            order: 1,
            // As the API returns it: required on the join row, no validation.
            required: true,
            validation: null,
          },
        ],
      });

      render();

      const submit = await screen.findByRole('button', { name: 'Add to basket' });
      expect(submit).toBeDisabled();
      expect(screen.getByText(/Still needed:.*Name/)).toBeInTheDocument();
    });

    /** Ticking the terms box must not substitute for filling the form. */
    it('stays disabled after agreeing to terms while an answer is missing', async () => {
      respond(
        activity({ applicationFormId: 'form-1', termsAndConditions: '<p>Be careful.</p>' }),
        {
          id: 'form-1',
          name: 'Entry details',
          description: null,
          fields: [
            {
              id: 'f1',
              name: 'name',
              label: 'Name',
              datatype: 'text',
              order: 1,
              required: true,
              validation: null,
            },
          ],
        }
      );

      render();

      await userEvent.click(await screen.findByRole('checkbox'));

      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
    });

    it('renders the club’s own fields', async () => {
      render();

      expect(await screen.findByLabelText(/Horse name/)).toBeInTheDocument();
    });

    /**
     * Every field type the form builder offers, drawn as itself.
     *
     * The builder stores its own vocabulary — `radio`, `checkbox`, `select`,
     * `multiselect` — while `FieldRenderer` switches on the metadata one and
     * falls through to a text box for anything it does not recognise. Nothing
     * throws, so a radio group, a checkbox list and a dropdown all arrived on
     * the member's screen as identical empty text boxes. These assert the
     * control, not merely the label, because a label proves nothing here.
     */
    const choiceForm = {
      id: 'form-1',
      name: 'Entry details',
      description: null,
      fields: [
        {
          id: 'f1',
          name: 'age_group',
          label: 'Age group',
          datatype: 'radio',
          order: 1,
          options: ['Under 12', 'Under 14'],
        },
        {
          id: 'f2',
          name: 'boat_class',
          label: 'Boat class',
          datatype: 'select',
          order: 2,
          options: ['Single', 'Double'],
        },
        {
          id: 'f3',
          name: 'extras',
          label: 'Extras',
          datatype: 'multiselect',
          order: 3,
          options: ['Blades', 'Trailer'],
        },
        {
          id: 'f4',
          name: 'dietary',
          label: 'Dietary needs',
          datatype: 'checkbox',
          order: 4,
          options: ['Vegetarian', 'Gluten free'],
        },
        { id: 'f5', name: 'notes', label: 'Notes', datatype: 'textarea', order: 5 },
        { id: 'f6', name: 'first_time', label: 'First time?', datatype: 'boolean', order: 6 },
      ],
    };

    it('draws a radio field as radio buttons with its choices', async () => {
      respond(activity({ applicationFormId: 'form-1' }), choiceForm);
      render();

      expect(await screen.findByText('Age group')).toBeInTheDocument();
      expect(screen.getAllByRole('radio')).toHaveLength(2);
      expect(screen.getByRole('radio', { name: 'Under 12' })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Under 14' })).toBeInTheDocument();
      // Not the text box it used to fall back to.
      expect(screen.queryByRole('textbox', { name: /Age group/ })).not.toBeInTheDocument();
    });

    it('draws select and multiselect fields as dropdowns, not text boxes', async () => {
      respond(activity({ applicationFormId: 'form-1' }), choiceForm);
      render();

      expect(await screen.findByRole('combobox', { name: /Boat class/ })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /Extras/ })).toBeInTheDocument();

      for (const label of [/Boat class/, /Extras/]) {
        expect(screen.queryByRole('textbox', { name: label })).not.toBeInTheDocument();
      }
    });

    /**
     * A checkbox field is laid out, not hidden behind a dropdown: for the
     * handful of options a club writes, making the member open something to
     * discover three choices is a click for nothing, and the answer is not
     * readable at a glance afterwards.
     */
    it('draws a checkbox field as a row of checkboxes', async () => {
      respond(activity({ applicationFormId: 'form-1' }), choiceForm);
      render();
      await nameTheEntrant();

      expect(await screen.findByText('Dietary needs')).toBeInTheDocument();
      const group = screen.getByRole('group', { name: /Dietary needs/ });
      expect(within(group).getByRole('checkbox', { name: 'Vegetarian' })).toBeInTheDocument();
      expect(within(group).getByRole('checkbox', { name: 'Gluten free' })).toBeInTheDocument();

      expect(screen.queryByRole('combobox', { name: /Dietary needs/ })).not.toBeInTheDocument();
    });

    it('records every box the member ticks', async () => {
      respond(activity({ applicationFormId: 'form-1' }), {
        ...choiceForm,
        fields: [choiceForm.fields[3]],
      });
      render();
      await nameTheEntrant();

      await userEvent.click(await screen.findByRole('checkbox', { name: 'Vegetarian' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Gluten free' }));

      await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('form-submissions'),
            data: expect.objectContaining({
              submissionData: { dietary: ['Vegetarian', 'Gluten free'] },
            }),
          })
        )
      );
    });

    it('draws a textarea as a text box and a boolean as a tick-box', async () => {
      respond(activity({ applicationFormId: 'form-1' }), choiceForm);
      render();

      expect(await screen.findByRole('textbox', { name: /Notes/ })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'First time?' })).toBeInTheDocument();
    });

    it('offers the stored options and submits the choice the member makes', async () => {
      respond(activity({ applicationFormId: 'form-1' }), {
        ...choiceForm,
        fields: [choiceForm.fields[1]],
      });
      render();
      await nameTheEntrant();

      // MUI opens on mouseDown, not click (CLAUDE.md §3.4).
      fireEvent.mouseDown(await screen.findByRole('combobox', { name: /Boat class/ }));
      const options = within(screen.getByRole('listbox')).getAllByRole('option');
      expect(options.map((option) => option.textContent)).toEqual(['Single', 'Double']);

      fireEvent.click(screen.getByRole('option', { name: 'Double' }));

      await userEvent.click(screen.getByRole('button', { name: 'Add to basket' }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('form-submissions'),
            data: expect.objectContaining({ submissionData: { boat_class: 'Double' } }),
          })
        )
      );
    });

    /**
     * A typed answer of the wrong kind is not an answer.
     *
     * The datatype is a promise about what comes back — an email field that
     * takes `not an email`, or a phone field that takes a sentence, is a
     * record the club cannot use, and it is discovered long after the member
     * has paid. The button waits on the answer being right, not merely present.
     */
    const typedForm = (datatype: string, name: string, label: string) => ({
      id: 'form-1',
      name: 'Entry details',
      description: null,
      fields: [{ id: 'f1', name, label, datatype, order: 1, required: true }],
    });

    it('will not accept an email field that is not an email', async () => {
      respond(activity({ applicationFormId: 'form-1' }), typedForm('email', 'email', 'Email'));
      render();
      await nameTheEntrant();

      await userEvent.type(await screen.findByLabelText(/Email/), 'not an email');

      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
      expect(screen.getByText(/Check these answers:.*Email/)).toBeInTheDocument();

      await userEvent.clear(screen.getByLabelText(/Email/));
      await userEvent.type(screen.getByLabelText(/Email/), 'member@club.ie');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });

    it('will not accept letters in a phone number', async () => {
      respond(activity({ applicationFormId: 'form-1' }), typedForm('phone', 'mobile', 'Mobile'));
      render();
      await nameTheEntrant();

      await userEvent.type(await screen.findByLabelText(/Mobile/), 'call the club');

      expect(screen.getByRole('button', { name: 'Add to basket' })).toBeDisabled();
      expect(screen.getByText(/Check these answers:.*Mobile/)).toBeInTheDocument();

      await userEvent.clear(screen.getByLabelText(/Mobile/));
      await userEvent.type(screen.getByLabelText(/Mobile/), '+353 1 234 5678');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });

    it('tells the member the field is wrong, not that it is missing', async () => {
      respond(activity({ applicationFormId: 'form-1' }), typedForm('email', 'email', 'Email'));
      render();

      await userEvent.type(await screen.findByLabelText(/Email/), 'nope');

      // It has been answered — so "still needed" would send them looking for
      // an empty box that is not there.
      expect(screen.queryByText(/Still needed/)).not.toBeInTheDocument();
      expect(screen.getByText(/Check these answers/)).toBeInTheDocument();
    });

    /** An optional field left blank is not "filled in wrongly". */
    it('does not object to an untouched optional field of a checked type', async () => {
      respond(activity({ applicationFormId: 'form-1' }), {
        ...typedForm('email', 'email', 'Email'),
        fields: [{ id: 'f1', name: 'email', label: 'Email', datatype: 'email', order: 1 }],
      });
      render();
      await nameTheEntrant();

      const submit = await screen.findByRole('button', { name: 'Add to basket' });
      expect(submit).toBeEnabled();
      expect(screen.queryByText(/Check these answers/)).not.toBeInTheDocument();
    });

    /** A radio field the club marked mandatory gates the button like any other. */
    it('keeps the button disabled until a required choice is made', async () => {
      respond(activity({ applicationFormId: 'form-1' }), {
        ...choiceForm,
        fields: [{ ...choiceForm.fields[0], required: true }],
      });
      render();
      await nameTheEntrant();

      expect(await screen.findByRole('button', { name: 'Add to basket' })).toBeDisabled();

      await userEvent.click(screen.getByRole('radio', { name: 'Under 14' }));

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });

    /**
     * The form's own name and description are written for the administrator who
     * built it — "Entry details v2", "used for junior classes" — and mean
     * nothing to the member filling it in. They get an instruction instead.
     */
    it('shows an instruction rather than the club’s internal form name', async () => {
      render();

      expect(await screen.findByText(/fill out the details below/i)).toBeInTheDocument();
      expect(screen.queryByText('Entry details')).not.toBeInTheDocument();
    });

    /**
     * The button waits on the form, not the other way round. A member should
     * see it is unavailable while they are still in the form, rather than being
     * sent back to a field they scrolled past after committing to the action.
     */
    it('keeps the button disabled until every required answer is given', async () => {
      render();
      await nameTheEntrant();

      const submit = await screen.findByRole('button', { name: 'Add to basket' });
      expect(submit).toBeDisabled();
      // Named, not merely counted — on a long form the field may be off-screen.
      // Matched on the hint, since the field's own label also says "Horse name".
      expect(screen.getByText(/Still needed:.*Horse name/)).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText(/Horse name/), 'Dobbin');

      await waitFor(() =>
        expect(screen.getByRole('button', { name: 'Add to basket' })).toBeEnabled()
      );
    });
  });

  it('says so when the item is no longer in the catalogue', async () => {
    mockExecute.mockImplementation((request: { url: string }) => {
      if (request.url.includes('/forms/')) return Promise.resolve(null);
      return Promise.resolve([]);
    });

    render();

    expect(await screen.findByText(/no longer available/i)).toBeInTheDocument();
  });

  /**
   * Members-only activities.
   *
   * The interesting cases are all about *how many* memberships the login holds,
   * because a parent holding their children's is normal rather than
   * exceptional. One is stated, several are asked, none is refused.
   *
   * See docs/MEMBERS_ONLY_ENTRIES.md.
   */
  describe('entering as a member', () => {
    const member = (over: Record<string, unknown> = {}) => ({
      id: 'mem-1',
      name: 'Saoirse Byrne',
      membershipTypeName: 'Junior Member',
      membershipNumber: 'KHP-0241',
      alreadyEntered: false,
      ...over,
    });

    const membersOnly = (members: Array<Record<string, unknown>>) =>
      activity({ membersOnly: true, eligibleMembers: members });

    it('opens already filled in when the account holds exactly one membership', async () => {
      // No choice to make, so the question is answered rather than asked.
      respond(membersOnly([member()]));
      render();

      await waitFor(() =>
        expect(screen.getByLabelText(/Who is this entry for/)).toHaveValue('Saoirse Byrne')
      );
    });

    it('asks, and preselects nothing, when the account holds several', async () => {
      /*
       * A parent entering Fionn who gets Saoirse by default has been handed a
       * wrong answer that looks like their own. An empty required field asks
       * the question instead.
       */
      respond(membersOnly([member(), member({ id: 'mem-2', name: 'Fionn Byrne' })]));
      render();

      const field = await screen.findByLabelText(/Who is this entry for/);
      expect(field).toHaveValue('');

      // And the consequence that matters — they cannot submit until they say.
      expect(screen.getByRole('button', { name: /Add to basket/i })).toBeDisabled();
    });

    it('refuses to render for someone holding no membership', async () => {
      /*
       * Not reachable from the listing, but a link can be pasted and a
       * membership can lapse between opening the list and opening the form.
       *
       * Note this still gates on the *caller*: widening who may be named did
       * not widen who may reach a members-only activity.
       */
      respond(membersOnly([]));
      render();

      expect(await screen.findByText(/do not hold an active membership/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Add to basket/i })).not.toBeInTheDocument();
    });

    it('completes against the whole roster, not just the account’s own members', async () => {
      /*
       * The widening, from the form's side. A parent whose child's membership
       * sits on the other parent's login, or a secretary entering half the
       * club, could name nobody at all under the old list.
       */
      respond(membersOnly([member()]));
      entrants = {
        autocomplete: true,
        allowFreeText: false,
        matches: [
          {
            memberId: 'mem-9',
            name: 'Somebody Else’s Child',
            membershipTypeName: 'Junior Member',
            membershipNumber: 'KHP-0999',
          },
        ],
      };
      render();

      const field = await screen.findByLabelText(/Who is this entry for/);
      await userEvent.clear(field);
      await userEvent.type(field, 'som');

      expect(await screen.findByText('Somebody Else’s Child')).toBeInTheDocument();
    });

    it('asks the server for matches as the member types', async () => {
      respond(membersOnly([member()]));
      entrants = { autocomplete: true, allowFreeText: false, matches: [] };
      render();

      const field = await screen.findByLabelText(/Who is this entry for/);
      await userEvent.clear(field);
      await userEvent.type(field, 'byr');

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('/activities/act-1/entrants'),
            params: { q: 'byr' },
          })
        )
      );
    });

    it('sends the chosen member with the basket line', async () => {
      // What carries the choice all the way to the entry record.
      respond(membersOnly([member()]));
      render();

      await waitFor(() =>
        expect(screen.getByLabelText(/Who is this entry for/)).toHaveValue('Saoirse Byrne')
      );
      await userEvent.click(screen.getByRole('button', { name: /Add to basket/i }));

      await waitFor(() =>
        expect(mockExecute).toHaveBeenCalledWith(
          expect.objectContaining({
            method: 'POST',
            data: expect.objectContaining({
              contextRef: expect.objectContaining({
                memberId: 'mem-1',
                entrantName: 'Saoirse Byrne',
              }),
            }),
          })
        )
      );
    });

    it('sends the typed name, and no member, for an open activity', async () => {
      respond(activity());
      render();

      await screen.findByText('Junior Single Sculls');
      await nameTheEntrant('Fionn Doyle');
      await userEvent.click(screen.getByRole('button', { name: /Add to basket/i }));

      await waitFor(() => expect(mockExecute).toHaveBeenCalled());
      const add = mockExecute.mock.calls
        .map(([request]) => request)
        .find((request: any) => request?.data?.contextRef?.activityId);
      expect(add.data.contextRef).not.toHaveProperty('memberId');
      expect(add.data.contextRef.entrantName).toBe('Fionn Doyle');
    });

    it('will not submit an open entry with no name at all', async () => {
      /*
       * The name is the entry, not a question about it. Without it the club's
       * entry list is a column of account holders.
       */
      respond(activity());
      render();

      await screen.findByText('Junior Single Sculls');
      expect(screen.getByRole('button', { name: /Add to basket/i })).toBeDisabled();
    });
  });

});
