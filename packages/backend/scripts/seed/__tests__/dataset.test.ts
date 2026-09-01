import {
  ACCOUNT_USERS,
  ENTRIES,
  EVENTS,
  FIELDS,
  FORMS,
  MEMBERS,
  ORGS,
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
      'riderName', 'riderDob', 'riderEmail', 'riderPhone', 'ageGroup',
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
