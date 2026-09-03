import {
  ACCOUNT_USERS,
  ENTRIES,
  ORG_TYPE,
  EVENTS,
  FIELDS,
  FORMS,
  MEMBERS,
  BOOKINGS,
  CALENDARS,
  ORGS,
  REFUNDS,
  REGISTRATIONS,
  SHOP_ORDERS,
  SeedEvent,
  assertEventDates,
} from '../dataset';

/**
 * The seed's events, checked against the rule `eventService.createEvent`
 * applies to everything that comes in through the API.
 *
 * The seed writes with raw SQL, so nothing else stops the fixture drifting
 * back to an event with no entry window — which reads as *permanently open*
 * rather than as missing data. See docs/EVENT_ENTRY_DATE_INVENTION_FIX.md.
 */
describe('seed events', () => {
  const event = (over: Partial<SeedEvent> = {}): SeedEvent =>
    ({
      key: 'test',
      org: 'kildare',
      name: 'Test Event',
      description: '',
      eventType: 'Rally',
      venue: 'Craddockstown Equestrian',
      startDays: 10,
      endDays: 10,
      openDays: -5,
      closeDays: 8,
      status: 'published',
      activities: [],
      ...over,
    }) as SeedEvent;

  it('gives every event all four dates', () => {
    for (const e of EVENTS) {
      expect(typeof e.startDays).toBe('number');
      expect(typeof e.endDays).toBe('number');
      expect(typeof e.openDays).toBe('number');
      expect(typeof e.closeDays).toBe('number');
    }
  });

  it('never ends an event before it starts, or closes entries before they open', () => {
    for (const e of EVENTS) {
      expect(() => assertEventDates(e)).not.toThrow();
    }
  });

  it('names the event when it ends before it starts', () => {
    expect(() => assertEventDates(event({ startDays: 10, endDays: 9 }))).toThrow(
      /"Test Event" ends before it starts/
    );
  });

  it('rejects an entry window that closes before it opens', () => {
    expect(() => assertEventDates(event({ openDays: 5, closeDays: -1 }))).toThrow(
      /closes to entries before it opens/
    );
  });

  it('rejects an entry window with no duration at all', () => {
    expect(() => assertEventDates(event({ openDays: 3, closeDays: 3 }))).toThrow(
      /closes to entries before it opens/
    );
  });

  it('accepts a window that opens in the past and closes in the future', () => {
    expect(() => assertEventDates(event({ openDays: -60, closeDays: 42 }))).not.toThrow();
  });
});

/**
 * A form belongs to one club, and its name should say which.
 *
 * The seed writes a separate `application_forms` row per organisation. While
 * they all shared one name, four identical *Camp booking* forms made a list
 * showing every club's forms indistinguishable from one correctly showing
 * yours — the fixture camouflaging the very bug it should expose.
 */
describe('seed forms', () => {
  it('names every form in every club', () => {
    for (const form of FORMS) {
      for (const org of ORGS) {
        expect(form.name[org.key]?.trim()).toBeTruthy();
      }
    }
  });

  it('gives no two clubs the same name for a form', () => {
    for (const form of FORMS) {
      const names = ORGS.map((org) => form.name[org.key]);
      expect(new Set(names).size).toBe(ORGS.length);
    }
  });

  it('leaves no name repeated anywhere in the fixture', () => {
    const all = FORMS.flatMap((form) => ORGS.map((org) => form.name[org.key]));

    expect(all).toHaveLength(FORMS.length * ORGS.length);
    expect(new Set(all).size).toBe(all.length);
  });

  it('names each club’s forms after that club', () => {
    // Not a naming rule so much as a check that the columns were not shifted:
    // every name mentions its own club, its county or one of its venues.
    const marks: Record<string, RegExp> = {
      kildare: /Kildare|Craddockstown|Punchestown/,
      laois: /Laois|Ballyroan/,
      ward: /Ward Union/,
      meath: /Meath|Tara|Kilmessan/,
    };

    for (const form of FORMS) {
      for (const org of ORGS) {
        expect(form.name[org.key]).toMatch(marks[org.key]);
      }
    }
  });
});

/**
 * A field belongs to one club, and its label should say which.
 *
 * The Fields list and the form builder's field picker both render the label.
 * While all four clubs used the same forty, a list showing every club's fields
 * was indistinguishable from one correctly showing yours — 160 rows reading as
 * four copies of the same forty.
 */
describe('seed fields', () => {
  it('labels every field in every club', () => {
    for (const field of FIELDS) {
      for (const org of ORGS) {
        expect(field.label[org.key]?.trim()).toBeTruthy();
      }
    }
  });

  it('gives no two clubs the same label for a field', () => {
    for (const field of FIELDS) {
      const labels = ORGS.map((org) => field.label[org.key]);
      expect(new Set(labels).size).toBe(ORGS.length);
    }
  });

  /*
   * Across the whole fixture, not just per field: a label seen anywhere should
   * identify both which club owns it and which field it is. `Breed` appeared
   * twice within a single club before this — once for the pony and once for the
   * registered horse — so the rule catches more than cross-club collisions.
   */
  it('leaves no label repeated anywhere in the fixture', () => {
    const all = FIELDS.flatMap((field) => ORGS.map((org) => field.label[org.key]));

    expect(all).toHaveLength(FIELDS.length * ORGS.length);
    expect(new Set(all).size).toBe(all.length);
  });

  it('keeps one machine name per field, shared by every club', () => {
    // The label is per club; `name` is the platform's canonical key and the one
    // a submission's answers are stored under, so it must not vary.
    for (const field of FIELDS) {
      expect(typeof field.name).toBe('string');
      expect(field.name).toMatch(/^[a-z][a-z0-9_]*$/);
    }
    expect(new Set(FIELDS.map((f) => f.name)).size).toBe(FIELDS.length);
  });

  /*
   * Each club's own vocabulary for the person a form is about — Kildare's
   * Rider, Laois's Competitor, Ward Union's Member, Meath's Entrant. That
   * consistency is what makes a stray field obvious at a glance, and it is the
   * cheapest guard against a column being shifted in the label table, where
   * every entry names the four clubs positionally.
   */
  it('keeps each club to its own word for the person', () => {
    const houseTerm: Record<string, string> = {
      kildare: 'Rider',
      laois: 'Competitor',
      ward: 'Member',
      meath: 'Entrant',
    };

    const aboutAPerson = [
      'riderDob', 'riderEmail', 'riderPhone', 'ageGroup',
      'gradeLevel', 'dietary', 'medicalNotes', 'addressLine', 'county',
    ];

    for (const key of aboutAPerson) {
      const field = FIELDS.find((f) => f.key === key);
      expect(field).toBeDefined();

      for (const org of ORGS) {
        expect(field!.label[org.key]).toContain(houseTerm[org.key]);
      }
    }
  });
});

/**
 * Entries that have already been made.
 *
 * Every one names an event, an activity within it and an account that belongs
 * to that club — three references the dataset cannot check for itself, and
 * three ways to write a row the seed will refuse at run time.
 */
describe('seed entries', () => {
  it('names an event and an activity that exist', () => {
    for (const entry of ENTRIES) {
      const event = EVENTS.find((e) => e.key === entry.event);
      expect(event).toBeDefined();
      expect(event!.activities.map((a) => a.name)).toContain(entry.activity);
    }
  });

  it('is made by an account user of that club', () => {
    for (const entry of ENTRIES) {
      const user = ACCOUNT_USERS.find((u) => u.email === entry.email);
      expect(user).toBeDefined();
      expect(user!.orgs).toContain(entry.org);
    }
  });

  /*
   * The point of the fixture. Five distinct names on one account is what the
   * entry form's "used before" list is sized for, and fewer would leave it
   * unexercised.
   */
  it('gives one account five distinct names to have used', () => {
    const byAccount = new Map<string, Set<string>>();
    for (const entry of ENTRIES) {
      const names = byAccount.get(entry.email) ?? new Set<string>();
      names.add(`${entry.firstName} ${entry.lastName}`);
      byAccount.set(entry.email, names);
    }

    const most = Math.max(...[...byAccount.values()].map((n) => n.size));
    expect(most).toBeGreaterThanOrEqual(5);
  });

  /*
   * One entry with no membership behind the name, which is what an open
   * activity allows and what a suggestion with nothing to link to comes from.
   */
  it('includes a name that no membership stands behind', () => {
    const memberNames = new Set(
      MEMBERS.map((m) => `${m.org}|${m.firstName ?? ''} ${m.lastName ?? ''}`.trim())
    );

    const unlinked = ENTRIES.filter(
      (e) => !memberNames.has(`${e.org}|${e.firstName} ${e.lastName}`)
    );

    expect(unlinked.length).toBeGreaterThan(0);
  });

  /*
   * Every login, in every club it belongs to.
   *
   * An entry belongs to an account's row in one organisation, so a member of
   * three clubs who has entered at one still sees an empty "My entries" at the
   * other two — which reads as broken rather than as empty, and is the screen
   * an organisation switch lands on.
   */
  it('gives every account something to look at in every club it belongs to', () => {
    const entered = new Set(ENTRIES.map((e) => `${e.email}|${e.org}`));

    const missing = ACCOUNT_USERS.flatMap((user) =>
      user.orgs.filter((org) => !entered.has(`${user.email}|${org}`)).map((org) => `${user.email} at ${org}`)
    );

    expect(missing).toEqual([]);
  });

  /*
   * Something *paid* in every club, so no Payments page is empty.
   *
   * The member's payment list is money that moved — `listPayments` excludes
   * `pending` — so an account whose only purchase at a club is unpaid sees an
   * empty page beside an entry marked "Awaiting payment". That is correct, and
   * it reads as broken, which is exactly the report this rule came from.
   */
  it('leaves every login a paid purchase in every club it belongs to', () => {
    const paidEntry = new Set(
      ENTRIES.filter((e) => e.paymentStatus === 'paid').map((e) => `${e.email}|${e.org}`)
    );
    const paidMembership = new Set(
      MEMBERS.filter((m) => m.paymentStatus === 'paid').map((m) => `${m.email}|${m.org}`)
    );

    const missing = ACCOUNT_USERS.flatMap((user) =>
      user.orgs
        .filter(
          (org) =>
            !paidEntry.has(`${user.email}|${org}`) && !paidMembership.has(`${user.email}|${org}`)
        )
        .map((org) => `${user.email} at ${org}`)
    );

    expect(missing).toEqual([]);
  });

  /*
   * The constraint that actually matters, which is not "few live entries".
   *
   * Ward Union and Meath Hunt have no event that has finished or closed, so
   * every entry on those accounts is on a live one and always will be. What
   * must not happen is a seeded entry quietly eating the places that a capped
   * activity exists to demonstrate — so the rule is about caps, not dates.
   */
  it('takes at most one place from any activity that caps them', () => {
    const takenPerActivity = new Map<string, number>();

    for (const entry of ENTRIES) {
      const event = EVENTS.find((e) => e.key === entry.event)!;
      const activity = event.activities.find((a) => a.name === entry.activity)!;
      if (activity.applicantsLimit == null) continue;

      const key = `${entry.event}|${entry.activity}`;
      takenPerActivity.set(key, (takenPerActivity.get(key) ?? 0) + 1);
    }

    for (const [activity, taken] of takenPerActivity) {
      expect({ activity, taken }).toEqual({ activity, taken: 1 });
    }
  });

  it('leaves a capped activity nearly all of its places', () => {
    for (const entry of ENTRIES) {
      const event = EVENTS.find((e) => e.key === entry.event)!;
      const activity = event.activities.find((a) => a.name === entry.activity)!;
      if (activity.applicantsLimit == null) continue;

      // A cap small enough for one seeded entry to matter is a cap the fixture
      // should not be spending at all.
      expect(activity.applicantsLimit).toBeGreaterThanOrEqual(10);
    }
  });
});

/**
 * What the platform and the payment provider take.
 *
 * Both live on the organisation type and both apply only to card payments —
 * an offline payment has no provider to charge and no card share to take.
 */
describe('seed fees', () => {
  it('charges VAT on the handling fee', () => {
    expect(ORG_TYPE.handlingFee.taxPercentage).toBe(23);
  });

  /*
   * On the *fee*, never on the order. 23% of a €25 entry is not what this is:
   * the club prices its entries as it prices them, and the tax applies to the
   * 25c + 1.5% the provider charges on top.
   */
  it('leaves the handling fee itself unchanged', () => {
    expect(ORG_TYPE.handlingFee.fixedFee).toBe(0.25);
    expect(ORG_TYPE.handlingFee.percentageFee).toBe(1.5);
  });

  /* A flat 60c. The platform's share is not a percentage of anything. */
  it('takes a flat 60c, with no percentage on top', () => {
    expect(ORG_TYPE.applicationFee).toEqual({ fixed: 0.6, percentage: 0 });
  });

  it('charges 60c wherever nothing was negotiated', () => {
    for (const org of ORGS) {
      const charged = org.applicationFee ?? ORG_TYPE.applicationFee;
      expect({ club: org.urlCode, percentage: charged.percentage }).toEqual({
        club: org.urlCode,
        percentage: 0,
      });
    }
  });

  /*
   * One club on its own rate, which is what makes copy-on-create visible.
   *
   * Each organisation gets its own application-fee row when it is created, and
   * that row is what the platform charges from then on — editing the type does
   * not reach back and rewrite a rate a club has already agreed. With every
   * club on the default, "copied from the type" and "read from the type" look
   * identical until somebody edits the type.
   */
  it('keeps one club on a negotiated rate', () => {
    const negotiated = ORGS.filter(
      (org) => org.applicationFee && org.applicationFee.fixed !== ORG_TYPE.applicationFee.fixed
    );

    expect(negotiated.map((org) => org.urlCode)).toEqual(['lhpc']);
    expect(negotiated[0].applicationFee).toEqual({ fixed: 0.45, percentage: 0 });
  });
});

/**
 * Refunds.
 *
 * The seed used to set a membership payment's status to `refunded` and record
 * no refund at all, so the payment's own history and the Refunds screen were
 * both empty against data claiming a refund had happened.
 */
describe('seed refunds', () => {
  it('names a basket or a payer, so each refund can find its payment', () => {
    // Matched by basket where several purchases shared one payment, and by
    // payer where the payment has no basket name of its own.
    for (const refund of REFUNDS) {
      expect({ [refund.reason]: Boolean(refund.basket) !== Boolean(refund.email) }).toEqual({
        [refund.reason]: true,
      });
    }
  });

  it('points every basket-matched refund at a basket that exists', () => {
    const baskets = new Set(
      [...ENTRIES, ...MEMBERS, ...SHOP_ORDERS, ...REGISTRATIONS]
        .map((line) => line.basket)
        .filter(Boolean)
    );

    for (const refund of REFUNDS.filter((r) => r.basket)) {
      expect({ [refund.basket!]: baskets.has(refund.basket!) }).toEqual({
        [refund.basket!]: true,
      });
    }
  });

  it('points every payer-matched refund at a payment that was refunded', () => {
    /*
     * A refund of the whole payment is what makes the payment `refunded`, so a
     * fixture naming a payer must name one whose membership says so — otherwise
     * it silently matches nothing and the screen is empty again.
     */
    for (const refund of REFUNDS.filter((r) => r.email)) {
      const refundedPayments = MEMBERS.filter(
        (member) =>
          member.email === refund.email &&
          member.org === refund.org &&
          member.paymentStatus === 'refunded'
      );
      expect({ [refund.email!]: refundedPayments.length > 0 }).toEqual({
        [refund.email!]: true,
      });
    }
  });

  it('covers the states the Refunds screen has to tell apart', () => {
    // A whole payment returned, one item of one, and one still to be sent.
    expect(REFUNDS.some((r) => !r.amountMinor && !r.item)).toBe(true);
    expect(REFUNDS.some((r) => r.item)).toBe(true);
    expect(REFUNDS.some((r) => r.status === 'pending')).toBe(true);
    expect(REFUNDS.some((r) => r.status === 'completed')).toBe(true);
  });

  it('names an item rather than an amount for a part refund', () => {
    /*
     * A seeded refund used to name the item in its *reason* and link to
     * nothing, so the screens disagreed: the refund said the cap had gone back
     * and the cap said it was paid for. An amount refund attributable to one
     * item is that item's refund.
     */
    expect(REFUNDS.filter((refund) => refund.amountMinor)).toHaveLength(0);
  });

  it('describes each refunded item well enough to match one line', () => {
    // Two children entered in the same class produce two identical
    // descriptions, so those refunds name the entrant as well.
    const ambiguous = ['80cm', '1.00m', 'Novice'];

    for (const refund of REFUNDS.filter((r) => r.item)) {
      const description = refund.item!.description ?? '';
      const sameClassTwice = ENTRIES.filter(
        (entry) => entry.basket === refund.basket && entry.activity.includes(description)
      );

      if (sameClassTwice.length > 1 || ambiguous.includes(description)) {
        expect({ [refund.reason]: Boolean(refund.item!.subject || sameClassTwice.length <= 1) })
          .toEqual({ [refund.reason]: true });
      }
    }
  });

  it('gives every refund a reason a club would recognise', () => {
    // The reason is the whole point of the record; a blank one is a refund
    // nobody can account for afterwards.
    for (const refund of REFUNDS) {
      expect(refund.reason.length).toBeGreaterThan(20);
    }
  });
});

/**
 * Bookings.
 *
 * The calendars, their slots and their blocked periods were all seeded and no
 * booking ever was — so no payment anywhere carried a `booking` line, and
 * neither the payment screens nor the click-through to a booking could be
 * checked against one.
 */
describe('seed bookings', () => {
  const calendarFor = (key: string) => CALENDARS.find((calendar) => calendar.key === key);

  it('books a calendar that exists, in the club that owns it', () => {
    for (const booking of BOOKINGS) {
      const calendar = calendarFor(booking.calendar);
      expect({ [booking.calendar]: calendar?.org }).toEqual({ [booking.calendar]: booking.org });
    }
  });

  it('books a slot and a duration the calendar actually offers', () => {
    /*
     * A booking outside its own slot is a state the application cannot produce,
     * and its price would have to be invented — the fee comes from the duration
     * option, not from the fixture.
     */
    for (const booking of BOOKINGS) {
      const slot = calendarFor(booking.calendar)?.slots.find(
        (candidate) => candidate.startTime === booking.startTime
      );
      const duration = slot?.durations.find(([minutes]) => minutes === booking.duration);
      expect({ [`${booking.calendar} ${booking.startTime}`]: Boolean(duration) }).toEqual({
        [`${booking.calendar} ${booking.startTime}`]: true,
      });
    }
  });

  it('keeps every booking clear of its calendar’s blocked periods', () => {
    // A time segment blocked for harrowing is not bookable, and a seeded
    // booking inside one contradicts the screen that refuses to make it.
    for (const booking of BOOKINGS) {
      for (const period of calendarFor(booking.calendar)?.blocked ?? []) {
        if (period.type !== 'time_segment' || !period.startTime || !period.endTime) continue;
        const inside =
          booking.startTime >= period.startTime && booking.startTime < period.endTime;
        expect({ [`${booking.email} ${booking.startTime}`]: inside }).toEqual({
          [`${booking.email} ${booking.startTime}`]: false,
        });
      }
    }
  });

  it('books under a member of the club', () => {
    for (const booking of BOOKINGS) {
      const user = ACCOUNT_USERS.find((candidate) => candidate.email === booking.email);
      expect({ [booking.email]: user?.orgs.includes(booking.org) }).toEqual({
        [booking.email]: true,
      });
    }
  });

  it('covers the cases the payment screens branch on', () => {
    // One on its own, several in a basket, one owed offline, one past, one
    // cancelled.
    expect(BOOKINGS.some((booking) => !booking.basket)).toBe(true);
    expect(BOOKINGS.filter((booking) => booking.basket === 'walsh-arena-day').length).toBe(2);
    expect(BOOKINGS.some((booking) => booking.payment === 'offline')).toBe(true);
    expect(BOOKINGS.some((booking) => booking.daysFromNow < 0)).toBe(true);
    expect(BOOKINGS.some((booking) => booking.status === 'cancelled')).toBe(true);
  });

  it('gives the bookings sharing a basket one booking day', () => {
    /*
     * They were paid for in one go. Left to the default — a fortnight before
     * each slot — two lines of one payment would have been booked on different
     * days.
     */
    const shared = BOOKINGS.filter((booking) => booking.basket === 'walsh-arena-day');
    const days = new Set(shared.map((booking) => booking.bookedDaysAgo));

    expect(days.size).toBe(1);
    expect([...days][0]).toBeDefined();
  });
});

/**
 * Electronic tickets.
 *
 * The seed configured one event for tickets and issued **none**, so the whole
 * module — the issued/scanned/remaining cards, the scan history, a ticket's own
 * dialog — had nothing to show. A ticket is issued for every entry on a
 * ticketing event, which is what fulfilment does; what the fixture says is what
 * happened to it afterwards.
 */
describe('seed tickets', () => {
  const ticketed = EVENTS.filter((event) => event.ticketing);

  it('has a ticketed event that has already run, and one still to come', () => {
    /*
     * Both, deliberately. Before the day a club looks at tickets issued and
     * none scanned; afterwards it looks at who came. With only a future event
     * in the fixture, a scan would have to be dated in the future — a state a
     * gate cannot produce.
     */
    expect(ticketed.some((event) => event.startDays < 0)).toBe(true);
    expect(ticketed.some((event) => event.startDays > 0)).toBe(true);
  });

  it('gives every ticketed event entries to issue tickets for', () => {
    for (const event of ticketed) {
      const entries = ENTRIES.filter((entry) => entry.event === event.key);
      expect({ [event.name]: entries.length > 0 }).toEqual({ [event.name]: true });
    }
  });

  it('names a ticket state only on an event that issues tickets', () => {
    // Anywhere else it would silently do nothing, which is the kind of fixture
    // that reads as covered and is not.
    for (const entry of ENTRIES.filter((candidate) => candidate.ticket)) {
      const event = EVENTS.find((candidate) => candidate.key === entry.event);
      expect({ [entry.event]: Boolean(event?.ticketing) }).toEqual({ [entry.event]: true });
    }
  });

  it('covers every state a ticket can be in', () => {
    const states = new Set(
      ENTRIES.filter((entry) => entry.ticket).map((entry) => entry.ticket!.state)
    );

    // Admitted, presented twice, never used, and called off.
    expect(states).toEqual(new Set(['scanned', 'scannedTwice', 'issued', 'cancelled']));
  });

  it('scans no ticket at a gate that has not opened', () => {
    /*
     * A ticket scanned at a future gate is a fiction. **Today's** gate is not:
     * the fixture now has an event running today, half of whose tickets went
     * through the gate this morning and half of which are still waiting — which
     * is the only state the scanner can actually be tried in, and the reason
     * the rule is `<= 0` rather than `< 0`.
     */
    for (const entry of ENTRIES.filter((candidate) =>
      candidate.ticket?.state.startsWith('scanned')
    )) {
      const event = EVENTS.find((candidate) => candidate.key === entry.event)!;
      expect({ [event.name]: event.startDays <= 0 }).toEqual({ [event.name]: true });
    }
  });

  it('leaves tickets to be scanned on an event happening now', () => {
    /*
     * The gap this closes. A past event's tickets are expired and a future
     * event's cannot honestly be scanned, so before this the scanner had
     * nothing valid to work on: every seeded ticket was either used up or not
     * yet live.
     */
    const today = EVENTS.filter((event) => event.ticketing && event.startDays === 0);
    expect(today.length).toBeGreaterThan(0);

    for (const event of today) {
      const waiting = ENTRIES.filter(
        (entry) => entry.event === event.key && (entry.ticket?.state ?? 'issued') === 'issued'
      );
      expect({ [event.name]: waiting.length }).toEqual({
        [event.name]: expect.any(Number),
      });
      expect(waiting.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('enters every ticketed entry before its event ran', () => {
    // Entering after the gate closed is not a state the application produces.
    for (const entry of ENTRIES.filter((candidate) => candidate.ticket)) {
      const event = EVENTS.find((candidate) => candidate.key === entry.event)!;
      expect({ [entry.firstName]: -entry.enteredDaysAgo < event.startDays }).toEqual({
        [entry.firstName]: true,
      });
    }
  });
});

/**
 * A name is asked for once.
 *
 * "Who is this entry for?" is answered on the entry — chosen from the member
 * list or typed — and written to `event_entries.first_name` / `last_name`. An
 * entry form that asks for it again produces two names for one entrant that
 * nothing reconciles: pick a child from the list, type something else on the
 * form, and the entry says one thing and its answers another.
 */
describe('seed forms do not ask who the record is for', () => {
  /** The forms an event activity actually uses. */
  const entryForms = new Set(
    EVENTS.flatMap((event) => event.activities.map((activity) => activity.form)).filter(Boolean)
  );

  it('leaves the name to the entry on every form an activity uses', () => {
    for (const key of entryForms) {
      const form = FORMS.find((candidate) => candidate.key === key)!;
      const asks = form.fields.filter((field) => field.field === 'riderName');

      expect({ [form.key]: asks.map((field) => field.field) }).toEqual({ [form.key]: [] });
    }
  });

  it('leaves it to the application on a membership form', () => {
    /*
     * "Who is this membership for?" is asked by the application itself and
     * travels to `createMembership`. A membership used to take the **account
     * holder's** name whatever the form said, so a parent joining three
     * children produced three records all reading the same thing — and the
     * form's answer went nowhere.
     */
    for (const key of ['membershipSingle', 'membershipFamily']) {
      const form = FORMS.find((candidate) => candidate.key === key)!;
      expect(form.fields.some((field) => field.field === 'riderName')).toBe(false);
    }
  });

  it('has no name field in the library at all', () => {
    /*
     * Not merely unused: a `rider_name` sitting in every club's field library
     * is an invitation to put the question back on a form, where its answer is
     * a second name nothing reconciles with the first.
     */
    expect(FIELDS.some((field) => field.key === 'riderName')).toBe(false);
    expect(FORMS.some((form) => form.fields.some((f) => f.field === 'riderName'))).toBe(false);
  });

  it('still names the horse on a registration form', () => {
    // A registration is about an *animal*: there is no "who is this for" box
    // for one, so the form is where its name is asked.
    const form = FORMS.find((candidate) => candidate.key === 'horseRegistration')!;
    expect(form.fields.some((field) => field.field === 'horseName')).toBe(true);
  });

  it('leaves every form with something to ask', () => {
    // A form with no fields is a step in the journey that shows nothing.
    for (const form of FORMS) {
      expect({ [form.key]: form.fields.length > 0 }).toEqual({ [form.key]: true });
    }
  });
});
