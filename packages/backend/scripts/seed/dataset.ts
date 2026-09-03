/**
 * The demo dataset, declared rather than generated.
 *
 * Every date is expressed as an offset in days from the moment the seed runs,
 * so "closing soon" is still closing soon a fortnight from now. A fixed
 * calendar would go stale within a week and quietly stop exercising the cases
 * it was written for.
 *
 * The dataset is deliberately hand-written rather than faked. The point of this
 * seed is to reach specific states — an event whose entries have not opened, an
 * activity capped at eight places, a discount that expired last month — and a
 * generator produces plausible data that happens to miss exactly those.
 */

/** Marks everything this script creates, in Keycloak and in the database. */
export const SEED_TAG = 'itsplainsailing-demo';

/** Password for every seeded login. Non-temporary, so nobody hits a reset wall. */
export const SEED_PASSWORD = 'Passw0rd!';

export const ORG_TYPE = {
  name: 'irish-pony-clubs',
  displayName: 'Irish Pony Clubs',
  description: 'Pony clubs affiliated to the Irish Pony Club association.',
  currency: 'EUR',
  language: 'en',
  defaultLocale: 'en-GB',
  membershipNumbering: 'internal' as const,
  membershipNumberUniqueness: 'organization' as const,
  initialMembershipNumber: 100000,
  /**
   * **Every name here must exist in the `capabilities` table.**
   *
   * Nothing validates the seed itself, but the admin API validates any *edit*
   * to what it wrote — so a name that is not a capability produces a record
   * that can be created and never saved again. Editing this type's application
   * fee failed with "Invalid capabilities provided" for exactly that reason,
   * naming nothing and blaming a field the administrator had not touched.
   *
   * `discounts`, `email-notifications` and `document-uploads` were three such
   * names: plausible, gating nothing, and in no catalogue. The real discount
   * capabilities are per-module — `entry-discounts`, `membership-discounts` and
   * the rest — and are listed individually below.
   */
  defaultCapabilities: [
    'event-management',
    'event-types',
    'venues',
    'entry-discounts',
    'memberships',
    'membership-discounts',
    'merchandise',
    'calendar-bookings',
    'payment-processing',
    'reporting',
    'public-search',
    'document-management',
    /*
     * The rest of the platform's capability catalogue, permitted by the type so
     * that a club *can* switch them on. Every one of these is also listed in
     * `optInCapabilities` below, so adding them here does not quietly turn them
     * on for the three clubs that were seeded before they existed — only Meath
     * takes them.
     */
    'registrations',
    'registration-discounts',
    'event-ticketing',
    'entry-restrictions',
    'calendar-discounts',
    'merchandise-discounts',
    'multi-area-discounts',
    'org-announcements',
    /*
     * Deliberately **not** in `optInCapabilities`, so every club in the type
     * gets it.
     *
     * The federation entry option is only interesting when more than one club
     * has it: one club opens an event, and the others' account users are the
     * ones who have to see it. Giving it to a single club would seed a feature
     * with nobody on the other side of it.
     */
    'organisation-level-members',
  ],
  /**
   * Permitted by the type but **not** switched on for every club.
   *
   * An organisation's `enabled_capabilities` must be a subset of its type's
   * defaults — `organization.service` rejects anything outside them — so a
   * capability one club wants still has to be listed above. Naming the opt-in
   * ones here keeps "the type allows this" and "this club uses it" separate,
   * which is the distinction the capability handshake is built on.
   */
  optInCapabilities: [
    'merchandise',
    'calendar-bookings',
    'registrations',
    'registration-discounts',
    'event-ticketing',
    'entry-restrictions',
    'calendar-discounts',
    'merchandise-discounts',
    'multi-area-discounts',
    'org-announcements',
  ],
  /**
   * The platform's cut, inherited as the default by each organisation.
   *
   * 60c fixed, on every club that can take a card payment. Ward Union has no
   * card method switched on, so it has no card payment for a share to be taken
   * from and keeps nulls — that is an absence, not a zero.
   */
  applicationFee: { fixed: 0.6, percentage: 0 },
  /**
   * What the member pays on a card payment, and the VAT on it.
   *
   * `taxPercentage` is charged on the **handling fee**, never on the order —
   * the club's entries and shirts are priced as the club prices them, and 23%
   * of a €25 entry is not what this is. It applies to the 25c + 1.5% only.
   *
   * `fixedFee` is written here in major units, like every other fee in this
   * file, and read back in minor ones by `organizationTypePaymentFeeService`.
   */
  handlingFee: { fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 23 },
};

export interface SeedOrg {
  key: 'kildare' | 'laois' | 'ward' | 'meath';
  name: string;
  displayName: string;
  urlCode: string;
  contactName: string;
  contactEmail: string;
  settings: Record<string, string>;
  /** Which payment methods the club has switched on. */
  paymentMethods: Array<'pay-offline' | 'stripe'>;
  /**
   * Per-organisation platform share. Two clubs diverge from the type default so
   * the copy-on-create behaviour is visible without editing anything.
   */
  applicationFee?: { fixed: number | null; percentage: number | null };
  /** Opt-in capabilities this club switches on, from `ORG_TYPE.optInCapabilities`. */
  extraCapabilities?: string[];
  /**
   * Switch on everything the type permits, rather than listing it.
   *
   * One club has the lot so that every module can be reached from a single
   * login — the org-admin menu, the account app's home rows and the reports all
   * behave differently when a capability is absent, and a demo that needs three
   * sign-ins to see the whole product is a poor demo. Spelled as a flag rather
   * than a copy of the capability list, which would go stale the moment the
   * type gained one.
   */
  allCapabilities?: boolean;
}

/**
 * What a club actually has switched on: everything the type permits by default,
 * less the opt-in ones, plus whatever this club asked for.
 *
 * Used for the organisation's `enabled_capabilities` *and* for its admin role's
 * permissions. Granting the role a capability the club does not have would give
 * an administrator menu entries leading to endpoints that refuse them.
 */
export const capabilitiesFor = (org: SeedOrg): string[] =>
  org.allCapabilities
    ? [...ORG_TYPE.defaultCapabilities]
    : [
        ...ORG_TYPE.defaultCapabilities.filter((c) => !ORG_TYPE.optInCapabilities.includes(c)),
        ...(org.extraCapabilities ?? []),
      ];

export const ORGS: SeedOrg[] = [
  {
    key: 'kildare',
    name: 'kildare-hunt-pony-club',
    displayName: 'Kildare Hunt Pony Club',
    urlCode: 'khpc',
    contactName: 'Aoife Byrne',
    contactEmail: 'secretary@kildarehunt.test',
    settings: {
      address: 'Craddockstown, Naas',
      city: 'Naas',
      postcode: 'W91 X2R7',
      country: 'Ireland',
      phone: '+353 45 123 456',
      website: 'https://kildarehunt.test',
    },
    // Both methods, so activities can offer card, offline or either.
    paymentMethods: ['pay-offline', 'stripe'],
    /*
     * A shop, and notices. Kildare is the club a demo signs into as a member,
     * so it is the one that needs a home page with a right-hand column —
     * while Laois and Ward Union keep the plain page, which is the case that
     * has to keep working.
     */
    extraCapabilities: ['merchandise', 'org-announcements'],
  },
  {
    key: 'laois',
    name: 'laois-hunt-pony-club',
    displayName: 'Laois Hunt Pony Club',
    urlCode: 'lhpc',
    contactName: 'Seán Delaney',
    contactEmail: 'secretary@laoishunt.test',
    settings: {
      address: 'Ballyroan',
      city: 'Portlaoise',
      postcode: 'R32 KP80',
      country: 'Ireland',
      phone: '+353 57 987 654',
      website: 'https://laoishunt.test',
    },
    paymentMethods: ['pay-offline', 'stripe'],
    // The only club taking bookings, so "capability off" stays represented.
    extraCapabilities: ['calendar-bookings'],
    /*
     * The one club on its own rate: 45c rather than the type's 60c.
     *
     * It is here to make copy-on-create visible. Each organisation gets its own
     * application-fee row when it is created, and that row is what the platform
     * charges from then on — changing the type's rate does not reach back and
     * rewrite a rate a club has already agreed. Without a club that differs,
     * nothing in the fixture distinguishes "copied from the type" from "read
     * from the type", and the two behave identically until somebody edits the
     * type.
     *
     * Negotiated on the amount, because the amount is all there is now: the
     * platform's share carries no percentage.
     */
    applicationFee: { fixed: 0.45, percentage: 0 },
  },
  {
    key: 'ward',
    name: 'ward-union-pony-club',
    displayName: 'Ward Union Pony Club',
    urlCode: 'wupc',
    contactName: 'Máire Ní Fhloinn',
    contactEmail: 'secretary@wardunion.test',
    settings: {
      address: 'Ashbourne',
      city: 'Ashbourne',
      postcode: 'A84 F660',
      country: 'Ireland',
      phone: '+353 1 835 0000',
      website: 'https://wardunion.test',
    },
    // Offline only — every activity here must fall back to offline payment,
    // which is the case that catches code assuming a card method exists.
    paymentMethods: ['pay-offline'],
    /*
     * The type default, like Kildare and Meath — 60c applies to every club.
     *
     * It buys nothing today: this club takes no card payments, and an
     * application fee is a share of one. It is set so that the day Ward Union
     * switches Stripe on, the platform's share is already what it is
     * everywhere else rather than nothing at all. Explicit nulls used to sit
     * here to demonstrate an unconfigured club; a club that quietly pays no
     * share is a worse thing to have in a fixture than a missing example.
     */
  },
  {
    key: 'meath',
    name: 'meath-hunt-pony-club',
    displayName: 'Meath Hunt Pony Club',
    urlCode: 'mhpc',
    contactName: 'Deirdre Ó Ceallaigh',
    contactEmail: 'secretary@meathhunt.test',
    settings: {
      address: 'Kilmessan',
      city: 'Navan',
      postcode: 'C15 T891',
      country: 'Ireland',
      phone: '+353 46 902 1234',
      website: 'https://meathhunt.test',
    },
    paymentMethods: ['pay-offline', 'stripe'],
    /*
     * The everything club. The other three each leave something switched off on
     * purpose, so between them no single login reaches the whole product —
     * useful for testing the absence of a capability, useless for showing
     * somebody what the platform does. This one has the lot, including the
     * registrations and ticketing that nothing else exercises.
     */
    allCapabilities: true,
  },
];

export const SUPER_ADMIN = {
  email: 'super.admin@itsplainsailing.test',
  firstName: 'Sam',
  lastName: 'Platform',
};

/**
 * Administrators who also administer somebody else's club.
 *
 * One person, several clubs — the same shape the account users have had all
 * along. Kildare's administrator also runs Laois, so signing in as
 * `admin@kildarehunt.test` exercises the switcher, the per-organisation
 * capability resolution and the per-organisation role check, none of which an
 * administrator of one club can demonstrate.
 *
 * Laois deliberately: its capabilities differ from Kildare's, so switching
 * visibly changes the navigation rather than only the name in the bar.
 *
 * See docs/ORGADMIN_MULTI_ORGANISATION.md.
 */
export const ORG_ADMIN_ALSO_ADMINISTERS: Partial<Record<SeedOrg['key'], SeedOrg['key'][]>> = {
  kildare: ['laois'],
};

export const ORG_ADMINS: Record<SeedOrg['key'], { email: string; firstName: string; lastName: string }> = {
  kildare: { email: 'admin@kildarehunt.test', firstName: 'Aoife', lastName: 'Byrne' },
  laois: { email: 'admin@laoishunt.test', firstName: 'Seán', lastName: 'Delaney' },
  ward: { email: 'admin@wardunion.test', firstName: 'Máire', lastName: 'Ní Fhloinn' },
  meath: { email: 'admin@meathhunt.test', firstName: 'Deirdre', lastName: 'Ó Ceallaigh' },
};

/**
 * The people who can log in.
 *
 * The overlap between clubs is the point. Two people belong to all three and
 * three to exactly two, which is what exercises the organisation switcher
 * (screen A7) and the "which club am I acting as" resolution. Unrelated people
 * in each club would leave that path untested.
 *
 * Note that this is **not** the list of members. A membership belongs to a
 * person, who may have no login of their own: `MEMBERS` below has parents
 * holding their children's memberships, and those children appear nowhere here.
 */
export interface SeedAccountUser {
  email: string;
  firstName: string;
  lastName: string;
  orgs: Array<SeedOrg['key']>;
  /** `pending` exercises the awaiting-approval screen (A8). */
  status?: 'active' | 'pending';
}

export const ACCOUNT_USERS: SeedAccountUser[] = [
  { email: 'niamh.walsh@example.test', firstName: 'Niamh', lastName: 'Walsh', orgs: ['kildare', 'laois', 'ward', 'meath'] },
  { email: 'cillian.murphy@example.test', firstName: 'Cillian', lastName: 'Murphy', orgs: ['kildare', 'laois', 'ward'] },
  { email: 'orla.kavanagh@example.test', firstName: 'Órla', lastName: 'Kavanagh', orgs: ['kildare', 'laois'] },
  { email: 'darragh.otoole@example.test', firstName: 'Darragh', lastName: "O'Toole", orgs: ['laois', 'ward', 'meath'] },
  { email: 'fionn.doyle@example.test', firstName: 'Fionn', lastName: 'Doyle', orgs: ['kildare', 'ward'] },
  { email: 'saoirse.brennan@example.test', firstName: 'Saoirse', lastName: 'Brennan', orgs: ['kildare'] },
  { email: 'ruairi.kelly@example.test', firstName: 'Ruairí', lastName: 'Kelly', orgs: ['laois'] },
  // Left pending so the awaiting-approval path has a subject.
  { email: 'tadhg.nolan@example.test', firstName: 'Tadhg', lastName: 'Nolan', orgs: ['ward'], status: 'pending' },
  /*
   * The rest exist so the member database has enough people to be worth
   * filtering — every membership type wants more than one member. Áine and
   * Lorcán are the two parents, each holding memberships for children who have
   * no login of their own.
   */
  { email: 'aine.mcgrath@example.test', firstName: 'Áine', lastName: 'McGrath', orgs: ['kildare'] },
  { email: 'padraig.quinn@example.test', firstName: 'Pádraig', lastName: 'Quinn', orgs: ['kildare'] },
  { email: 'sinead.gallagher@example.test', firstName: 'Sinéad', lastName: 'Gallagher', orgs: ['kildare', 'laois'] },
  { email: 'oisin.farrell@example.test', firstName: 'Oisín', lastName: 'Farrell', orgs: ['laois'] },
  { email: 'clodagh.moran@example.test', firstName: 'Clodagh', lastName: 'Moran', orgs: ['laois'] },
  { email: 'eoin.sheridan@example.test', firstName: 'Eoin', lastName: 'Sheridan', orgs: ['laois'] },
  { email: 'grainne.duffy@example.test', firstName: 'Gráinne', lastName: 'Duffy', orgs: ['ward'] },
  /*
   * Two people who belong to exactly one club and hold its membership.
   *
   * They took over the Ward senior and associate memberships from Niamh Walsh
   * and Darragh O'Toole, who each held memberships in several clubs at once —
   * which a person cannot do. See the note on `MEMBERS`.
   *
   * Single-club members are also the realistic subject for the federation entry
   * option: someone whose one membership is at Ward Union, entering a Kildare
   * event that is open across the type.
   */
  { email: 'eoin.brady@example.test', firstName: 'Eoin', lastName: 'Brady', orgs: ['ward'] },
  { email: 'maire.flynn@example.test', firstName: 'Máire', lastName: 'Flynn', orgs: ['ward'] },
  { email: 'lorcan.hayes@example.test', firstName: 'Lorcán', lastName: 'Hayes', orgs: ['ward'] },
  /*
   * Meath-only members, and the owners of the registered horses below.
   *
   * Niamh and Darragh above also belong here, so the club with every capability
   * is reachable from an account that has to switch into it — the case where
   * the menu changes shape between organisations.
   */
  { email: 'brid.mcnamara@example.test', firstName: 'Bríd', lastName: 'McNamara', orgs: ['meath'] },
  { email: 'colm.fitzgerald@example.test', firstName: 'Colm', lastName: 'Fitzgerald', orgs: ['meath'] },
  { email: 'aoibhinn.regan@example.test', firstName: 'Aoibhínn', lastName: 'Regan', orgs: ['meath'] },
  { email: 'seamus.donnelly@example.test', firstName: 'Séamus', lastName: 'Donnelly', orgs: ['meath'] },
  { email: 'maeve.kiernan@example.test', firstName: 'Maeve', lastName: 'Kiernan', orgs: ['meath'] },
];

/* ------------------------------------------------------------------ forms */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'time'
  | 'datetime' | 'boolean' | 'select' | 'multiselect' | 'radio' | 'checkbox';

export interface SeedField {
  key: string;
  /**
   * The machine name, shared by all four clubs.
   *
   * This is the platform's canonical name for the field and the key a
   * submission's answers are stored under, so it stays common; the *label* is
   * what a club sees, and what identifies the row as its own.
   */
  name: string;
  /**
   * What each club calls this field — **one label per organisation**, and all
   * 160 of them are different.
   *
   * The Fields list and the form builder's field picker both show the label, so
   * while every club's forty fields read identically there was no way to tell a
   * correctly scoped list from one quietly showing all four clubs' — the
   * fixture hiding exactly the kind of fault it exists to expose. See
   * docs/CROSS_ORGANISATION_ACCESS_FIX.md.
   *
   * Each club has its own vocabulary, so a field under the wrong one announces
   * itself: Kildare speaks of a **Rider** and a **Pony**, Laois of a
   * **Competitor** and a **Horse**, Ward Union of a **Member**, a **Mount** and
   * "the register", and Meath Hunt writes its fields out longhand around an
   * **Entrant**.
   *
   * A `Record` over every org key, so a field added without a label for one of
   * the clubs fails to compile rather than silently borrowing another's.
   */
  label: Record<SeedOrg['key'], string>;
  datatype: FieldType;
  description?: string;
  options?: string[];
  validation?: Record<string, unknown>;
}

/**
 * One field of every type the Forms area offers, so a form can be assembled to
 * exercise any renderer. `file` and `image` are omitted deliberately: they need
 * the document-upload storage path configured, and a seeded form that half
 * works is worse than one that does not claim to.
 */
export const FIELDS: SeedField[] = [
  /*
   * No name field in the library at all.
   *
   * Both journeys that create a record about a person now ask for the name
   * themselves — "Who is this entry for?" and "Who is this membership for?" —
   * and write it to the record. A `rider_name` field sitting in every club's
   * field library is an invitation to put the question back on a form, where
   * its answer is a second name that nothing reconciles with the first.
   *
   * Registrations are the exception and keep their own: a registration is about
   * a *horse*, and `entity_name` is asked on the form because there is no
   * "who is this for" box for an animal.
   */
  {
    key: 'riderDob', name: 'rider_dob', datatype: 'date', validation: { required: true },
    label: { kildare: 'Rider date of birth', laois: 'Competitor date of birth', ward: 'Member date of birth', meath: 'Entrant date of birth' },
  },
  {
    key: 'riderEmail', name: 'rider_email', datatype: 'email', validation: { required: true },
    label: { kildare: 'Rider email address', laois: 'Competitor email address', ward: 'Member email address', meath: 'Entrant email address' },
  },
  {
    key: 'riderPhone', name: 'rider_phone', datatype: 'phone',
    label: { kildare: 'Rider mobile number', laois: 'Competitor mobile number', ward: 'Member mobile number', meath: 'Entrant mobile number' },
  },
  {
    key: 'ageGroup', name: 'age_group', datatype: 'select', options: ['Under 12', '12–14', '15–17', '18+'], validation: { required: true },
    label: { kildare: 'Rider age group', laois: 'Competitor age group', ward: 'Member age group', meath: 'Entrant age group' },
  },
  {
    key: 'ponyName', name: 'pony_name', datatype: 'text', validation: { required: true },
    label: { kildare: 'Pony name', laois: 'Horse name', ward: 'Mount name', meath: 'Pony or horse name' },
  },
  {
    key: 'ponyHeight', name: 'pony_height', datatype: 'number', description: 'To one decimal place, e.g. 14.2', validation: { min: 8, max: 19 },
    label: { kildare: 'Pony height (hands)', laois: 'Horse height (hands)', ward: 'Mount height (hands)', meath: 'Pony height in hands' },
  },
  {
    key: 'ponyBreed', name: 'pony_breed', datatype: 'select', options: ['Connemara', 'Irish Sport Horse', 'Welsh', 'Thoroughbred', 'Other'],
    label: { kildare: 'Pony breed', laois: 'Horse breed', ward: 'Mount breed', meath: 'Pony or horse breed' },
  },
  {
    key: 'vaccinated', name: 'vaccination_status', datatype: 'radio', options: ['Up to date', 'Due within 30 days', 'Not vaccinated'], validation: { required: true },
    label: { kildare: 'Pony vaccination status', laois: 'Horse vaccination status', ward: 'Mount vaccination status', meath: 'Vaccination status of the pony' },
  },
  {
    key: 'gradeLevel', name: 'grade_level', datatype: 'radio', options: ['Grade 1', 'Grade 2', 'Grade 3', 'Ungraded'],
    label: { kildare: 'Rider grade', laois: 'Competitor grade', ward: 'Member grade', meath: 'Entrant grade' },
  },
  {
    key: 'dietary', name: 'dietary_requirements', datatype: 'multiselect', options: ['None', 'Vegetarian', 'Vegan', 'Gluten free', 'Dairy free', 'Nut allergy'],
    label: { kildare: 'Rider dietary requirements', laois: 'Competitor dietary requirements', ward: 'Member dietary requirements', meath: 'Entrant dietary requirements' },
  },
  {
    key: 'sessions', name: 'preferred_sessions', datatype: 'checkbox', options: ['Morning', 'Afternoon', 'Both'],
    label: { kildare: 'Preferred camp sessions', laois: 'Preferred sessions', ward: 'Sessions wanted', meath: 'Sessions the entrant prefers' },
  },
  {
    key: 'arrivalTime', name: 'arrival_time', datatype: 'time',
    label: { kildare: 'Expected arrival time', laois: 'Arrival time', ward: 'Time of arrival', meath: 'What time the entrant will arrive' },
  },
  {
    key: 'stablingFrom', name: 'stabling_from', datatype: 'datetime',
    label: { kildare: 'Stabling required from', laois: 'Stabling needed from', ward: 'Stabling from', meath: 'Stabling start date and time' },
  },
  {
    key: 'medicalNotes', name: 'medical_notes', datatype: 'textarea', description: 'Anything the organisers should know on the day.',
    label: { kildare: 'Rider medical notes', laois: 'Competitor medical notes', ward: 'Member medical notes', meath: 'Entrant medical notes' },
  },
  {
    key: 'transportNeeded', name: 'transport_needed', datatype: 'boolean',
    label: { kildare: 'Transport required?', laois: 'Transport needed?', ward: 'Needs transport?', meath: 'Does the entrant need transport?' },
  },
  {
    key: 'firstAider', name: 'is_first_aider', datatype: 'boolean',
    label: { kildare: 'Willing to help as a first aider', laois: 'Can help as a first aider', ward: 'Available as a first aider', meath: 'Happy to be called on as a first aider' },
  },
  {
    key: 'emergencyName', name: 'emergency_contact_name', datatype: 'text', validation: { required: true },
    label: { kildare: 'Emergency contact name', laois: 'Emergency contact — name', ward: 'Next of kin name', meath: 'Who to call in an emergency' },
  },
  {
    key: 'emergencyPhone', name: 'emergency_contact_phone', datatype: 'phone', validation: { required: true },
    label: { kildare: 'Emergency contact number', laois: 'Emergency contact — number', ward: 'Next of kin number', meath: 'Emergency telephone number' },
  },
  {
    key: 'yearsRiding', name: 'years_riding', datatype: 'number', validation: { min: 0, max: 80 },
    label: { kildare: 'Years riding', laois: 'Years competing', ward: 'Years in the saddle', meath: 'How many years the entrant has ridden' },
  },
  {
    key: 'addressLine', name: 'address_line', datatype: 'text', validation: { required: true, maxLength: 200 },
    label: { kildare: 'Rider address', laois: 'Competitor address', ward: 'Member address', meath: 'Entrant address' },
  },
  {
    key: 'county', name: 'county', datatype: 'select', options: ['Kildare', 'Laois', 'Meath', 'Dublin', 'Other'], validation: { required: true },
    label: { kildare: 'Rider county', laois: 'Competitor county', ward: 'Member county', meath: 'Entrant county' },
  },
  {
    key: 'guardianName', name: 'guardian_name', datatype: 'text', description: 'Required for members under 18.',
    label: { kildare: 'Parent or guardian', laois: 'Parent or guardian name', ward: 'Responsible adult', meath: 'Name of parent or guardian' },
  },
  {
    key: 'guardianPhone', name: 'guardian_phone', datatype: 'phone',
    label: { kildare: 'Parent or guardian number', laois: 'Parent or guardian telephone', ward: 'Responsible adult number', meath: 'Telephone for parent or guardian' },
  },
  {
    key: 'photoConsent', name: 'photo_consent', datatype: 'boolean',
    label: { kildare: 'Consent to photographs at club events', laois: 'Photography consent', ward: 'Consent to photographs at meets', meath: 'May we photograph the entrant?' },
  },

  /*
   * Horse registration.
   *
   * A registration is about an **animal**, not a person, and the field names
   * say so: this is the vocabulary of a passport and a vaccination card rather
   * than of a rider. It is the distinction the registrations module exists to
   * make, and reusing the rider fields would have hidden it.
   */
  {
    key: 'horseName', name: 'horse_name', datatype: 'text', validation: { required: true, maxLength: 120 },
    label: { kildare: 'Registered horse name', laois: 'Name of horse', ward: 'Horse name on the register', meath: 'Horse or pony name' },
  },
  {
    key: 'horseStableName', name: 'horse_stable_name', datatype: 'text', description: 'What he answers to at home, if different.',
    label: { kildare: 'Stable name', laois: 'Name at home', ward: 'Yard name', meath: 'Stable name at home' },
  },
  {
    key: 'horseBreed', name: 'horse_breed', datatype: 'select', options: ['Irish Sports Horse', 'Connemara', 'Welsh Section B', 'Welsh Section D', 'Thoroughbred', 'Irish Draught', 'Cob', 'Other'], validation: { required: true },
    label: { kildare: 'Registered horse breed', laois: 'Breed of horse', ward: 'Breed on the register', meath: 'Breed of the registered horse' },
  },
  {
    key: 'horseColour', name: 'horse_colour', datatype: 'select', options: ['Bay', 'Chestnut', 'Grey', 'Black', 'Piebald', 'Skewbald', 'Dun', 'Palomino'], validation: { required: true },
    label: { kildare: 'Registered horse colour', laois: 'Colour of horse', ward: 'Colour on the register', meath: 'Horse colour' },
  },
  {
    key: 'horseSex', name: 'horse_sex', datatype: 'radio', options: ['Mare', 'Gelding', 'Stallion'], validation: { required: true },
    label: { kildare: 'Registered horse sex', laois: 'Sex of horse', ward: 'Sex on the register', meath: 'Horse sex' },
  },
  {
    key: 'horseYearFoaled', name: 'horse_year_foaled', datatype: 'number', validation: { required: true, min: 1990, max: 2026 },
    label: { kildare: 'Year foaled', laois: 'Foaling year', ward: 'Year of foaling', meath: 'What year the horse was foaled' },
  },
  {
    key: 'horseHeight', name: 'horse_height', datatype: 'number', description: 'To the nearest hand, e.g. 14.2 as 14.2.', validation: { required: true },
    label: { kildare: 'Registered horse height (hands)', laois: 'Height of horse (hands)', ward: 'Height on the register (hands)', meath: 'Height of the registered horse (hands)' },
  },
  {
    key: 'horsePassport', name: 'horse_passport', datatype: 'text', description: 'As printed on the equine passport.', validation: { required: true, maxLength: 40 },
    label: { kildare: 'Passport number', laois: 'Equine passport number', ward: 'Passport number on the register', meath: 'Number on the equine passport' },
  },
  {
    key: 'horseMicrochip', name: 'horse_microchip', datatype: 'text', validation: { maxLength: 20 },
    label: { kildare: 'Microchip number', laois: 'Chip number', ward: 'Microchip on the register', meath: 'Microchip number of the horse' },
  },
  {
    key: 'horseOwner', name: 'horse_owner', datatype: 'text', validation: { required: true, maxLength: 120 },
    label: { kildare: 'Registered owner', laois: 'Owner of horse', ward: 'Owner on the register', meath: 'Name of the registered owner' },
  },
  {
    key: 'horseFluVaccine', name: 'horse_flu_vaccine', datatype: 'date', description: 'Must be within the last twelve months to compete.', validation: { required: true },
    label: { kildare: 'Date of last flu vaccination', laois: 'Last flu vaccination', ward: 'Flu vaccination date on the register', meath: 'When the horse last had a flu vaccination' },
  },
  {
    key: 'horseVetName', name: 'horse_vet_name', datatype: 'text',
    label: { kildare: 'Veterinary practice', laois: 'Vet practice', ward: 'Veterinary surgeon', meath: 'Name of the veterinary practice' },
  },
  {
    key: 'horseVetPhone', name: 'horse_vet_phone', datatype: 'phone',
    label: { kildare: 'Veterinary practice number', laois: 'Vet practice telephone', ward: 'Veterinary surgeon number', meath: 'Telephone for the veterinary practice' },
  },
  {
    key: 'horseInsured', name: 'horse_insured', datatype: 'boolean',
    label: { kildare: 'Insured for third-party liability', laois: 'Third-party insurance held', ward: 'Insured against third-party liability', meath: 'Is the horse insured for third-party liability?' },
  },
  {
    key: 'horseNotes', name: 'horse_notes', datatype: 'textarea', description: 'Allergies, quirks, whether he loads.',
    label: { kildare: 'Anything the club should know', laois: 'Anything we should know', ward: 'Notes for the organisers', meath: 'Anything Meath Hunt should know' },
  },
];

export interface SeedForm {
  key: string;
  /**
   * What each club calls this form — **one name per organisation**, and they
   * are all different.
   *
   * A form belongs to one club: the seed writes a separate `application_forms`
   * row per organisation, and a `Record` here rather than a single string is
   * what stops those rows sharing a name. When they did, four identical
   * "Camp booking" forms made it impossible to tell at a glance whether a list
   * was correctly scoped or quietly showing every club's — which is exactly the
   * bug this fixture should have made obvious, and instead camouflaged. See
   * docs/CROSS_ORGANISATION_ACCESS_FIX.md.
   *
   * Typed as a `Record` over every org key, so a form added without a name for
   * one of the clubs fails to compile rather than silently reusing another's.
   * Each club's own vocabulary, and its own venue where the form has one.
   */
  name: Record<SeedOrg['key'], string>;
  description: string;
  /** Field keys, in order. Grouped headings drive the form's sections. */
  fields: Array<{ field: string; group?: string; wizardStep?: number; wizardStepTitle?: string }>;
}

export const FORMS: SeedForm[] = [
  {
    key: 'fullEntry',
    name: {
      kildare: 'Kildare championship entry',
      laois: 'Ballyroan entry form',
      ward: 'Ward Union rider entry',
      meath: 'Meath Hunt full entry',
    },
    description: 'Rider, pony and safety details. Uses every field type the builder offers.',
    /*
     * No name field. The entry already carries one.
     *
     * "Who is this entry for?" is answered on the entry itself — chosen from
     * the member list or typed — and `fulfilment.service` writes it to
     * `event_entries.first_name` / `last_name`. Asking again on the form
     * produced two names for one entrant, never reconciled: pick a child from
     * the list, type something else into the form, and the entry says one thing
     * and its answers another. The entry's own columns are the single answer.
     *
     * The membership and registration forms below **do** ask, and should: a
     * membership takes its name from the account holder, so a household naming
     * each person on a family membership has nowhere else to say it.
     */
    fields: [
      { field: 'riderDob', group: 'Rider', wizardStep: 1, wizardStepTitle: 'Rider' },
      { field: 'riderEmail', group: 'Rider', wizardStep: 1, wizardStepTitle: 'Rider' },
      { field: 'riderPhone', group: 'Rider', wizardStep: 1, wizardStepTitle: 'Rider' },
      { field: 'ageGroup', group: 'Rider', wizardStep: 1, wizardStepTitle: 'Rider' },
      { field: 'yearsRiding', group: 'Rider', wizardStep: 1, wizardStepTitle: 'Rider' },
      { field: 'ponyName', group: 'Pony', wizardStep: 2, wizardStepTitle: 'Pony' },
      { field: 'ponyHeight', group: 'Pony', wizardStep: 2, wizardStepTitle: 'Pony' },
      { field: 'ponyBreed', group: 'Pony', wizardStep: 2, wizardStepTitle: 'Pony' },
      { field: 'vaccinated', group: 'Pony', wizardStep: 2, wizardStepTitle: 'Pony' },
      { field: 'gradeLevel', group: 'Pony', wizardStep: 2, wizardStepTitle: 'Pony' },
      { field: 'emergencyName', group: 'Safety', wizardStep: 3, wizardStepTitle: 'Safety' },
      { field: 'emergencyPhone', group: 'Safety', wizardStep: 3, wizardStepTitle: 'Safety' },
      { field: 'medicalNotes', group: 'Safety', wizardStep: 3, wizardStepTitle: 'Safety' },
      { field: 'firstAider', group: 'Safety', wizardStep: 3, wizardStepTitle: 'Safety' },
    ],
  },
  {
    key: 'campBooking',
    name: {
      kildare: 'Craddockstown camp booking',
      laois: 'Ballyroan camp booking',
      ward: 'Ward Union camp booking',
      meath: 'Tara camp booking',
    },
    description: 'Multi-day camp: sessions, stabling, dietary needs.',
    // No name field: the entry carries it. See `fullEntry` above.
    fields: [
      { field: 'ageGroup', group: 'Rider' },
      { field: 'ponyName', group: 'Pony' },
      { field: 'sessions', group: 'Camp' },
      { field: 'stablingFrom', group: 'Camp' },
      { field: 'arrivalTime', group: 'Camp' },
      { field: 'dietary', group: 'Camp' },
      { field: 'transportNeeded', group: 'Camp' },
      { field: 'medicalNotes', group: 'Camp' },
    ],
  },
  {
    key: 'shortEntry',
    name: {
      kildare: 'Kildare one-class entry',
      laois: 'Ballyroan short form',
      ward: 'Ward Union quick entry',
      meath: 'Meath Hunt short entry',
    },
    description: 'The minimum a club can ask for. One required field and nothing else.',
    // No name field: the entry carries it. See `fullEntry` above.
    fields: [{ field: 'ponyName' }],
  },
  {
    key: 'spectator',
    name: {
      kildare: 'Kildare gate list',
      laois: 'Ballyroan visitor sign-in',
      ward: 'Ward Union day ticket details',
      meath: 'Meath Hunt spectator list',
    },
    description: 'No pony. Contact details only, for gate lists and catering numbers.',
    /*
     * No name field: the entry carries it. The **email** stays — the entry's is
     * the account holder's, which is where the club writes, and a spectator's
     * own address is a different answer.
     */
    fields: [
      { field: 'riderEmail' },
      { field: 'riderPhone' },
      { field: 'dietary' },
    ],
  },
  {
    key: 'membershipSingle',
    name: {
      kildare: 'Kildare membership application',
      laois: 'Laois membership form',
      ward: 'Ward Union membership',
      meath: 'Meath Hunt membership application',
    },
    description: 'What a club asks of one person joining for the season.',
    /*
     * No name field here either. The application asks it.
     *
     * "Who is this membership for?" sits above the club's own questions, filled
     * from the people this account already holds memberships for and the names
     * it has used on entries — and the answer travels on the basket line to
     * `createMembership`. Before that existed, every membership took the
     * **account holder's** name whatever the form said, so a parent joining
     * three children produced three records all reading the same thing and the
     * form's "Member name" answer went nowhere.
     */
    fields: [
      { field: 'riderDob', group: 'Member', wizardStep: 1, wizardStepTitle: 'Member' },
      { field: 'riderEmail', group: 'Member', wizardStep: 1, wizardStepTitle: 'Member' },
      { field: 'riderPhone', group: 'Member', wizardStep: 1, wizardStepTitle: 'Member' },
      { field: 'ageGroup', group: 'Member', wizardStep: 1, wizardStepTitle: 'Member' },
      { field: 'addressLine', group: 'Address', wizardStep: 2, wizardStepTitle: 'Address' },
      { field: 'county', group: 'Address', wizardStep: 2, wizardStepTitle: 'Address' },
      { field: 'guardianName', group: 'Guardian', wizardStep: 3, wizardStepTitle: 'Guardian' },
      { field: 'guardianPhone', group: 'Guardian', wizardStep: 3, wizardStepTitle: 'Guardian' },
      { field: 'emergencyName', group: 'Safety', wizardStep: 4, wizardStepTitle: 'Safety' },
      { field: 'emergencyPhone', group: 'Safety', wizardStep: 4, wizardStepTitle: 'Safety' },
      { field: 'medicalNotes', group: 'Safety', wizardStep: 4, wizardStepTitle: 'Safety' },
      { field: 'photoConsent', group: 'Safety', wizardStep: 4, wizardStepTitle: 'Safety' },
    ],
  },
  {
    key: 'membershipFamily',
    name: {
      kildare: 'Kildare family membership',
      laois: 'Laois family membership form',
      ward: 'Ward Union household membership',
      meath: 'Meath Hunt family application',
    },
    description: 'Asked once of the household, then once per person on the membership.',
    // No name field: the application asks it. See `membershipSingle` above.
    fields: [
      { field: 'riderDob', group: 'Person' },
      { field: 'ageGroup', group: 'Person' },
      { field: 'addressLine', group: 'Household' },
      { field: 'county', group: 'Household' },
      { field: 'guardianName', group: 'Household' },
      { field: 'guardianPhone', group: 'Household' },
      { field: 'emergencyName', group: 'Safety' },
      { field: 'emergencyPhone', group: 'Safety' },
      { field: 'photoConsent', group: 'Safety' },
    ],
  },
  {
    key: 'horseRegistration',
    name: {
      kildare: 'Kildare horse passport record',
      laois: 'Laois horse details',
      ward: 'Ward Union horse register',
      meath: 'Meath Hunt horse registration',
    },
    description:
      'Passport, vaccination and ownership details for a horse or pony registered with the club for the year.',
    fields: [
      { field: 'horseName', group: 'The horse', wizardStep: 1, wizardStepTitle: 'The horse' },
      { field: 'horseStableName', group: 'The horse', wizardStep: 1, wizardStepTitle: 'The horse' },
      { field: 'horseBreed', group: 'The horse', wizardStep: 1, wizardStepTitle: 'The horse' },
      { field: 'horseColour', group: 'The horse', wizardStep: 1, wizardStepTitle: 'The horse' },
      { field: 'horseSex', group: 'The horse', wizardStep: 1, wizardStepTitle: 'The horse' },
      { field: 'horseYearFoaled', group: 'The horse', wizardStep: 1, wizardStepTitle: 'The horse' },
      { field: 'horseHeight', group: 'The horse', wizardStep: 1, wizardStepTitle: 'The horse' },
      { field: 'horsePassport', group: 'Passport and health', wizardStep: 2, wizardStepTitle: 'Passport and health' },
      { field: 'horseMicrochip', group: 'Passport and health', wizardStep: 2, wizardStepTitle: 'Passport and health' },
      { field: 'horseFluVaccine', group: 'Passport and health', wizardStep: 2, wizardStepTitle: 'Passport and health' },
      { field: 'horseVetName', group: 'Passport and health', wizardStep: 2, wizardStepTitle: 'Passport and health' },
      { field: 'horseVetPhone', group: 'Passport and health', wizardStep: 2, wizardStepTitle: 'Passport and health' },
      { field: 'horseOwner', group: 'Ownership', wizardStep: 3, wizardStepTitle: 'Ownership' },
      { field: 'horseInsured', group: 'Ownership', wizardStep: 3, wizardStepTitle: 'Ownership' },
      { field: 'horseNotes', group: 'Ownership', wizardStep: 3, wizardStepTitle: 'Ownership' },
    ],
  },
];

/* -------------------------------------------------------------- discounts */

export interface SeedDiscount {
  /**
   * Unique **within its organisation**, not across the seed.
   *
   * The same key may appear for several clubs — `familyMembership` means "this
   * club's family membership discount" — which is what lets a membership type
   * shared by every club pick up each club's own version rather than one
   * club's discount leaking into another's.
   */
  key: string;
  org: SeedOrg['key'];
  /**
   * Which module's discount list this belongs to.
   *
   * `discounts.module_type` is what the org-admin pages filter on and what the
   * pickers query, so a membership discount filed under `events` exists but is
   * invisible everywhere it would be used.
   */
  module: 'events' | 'memberships' | 'calendar' | 'merchandise' | 'registrations';
  name: string;
  description: string;
  code?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  applicationScope: 'item' | 'category' | 'cart' | 'quantity-based';
  quantityRules?: { minimumQuantity: number; applyToQuantity?: number; applyEveryN?: number };
  eligibilityCriteria?: Record<string, unknown>;
  usageLimits?: Record<string, unknown>;
  validFromDays?: number;
  validUntilDays?: number;
  combinable?: boolean;
  priority?: number;
  status?: 'active' | 'inactive' | 'expired';
}

export const DISCOUNTS: SeedDiscount[] = [
  /* ================================================================ Kildare
   * Events, memberships and the shop — the only club with merchandise.
   */
  {
    key: 'earlyBird',
    org: 'kildare',
    module: 'events',
    name: 'Early bird 10%',
    description: 'Ten per cent off entries made well before the closing date.',
    code: 'EARLYBIRD',
    discountType: 'percentage',
    discountValue: 10,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: true },
    validFromDays: -30,
    validUntilDays: 30,
    combinable: true,
    priority: 10,
    status: 'active',
  },
  {
    key: 'memberFiver',
    org: 'kildare',
    module: 'events',
    name: 'Club member €5 off',
    description: 'Five euro off every entry, applied automatically for members.',
    discountType: 'fixed',
    discountValue: 5,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: false },
    validFromDays: -60,
    validUntilDays: 90,
    combinable: true,
    priority: 8,
    status: 'active',
  },
  {
    key: 'thirdFree',
    org: 'kildare',
    module: 'events',
    name: 'Third entry free',
    description: 'Enter three classes and the third is free.',
    discountType: 'percentage',
    discountValue: 100,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 3, applyEveryN: 3 },
    validFromDays: -20,
    validUntilDays: 60,
    combinable: false,
    priority: 6,
    status: 'active',
  },
  {
    key: 'seasonPass',
    org: 'kildare',
    module: 'events',
    name: 'Season pass 25%',
    description: 'A quarter off for members entering the whole league. Limited run.',
    code: 'SEASON25',
    discountType: 'percentage',
    discountValue: 25,
    applicationScope: 'category',
    // The one usage-limited discount, so the "uses remaining" path has a subject.
    usageLimits: { totalUses: 40, usesPerMember: 1, used: 12 },
    validFromDays: -15,
    validUntilDays: 45,
    combinable: false,
    priority: 12,
    status: 'active',
  },
  {
    key: 'expiredSpring',
    org: 'kildare',
    module: 'events',
    name: 'Spring promotion',
    description: 'Ran in the spring. Left expired so the lapsed-discount path has a subject.',
    code: 'SPRING24',
    discountType: 'percentage',
    discountValue: 15,
    applicationScope: 'item',
    validFromDays: -120,
    validUntilDays: -30,
    combinable: false,
    priority: 4,
    status: 'expired',
  },
  {
    key: 'familyMembership',
    org: 'kildare',
    module: 'memberships',
    name: 'Family membership 10%',
    description: 'Ten per cent off a family membership, applied automatically.',
    discountType: 'percentage',
    discountValue: 10,
    applicationScope: 'item',
    validFromDays: -90,
    validUntilDays: 120,
    combinable: false,
    priority: 5,
    status: 'active',
  },
  {
    key: 'juniorMembership',
    org: 'kildare',
    module: 'memberships',
    name: 'Junior member €8 off',
    description: 'Eight euro off a junior membership taken out before the season starts.',
    code: 'JUNIOR8',
    discountType: 'fixed',
    discountValue: 8,
    applicationScope: 'item',
    validFromDays: -40,
    validUntilDays: 75,
    combinable: true,
    priority: 3,
    status: 'active',
  },
  {
    key: 'kitBundle',
    org: 'kildare',
    module: 'merchandise',
    name: 'Club kit 15%',
    description: 'Fifteen per cent off club clothing during the season.',
    code: 'KIT15',
    discountType: 'percentage',
    discountValue: 15,
    applicationScope: 'item',
    validFromDays: -20,
    validUntilDays: 45,
    combinable: false,
    priority: 6,
    status: 'active',
  },
  {
    key: 'secondItemHalf',
    org: 'kildare',
    module: 'merchandise',
    name: 'Second item half price',
    description: 'Buy two of the same, the second is half price.',
    discountType: 'percentage',
    discountValue: 50,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 2, applyToQuantity: 1 },
    validFromDays: -10,
    validUntilDays: 90,
    combinable: true,
    priority: 4,
    status: 'active',
  },
  {
    key: 'shopBasketFive',
    org: 'kildare',
    module: 'merchandise',
    name: '€5 off shop baskets over €40',
    description: 'Five euro off the whole basket once it passes forty.',
    code: 'SHOP5',
    discountType: 'fixed',
    discountValue: 5,
    applicationScope: 'cart',
    eligibilityCriteria: { minimumOrderValue: 4000 },
    validFromDays: -25,
    validUntilDays: 65,
    combinable: true,
    priority: 2,
    status: 'active',
  },

  /* ================================================================== Laois
   * Events, memberships and the arena — the only club taking bookings.
   */
  {
    key: 'cartTenner',
    org: 'laois',
    module: 'events',
    name: '€10 off baskets over €60',
    description: 'Ten euro off the whole basket once it passes sixty.',
    code: 'BASKET10',
    discountType: 'fixed',
    discountValue: 10,
    applicationScope: 'cart',
    eligibilityCriteria: { minimumOrderValue: 6000 },
    usageLimits: { totalUses: 100, usesPerMember: 2, used: 8 },
    validFromDays: -45,
    validUntilDays: 60,
    combinable: false,
    priority: 9,
    status: 'active',
  },
  {
    key: 'laoisFamily',
    org: 'laois',
    module: 'events',
    name: 'Family rate 15%',
    description: 'Fifteen per cent off from the second entry in the same family.',
    discountType: 'percentage',
    discountValue: 15,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 2 },
    validFromDays: -60,
    validUntilDays: 120,
    combinable: true,
    priority: 7,
    status: 'active',
  },
  {
    key: 'laoisAutumn',
    org: 'laois',
    module: 'events',
    name: 'Autumn league 12%',
    description: 'Twelve per cent off the autumn fixtures. Not yet started.',
    code: 'AUTUMN12',
    discountType: 'percentage',
    discountValue: 12,
    applicationScope: 'item',
    // Starts next month: the not-yet-valid case, which nothing else covers.
    validFromDays: 30,
    validUntilDays: 120,
    combinable: true,
    priority: 5,
    status: 'active',
  },
  {
    key: 'familyMembership',
    org: 'laois',
    module: 'memberships',
    name: 'Family membership €20 off',
    description: 'Twenty euro off a family membership. Laois prices theirs as a flat amount.',
    discountType: 'fixed',
    discountValue: 20,
    applicationScope: 'item',
    validFromDays: -80,
    validUntilDays: 120,
    combinable: false,
    priority: 5,
    status: 'active',
  },
  {
    key: 'earlyRenewal',
    org: 'laois',
    module: 'memberships',
    name: 'Early renewal €5 off',
    description: 'Five euro off for renewing before the season ends.',
    code: 'RENEW5',
    discountType: 'fixed',
    discountValue: 5,
    applicationScope: 'item',
    validFromDays: -30,
    validUntilDays: 60,
    combinable: true,
    priority: 3,
    status: 'active',
  },
  {
    key: 'offPeakArena',
    org: 'laois',
    module: 'calendar',
    name: 'Off-peak 20%',
    description: 'Twenty per cent off weekday arena hire outside the evening rush.',
    code: 'OFFPEAK',
    discountType: 'percentage',
    discountValue: 20,
    applicationScope: 'item',
    validFromDays: -45,
    validUntilDays: 90,
    combinable: false,
    priority: 5,
    status: 'active',
  },
  {
    key: 'lessonBlock',
    org: 'laois',
    module: 'calendar',
    name: 'Block of five lessons 10%',
    description: 'Book five lessons together and the fifth is discounted.',
    discountType: 'percentage',
    discountValue: 10,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 5, applyToQuantity: 1 },
    validFromDays: -60,
    validUntilDays: 120,
    combinable: true,
    priority: 2,
    status: 'active',
  },
  {
    key: 'arenaMemberRate',
    org: 'laois',
    module: 'calendar',
    name: 'Member rate €3 off',
    description: 'Three euro off every arena booking for members.',
    discountType: 'fixed',
    discountValue: 3,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: false, membersOnly: true },
    validFromDays: -70,
    validUntilDays: 150,
    combinable: true,
    priority: 4,
    status: 'active',
  },

  /* =================================================================== Ward
   * Events and memberships only — no shop, no bookings. The club that shows
   * what a discount list looks like without the other two capabilities.
   */
  {
    key: 'wardCapped',
    org: 'ward',
    module: 'events',
    name: 'Winter league 20%',
    description: 'Twenty per cent off, capped, with a limited number of uses.',
    code: 'WINTER20',
    discountType: 'percentage',
    discountValue: 20,
    applicationScope: 'item',
    usageLimits: { totalUses: 25, usesPerMember: 1, maximumDiscount: 1500, used: 4 },
    validFromDays: -15,
    validUntilDays: 75,
    combinable: false,
    priority: 8,
    status: 'active',
  },
  {
    key: 'wardVolunteer',
    org: 'ward',
    module: 'events',
    name: 'Volunteer thank-you €7 off',
    description: 'Seven euro off an entry for anyone who stewarded a fixture.',
    discountType: 'fixed',
    discountValue: 7,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: false, volunteersOnly: true },
    validFromDays: -50,
    validUntilDays: 100,
    combinable: true,
    priority: 6,
    status: 'active',
  },
  {
    key: 'wardBulkEntries',
    org: 'ward',
    module: 'events',
    name: 'Fourth entry half price',
    description: 'Enter four or more and the fourth is half price.',
    discountType: 'percentage',
    discountValue: 50,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 4, applyToQuantity: 1 },
    validFromDays: -35,
    validUntilDays: 95,
    combinable: true,
    priority: 5,
    status: 'active',
  },
  {
    key: 'wardSuspended',
    org: 'ward',
    module: 'events',
    name: 'Open day 30%',
    description: 'Switched off by the club while it reconsiders. Not expired — inactive.',
    code: 'OPENDAY30',
    discountType: 'percentage',
    discountValue: 30,
    applicationScope: 'item',
    validFromDays: -10,
    validUntilDays: 80,
    combinable: false,
    priority: 1,
    // Inactive is about the club's switch, not the calendar — a distinction
    // nothing else in the fixture makes.
    status: 'inactive',
  },
  {
    key: 'familyMembership',
    org: 'ward',
    module: 'memberships',
    name: 'Family membership 12%',
    description: 'Twelve per cent off a family membership.',
    discountType: 'percentage',
    discountValue: 12,
    applicationScope: 'item',
    validFromDays: -85,
    validUntilDays: 130,
    combinable: false,
    priority: 5,
    status: 'active',
  },
  {
    key: 'earlyRenewal',
    org: 'ward',
    module: 'memberships',
    name: 'Renew early €6 off',
    description: 'Six euro off for renewing before the season ends.',
    code: 'WARDRENEW',
    discountType: 'fixed',
    discountValue: 6,
    applicationScope: 'item',
    validFromDays: -30,
    validUntilDays: 70,
    combinable: true,
    priority: 3,
    status: 'active',
  },

  /* ================================================================== Meath
   * One per module, including the only `registrations` discount in the seed —
   * the org-admin discount pages filter on `module_type`, so a module with no
   * discount at all leaves its picker empty and untested.
   */
  {
    key: 'mhpcCampEarly',
    org: 'meath',
    module: 'events',
    name: 'Camp early bird 15%',
    description: 'Fifteen per cent off camp places booked before the rush.',
    code: 'CAMP15',
    discountType: 'percentage',
    discountValue: 15,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: true },
    validFromDays: -20,
    validUntilDays: 20,
    combinable: false,
    priority: 20,
    status: 'active',
  },
  {
    key: 'mhpcFamilyEntry',
    org: 'meath',
    module: 'events',
    name: 'Third entry half price',
    description: 'Enter three or more and the third onwards is half price.',
    discountType: 'percentage',
    discountValue: 50,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 3, applyEveryN: 3, applyToQuantity: 1 },
    eligibilityCriteria: { requiresCode: false },
    validFromDays: -30,
    validUntilDays: 60,
    combinable: true,
    priority: 5,
    status: 'active',
  },
  {
    key: 'mhpcFamilyMembership',
    org: 'meath',
    module: 'memberships',
    name: 'Family membership €20 off',
    description: 'Twenty euro off a family membership.',
    discountType: 'fixed',
    discountValue: 20,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: false },
    validFromDays: -60,
    validUntilDays: 120,
    combinable: true,
    priority: 6,
    status: 'active',
  },
  {
    key: 'mhpcArenaOffPeak',
    org: 'meath',
    module: 'calendar',
    name: 'Off-peak arena 20%',
    description: 'Twenty per cent off weekday arena hire.',
    code: 'OFFPEAK',
    discountType: 'percentage',
    discountValue: 20,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: true },
    validFromDays: -15,
    validUntilDays: 90,
    combinable: false,
    priority: 12,
    status: 'active',
  },
  {
    key: 'mhpcShopBundle',
    org: 'meath',
    module: 'merchandise',
    name: 'Two items 10% off',
    description: 'Ten per cent off when two or more items are bought together.',
    discountType: 'percentage',
    discountValue: 10,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 2 },
    eligibilityCriteria: { requiresCode: false },
    validFromDays: -30,
    validUntilDays: 120,
    combinable: true,
    priority: 4,
    status: 'active',
  },
  {
    key: 'mhpcHorseRenewal',
    org: 'meath',
    module: 'registrations',
    name: 'Renewal €10 off',
    description: 'Ten euro off renewing a horse registration for another year.',
    discountType: 'fixed',
    discountValue: 10,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: false },
    validFromDays: -90,
    validUntilDays: 180,
    combinable: true,
    priority: 7,
    status: 'active',
  },
];


/* ----------------------------------------------------------------- events */

/**
 * Every fee in this file is in **major units** — `fee: 25` is €25 — and is
 * inserted raw. Two rules follow from that, both learned the hard way:
 *
 *  - Writing minor units here multiplies the price by a hundred. A camp went in
 *    at `22000` and appeared in the shop at €22,000.
 *  - **Nothing costs more than €100.** These are demo fixtures; a €500 table or
 *    a €395 camp week is a distraction on every screen it appears on, and makes
 *    a test payment awkward to reason about.
 */
export interface SeedActivity {
  name: string;
  description: string;
  fee: number;
  form?: string;
  limitApplicants?: boolean;
  applicantsLimit?: number;
  allowSpecifyQuantity?: boolean;
  /** `both` seeds card and offline; a club without Stripe falls back to offline. */
  payment: 'offline' | 'card' | 'both';
  handlingFeeIncluded?: boolean;
  useTermsAndConditions?: boolean;
  showPublicly?: boolean;
  discounts?: string[];
  /**
   * Who may enter. Omitted means `'all'`, which is what every pre-existing
   * seeded activity is and must remain.
   */
  entryEligibility?: 'all' | 'members' | 'org-type-members';
  /**
   * How many people one of this activity's tickets admits at the gate.
   * Omitted means 1, which is what every pre-existing seeded activity is.
   */
  ticketsAdmit?: number;
}

export interface SeedEvent {
  key: string;
  org: SeedOrg['key'];
  name: string;
  description: string;
  eventType: string;
  venue: string;
  /** Days from now. */
  startDays: number;
  endDays: number;
  /**
   * The entry window, in days from now. Both are required.
   *
   * `event.service` refuses to create an event without all four dates, and a
   * null entry window reads as *unbounded* to `public-event.service` — an
   * event permanently open to entries, which nobody sets out to configure.
   * See docs/EVENT_ENTRY_DATE_INVENTION_FIX.md.
   */
  openDays: number;
  closeDays: number;
  status: 'draft' | 'published';
  /**
   * Public listing. Omitted means not public, which is what most events are.
   * See docs/PUBLIC_EVENTS.md §2.
   */
  showOnOrganisationPage?: boolean;
  showOnPlatformPage?: boolean;
  limitEntries?: boolean;
  entriesLimit?: number;
  addConfirmationMessage?: boolean;
  confirmationMessage?: string;
  discounts?: string[];
  /**
   * Issue an electronic ticket per entry.
   *
   * Requires the `event-ticketing` capability, so only the club that has
   * everything can use it — which is the point: nothing else in the seed
   * produces a ticket, and the ticket screens had no subject.
   */
  ticketing?: {
    headerText: string;
    instructions: string;
    footerText?: string;
    /**
     * How the ticket is laid out: `stacked`, `sideBySide` or `compact`.
     *
     * Omitted means `stacked`, which is what every ticket looked like before a
     * club could choose — so a fixture that says nothing produces the ticket
     * the product produced before this existed.
     */
    layout?: 'stacked' | 'sideBySide' | 'compact';
    /** Hours the ticket stays valid from the event start. */
    validityPeriod?: number;
    backgroundColour?: string;
  };
  activities: SeedActivity[];
}

/**
 * The four dates every seeded event must have, and in the right order.
 *
 * `eventService.createEvent` enforces this for anything that comes in through
 * the API, but the seed writes its rows with raw SQL and never meets that
 * guard. Without a check of its own the fixture is free to drift back to a
 * shape the API would now reject — an unbounded entry window, which
 * `public-event.service` reads as permanently open, or an event that ends
 * before it starts. See docs/EVENT_ENTRY_DATE_INVENTION_FIX.md.
 */
export const assertEventDates = (event: SeedEvent): void => {
  if (event.endDays < event.startDays) {
    throw new Error(
      `"${event.name}" ends before it starts (${event.startDays} → ${event.endDays}).`
    );
  }
  if (event.closeDays <= event.openDays) {
    throw new Error(
      `"${event.name}" closes to entries before it opens (${event.openDays} → ${event.closeDays}).`
    );
  }
};

export const EVENT_TYPES = ['Show Jumping', 'Cross Country', 'Dressage', 'Camp', 'Rally', 'Fun Day'];

/**
 * `region` is what the public listings filter on.
 *
 * The address is prose and cannot be filtered without parsing it; the region is
 * the value. Ward Union's grounds are in Meath despite the club's name, which is
 * exactly the kind of thing a filter built from club names would get wrong.
 */
export const VENUES: Record<
  SeedOrg['key'],
  Array<{ name: string; address: string; region: string }>
> = {
  kildare: [
    { name: 'Craddockstown Equestrian', address: 'Craddockstown, Naas, Co. Kildare', region: 'Co. Kildare' },
    { name: 'Punchestown Event Centre', address: 'Punchestown, Naas, Co. Kildare', region: 'Co. Kildare' },
  ],
  laois: [{ name: 'Ballyroan Showgrounds', address: 'Ballyroan, Co. Laois', region: 'Co. Laois' }],
  ward: [{ name: 'Ward Union Grounds', address: 'Ashbourne, Co. Meath', region: 'Co. Meath' }],
  meath: [
    { name: 'Kilmessan Equestrian Centre', address: 'Kilmessan, Co. Meath', region: 'Co. Meath' },
    { name: 'Tara Hill Cross Country', address: 'Hill of Tara, Navan, Co. Meath', region: 'Co. Meath' },
  ],
};

/**
 * Eighteen events covering every entry-window state, both limit mechanisms,
 * quantity, all three payment arrangements and each form.
 *
 * The window states are the ones worth naming:
 *
 *   not-open   openDays  > 0                     entries have not opened
 *   open       openDays  < 0, closeDays > 14      open, closing in a while
 *   closing    openDays  < 0, closeDays 1–3       closing soon
 *   closed     closeDays < 0                      closed to entries
 */
/*
 * ## Which of these are public, and why that spread
 *
 * Fifteen of the eighteen are published publicly; twelve of those also appear
 * on the platform listing at `/events`. The split is not arbitrary — the
 * platform page is a **filterable** surface, and a fixture where every event
 * shares a club, a county and an event type gives every filter exactly one
 * option and proves nothing:
 *
 *   clubs    all four, so the Club filter is worth opening
 *   regions  Co. Kildare, Co. Laois and Co. Meath
 *   types    Show Jumping, Cross Country, Dressage, Camp, Rally, Fun Day
 *   windows  open, closing in days, not yet open, closed, finished
 *
 * **Three are club-page-only** — Kildare's Members' Cup, Laois's closed event
 * and Meath's summer camp. Without them the two flags would always agree and a
 * bug that ignored one of them would pass unnoticed.
 *
 * **Three are not public at all**, including `khpc-fun-day-draft`, which is a
 * draft. A draft can never reach the public whatever its flags say, and having
 * one in the fixture is what makes that rule testable rather than assumed.
 */
export const EVENTS: SeedEvent[] = [
  /* ---------------------------------------------------------- Kildare */
  {
    key: 'khpc-spring-league',
    org: 'kildare',
    name: 'Spring Show Jumping League',
    description: 'Four-round league over the spring, graded 1 to 3. Entries open now.',
    eventType: 'Show Jumping',
    venue: 'Craddockstown Equestrian',
    startDays: 21,
    endDays: 21,
    openDays: -10,
    closeDays: 14,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    limitEntries: true,
    entriesLimit: 120,
    addConfirmationMessage: true,
    confirmationMessage: 'Numbers can be collected from the secretary’s office from 8am.',
    discounts: ['earlyBird', 'memberFiver', 'seasonPass'],
    activities: [
      {
        name: 'Grade 1 — 80cm',
        description: 'Introductory round for newer combinations.',
        fee: 25,
        form: 'fullEntry',
        limitApplicants: true,
        applicantsLimit: 40,
        payment: 'both',
        handlingFeeIncluded: true,
        discounts: ['earlyBird', 'memberFiver'],
      },
      {
        name: 'Grade 2 — 90cm',
        description: 'Intermediate round.',
        fee: 30,
        form: 'fullEntry',
        limitApplicants: true,
        applicantsLimit: 40,
        payment: 'both',
        handlingFeeIncluded: true,
        discounts: ['earlyBird'],
      },
      {
        name: 'Grade 3 — 1.00m',
        description: 'Open round.',
        fee: 35,
        form: 'fullEntry',
        payment: 'card',
        handlingFeeIncluded: true,
      },
      {
        name: 'Stabling (per night)',
        description: 'Overnight stabling. Choose how many nights.',
        fee: 20,
        allowSpecifyQuantity: true,
        limitApplicants: true,
        applicantsLimit: 30,
        payment: 'both',
        useTermsAndConditions: true,
      },
    ],
  },
  {
    key: 'khpc-summer-camp',
    org: 'kildare',
    name: 'Summer Camp',
    description: 'Five-day residential camp. Entries have not opened yet.',
    eventType: 'Camp',
    venue: 'Craddockstown Equestrian',
    startDays: 90,
    endDays: 94,
    openDays: 21, // not open yet
    closeDays: 75,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    limitEntries: true,
    entriesLimit: 60,
    activities: [
      {
        name: 'Full week, residential',
        description: 'Five days including stabling and meals.',
        fee: 95,
        form: 'campBooking',
        limitApplicants: true,
        applicantsLimit: 24,
        payment: 'both',
        useTermsAndConditions: true,
      },
      {
        name: 'Full week, non-residential',
        description: 'Five days, pony travels home each evening.',
        fee: 75,
        form: 'campBooking',
        limitApplicants: true,
        applicantsLimit: 30,
        payment: 'both',
      },
      {
        name: 'Day tickets',
        description: 'Individual days. Choose how many.',
        fee: 65,
        form: 'campBooking',
        allowSpecifyQuantity: true,
        payment: 'offline',
      },
    ],
  },
  {
    key: 'khpc-hunter-trial',
    org: 'kildare',
    name: 'Autumn Hunter Trial',
    description: 'Cross-country over the Punchestown banks. Entries close in two days.',
    eventType: 'Cross Country',
    venue: 'Punchestown Event Centre',
    startDays: 9,
    endDays: 9,
    openDays: -25,
    closeDays: 2, // closing soon
    status: 'published',
    discounts: ['thirdFree'],
    activities: [
      {
        name: 'Pairs class',
        description: 'Two riders, one round.',
        fee: 40,
        form: 'shortEntry',
        payment: 'both',
        discounts: ['thirdFree'],
      },
      {
        name: 'Individual — Novice',
        description: 'Single rider, novice track.',
        fee: 28,
        form: 'fullEntry',
        limitApplicants: true,
        applicantsLimit: 50,
        payment: 'both',
        discounts: ['thirdFree'],
      },
      {
        name: 'Individual — Open',
        description: 'Single rider, open track.',
        fee: 32,
        form: 'fullEntry',
        payment: 'both',
      },
    ],
  },
  {
    key: 'khpc-dressage-closed',
    org: 'kildare',
    name: 'Winter Dressage — Round 3',
    description: 'Entries have closed. The event itself is still ahead.',
    eventType: 'Dressage',
    venue: 'Craddockstown Equestrian',
    startDays: 4,
    endDays: 4,
    openDays: -40,
    closeDays: -2, // closed
    status: 'published',
    limitEntries: true,
    entriesLimit: 45,
    activities: [
      { name: 'Preliminary 1', description: 'Prelim test 1.', fee: 22, form: 'shortEntry', payment: 'both' },
      { name: 'Novice 2', description: 'Novice test 2.', fee: 24, form: 'shortEntry', payment: 'both' },
    ],
  },
  {
    key: 'khpc-fun-day-draft',
    org: 'kildare',
    name: 'Christmas Fun Day (draft)',
    description: 'Still being put together — not visible to members.',
    eventType: 'Fun Day',
    venue: 'Craddockstown Equestrian',
    startDays: 120,
    endDays: 120,
    openDays: 60, // not open yet
    closeDays: 110,
    status: 'draft',
    activities: [
      { name: 'Fancy dress', description: 'Best turned out pony and rider.', fee: 10, payment: 'offline' },
    ],
  },
  {
    key: 'khpc-past-event',
    org: 'kildare',
    name: 'Summer Show (completed)',
    description: 'Already happened. Useful for reporting and for a member’s past entries.',
    eventType: 'Show Jumping',
    venue: 'Craddockstown Equestrian',
    startDays: -45,
    endDays: -45,
    openDays: -90,
    closeDays: -50,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    activities: [
      { name: '80cm', description: 'Eighty centimetre class.', fee: 25, form: 'shortEntry', payment: 'both' },
      { name: '1.00m', description: 'One metre class.', fee: 30, form: 'shortEntry', payment: 'both' },
    ],
  },

  /* ------------------------------------------------------------ Laois */
  {
    key: 'lhpc-league',
    org: 'laois',
    name: 'Ballyroan Winter League',
    description: 'Six rounds through the winter. Open, closing in three weeks.',
    eventType: 'Show Jumping',
    venue: 'Ballyroan Showgrounds',
    startDays: 30,
    endDays: 30,
    openDays: -5,
    closeDays: 21,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    limitEntries: true,
    entriesLimit: 80,
    discounts: ['cartTenner', 'laoisFamily', 'laoisAutumn'],
    activities: [
      {
        name: '70cm',
        description: 'Starter class.',
        fee: 20,
        form: 'fullEntry',
        limitApplicants: true,
        applicantsLimit: 25,
        payment: 'both',
        discounts: ['laoisFamily'],
      },
      {
        name: '90cm',
        description: 'Middle class.',
        fee: 25,
        form: 'fullEntry',
        payment: 'both',
        discounts: ['laoisFamily'],
      },
      {
        name: 'Spectator pass',
        description: 'Entry to the grounds. Buy as many as you need.',
        fee: 5,
        form: 'spectator',
        allowSpecifyQuantity: true,
        payment: 'both',
        showPublicly: true,
      },
    ],
  },
  {
    key: 'lhpc-rally-closing',
    org: 'laois',
    name: 'Autumn Rally',
    description: 'Instructional rally. Entries close tomorrow.',
    eventType: 'Rally',
    venue: 'Ballyroan Showgrounds',
    startDays: 7,
    endDays: 7,
    openDays: -20,
    closeDays: 1, // closing soonest
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    activities: [
      {
        name: 'Morning group',
        description: 'Flatwork and poles.',
        fee: 30,
        form: 'campBooking',
        limitApplicants: true,
        applicantsLimit: 12,
        payment: 'card',
      },
      {
        name: 'Afternoon group',
        description: 'Jumping.',
        fee: 30,
        form: 'campBooking',
        limitApplicants: true,
        applicantsLimit: 12,
        payment: 'card',
      },
    ],
  },
  {
    key: 'lhpc-not-open',
    org: 'laois',
    name: 'Spring Dressage Series',
    description: 'Published, but entries do not open for a month.',
    eventType: 'Dressage',
    venue: 'Ballyroan Showgrounds',
    startDays: 75,
    endDays: 76,
    openDays: 30, // not open yet
    closeDays: 70,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    activities: [
      { name: 'Intro A', description: 'Intro test A.', fee: 18, form: 'shortEntry', payment: 'offline' },
      { name: 'Prelim 7', description: 'Preliminary test 7.', fee: 20, form: 'shortEntry', payment: 'offline' },
    ],
  },
  {
    key: 'lhpc-closed',
    org: 'laois',
    name: 'Hunter Trial (entries closed)',
    description: 'Closed to entries last week.',
    eventType: 'Cross Country',
    venue: 'Ballyroan Showgrounds',
    startDays: 3,
    endDays: 3,
    openDays: -35,
    closeDays: -7,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: false,
    activities: [
      { name: 'Novice', description: 'Novice track.', fee: 26, form: 'shortEntry', payment: 'both' },
    ],
  },

  /* ------------------------------------------------------------- Ward */
  {
    key: 'wupc-open-day',
    org: 'ward',
    name: 'Ward Union Open Day',
    description: 'Open to entries for most of the run-up — a long window rather than none at all.',
    eventType: 'Fun Day',
    venue: 'Ward Union Grounds',
    startDays: 45,
    endDays: 45,
    openDays: -60,
    closeDays: 42,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    discounts: ['wardCapped', 'wardVolunteer', 'wardSuspended'],
    activities: [
      {
        name: 'Family ticket',
        description: 'Admits two adults and up to three children.',
        fee: 25,
        form: 'spectator',
        allowSpecifyQuantity: true,
        payment: 'offline',
        discounts: ['wardCapped', 'wardBulkEntries'],
      },
      {
        name: 'Have-a-go lesson',
        description: 'Twenty-minute lead-rein lesson. Very limited.',
        fee: 15,
        form: 'shortEntry',
        limitApplicants: true,
        applicantsLimit: 8,
        payment: 'offline',
      },
    ],
  },
  {
    key: 'wupc-league-open',
    org: 'ward',
    name: 'Ward Union Cross Country League',
    description: 'Offline payment only, since this club has no card provider.',
    eventType: 'Cross Country',
    venue: 'Ward Union Grounds',
    startDays: 28,
    endDays: 28,
    openDays: -12,
    closeDays: 20,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    limitEntries: true,
    entriesLimit: 50,
    activities: [
      {
        name: 'Junior track',
        description: 'For riders under 15.',
        fee: 22,
        form: 'fullEntry',
        limitApplicants: true,
        applicantsLimit: 20,
        payment: 'offline',
      },
      {
        name: 'Senior track',
        description: 'For riders 15 and over.',
        fee: 28,
        form: 'fullEntry',
        payment: 'offline',
      },
    ],
  },
  {
    key: 'wupc-closing-soon',
    org: 'ward',
    name: 'Hunt Ball Tickets',
    description: 'Not a riding event — tickets only. Closing in three days.',
    eventType: 'Fun Day',
    venue: 'Ward Union Grounds',
    startDays: 16,
    endDays: 16,
    openDays: -30,
    closeDays: 3,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    limitEntries: true,
    entriesLimit: 200,
    addConfirmationMessage: true,
    confirmationMessage: 'Tables are allocated a week before. Email the secretary with seating requests.',
    activities: [
      {
        name: 'Individual ticket',
        description: 'One seat.',
        fee: 55,
        form: 'spectator',
        allowSpecifyQuantity: true,
        payment: 'offline',
        useTermsAndConditions: true,
      },
      {
        name: 'Table of ten',
        description: 'A full table.',
        fee: 90,
        form: 'spectator',
        limitApplicants: true,
        applicantsLimit: 20,
        payment: 'offline',
      },
    ],
  },

  /* ------------------------------------------------------------ Meath
   * The club with every capability. These events exist to give ticketing and
   * entry restrictions something to act on, which no other club can do.
   */
  {
    key: 'mhpc-summer-camp',
    org: 'meath',
    name: 'Summer Pony Camp',
    description:
      'Four days of flatwork, jumping and stable management at Kilmessan. Places go quickly.',
    eventType: 'Camp',
    venue: 'Kilmessan Equestrian Centre',
    startDays: 40,
    endDays: 43,
    openDays: -10,
    closeDays: 25,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: false,
    // Capped at the event level, so the whole camp fills even though each
    // activity has room — the case the account app words as "event full".
    limitEntries: true,
    entriesLimit: 40,
    addConfirmationMessage: true,
    confirmationMessage:
      'Camp confirmed. Bring a hat, boots and a filled water bottle; the yard opens at 8:30.',
    discounts: ['mhpcCampEarly'],
    activities: [
      {
        name: 'Camp — full week, own pony',
        description: 'Four days, bring your own pony.',
        fee: 85,
        form: 'fullEntry',
        limitApplicants: true,
        applicantsLimit: 24,
        payment: 'both',
        useTermsAndConditions: true,
        discounts: ['mhpcCampEarly'],
      },
      {
        name: 'Camp — full week, club pony',
        description: 'Four days on a club pony, for members without one.',
        fee: 98,
        form: 'fullEntry',
        limitApplicants: true,
        applicantsLimit: 8,
        payment: 'both',
      },
      {
        name: 'Day ticket',
        description: 'A single day, for anyone who cannot make the full week.',
        fee: 65,
        form: 'shortEntry',
        allowSpecifyQuantity: true,
        payment: 'both',
      },
    ],
  },
  /**
   * A ticketed event that has already run.
   *
   * The upcoming Tara Hunter Trial shows tickets *before* the day — issued, none
   * scanned, which is what the issued/scanned/remaining cards are for. Nothing
   * showed what a gate looks like afterwards, because every ticketed event in
   * the fixture was in the future and a scan on a future event is a fiction.
   *
   * This one has been through the gate: most riders admitted, one who presented
   * the same ticket twice, one who never came, and one whose entry came off.
   */
  {
    key: 'mhpc-gate-day',
    org: 'meath',
    name: 'Dunshaughlin Gate Day (completed)',
    description:
      'Ran last month, with electronic tickets scanned at the gate. Useful for the scanning history and the duplicate-use report.',
    eventType: 'Cross Country',
    venue: 'Tara Hill Cross Country',
    startDays: -12,
    endDays: -12,
    openDays: -60,
    closeDays: -15,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    ticketing: {
      headerText: 'Meath Hunt Pony Club — Dunshaughlin Gate Day',
      instructions: 'Show this ticket at the gate. One ticket admits the named rider and one horse.',
      footerText: 'Hard hats to current standard. No dogs on the course.',
      validityPeriod: 1,
      backgroundColour: '#123c2b',
    },
    activities: [
      {
        name: 'Open class',
        description: 'Open to all grades.',
        fee: 40,
        form: 'shortEntry',
        payment: 'both',
      },
      {
        name: 'Junior class',
        description: 'Under 14s, lower fences.',
        fee: 30,
        form: 'shortEntry',
        payment: 'both',
      },
    ],
  },
  /**
   * A ticketed event running **today**, whose tickets are valid **now**.
   *
   * The fixture had a gate day last month and a hunter trial three weeks out,
   * which between them cover "afterwards" and "before the day" — and leave out
   * the state a gate is actually worked in. A ticket for a future event cannot
   * be scanned without lying about when, and one for a past event is expired:
   * neither can be used to try the scanner, which is the part of ticketing that
   * matters on the day.
   *
   * So: today, with most tickets unscanned and waiting. Two have been through
   * the gate already, because a morning's gate is a mixture and the counts on
   * the dashboard should not read as all-or-nothing.
   *
   * Entries are closed — they shut yesterday. A gate day whose entries are
   * still open would be a different fixture and a stranger one.
   */
  {
    key: 'mhpc-gate-today',
    org: 'meath',
    name: 'Dunshaughlin Gate Day (today)',
    description:
      'Running today. Tickets are valid now — use this one to try scanning at the gate.',
    eventType: 'Cross Country',
    venue: 'Tara Hill Cross Country',
    startDays: 0,
    endDays: 0,
    openDays: -45,
    closeDays: -1,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    ticketing: {
      headerText: 'Meath Hunt Pony Club — Dunshaughlin Gate Day',
      instructions: 'Show this ticket at the gate. One ticket admits the named rider and one horse.',
      footerText: 'Hard hats to current standard. No dogs on the course.',
      /*
       * The one seeded ticket not laid out the default way, so a developer can
       * see what the choice does without designing one first. No image: the
       * seed writes rows, not S3 objects, and a key pointing at nothing renders
       * as a broken picture on the one screen this is for.
       */
      layout: 'sideBySide',
      // A day after the event, so a ticket issued for today is still valid this
      // evening — a gate that shuts at midnight is nobody's gate.
      validityPeriod: 1,
      backgroundColour: '#123c2b',
    },
    activities: [
      {
        name: 'Open class',
        description: 'Open to all grades.',
        fee: 40,
        form: 'shortEntry',
        payment: 'both',
      },
      {
        name: 'Junior class',
        description: 'Under 14s, lower fences.',
        fee: 30,
        form: 'shortEntry',
        payment: 'both',
      },
      {
        /*
         * The only seeded activity whose ticket admits more than one person.
         * Without it `admits` is 1 everywhere and the gate's ceiling can only
         * be seen failing — a family ticket is what shows it counting.
         */
        name: 'Family car pass',
        description: 'One car, up to four people. Admits four at the gate.',
        fee: 25,
        form: 'shortEntry',
        payment: 'both',
        ticketsAdmit: 4,
      },
    ],
  },
  {
    key: 'mhpc-tara-hunter-trial',
    org: 'meath',
    name: 'Tara Hunter Trial',
    description:
      'Cross country over the Tara banks. Electronic tickets are issued for this one — bring your phone to the gate.',
    eventType: 'Cross Country',
    venue: 'Tara Hill Cross Country',
    startDays: 21,
    endDays: 21,
    openDays: -20,
    closeDays: 14,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    discounts: ['mhpcFamilyEntry'],
    ticketing: {
      headerText: 'Meath Hunt Pony Club — Tara Hunter Trial',
      instructions:
        'Show this ticket at the gate. One ticket admits the named rider and one horse; car passes are separate.',
      footerText: 'Hard hats to current standard. No dogs on the cross-country course.',
      /*
       * Days, not hours.
       *
       * `ticketingService.issueTicketForEntry` adds this to the event's last
       * day (`validUntil.setDate(+period)`), while the form labels the field
       * "Ticket Validity Period (hours)" and describes it as hours *before* the
       * event. The two disagree about the unit and about which end of the
       * window it moves; the fixture follows the code, because that is what the
       * data will actually look like. See docs/SEED_TICKETS.md.
       */
      validityPeriod: 1,
      backgroundColour: '#123c2b',
    },
    activities: [
      {
        name: 'Open class',
        description: 'Open to all grades.',
        fee: 45,
        form: 'fullEntry',
        payment: 'both',
        handlingFeeIncluded: true,
        discounts: ['mhpcFamilyEntry'],
      },
      {
        name: 'Junior class',
        description: 'Under 14s, lower fences.',
        fee: 35,
        form: 'fullEntry',
        payment: 'both',
      },
      {
        name: 'Spectator car pass',
        description: 'One car, any number of passengers.',
        fee: 15,
        form: 'spectator',
        allowSpecifyQuantity: true,
        payment: 'both',
      },
    ],
  },
  {
    key: 'mhpc-winter-dressage',
    org: 'meath',
    name: 'Winter Dressage Series',
    description: 'Three indoor dressage evenings through the winter. Entries not yet open.',
    eventType: 'Dressage',
    venue: 'Kilmessan Equestrian Centre',
    startDays: 90,
    endDays: 90,
    // Not yet open, so Meath has one of every window state too.
    openDays: 30,
    closeDays: 85,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    activities: [
      {
        name: 'Preliminary',
        description: 'Prelim tests.',
        fee: 30,
        form: 'shortEntry',
        payment: 'both',
      },
      {
        name: 'Novice',
        description: 'Novice tests.',
        fee: 30,
        form: 'shortEntry',
        payment: 'both',
      },
    ],
  },
  /* ------------------------------------------- Kildare, entry-restricted
   *
   * Two events for the members-only entry rules, both run by Kildare and both
   * wide open in their entry window — the point of these is *who* may enter, so
   * nothing else about them should be in the way.
   *
   * They are the only seeded activities with an `entryEligibility`; everything
   * above stays `'all'`, which is what it has always been.
   *
   * See docs/MEMBERS_ONLY_ENTRIES.md.
   */
  {
    key: 'khpc-members-cup',
    org: 'kildare',
    name: 'Kildare Members\u2019 Cup',
    description:
      'Club championship, open to Kildare Hunt Pony Club members only. Every activity requires an active membership of this club.',
    eventType: 'Show Jumping',
    venue: 'Craddockstown Equestrian',
    startDays: 35,
    endDays: 35,
    openDays: -7,
    closeDays: 28,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: false,
    activities: [
      {
        /*
         * Uncapped and card-or-offline, so the only thing that can refuse an
         * entry is the membership rule this event exists to demonstrate.
         */
        name: 'Members\u2019 Championship',
        description: 'One round, members of this club only.',
        fee: 20,
        form: 'shortEntry',
        payment: 'both',
        entryEligibility: 'members',
      },
      {
        /*
         * An open activity beside a restricted one, in the same event and the
         * same list. A non-member sees "Members only" on one row and an Enter
         * button on the next, which is the comparison that shows the rule is
         * per activity rather than per event.
         */
        name: 'Open Warm-up Round',
        description: 'Unaffiliated warm-up, open to anyone with an account.',
        fee: 10,
        form: 'shortEntry',
        payment: 'both',
      },
    ],
  },
  {
    key: 'khpc-inter-branch',
    org: 'kildare',
    name: 'Inter-Branch Championship',
    description:
      'Run by Kildare Hunt Pony Club and open to members of every Irish Pony Club branch. Members of Laois, Ward Union and Meath may enter.',
    eventType: 'Cross Country',
    venue: 'Punchestown Event Centre',
    startDays: 49,
    endDays: 49,
    openDays: -3,
    closeDays: 42,
    status: 'published',
    showOnOrganisationPage: true,
    showOnPlatformPage: true,
    activities: [
      {
        /*
         * The activity that makes this event visible to the other three clubs'
         * account users. Nothing else in the seed does, so this is the only
         * subject the "Events at other organisations" section has.
         */
        name: 'Inter-Branch Team Class',
        description: 'Teams of four, one branch each. Open to members of any branch.',
        fee: 30,
        form: 'fullEntry',
        payment: 'both',
        entryEligibility: 'org-type-members',
      },
      {
        /*
         * Restricted to Kildare's own members, in the same event as the
         * federation-wide one. A Laois member sees the team class as enterable
         * and this one as closed to them — the distinction between the second
         * and third options, in a single list.
         */
        name: 'Host Club Class',
        description: 'Kildare members only, run alongside the team class.',
        fee: 25,
        form: 'shortEntry',
        payment: 'both',
        entryEligibility: 'members',
      },
    ],
  },
];

/* ------------------------------------------------------ membership types */

export interface SeedMembershipType {
  key: string;
  name: string;
  description: string;
  /** Seeded form that captures the application. */
  form: string;
  category: 'single' | 'group';
  fee: number;
  status: 'open' | 'closed';
  automaticallyApprove: boolean;
  memberLabels: string[];
  /**
   * A rolling membership runs `months` from the day someone joins. A fixed one
   * runs to the end of the current season, whenever that person joined.
   */
  rolling?: { months: number };
  /** Group types only: how many people one membership may cover. */
  people?: { min: number; max: number; titles: string[] };
  handlingFeeIncluded?: boolean;
  useTermsAndConditions?: boolean;
  /** `DISCOUNTS` keys applied to this membership type. */
  discounts?: string[];
  /** Restricts the type to certain clubs. Absent means every club gets it. */
  onlyOrgs?: Array<SeedOrg['key']>;
}

/**
 * Five types per club, chosen to cover the axes the membership pages branch on:
 * single against group, fixed season against rolling, auto-approval on and off,
 * and a closed type that must not appear as joinable.
 *
 * Payment methods are not listed here. A type can only offer what its club has
 * switched on, so they are intersected with the organisation's methods when the
 * rows are written — Ward Union has no Stripe, and every type there falls back
 * to offline.
 */
/* ---------------------------------------------------------------- entries */

export interface SeedEntry {
  /** The account that made the entry — whose login it sits under. */
  email: string;
  org: SeedOrg['key'];
  /** An `EVENTS` key, and the activity's name within that event. */
  event: string;
  activity: string;
  /**
   * Who the entry is *for*.
   *
   * Not always the account holder: a parent enters each of their children, and
   * a secretary enters a friend who has no login at all. Where the name matches
   * one of that account's seeded memberships the entry is linked to it by
   * `member_id`; where it does not, the entry carries the name alone, which is
   * what an open activity allows.
   */
  firstName: string;
  lastName: string;
  paymentStatus: 'paid' | 'pending';
  payment: 'card' | 'offline';
  /** Days ago the entry was made. Drives `entry_date`, and so the recent order. */
  enteredDaysAgo: number;
  /**
   * A basket this was bought in, shared with anything else naming it.
   *
   * Omitted means a basket of its own, which is the ordinary case. Naming one
   * is how the fixture produces a payment with several lines — two entries, a
   * membership renewal, a shop order — which is what a family checking out at
   * the start of a season actually does, and what the payment detail screen
   * exists to itemise.
   */
  basket?: string;
  /**
   * How this entry's ticket stands, on an event that issues them.
   *
   * A ticket is issued for **every** entry on a ticketing event — that is what
   * `fulfilment.service` does, so the fixture does not ask for one. What it says
   * here is what happened to the ticket afterwards, which is the part a club
   * looks at:
   *
   * | | |
   * |---|---|
   * | `issued` | nobody has scanned it — the state every ticket is in before the day, and the default |
   * | `scanned` | admitted at the gate |
   * | `scannedTwice` | presented a second time: `scan_count` 2 and two scans in its history, which is how a duplicate shows |
   * | `cancelled` | the entry came off and the ticket with it |
   *
   * Only meaningful on an event configured for tickets; naming one elsewhere is
   * a fixture that would silently do nothing, and the writer refuses it.
   */
  ticket?: { state: 'issued' | 'scanned' | 'scannedTwice' | 'cancelled'; location?: string };
}

/**
 * Entries that have already been made.
 *
 * The seed used to create none, and "no entries, payments or carts are seeded"
 * was a documented limit rather than an oversight. It cost more than it looked
 * like: a club with eighteen events and not one entrant cannot show a member's
 * own history, cannot exercise an organiser's entrant list, and — since the
 * entry form began offering the names an account has used before — cannot
 * demonstrate that at all.
 *
 * **Weighted towards events that have finished or closed.** An entry against a
 * live activity is a place taken, and on a members-only one a member who can no
 * longer be entered; a fixture that quietly consumed the thing it exists to let
 * you test would be worse than none. The past show and the closed dressage
 * carry the history; two live events carry an entrant apiece so an organiser's
 * list is not empty either.
 *
 * Áine McGrath is the one to look at: four memberships, four names entered, and
 * a fifth for a friend with no login — five distinct names on one account,
 * which is what the entry form's "used before" list is sized for.
 */
export const ENTRIES: SeedEntry[] = [
  /* ---- Kildare: Áine's household, on events that have been and gone ---- */
  /*
   * One basket, four lines.
   *
   * Two children entered, the family membership renewed and a hoodie, paid for
   * together — which is what a household actually does at the start of a
   * season, and the case the payment detail screen exists to itemise. Anything
   * naming `mcgrath-season` joins it, including the membership in `MEMBERS` and
   * the hoodie in `SHOP_ORDERS`. Every line in a basket must agree on status
   * and method: a basket settles once. `database.ts` refuses one that does not.
   */
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-past-event', activity: '80cm', firstName: 'Áine', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 110, basket: 'mcgrath-season' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-past-event', activity: '80cm', firstName: 'Rónán', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 110, basket: 'mcgrath-season' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-past-event', activity: '1.00m', firstName: 'Conor', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 69 },
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-dressage-closed', activity: 'Preliminary 1', firstName: 'Éabha', lastName: 'McGrath', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 21 },
  /*
   * A name with no membership behind it, and the most recent of the five.
   *
   * Open activities accept a typed name, and this is what one looks like once
   * it has been used: offered back as a suggestion, with nothing to link it to.
   */
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-dressage-closed', activity: 'Novice 2', firstName: 'Tadhg', lastName: 'Nolan', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 12 },

  /*
   * ---- Five baskets on one account, for the handling-fee cases -----------
   *
   * All on Áine McGrath at Kildare, so every combination can be walked through
   * from one login without switching clubs.
   *
   * The handling fee is charged on **card** lines whose price does not already
   * absorb it. Which items those are is the club's decision and lives on the
   * item, so these baskets are composed from activities and products that
   * already carry the flag they need rather than overriding it:
   *
   *   Spring League grades, the club hoodie   handling fee included
   *   everything else at Kildare              handling fee added on
   *
   *   1  all card, fee added on      two fee-bearing entries
   *   2  all card, fee included      entry + hoodie, so no fee at all — not
   *                                  even the fixed element (rule 3)
   *   3  all card, one of each       only the added-on line bears it
   *   4  card added-on + offline     fee on the card line; the offline one is
   *                                  owed to the club and bears nothing
   *   5  card included + offline     no fee anywhere, and still two methods
   */
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-past-event', activity: '80cm', firstName: 'Áine', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 64, basket: 'fees-1-card-added' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-past-event', activity: '1.00m', firstName: 'Rónán', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 64, basket: 'fees-1-card-added' },

  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-spring-league', activity: 'Grade 1 — 80cm', firstName: 'Éabha', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 34, basket: 'fees-2-card-included' },

  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-spring-league', activity: 'Grade 3 — 1.00m', firstName: 'Conor', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 33, basket: 'fees-3-card-mixed' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-dressage-closed', activity: 'Preliminary 1', firstName: 'Áine', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 33, basket: 'fees-3-card-mixed' },

  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-dressage-closed', activity: 'Novice 2', firstName: 'Rónán', lastName: 'McGrath', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 32, basket: 'fees-4-added-and-offline' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-hunter-trial', activity: 'Pairs class', firstName: 'Conor', lastName: 'McGrath', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 32, basket: 'fees-4-added-and-offline' },

  { email: 'aine.mcgrath@example.test', org: 'kildare', event: 'khpc-members-cup', activity: 'Open Warm-up Round', firstName: 'Éabha', lastName: 'McGrath', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 31, basket: 'fees-5-included-and-offline' },

  /* ---- Kildare: other members, so an entrant list has more than one name -- */
  { email: 'cillian.murphy@example.test', org: 'kildare', event: 'khpc-past-event', activity: '1.00m', firstName: 'Cillian', lastName: 'Murphy', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 68 },
  { email: 'saoirse.brennan@example.test', org: 'kildare', event: 'khpc-past-event', activity: '80cm', firstName: 'Saoirse', lastName: 'Brennan', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 66 },
  /* Entered and not yet paid — what an organiser chasing money is looking at. */
  { email: 'orla.kavanagh@example.test', org: 'kildare', event: 'khpc-hunter-trial', activity: 'Pairs class', firstName: 'Órla', lastName: 'Kavanagh', paymentStatus: 'pending', payment: 'offline', enteredDaysAgo: 3 },
  { email: 'niamh.walsh@example.test', org: 'kildare', event: 'khpc-spring-league', activity: 'Grade 2 — 90cm', firstName: 'Niamh', lastName: 'Walsh', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 1 },

  /* ---- The rest of Kildare and Laois, on events already run or shut ----- */
  { email: 'padraig.quinn@example.test', org: 'kildare', event: 'khpc-past-event', activity: '1.00m', firstName: 'Pádraig', lastName: 'Quinn', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 67 },
  { email: 'sinead.gallagher@example.test', org: 'kildare', event: 'khpc-dressage-closed', activity: 'Preliminary 1', firstName: 'Sinéad', lastName: 'Gallagher', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 25 },
  /* Entered while their own membership application was still pending. */
  { email: 'fionn.doyle@example.test', org: 'kildare', event: 'khpc-past-event', activity: '80cm', firstName: 'Fionn', lastName: 'Doyle', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 65 },
  { email: 'oisin.farrell@example.test', org: 'laois', event: 'lhpc-closed', activity: 'Novice', firstName: 'Oisín', lastName: 'Farrell', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 18 },
  { email: 'clodagh.moran@example.test', org: 'laois', event: 'lhpc-closed', activity: 'Novice', firstName: 'Clodagh', lastName: 'Moran', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 16 },
  { email: 'darragh.otoole@example.test', org: 'laois', event: 'lhpc-closed', activity: 'Novice', firstName: "Darragh", lastName: "O'Toole", paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 15 },

  /*
   * ---- Ward and Meath -------------------------------------------------
   *
   * Neither club has an event that has finished or closed, so these sit on
   * live ones — and every activity used here is **uncapped**, so an entry
   * takes nothing from the limited classes those events exist to demonstrate.
   */
  { email: 'tadhg.nolan@example.test', org: 'ward', event: 'wupc-league-open', activity: 'Senior track', firstName: 'Tadhg', lastName: 'Nolan', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 9 },
  { email: 'grainne.duffy@example.test', org: 'ward', event: 'wupc-league-open', activity: 'Senior track', firstName: 'Gráinne', lastName: 'Duffy', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 8 },
  { email: 'eoin.brady@example.test', org: 'ward', event: 'wupc-closing-soon', activity: 'Individual ticket', firstName: 'Eoin', lastName: 'Brady', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 7 },
  { email: 'maire.flynn@example.test', org: 'ward', event: 'wupc-open-day', activity: 'Family ticket', firstName: 'Máire', lastName: 'Flynn', paymentStatus: 'pending', payment: 'offline', enteredDaysAgo: 6 },
  /*
   * Lorcán holds his children's memberships and none of his own, so the entry
   * on his account is in a child's name. An account whose entries are never
   * the account holder's is the case a screen headed by the login gets wrong.
   */
  { email: 'lorcan.hayes@example.test', org: 'ward', event: 'wupc-open-day', activity: 'Family ticket', firstName: 'Cathal', lastName: 'Hayes', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 5 },
  /*
   * The gate day that has run. One entry per ticket state, so the scanning
   * history and the duplicate-use report have something to show.
   */
  { email: 'brid.mcnamara@example.test', org: 'meath', event: 'mhpc-gate-day', activity: 'Open class', firstName: 'Bríd', lastName: 'McNamara', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 30, ticket: { state: 'scanned', location: 'Main gate' } },
  { email: 'colm.fitzgerald@example.test', org: 'meath', event: 'mhpc-gate-day', activity: 'Open class', firstName: 'Colm', lastName: 'Fitzgerald', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 28, ticket: { state: 'scanned', location: 'Main gate' } },
  // Presented the same ticket twice — the case the scan history exists for.
  { email: 'darragh.otoole@example.test', org: 'meath', event: 'mhpc-gate-day', activity: 'Open class', firstName: "Éabha", lastName: "O'Toole", paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 26, ticket: { state: 'scannedTwice', location: 'Main gate' } },
  // Entered, paid, never came: a ticket that stays unscanned after the day.
  { email: 'seamus.donnelly@example.test', org: 'meath', event: 'mhpc-gate-day', activity: 'Junior class', firstName: 'Séamus', lastName: 'Donnelly', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 25, ticket: { state: 'issued' } },
  // Withdrew beforehand, so the ticket was cancelled rather than scanned.
  { email: 'maeve.kiernan@example.test', org: 'meath', event: 'mhpc-gate-day', activity: 'Junior class', firstName: 'Maeve', lastName: 'Kiernan', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 24, ticket: { state: 'cancelled' } },
  { email: 'aoibhinn.regan@example.test', org: 'meath', event: 'mhpc-gate-day', activity: 'Junior class', firstName: 'Aoibhínn', lastName: 'Regan', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 22, ticket: { state: 'scanned', location: 'Junior ring' } },

  { email: 'colm.fitzgerald@example.test', org: 'meath', event: 'mhpc-tara-hunter-trial', activity: 'Junior class', firstName: 'Colm', lastName: 'Fitzgerald', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 11 },
  /*
   * Today's gate. Mostly unscanned, because an unscanned ticket that is valid
   * now is the only thing the scanner can actually be tried against — and
   * spread across five accounts, so whichever member you sign in as has one in
   * hand rather than a page of expired ones.
   */
  { email: 'brid.mcnamara@example.test', org: 'meath', event: 'mhpc-gate-today', activity: 'Open class', firstName: 'Bríd', lastName: 'McNamara', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 12, ticket: { state: 'issued' } },
  { email: 'darragh.otoole@example.test', org: 'meath', event: 'mhpc-gate-today', activity: 'Open class', firstName: "Darragh", lastName: "O'Toole", paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 11, ticket: { state: 'issued' } },
  { email: 'seamus.donnelly@example.test', org: 'meath', event: 'mhpc-gate-today', activity: 'Junior class', firstName: 'Séamus', lastName: 'Donnelly', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 10, ticket: { state: 'issued' } },
  { email: 'maeve.kiernan@example.test', org: 'meath', event: 'mhpc-gate-today', activity: 'Junior class', firstName: 'Maeve', lastName: 'Kiernan', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 9, ticket: { state: 'issued' } },
  // Two already admitted, so the morning reads as a morning.
  { email: 'colm.fitzgerald@example.test', org: 'meath', event: 'mhpc-gate-today', activity: 'Open class', firstName: 'Colm', lastName: 'Fitzgerald', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 14, ticket: { state: 'scanned', location: 'Main gate' } },
  { email: 'aoibhinn.regan@example.test', org: 'meath', event: 'mhpc-gate-today', activity: 'Junior class', firstName: 'Aoibhínn', lastName: 'Regan', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 8, ticket: { state: 'scanned', location: 'Junior ring' } },
  /*
   * The family car pass — the one seeded ticket that admits four. Scan it four
   * times and the fifth is refused; nothing else in the fixture can show that,
   * because everything else admits one and looks the same used as used up.
   */
  { email: 'maeve.kiernan@example.test', org: 'meath', event: 'mhpc-gate-today', activity: 'Family car pass', firstName: 'Maeve', lastName: 'Kiernan', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 7, ticket: { state: 'issued' } },

  { email: 'aoibhinn.regan@example.test', org: 'meath', event: 'mhpc-summer-camp', activity: 'Day ticket', firstName: 'Aoibhínn', lastName: 'Regan', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 10 },
  { email: 'seamus.donnelly@example.test', org: 'meath', event: 'mhpc-tara-hunter-trial', activity: 'Open class', firstName: 'Séamus', lastName: 'Donnelly', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 9 },
  { email: 'maeve.kiernan@example.test', org: 'meath', event: 'mhpc-tara-hunter-trial', activity: 'Spectator car pass', firstName: 'Maeve', lastName: 'Kiernan', paymentStatus: 'pending', payment: 'offline', enteredDaysAgo: 8 },

  /*
   * ---- The second club, for the people who belong to more than one ------
   *
   * An entry belongs to an account's row in **one** organisation
   * (`event_entries.user_id`), so a member of three clubs who has entered at
   * one still sees an empty "My entries" at the other two. That reads as
   * broken rather than as empty, and it is the screen an organisation switch
   * lands on. Every login now has something to look at in every club it
   * belongs to.
   */
  { email: 'cillian.murphy@example.test', org: 'laois', event: 'lhpc-closed', activity: 'Novice', firstName: 'Cillian', lastName: 'Murphy', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 14 },
  { email: 'cillian.murphy@example.test', org: 'ward', event: 'wupc-open-day', activity: 'Family ticket', firstName: 'Cillian', lastName: 'Murphy', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 4 },
  { email: 'darragh.otoole@example.test', org: 'meath', event: 'mhpc-tara-hunter-trial', activity: 'Open class', firstName: "Darragh", lastName: "O'Toole", paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 13 },
  { email: 'darragh.otoole@example.test', org: 'ward', event: 'wupc-closing-soon', activity: 'Individual ticket', firstName: "Darragh", lastName: "O'Toole", paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 3 },
  { email: 'fionn.doyle@example.test', org: 'ward', event: 'wupc-open-day', activity: 'Family ticket', firstName: 'Fionn', lastName: 'Doyle', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 2 },
  { email: 'niamh.walsh@example.test', org: 'laois', event: 'lhpc-closed', activity: 'Novice', firstName: 'Niamh', lastName: 'Walsh', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 17 },
  { email: 'niamh.walsh@example.test', org: 'meath', event: 'mhpc-summer-camp', activity: 'Day ticket', firstName: 'Niamh', lastName: 'Walsh', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 12 },
  { email: 'niamh.walsh@example.test', org: 'ward', event: 'wupc-league-open', activity: 'Senior track', firstName: 'Niamh', lastName: 'Walsh', paymentStatus: 'pending', payment: 'offline', enteredDaysAgo: 2 },
  /*
   * And one she has paid for at the same club.
   *
   * Ward was the only login-and-club pair whose single purchase was the unpaid
   * one, so its Payments page was empty — correctly, since that list is money
   * that moved and an unpaid entry is not — but indistinguishable from a page
   * that was broken. Two entries at one club with different statuses is the
   * pair worth having: one shows on Payments, one explains why the other does
   * not.
   */
  { email: 'niamh.walsh@example.test', org: 'ward', event: 'wupc-open-day', activity: 'Family ticket', firstName: 'Niamh', lastName: 'Walsh', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 16 },
  { email: 'orla.kavanagh@example.test', org: 'laois', event: 'lhpc-closed', activity: 'Novice', firstName: 'Órla', lastName: 'Kavanagh', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 19 },
  { email: 'sinead.gallagher@example.test', org: 'laois', event: 'lhpc-closed', activity: 'Novice', firstName: 'Sinéad', lastName: 'Gallagher', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 20 },

  /* ---- Laois and Meath, so Kildare is not the only club with a history --- */
  { email: 'ruairi.kelly@example.test', org: 'laois', event: 'lhpc-league', activity: '70cm', firstName: 'Ruairí', lastName: 'Kelly', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 5 },
  { email: 'eoin.sheridan@example.test', org: 'laois', event: 'lhpc-league', activity: 'Spectator pass', firstName: 'Eoin', lastName: 'Sheridan', paymentStatus: 'paid', payment: 'offline', enteredDaysAgo: 4 },
  /*
   * A smaller basket, and a different mixture: an entry, the horse's papers and
   * a cap. Meath is the club with registrations, so it is the only place this
   * combination can exist.
   */
  { email: 'brid.mcnamara@example.test', org: 'meath', event: 'mhpc-tara-hunter-trial', activity: 'Open class', firstName: 'Bríd', lastName: 'McNamara', paymentStatus: 'paid', payment: 'card', enteredDaysAgo: 6, basket: 'mcnamara-day' },
];

/* ------------------------------------------------------------- shop orders */

export interface SeedShopOrder {
  /** The account that placed it. */
  email: string;
  org: SeedOrg['key'];
  /** A `MERCHANDISE` key, and the option value chosen, by its name. */
  item: string;
  option: string;
  quantity: number;
  paymentStatus: 'paid' | 'pending';
  payment: 'card' | 'offline';
  orderedDaysAgo: number;
  /** A basket shared with other purchases. See `SeedEntry.basket`. */
  basket?: string;
}

/**
 * Shop orders that have already been placed.
 *
 * Few, and only for what they demonstrate: the shop is a whole module of its
 * own and a fixture of orders is not what this seed is for. What it *is* for is
 * a payment with a shirt on it beside an entry and a membership — the basket a
 * family fills at the start of a season, which is the case the payment detail
 * screen exists to itemise and which nothing else here produces.
 */
export const SHOP_ORDERS: SeedShopOrder[] = [
  { email: 'aine.mcgrath@example.test', org: 'kildare', item: 'club-hoodie', option: 'Age 12–14', quantity: 1, paymentStatus: 'paid', payment: 'card', orderedDaysAgo: 110, basket: 'mcgrath-season' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', item: 'baseball-cap', option: 'Navy', quantity: 2, paymentStatus: 'paid', payment: 'card', orderedDaysAgo: 40 },
  /* The hoodie's price absorbs its handling fee, which is what baskets 2 and 5 need. */
  { email: 'aine.mcgrath@example.test', org: 'kildare', item: 'club-hoodie', option: 'Small', quantity: 1, paymentStatus: 'paid', payment: 'card', orderedDaysAgo: 34, basket: 'fees-2-card-included' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', item: 'club-hoodie', option: 'Medium', quantity: 1, paymentStatus: 'paid', payment: 'card', orderedDaysAgo: 31, basket: 'fees-5-included-and-offline' },
  { email: 'brid.mcnamara@example.test', org: 'meath', item: 'mhpc-show-cap', option: 'One size', quantity: 1, paymentStatus: 'paid', payment: 'card', orderedDaysAgo: 6, basket: 'mcnamara-day' },
];

export interface SeedBooking {
  email: string;
  org: SeedOrg['key'];
  /** A `CALENDARS` key. */
  calendar: string;
  /** Days from the run. Negative is in the past; positive is still to come. */
  daysFromNow: number;
  /** `HH:MM`, matching one of the calendar's slots. */
  startTime: string;
  /** Minutes. Must be one of that slot's durations — the price comes from it. */
  duration: number;
  places?: number;
  status?: 'confirmed' | 'cancelled';
  paymentStatus: 'paid' | 'pending';
  payment: 'card' | 'offline';
  /**
   * Days ago the member booked it. Defaults to a fortnight before the slot.
   *
   * Set it explicitly where two bookings share a basket: they were paid for in
   * one go, so they cannot have been booked on different days.
   */
  bookedDaysAgo?: number;
  /** A basket shared with other purchases. See `SeedEntry.basket`. */
  basket?: string;
}

/**
 * Bookings members have already made.
 *
 * The calendars, their slots and their blocked periods were all seeded and
 * **no booking ever was**, so a club had a booking module with nothing in it —
 * and, more to the point here, no payment anywhere in the seed carried a
 * `booking` line. The payment screens could not be checked against one, and
 * neither could the click-through to a booking.
 *
 * Chosen for the cases the screens branch on rather than for volume: a booking
 * on its own, a booking beside other things in one basket, one owed offline
 * (so it appears under Offline Payments with a booking in it), one already
 * past, and one cancelled.
 *
 * `daysFromNow` is a target, not a date: the writer moves it to the nearest day
 * the slot actually runs. A fixed offset lands on a different weekday every
 * time the seed is run, so a booking pinned to one would sit outside its own
 * slot most days of the week.
 */
export const BOOKINGS: SeedBooking[] = [
  /* ------------------------------------------------------------- Laois */
  // A booking on its own, paid by card: the simplest payment with a booking.
  {
    email: 'orla.kavanagh@example.test',
    org: 'laois',
    calendar: 'arena',
    daysFromNow: 9,
    startTime: '17:00',
    duration: 60,
    paymentStatus: 'paid',
    payment: 'card',
  },
  /*
   * Two bookings in one basket — a member booking the arena and a lesson in one
   * go. The case the itemised payment detail exists for, with lines that lead
   * to bookings rather than to entries.
   */
  {
    email: 'niamh.walsh@example.test',
    org: 'laois',
    calendar: 'arena',
    daysFromNow: 12,
    startTime: '09:00',
    duration: 120,
    paymentStatus: 'paid',
    payment: 'card',
    bookedDaysAgo: 3,
    basket: 'walsh-arena-day',
  },
  {
    email: 'niamh.walsh@example.test',
    org: 'laois',
    calendar: 'lessons',
    daysFromNow: 14,
    startTime: '18:30',
    duration: 60,
    paymentStatus: 'paid',
    payment: 'card',
    bookedDaysAgo: 3,
    basket: 'walsh-arena-day',
  },
  // Owed to the club: an offline basket with a booking in it, which is what
  // puts a booking under Offline Payments.
  {
    email: 'ruairi.kelly@example.test',
    org: 'laois',
    calendar: 'lessons',
    daysFromNow: 6,
    startTime: '18:30',
    duration: 60,
    paymentStatus: 'pending',
    payment: 'offline',
    basket: 'kelly-lesson',
  },
  // Been and gone, so the past-booking case is represented.
  {
    email: 'eoin.sheridan@example.test',
    org: 'laois',
    calendar: 'cross-country',
    daysFromNow: -11,
    startTime: '10:00',
    duration: 180,
    paymentStatus: 'paid',
    payment: 'card',
  },
  /*
   * Cancelled but paid for. The money still changed hands, so the payment
   * stands and the booking says why it is not happening — which is the state a
   * refund is asked about.
   */
  {
    email: 'clodagh.moran@example.test',
    org: 'laois',
    calendar: 'arena',
    daysFromNow: 4,
    startTime: '17:00',
    duration: 30,
    status: 'cancelled',
    paymentStatus: 'paid',
    payment: 'card',
  },
  /* ------------------------------------------------------------- Meath */
  {
    email: 'darragh.otoole@example.test',
    org: 'meath',
    calendar: 'mhpc-indoor-arena',
    daysFromNow: 15,
    // Not 19:00: that half-hour is blocked for harrowing, and a seeded booking
    // inside a blocked period is a state the application refuses to create.
    startTime: '17:00',
    duration: 60,
    paymentStatus: 'paid',
    payment: 'card',
  },
];

export interface SeedRefund {
  /**
   * The basket the money came out of — a `basket` name where several purchases
   * shared a payment, otherwise the email and the thing bought, which is how a
   * single-line payment is identified.
   */
  basket?: string;
  email?: string;
  org: SeedOrg['key'];
  /**
   * The item refunded, where the refund was of one item.
   *
   * Matched against the payment's lines — a description substring, and the
   * entrant's name where two lines of a basket read identically, which two
   * children entered in the same class do. A refund that names an item is
   * written with scope `items` and linked to the line, so the item itself shows
   * as refunded and cannot be refunded twice.
   *
   * The amount then comes from the line: its fee plus the share of the handling
   * fee it bore, which is what the member paid for it.
   */
  item?: { description?: string; subject?: string };
  /** Minor units. Omit to refund the whole payment, or name an `item` instead. */
  amountMinor?: number;
  reason: string;
  /** `completed` — the money has gone back; `pending` — asked for, not yet sent. */
  status: 'completed' | 'pending';
  daysAgo: number;
}

/**
 * Refunds the clubs have made.
 *
 * Four, chosen for the states the Refunds screen has to tell apart rather than
 * for volume: a whole payment returned, part of one returned, a refund still
 * waiting to be sent, and one against a basket of several items — where the
 * amount refunded matches a single line and the rest of the payment stands.
 *
 * The seed used to mark a membership's payment `refunded` and record no refund
 * at all, so every refund screen was empty against data that claimed refunds
 * had happened.
 */
/**
 * A notice a club shows its members when they sign in.
 *
 * The window is written in days from the seed run rather than as dates, like
 * everything else here, so a database seeded in March still has a notice
 * showing in September.
 */
export interface SeedAnnouncement {
  org: SeedOrg['key'];
  title: string;
  /** HTML, as the rich-text editor writes it. */
  description: string;
  /** Days from today. Negative is in the past. */
  fromDays: number;
  untilDays: number;
  /** How the picture is used, where there is one. */
  image?: 'background' | 'header' | 'footer';
  /** Where the notice points. Both halves or neither. */
  link?: { label: string; url: string };
}

/**
 * Kildare's notices, chosen for the states the screens have to tell apart.
 *
 * One showing now with a background image, one showing now with none, one still
 * to start and one already finished — so the admin list has all three of its
 * badges and the member's home page has a column with two cards in it.
 *
 * **No image files.** The seed writes rows, not S3 objects, and a key pointing
 * at an object that does not exist would render as a broken picture on the one
 * screen this feature exists for. `image` records the club's *intent* for the
 * placement; the picture is attached from the org-admin, which is the only
 * place that can upload one.
 */
export const ANNOUNCEMENTS: SeedAnnouncement[] = [
  {
    org: 'kildare',
    title: 'Clubhouse closed this Saturday',
    description:
      '<p>The clubhouse is closed all day on Saturday while the floor is replaced. ' +
      'The yard and the arenas are open as usual.</p>',
    fromDays: -2,
    untilDays: 5,
  },
  {
    org: 'kildare',
    title: 'Summer camp booking is open',
    description:
      '<p>Places for the August camp are open now and go quickly. ' +
      '<strong>Book through the Camps page</strong> — a deposit holds a place.</p>',
    fromDays: -6,
    untilDays: 21,
    // The one notice that points somewhere, so the link renders in a seeded
    // database rather than only in a club that has typed one.
    link: { label: 'Book a place', url: 'https://kildarehunt.test/camp' },
  },
  {
    org: 'kildare',
    title: 'AGM: 14 October, 7.30pm',
    description:
      '<p>The AGM is in the clubhouse. Nominations for the committee close a week beforehand.</p>',
    // Not showing yet — what the "Scheduled" badge is for.
    fromDays: 20,
    untilDays: 45,
  },
  {
    org: 'kildare',
    title: 'Winter league results',
    description: '<p>Thanks to everyone who came out. Full results are on the noticeboard.</p>',
    // Over — the list keeps it, the members no longer see it.
    fromDays: -120,
    untilDays: -60,
  },
];

export const REFUNDS: SeedRefund[] = [
  // A whole membership returned: the member moved away mid-season.
  {
    email: 'clodagh.moran@example.test',
    org: 'laois',
    reason: 'Member moved out of the area; season subscription returned in full.',
    status: 'completed',
    daysAgo: 40,
  },
  // Part of a four-line basket: one child withdrew from the class he entered.
  // Two children entered the same class, so the entrant's name is what tells
  // the two identical lines apart.
  {
    basket: 'mcgrath-season',
    org: 'kildare',
    item: { description: '80cm', subject: 'Rónán McGrath' },
    reason: 'Rónán withdrew from the 80cm before the closing date.',
    status: 'completed',
    daysAgo: 96,
  },
  // Asked for and not yet sent — what the pending state is for.
  {
    basket: 'mcnamara-day',
    org: 'meath',
    item: { description: 'Show cap' },
    reason: 'Cap ordered in the wrong size; refund agreed, awaiting the transfer.',
    status: 'pending',
    daysAgo: 6,
  },
  // A part refund on a fee-scenario basket, so the handling fee and a refund
  // appear on one payment.
  {
    basket: 'fees-1-card-added',
    org: 'kildare',
    item: { description: '1.00m' },
    reason: 'Class cancelled for waterlogging; entry fee returned.',
    status: 'completed',
    daysAgo: 12,
  },
];

export const MEMBERSHIP_TYPES: SeedMembershipType[] = [
  {
    key: 'junior',
    name: 'Junior Member',
    description: 'Riding membership for anyone under 18 on 1 January. Runs to the end of the season.',
    form: 'membershipSingle',
    category: 'single',
    fee: 45,
    status: 'open',
    automaticallyApprove: true,
    memberLabels: ['Junior'],
    discounts: ['juniorMembership'],
  },
  {
    key: 'senior',
    name: 'Senior Member',
    description: 'Riding membership for 18 and over. Applications are reviewed before approval.',
    form: 'membershipSingle',
    category: 'single',
    fee: 75,
    status: 'open',
    automaticallyApprove: false,
    memberLabels: ['Senior'],
    useTermsAndConditions: true,
    discounts: ['earlyRenewal'],
  },
  {
    key: 'family',
    name: 'Family Membership',
    description: 'One membership covering a household: up to two adults and three children.',
    form: 'membershipFamily',
    category: 'group',
    fee: 96,
    status: 'open',
    automaticallyApprove: false,
    memberLabels: ['Family'],
    discounts: ['familyMembership'],
    people: { min: 2, max: 5, titles: ['Adult', 'Adult', 'Child', 'Child', 'Child'] },
    handlingFeeIncluded: true,
    useTermsAndConditions: true,
  },
  {
    key: 'associate',
    name: 'Associate Member',
    description: 'Non-riding membership for helpers and supporters. Runs twelve months from joining.',
    form: 'membershipSingle',
    category: 'single',
    fee: 30,
    status: 'open',
    automaticallyApprove: true,
    memberLabels: ['Associate', 'Non-riding'],
    rolling: { months: 12 },
  },
  {
    key: 'founder',
    name: 'Founder Member',
    description: 'Closed to new applications. Held by members who joined before the club reorganised.',
    form: 'membershipSingle',
    category: 'single',
    fee: 0,
    status: 'closed',
    automaticallyApprove: false,
    memberLabels: ['Founder', 'Life'],
    onlyOrgs: ['kildare'],
  },
];

/* ------------------------------------------------------------- members */

export interface SeedMember {
  /**
   * The account user who **holds** the membership — whose login it appears
   * under. Not necessarily the person it is for: a parent holds their
   * children's, so several members here share one email.
   */
  email: string;
  org: SeedOrg['key'];
  /** A `MEMBERSHIP_TYPES` key. */
  type: string;
  status: 'active' | 'pending' | 'elapsed';
  paymentStatus: 'paid' | 'pending' | 'refunded';
  payment?: 'pay-offline' | 'stripe';
  /** A basket shared with other purchases. See `SeedEntry.basket`. */
  basket?: string;
  /**
   * Which season the membership belongs to.
   *
   *   current    runs to the end of this year
   *   expiring   runs out within the renewal window, so renewal is due now
   *   previous   ran to the end of last year — what an elapsed member looks like
   */
  season: 'current' | 'expiring' | 'previous';
  /** Days ago the membership was taken out or last renewed. */
  renewedDaysAgo: number;
  labels?: string[];
  /**
   * People sharing a group membership carry the same tag. The tag becomes one
   * `group_membership_id`, and slots are numbered in the order listed here.
   */
  household?: string;
  /**
   * Who the membership is *for*, when that is not the holder.
   *
   * A child has no login of their own — `members` carries their name while
   * `user_id` points at the parent. Omitted, the holder's own name is used,
   * which is the ordinary case of a member holding their own membership.
   */
  firstName?: string;
  lastName?: string;
}

/**
 * Members for this season, across all five types and all three clubs.
 *
 * ## One person, one club
 *
 * **Nobody here holds an active membership in more than one organisation.** A
 * person belongs to a club; they do not belong to three at once, and seed data
 * that says otherwise describes something the domain does not allow.
 *
 * It is worth stating because the seed *does* deliberately give people logins at
 * several clubs — `ACCOUNT_USERS` overlaps heavily, to exercise the organisation
 * switcher — and an account at a club is a different thing from a membership of
 * it. Niamh Walsh has a login at all four and is a member of Laois.
 *
 * The distinction became load-bearing with the federation entry option: a member
 * of one branch entering another branch's event is the whole case, and it cannot
 * be tested by someone who happens to be a member of both. Niamh held Kildare,
 * Laois and Ward memberships, and her Kildare one masked the very thing the
 * fixture was meant to show.
 *
 * An **elapsed** membership at a different club is a different matter and is
 * kept: it says the person moved clubs, which is ordinary. Niamh's elapsed Meath
 * membership sits behind her active Laois one for exactly that reason.
 *
 * The mix is deliberate rather than uniform: active members alongside a pending
 * application awaiting approval, an elapsed member from last season who has not
 * renewed, an unpaid membership, a refunded one, and two households on group
 * memberships. A member list where every row is identical proves nothing about
 * the filters and batch actions the page is built around.
 */
export const MEMBERS: SeedMember[] = [
  /* ------------------------------------------------------------ Kildare */
  { email: 'cillian.murphy@example.test', org: 'kildare', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 96 },
  { email: 'orla.kavanagh@example.test', org: 'kildare', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 88 },
  { email: 'saoirse.brennan@example.test', org: 'kildare', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 61 },
  { email: 'fionn.doyle@example.test', org: 'kildare', type: 'junior', status: 'pending', paymentStatus: 'pending', payment: 'pay-offline', season: 'current', renewedDaysAgo: 4 },
  { email: 'padraig.quinn@example.test', org: 'kildare', type: 'associate', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 45 },
  { email: 'sinead.gallagher@example.test', org: 'kildare', type: 'founder', status: 'active', paymentStatus: 'paid', season: 'current', renewedDaysAgo: 300, labels: ['Committee'] },
  /*
   * One login, four memberships — the parent case.
   *
   * Áine holds her own membership and her three children's. None of the
   * children has a login: `members` carries their names while `user_id` points
   * at Áine, which is what a screen headed by the membership *type* cannot
   * distinguish. Her Senior membership is also the one expiring first, so her
   * dashboard has to say which of the four it is talking about.
   */
  { email: 'aine.mcgrath@example.test', org: 'kildare', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'expiring', renewedDaysAgo: 340 },
  { email: 'aine.mcgrath@example.test', org: 'kildare', type: 'family', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 110, household: 'mcgrath', firstName: 'Conor', lastName: 'McGrath', basket: 'mcgrath-season' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', type: 'family', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 110, household: 'mcgrath', firstName: 'Éabha', lastName: 'McGrath' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 95, firstName: 'Rónán', lastName: 'McGrath' },

  /*
   * Three more active members, so the clubs are not one household deep.
   *
   * Niamh and Cillian give Kildare and Ward a member apiece whose login holds
   * exactly one membership — the ordinary case, and the one the entry form's
   * suggestions are simplest to read against. Órla's Laois membership makes her
   * a member of two clubs at once, which is what the federation-wide entry
   * option is for: a name that is eligible somewhere else.
   */
  { email: 'niamh.walsh@example.test', org: 'kildare', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 52 },

  /* -------------------------------------------------------------- Laois */
  { email: 'niamh.walsh@example.test', org: 'laois', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 74 },
  { email: 'ruairi.kelly@example.test', org: 'laois', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 52 },
  // Playing but not yet paid up — the case the unpaid filter exists for.
  { email: 'oisin.farrell@example.test', org: 'laois', type: 'junior', status: 'active', paymentStatus: 'pending', payment: 'pay-offline', season: 'current', renewedDaysAgo: 30 },
  { email: 'clodagh.moran@example.test', org: 'laois', type: 'senior', status: 'active', paymentStatus: 'refunded', payment: 'stripe', season: 'current', renewedDaysAgo: 66 },
  { email: 'eoin.sheridan@example.test', org: 'laois', type: 'associate', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 20 },
  { email: 'orla.kavanagh@example.test', org: 'laois', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 27 },
  // Last season's member who has not come back.
  { email: 'darragh.otoole@example.test', org: 'laois', type: 'senior', status: 'elapsed', paymentStatus: 'paid', payment: 'stripe', season: 'previous', renewedDaysAgo: 400 },

  /* --------------------------------------------------------------- Ward */
  { email: 'eoin.brady@example.test', org: 'ward', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 58 },
  { email: 'grainne.duffy@example.test', org: 'ward', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 41 },
  { email: 'maire.flynn@example.test', org: 'ward', type: 'associate', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 15 },
  { email: 'cillian.murphy@example.test', org: 'ward', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 33 },
  /*
   * A second parent, and the other renewal that is due. Lorcán holds two of his
   * children's memberships and nothing of his own, which is the case where a
   * screen naming only the holder would be wrong on every card.
   */
  { email: 'lorcan.hayes@example.test', org: 'ward', type: 'family', status: 'active', paymentStatus: 'pending', payment: 'pay-offline', season: 'expiring', renewedDaysAgo: 350, household: 'hayes', firstName: 'Maeve', lastName: 'Hayes' },
  { email: 'lorcan.hayes@example.test', org: 'ward', type: 'family', status: 'active', paymentStatus: 'pending', payment: 'pay-offline', season: 'expiring', renewedDaysAgo: 350, household: 'hayes', firstName: 'Cathal', lastName: 'Hayes' },

  /* ------------------------------------------------------------- Meath */
  { email: 'brid.mcnamara@example.test', org: 'meath', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 70 },
  { email: 'colm.fitzgerald@example.test', org: 'meath', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 64 },
  { email: 'aoibhinn.regan@example.test', org: 'meath', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 52 },
  { email: 'seamus.donnelly@example.test', org: 'meath', type: 'associate', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 30 },
  // Due for renewal, so Meath's home screen shows a Renew button too.
  { email: 'maeve.kiernan@example.test', org: 'meath', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'expiring', renewedDaysAgo: 340 },
  // Niamh belongs to all four clubs; this is the one she has let lapse.
  { email: 'niamh.walsh@example.test', org: 'meath', type: 'junior', status: 'elapsed', paymentStatus: 'paid', payment: 'pay-offline', season: 'previous', renewedDaysAgo: 400 },
  // A family membership held by one parent for three children, none of whom
  // has a login — the case the account app has to name the member on the card.
  { email: 'darragh.otoole@example.test', org: 'meath', type: 'family', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 45, household: 'otoole-meath', firstName: 'Darragh', lastName: "O'Toole" },
  { email: 'darragh.otoole@example.test', org: 'meath', type: 'family', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 45, household: 'otoole-meath', firstName: 'Éabha', lastName: "O'Toole" },
  { email: 'darragh.otoole@example.test', org: 'meath', type: 'family', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 45, household: 'otoole-meath', firstName: 'Rónán', lastName: "O'Toole" },
  // Waiting on the club to approve, so the pending state has a subject here too.
  { email: 'brid.mcnamara@example.test', org: 'meath', type: 'associate', status: 'pending', paymentStatus: 'pending', payment: 'pay-offline', season: 'current', renewedDaysAgo: 4, firstName: 'Aoife', lastName: 'McNamara' },
];

/* --------------------------------------------------------- merchandise */

export interface SeedMerchandiseOption {
  name: string;
  /** Option values, in the order the picker shows them. */
  values: Array<{
    name: string;
    /** The price for this choice. Sizes usually share one; a bigger rug costs more. */
    price: number;
    sku?: string;
    /** Only meaningful when the product tracks stock. */
    stock?: number;
  }>;
}

export interface SeedMerchandise {
  key: string;
  org: SeedOrg['key'];
  name: string;
  description: string;
  /**
   * Placeholder colour for the generated product image. The application
   * requires at least one image, so every product gets one.
   */
  imageColour: string;
  /** More than one gives the gallery something to page through. */
  imageCount?: number;
  status: 'active' | 'inactive';
  /**
   * `free` charges nothing to deliver, `fixed` one fee however much is ordered,
   * `quantity_based` reads the banded `delivery` rules below.
   */
  deliveryType: 'free' | 'fixed' | 'quantity_based';
  deliveryFee?: number;
  /** Bands for `quantity_based`, as `[minQuantity, maxQuantity | null, fee]`. */
  delivery?: Array<[number, number | null, number]>;
  trackStock?: boolean;
  lowStockAlert?: number;
  /** What a member sees once a tracked item runs out. */
  outOfStock?: 'hide' | 'show_unavailable';
  minOrder?: number;
  maxOrder?: number;
  increments?: number;
  /** A seeded form key; the item then asks for details at checkout. */
  form?: string;
  handlingFeeIncluded?: boolean;
  useTermsAndConditions?: boolean;
  confirmationMessage?: string;
  /** `DISCOUNTS` keys applied to this product. */
  discounts?: string[];
  options: SeedMerchandiseOption[];
}

/**
 * Kildare's shop — the only club with the merchandise capability, so a club
 * *without* a shop stays represented too.
 *
 * Eight products chosen to cover what the merchandise pages branch on rather
 * than to look like a plausible catalogue: all three delivery models, tracked
 * and untracked stock, both out-of-stock behaviours, single- and multi-option
 * products, quantity rules, an item that asks for a form, and an inactive one.
 *
 * The states worth naming:
 *
 *   sold out          every value of an option type at zero → `out-of-stock`
 *   partly sold out   one size gone, the rest available → still buyable
 *   hidden when gone  `hide`, so it drops out of the catalogue entirely
 *   inactive          `not-on-sale` however much stock it has
 */
export const MERCHANDISE: SeedMerchandise[] = [
  {
    key: 'club-polo',
    org: 'kildare',
    name: 'Club polo shirt',
    description: 'Navy cotton piqué with the club crest. The everyday one.',
    imageColour: '#1a3a6b',
    imageCount: 3,
    status: 'active',
    deliveryType: 'quantity_based',
    delivery: [
      [1, 2, 5.5],
      [3, 5, 8.0],
      // Open-ended top band: order enough and delivery is free.
      [6, null, 0],
    ],
    trackStock: true,
    lowStockAlert: 5,
    outOfStock: 'show_unavailable',
    discounts: ['kitBundle', 'secondItemHalf', 'shopBasketFive'],
    options: [
      {
        name: 'Size',
        values: [
          { name: 'Age 8–10', price: 25, sku: 'POLO-0810', stock: 12 },
          { name: 'Age 11–13', price: 25, sku: 'POLO-1113', stock: 3 },
          { name: 'Small', price: 28, sku: 'POLO-S', stock: 9 },
          { name: 'Medium', price: 28, sku: 'POLO-M', stock: 0 },
          { name: 'Large', price: 28, sku: 'POLO-L', stock: 14 },
        ],
      },
      {
        name: 'Colour',
        values: [
          { name: 'Navy', price: 0, sku: 'POLO-NVY', stock: 30 },
          { name: 'Bottle green', price: 2, sku: 'POLO-GRN', stock: 8 },
        ],
      },
    ],
  },
  {
    key: 'club-hoodie',
    org: 'kildare',
    name: 'Club hoodie',
    description: 'Heavyweight, fleece-lined, crest on the chest and club name across the back.',
    imageColour: '#2f4f4f',
    imageCount: 2,
    status: 'active',
    deliveryType: 'fixed',
    deliveryFee: 6.5,
    trackStock: true,
    lowStockAlert: 3,
    outOfStock: 'show_unavailable',
    handlingFeeIncluded: true,
    discounts: ['kitBundle', 'shopBasketFive'],
    options: [
      {
        name: 'Size',
        values: [
          { name: 'Age 9–11', price: 38, sku: 'HOOD-0911', stock: 6 },
          { name: 'Age 12–14', price: 38, sku: 'HOOD-1214', stock: 2 },
          { name: 'Small', price: 42, sku: 'HOOD-S', stock: 4 },
          { name: 'Medium', price: 42, sku: 'HOOD-M', stock: 7 },
          { name: 'Large', price: 42, sku: 'HOOD-L', stock: 1 },
        ],
      },
    ],
  },
  {
    key: 'baseball-cap',
    org: 'kildare',
    name: 'Club cap',
    description: 'One size, adjustable. Free delivery with any other order.',
    imageColour: '#0f4c81',
    status: 'active',
    deliveryType: 'free',
    trackStock: false,
    maxOrder: 10,
    options: [
      {
        name: 'Colour',
        values: [
          { name: 'Navy', price: 15, sku: 'CAP-NVY' },
          { name: 'White', price: 15, sku: 'CAP-WHT' },
        ],
      },
    ],
  },
  {
    key: 'saddle-pad',
    org: 'kildare',
    name: 'Embroidered saddle pad',
    description: 'Quilted cotton, club crest embroidered in the corner. Made to order.',
    imageColour: '#6b4423',
    imageCount: 2,
    status: 'active',
    deliveryType: 'fixed',
    deliveryFee: 9,
    trackStock: false,
    form: 'shortEntry',
    useTermsAndConditions: true,
    confirmationMessage:
      'Made-to-order items take three to four weeks. We will email you when yours is ready to collect.',
    options: [
      {
        name: 'Size',
        values: [
          { name: 'Pony', price: 45, sku: 'PAD-P' },
          { name: 'Cob', price: 48, sku: 'PAD-C' },
          { name: 'Full', price: 52, sku: 'PAD-F' },
        ],
      },
      {
        name: 'Binding colour',
        values: [
          { name: 'Navy', price: 0, sku: 'PAD-BND-NVY' },
          { name: 'Red', price: 0, sku: 'PAD-BND-RED' },
          { name: 'Gold', price: 4, sku: 'PAD-BND-GLD' },
        ],
      },
    ],
  },
  {
    key: 'rosette-set',
    org: 'kildare',
    name: 'Rosettes, set of ten',
    description: 'For members running their own fun days. Sold in tens.',
    imageColour: '#b3123b',
    status: 'active',
    deliveryType: 'quantity_based',
    delivery: [
      [1, 3, 4.5],
      [4, null, 7.5],
    ],
    trackStock: true,
    lowStockAlert: 2,
    outOfStock: 'show_unavailable',
    minOrder: 1,
    maxOrder: 20,
    // Sold in tens, so the picker must step rather than count one at a time.
    increments: 1,
    options: [
      {
        name: 'Placing',
        values: [
          { name: '1st — red', price: 12, sku: 'ROS-1', stock: 15 },
          { name: '2nd — blue', price: 12, sku: 'ROS-2', stock: 11 },
          { name: '3rd — yellow', price: 12, sku: 'ROS-3', stock: 9 },
          { name: 'Participation', price: 9, sku: 'ROS-P', stock: 40 },
        ],
      },
    ],
  },
  {
    key: 'yearbook',
    org: 'kildare',
    name: 'Club yearbook',
    description: 'Photographs and results from the season. Printed once a year.',
    imageColour: '#3d5a3d',
    status: 'active',
    deliveryType: 'fixed',
    deliveryFee: 3.5,
    trackStock: true,
    lowStockAlert: 5,
    outOfStock: 'show_unavailable',
    options: [
      {
        name: 'Edition',
        values: [
          // Every value at zero: the sold-out case the catalogue must report
          // as unavailable rather than quietly offer.
          { name: 'This season', price: 18, sku: 'YB-CURRENT', stock: 0 },
          { name: 'Last season', price: 10, sku: 'YB-PREVIOUS', stock: 0 },
        ],
      },
    ],
  },
  {
    key: 'grooming-kit',
    org: 'kildare',
    name: 'Grooming kit',
    description: 'Brushes, hoof pick and a club-branded bag. Discontinued once these are gone.',
    imageColour: '#5a4a7d',
    status: 'active',
    deliveryType: 'fixed',
    deliveryFee: 6,
    trackStock: true,
    lowStockAlert: 2,
    // Drops out of the catalogue entirely rather than lingering as unavailable.
    outOfStock: 'hide',
    options: [
      {
        name: 'Kit',
        values: [{ name: 'Complete kit', price: 55, sku: 'GROOM-KIT', stock: 0 }],
      },
    ],
  },
  {
    key: 'christmas-jumper',
    org: 'kildare',
    name: 'Christmas jumper',
    description: 'Back in November. Left inactive out of season.',
    imageColour: '#8b1a1a',
    // Inactive with stock on the shelf: `not-on-sale` is about the switch, not
    // the shelf, and the two must not be confused.
    status: 'inactive',
    deliveryType: 'fixed',
    deliveryFee: 6.5,
    trackStock: true,
    outOfStock: 'show_unavailable',
    options: [
      {
        name: 'Size',
        values: [
          { name: 'Small', price: 35, sku: 'XMAS-S', stock: 10 },
          { name: 'Medium', price: 35, sku: 'XMAS-M', stock: 10 },
          { name: 'Large', price: 35, sku: 'XMAS-L', stock: 10 },
        ],
      },
    ],
  },

  /* ------------------------------------------------------------- Meath */
  {
    key: 'mhpc-softshell',
    org: 'meath',
    name: 'Club softshell jacket',
    description: 'Bottle green softshell with the Meath crest. Warm enough for a winter rally.',
    imageColour: '#123c2b',
    imageCount: 2,
    status: 'active',
    deliveryType: 'fixed',
    deliveryFee: 6.5,
    trackStock: true,
    lowStockAlert: 4,
    outOfStock: 'show_unavailable',
    discounts: ['mhpcShopBundle'],
    options: [
      {
        name: 'Size',
        values: [
          { name: 'Age 9–11', price: 42, sku: 'MH-SS-0911', stock: 8 },
          { name: 'Age 12–14', price: 42, sku: 'MH-SS-1214', stock: 6 },
          { name: 'Small', price: 46, sku: 'MH-SS-S', stock: 5 },
          { name: 'Medium', price: 46, sku: 'MH-SS-M', stock: 0 },
          { name: 'Large', price: 46, sku: 'MH-SS-L', stock: 7 },
        ],
      },
    ],
  },
  {
    key: 'mhpc-show-cap',
    org: 'meath',
    name: 'Show cap',
    description: 'Club colours, for the ring rather than the yard.',
    imageColour: '#5c1a2b',
    status: 'active',
    deliveryType: 'free',
    trackStock: false,
    discounts: ['mhpcShopBundle'],
    options: [
      {
        name: 'Size',
        values: [
          { name: 'One size', price: 18, sku: 'MH-CAP-OS' },
        ],
      },
    ],
  },
  {
    key: 'mhpc-numnah',
    org: 'meath',
    name: 'Embroidered numnah',
    description: 'Dressage-cut saddle pad with the club crest. Made to order, so allow two weeks.',
    imageColour: '#3b2d5c',
    status: 'active',
    deliveryType: 'fixed',
    deliveryFee: 4.0,
    trackStock: true,
    lowStockAlert: 2,
    outOfStock: 'hide',
    // Made to order, so the shop asks who it is for.
    form: 'shortEntry',
    minOrder: 1,
    maxOrder: 4,
    options: [
      {
        name: 'Colour',
        values: [
          { name: 'Bottle green', price: 34, sku: 'MH-NUM-GRN', stock: 6 },
          { name: 'Burgundy', price: 34, sku: 'MH-NUM-BUR', stock: 3 },
          { name: 'Navy', price: 34, sku: 'MH-NUM-NVY', stock: 0 },
        ],
      },
    ],
  },
];

/* -------------------------------------------------------- registrations */

/**
 * Registering a **horse**, annually.
 *
 * The registrations module is the one part of the platform that is not about
 * people. A registration names an *entity* — here a horse — which belongs to a
 * member, carries its own number, and has to be renewed. `entity_name` on the
 * type is what every screen calls the thing being registered, so getting it
 * right is what makes the module read as "register a horse" rather than as a
 * second, oddly-worded membership.
 *
 * Annual rather than rolling: `is_rolling_registration: false` with a
 * `valid_until` date means every horse's registration lapses on the same day,
 * the way a season does, rather than twelve months from whenever each owner
 * happened to apply.
 */
export interface SeedRegistrationType {
  key: string;
  org: SeedOrg['key'];
  name: string;
  description: string;
  /** What is being registered. Singular, and used verbatim in the UI. */
  entityName: string;
  /** A `FORMS` key. */
  form: string;
  /** **Major units**, like every other fee in this file: 35 is €35. */
  fee: number;
  status: 'open' | 'closed';
  /**
   * False for an annual registration that expires on a fixed date; true for one
   * that runs `numberOfMonths` from whenever it was taken out.
   */
  rolling?: boolean;
  numberOfMonths?: number;
  /** Days from now the current registration period ends. Annual types only. */
  validUntilDays?: number;
  automaticallyApprove?: boolean;
  labels?: string[];
  handlingFeeIncluded?: boolean;
  useTermsAndConditions?: boolean;
  termsAndConditions?: string;
  /** `DISCOUNTS` keys applied to this registration type. */
  discounts?: string[];
}

export const REGISTRATION_TYPES: SeedRegistrationType[] = [
  {
    key: 'mhpc-horse-annual',
    org: 'meath',
    name: 'Horse registration 2026',
    description:
      'Every horse or pony competing under Meath Hunt colours must be registered for the season. Renewable each year.',
    entityName: 'Horse',
    form: 'horseRegistration',
    fee: 35,
    status: 'open',
    rolling: false,
    // The season end, so every horse lapses on the same day.
    validUntilDays: 200,
    automaticallyApprove: false,
    labels: ['Competing', 'Non-competing', 'Vetted'],
    handlingFeeIncluded: false,
    useTermsAndConditions: true,
    termsAndConditions:
      'Registration is for one season and is not transferable between horses. The owner confirms the horse holds a current equine passport and that influenza vaccinations are up to date.',
    discounts: ['mhpcHorseRenewal'],
  },
  {
    key: 'mhpc-horse-day',
    org: 'meath',
    name: 'Day registration',
    description:
      'A single-event registration for a horse visiting from another club. Runs three months from the day it is taken out.',
    entityName: 'Horse',
    form: 'horseRegistration',
    fee: 15,
    status: 'open',
    // Rolling, so the two mechanisms sit side by side in one club.
    rolling: true,
    numberOfMonths: 3,
    automaticallyApprove: true,
    labels: ['Visitor'],
    handlingFeeIncluded: true,
  },
];

/**
 * The horses already on the register.
 *
 * `owner` is the account user the registration sits under; `entityName` is the
 * horse. The two are deliberately different people-and-not-people, which is the
 * whole shape of the module.
 */
export interface SeedRegistration {
  /** A `REGISTRATION_TYPES` key. */
  type: string;
  /** The account user who registered it. */
  owner: string;
  /** The horse's name — `registrations.entity_name`. */
  entityName: string;
  /** Registered owner as written on the passport, which may not be the member. */
  ownerName: string;
  status: 'pending' | 'active' | 'rejected' | 'expired';
  paymentStatus: 'paid' | 'pending' | 'refunded';
  payment?: 'pay-offline' | 'stripe';
  /** Days ago it was taken out or last renewed. */
  renewedDaysAgo: number;
  /** Days from now it lapses. Negative for one that already has. */
  validUntilDays: number;
  /** A basket shared with other purchases. See `SeedEntry.basket`. */
  basket?: string;
  labels?: string[];
  processed?: boolean;
  /** Answers for the registration form, keyed by `FIELDS` key. */
  answers: Record<string, string | number | boolean>;
}

export const REGISTRATIONS: SeedRegistration[] = [
  {
    type: 'mhpc-horse-annual',
    owner: 'brid.mcnamara@example.test',
    entityName: 'Ballinteer Boy',
    ownerName: 'Bríd McNamara',
    status: 'active',
    paymentStatus: 'paid',
    payment: 'stripe',
    /*
     * Renewed on the day she entered the hunter trial and bought a cap — the
     * three are one basket (`mcnamara-day`), and a basket settles on one day by
     * one method, so the dates have to agree.
     */
    renewedDaysAgo: 6,
    validUntilDays: 200,
    basket: 'mcnamara-day',
    labels: ['Competing', 'Vetted'],
    processed: true,
    answers: {
      horseName: 'Ballinteer Boy',
      horseStableName: 'Bertie',
      horseBreed: 'Irish Sports Horse',
      horseColour: 'Bay',
      horseSex: 'Gelding',
      horseYearFoaled: 2015,
      horseHeight: 16.1,
      horsePassport: 'IRL372615004821',
      horseMicrochip: '985141000123456',
      horseOwner: 'Bríd McNamara',
      horseFluVaccine: '2026-03-14',
      horseVetName: 'Navan Equine Clinic',
      horseVetPhone: '+353 46 902 5555',
      horseInsured: true,
      horseNotes: 'Loads well. Sharp in a strong wind.',
    },
  },
  {
    type: 'mhpc-horse-annual',
    owner: 'colm.fitzgerald@example.test',
    entityName: 'Tara Mist',
    ownerName: 'Fitzgerald Family',
    status: 'active',
    paymentStatus: 'paid',
    payment: 'pay-offline',
    renewedDaysAgo: 45,
    validUntilDays: 200,
    labels: ['Competing'],
    processed: true,
    answers: {
      horseName: 'Tara Mist',
      horseBreed: 'Connemara',
      horseColour: 'Grey',
      horseSex: 'Mare',
      horseYearFoaled: 2017,
      horseHeight: 14.2,
      horsePassport: 'IRL372615009134',
      horseMicrochip: '985141000654321',
      horseOwner: 'Fitzgerald Family',
      horseFluVaccine: '2026-05-02',
      horseVetName: 'Boyne Valley Veterinary',
      horseInsured: true,
    },
  },
  {
    type: 'mhpc-horse-annual',
    owner: 'aoibhinn.regan@example.test',
    entityName: 'Little Duke',
    ownerName: 'Aoibhínn Regan',
    status: 'active',
    paymentStatus: 'paid',
    payment: 'stripe',
    renewedDaysAgo: 30,
    validUntilDays: 200,
    labels: ['Non-competing'],
    processed: true,
    answers: {
      horseName: 'Little Duke',
      horseStableName: 'Duke',
      horseBreed: 'Welsh Section B',
      horseColour: 'Chestnut',
      horseSex: 'Gelding',
      horseYearFoaled: 2019,
      horseHeight: 12.2,
      horsePassport: 'IRL372615011277',
      horseOwner: 'Aoibhínn Regan',
      horseFluVaccine: '2026-04-21',
      horseInsured: false,
      horseNotes: 'First season. Still green in company.',
    },
  },
  {
    // Waiting on the club, so the org-admin approval queue is not empty.
    type: 'mhpc-horse-annual',
    owner: 'seamus.donnelly@example.test',
    entityName: 'Kells Rebel',
    ownerName: 'Séamus Donnelly',
    status: 'pending',
    paymentStatus: 'pending',
    payment: 'pay-offline',
    renewedDaysAgo: 3,
    validUntilDays: 200,
    processed: false,
    answers: {
      horseName: 'Kells Rebel',
      horseBreed: 'Irish Draught',
      horseColour: 'Black',
      horseSex: 'Stallion',
      horseYearFoaled: 2014,
      horseHeight: 16.3,
      horsePassport: 'IRL372615002093',
      horseOwner: 'Séamus Donnelly',
      horseFluVaccine: '2026-02-08',
      horseInsured: true,
    },
  },
  {
    // Lapsed last season — what the renewal prompt is for, and the only way to
    // see an expired registration without waiting a year.
    type: 'mhpc-horse-annual',
    owner: 'maeve.kiernan@example.test',
    entityName: 'Slane Sunrise',
    ownerName: 'Maeve Kiernan',
    status: 'expired',
    paymentStatus: 'paid',
    payment: 'stripe',
    renewedDaysAgo: 420,
    validUntilDays: -55,
    labels: ['Competing'],
    processed: true,
    answers: {
      horseName: 'Slane Sunrise',
      horseBreed: 'Thoroughbred',
      horseColour: 'Chestnut',
      horseSex: 'Mare',
      horseYearFoaled: 2013,
      horseHeight: 16.0,
      horsePassport: 'IRL372615007766',
      horseOwner: 'Maeve Kiernan',
      horseFluVaccine: '2025-03-30',
      horseInsured: false,
    },
  },
  {
    // The rolling type, so both mechanisms have a live example.
    type: 'mhpc-horse-day',
    owner: 'niamh.walsh@example.test',
    entityName: 'Curragh Lad',
    ownerName: 'Niamh Walsh',
    status: 'active',
    paymentStatus: 'paid',
    payment: 'stripe',
    renewedDaysAgo: 12,
    validUntilDays: 78,
    labels: ['Visitor'],
    processed: true,
    answers: {
      horseName: 'Curragh Lad',
      horseBreed: 'Cob',
      horseColour: 'Piebald',
      horseSex: 'Gelding',
      horseYearFoaled: 2016,
      horseHeight: 15.0,
      horsePassport: 'IRL372615013900',
      horseOwner: 'Niamh Walsh',
      horseFluVaccine: '2026-06-11',
      horseInsured: true,
    },
  },
];

/* ---------------------------------------------------- calendar bookings */

export interface SeedTimeSlot {
  /** 0 = Sunday, as `time_slot_configurations.days_of_week` stores it. */
  days: number[];
  /** `HH:MM`, the time the slot opens. */
  startTime: string;
  /** How many can book the same slot. 1 is exclusive hire. */
  places?: number;
  /** Refuses to run below this many — a lesson nobody else joins is cancelled. */
  minPlaces?: number;
  /** Every other week when 2, which is the case a weekly assumption breaks on. */
  recurrenceWeeks?: number;
  /** Days from now the pattern starts and stops; null runs indefinitely. */
  fromDays?: number;
  untilDays?: number | null;
  /** What a member may book, as `[minutes, price, label]`. */
  durations: Array<[number, number, string]>;
}

export interface SeedBlockedPeriod {
  type: 'date_range' | 'time_segment';
  /** `date_range` only. */
  fromDays?: number;
  toDays?: number;
  /** `time_segment` only — a recurring gap, e.g. lunch. */
  days?: number[];
  startTime?: string;
  endTime?: string;
  reason: string;
}

export interface SeedCalendar {
  key: string;
  org: SeedOrg['key'];
  name: string;
  description: string;
  colour: string;
  status: 'open' | 'closed';
  minDaysInAdvance?: number;
  maxDaysInAdvance?: number;
  allowCancellations?: boolean;
  cancelDaysInAdvance?: number;
  refundAutomatically?: boolean;
  useTermsAndConditions?: boolean;
  handlingFeeIncluded?: boolean;
  sendReminders?: boolean;
  reminderHoursBefore?: number;
  /** `DISCOUNTS` keys applied to this calendar. */
  discounts?: string[];
  /** A shared icon key, drawn in the calendar's colour wherever it is offered. */
  icon?: string;
  slots: SeedTimeSlot[];
  blocked?: SeedBlockedPeriod[];
  /** Automated open/close, as `[daysFromNow, action, timeOfDay, reason]`. */
  schedule?: Array<[number, 'open' | 'close', string, string]>;
}

/**
 * Laois's bookable facilities — the only club with the calendar capability, so
 * a club *without* bookings stays represented.
 *
 * Four calendars covering what the booking pages branch on rather than what a
 * yard would plausibly own: exclusive hire against shared places, one duration
 * against several, a fortnightly pattern, a blocked week and a recurring daily
 * gap, cancellation allowed and refused, an automated open/close pair, and a
 * closed calendar that must not be bookable at all.
 *
 * Times are `HH:MM` strings and days are `0`–`6` from Sunday, which is what the
 * slot generator reads. Dates are offsets from the run, so a blocked week is
 * still ahead of today whenever the seed is run.
 */
export const CALENDARS: SeedCalendar[] = [
  {
    key: 'arena',
    org: 'laois',
    name: 'Outdoor arena',
    description: 'The main sand arena. Exclusive hire — one booking at a time.',
    colour: '#2e7d32',
    status: 'open',
    minDaysInAdvance: 1,
    maxDaysInAdvance: 60,
    allowCancellations: true,
    cancelDaysInAdvance: 2,
    refundAutomatically: true,
    sendReminders: true,
    reminderHoursBefore: 24,
    discounts: ['offPeakArena', 'arenaMemberRate'],
    icon: 'equestrian',
    slots: [
      {
        // Weekday evenings, one party at a time.
        days: [1, 2, 3, 4, 5],
        startTime: '17:00',
        places: 1,
        fromDays: -30,
        untilDays: null,
        durations: [
          [30, 10, '30 minutes'],
          [60, 18, '1 hour'],
          [90, 25, '1½ hours'],
        ],
      },
      {
        // Weekend mornings, cheaper and longer.
        days: [0, 6],
        startTime: '09:00',
        places: 1,
        fromDays: -30,
        untilDays: null,
        durations: [
          [60, 15, '1 hour'],
          [120, 26, '2 hours'],
        ],
      },
    ],
    blocked: [
      {
        type: 'date_range',
        fromDays: 21,
        toDays: 27,
        reason: 'Surface being re-sanded — no bookings this week.',
      },
    ],
  },
  {
    key: 'lessons',
    org: 'laois',
    name: 'Group lessons',
    description: 'Six places per lesson with a club instructor. Runs if at least three book.',
    colour: '#1565c0',
    status: 'open',
    minDaysInAdvance: 2,
    maxDaysInAdvance: 45,
    allowCancellations: true,
    cancelDaysInAdvance: 5,
    // Cancellations allowed but refunds handled by hand, which is the case an
    // "allowed therefore automatic" assumption gets wrong.
    refundAutomatically: false,
    useTermsAndConditions: true,
    handlingFeeIncluded: true,
    discounts: ['lessonBlock'],
    icon: 'lesson',
    slots: [
      {
        days: [3],
        startTime: '18:30',
        places: 6,
        minPlaces: 3,
        fromDays: -14,
        untilDays: null,
        durations: [[60, 22, '1 hour lesson']],
      },
      {
        // Fortnightly: the pattern a weekly assumption produces phantom slots for.
        days: [6],
        startTime: '11:00',
        places: 8,
        minPlaces: 3,
        recurrenceWeeks: 2,
        fromDays: -14,
        untilDays: null,
        durations: [[90, 30, '1½ hour clinic']],
      },
    ],
    blocked: [
      {
        type: 'time_segment',
        days: [3],
        startTime: '19:30',
        endTime: '20:00',
        reason: 'Arena dragged between lessons.',
      },
    ],
  },
  {
    key: 'cross-country',
    org: 'laois',
    name: 'Cross-country schooling',
    description: 'The full course, up to four horses at once. Book the whole morning or afternoon.',
    colour: '#ef6c00',
    status: 'open',
    minDaysInAdvance: 3,
    maxDaysInAdvance: 90,
    // No cancellations: the case a screen offering a cancel button must respect.
    allowCancellations: false,
    useTermsAndConditions: true,
    icon: 'hiking',
    slots: [
      {
        days: [0, 6],
        startTime: '10:00',
        places: 4,
        fromDays: -7,
        untilDays: null,
        durations: [
          [180, 35, 'Morning session'],
          [240, 45, 'Extended morning'],
        ],
      },
    ],
    // Opens for the season, then closes again — the automated pair.
    schedule: [
      [-60, 'open', '08:00', 'Season opens.'],
      [120, 'close', '18:00', 'Course closes for the winter.'],
    ],
  },
  {
    key: 'clubhouse',
    org: 'laois',
    name: 'Clubhouse hire',
    description: 'Closed while the roof is repaired. Back in the spring.',
    colour: '#6a1b9a',
    // Closed with a full schedule behind it: `not-open-for-bookings` is about
    // the switch, not the absence of slots.
    status: 'closed',
    allowCancellations: true,
    cancelDaysInAdvance: 7,
    icon: 'clubhouse',
    slots: [
      {
        days: [5, 6],
        startTime: '19:00',
        places: 1,
        fromDays: -60,
        untilDays: null,
        durations: [[240, 60, 'Evening hire']],
      },
    ],
  },

  /* ------------------------------------------------------------- Meath
   * Two calendars, deliberately simpler than Laois's. Laois exists to cover
   * every branch of the booking rules; these exist so the club that has every
   * capability has something bookable at all.
   */
  {
    key: 'mhpc-indoor-arena',
    org: 'meath',
    name: 'Indoor arena',
    description: 'Floodlit 40x20 indoor school. Exclusive hire.',
    colour: '#123c2b',
    status: 'open',
    minDaysInAdvance: 0,
    maxDaysInAdvance: 45,
    allowCancellations: true,
    cancelDaysInAdvance: 1,
    refundAutomatically: true,
    handlingFeeIncluded: true,
    sendReminders: true,
    reminderHoursBefore: 24,
    discounts: ['mhpcArenaOffPeak'],
    icon: 'equestrian',
    slots: [
      {
        // Weekday evenings, the off-peak the discount is for.
        days: [1, 2, 3, 4, 5],
        startTime: '17:00',
        places: 1,
        fromDays: -30,
        untilDays: null,
        durations: [
          [30, 12, 'Half hour'],
          [60, 20, 'Hour'],
        ],
      },
      {
        days: [0, 6],
        startTime: '09:00',
        places: 1,
        fromDays: -30,
        untilDays: null,
        durations: [[60, 25, 'Weekend hour']],
      },
    ],
    blocked: [
      {
        type: 'time_segment',
        days: [1, 2, 3, 4, 5],
        startTime: '19:00',
        endTime: '19:30',
        reason: 'Arena harrowing',
      },
    ],
  },
  {
    key: 'mhpc-group-lessons',
    org: 'meath',
    name: 'Group lessons',
    description: 'Shared flatwork lessons with the club instructor. Four to a group.',
    colour: '#5c1a2b',
    status: 'open',
    minDaysInAdvance: 1,
    maxDaysInAdvance: 30,
    allowCancellations: true,
    cancelDaysInAdvance: 2,
    refundAutomatically: false,
    useTermsAndConditions: true,
    sendReminders: true,
    reminderHoursBefore: 48,
    icon: 'lesson',
    slots: [
      {
        days: [6],
        startTime: '10:00',
        // Shared places, and it will not run for fewer than two.
        places: 4,
        minPlaces: 2,
        fromDays: -14,
        untilDays: null,
        durations: [[60, 15, 'Lesson']],
      },
    ],
  },
];
