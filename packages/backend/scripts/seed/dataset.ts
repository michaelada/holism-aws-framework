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
  defaultCapabilities: [
    'event-management',
    'event-types',
    'venues',
    'entry-discounts',
    'discounts',
    'memberships',
    'membership-discounts',
    'merchandise',
    'calendar-bookings',
    'payment-processing',
    'reporting',
    'public-search',
    'email-notifications',
    'document-uploads',
    'document-management',
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
  optInCapabilities: ['merchandise', 'calendar-bookings'],
  /** The platform's cut, inherited as the default by each organisation. */
  applicationFee: { fixed: 0.3, percentage: 1.5 },
  handlingFee: { fixedFee: 0.25, percentageFee: 1.5, taxPercentage: 0 },
};

export interface SeedOrg {
  key: 'kildare' | 'laois' | 'ward';
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
}

/**
 * What a club actually has switched on: everything the type permits by default,
 * less the opt-in ones, plus whatever this club asked for.
 *
 * Used for the organisation's `enabled_capabilities` *and* for its admin role's
 * permissions. Granting the role a capability the club does not have would give
 * an administrator menu entries leading to endpoints that refuse them.
 */
export const capabilitiesFor = (org: SeedOrg): string[] => [
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
    // The only club with a shop, so "capability off" stays represented too.
    extraCapabilities: ['merchandise'],
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
    // Diverges from the type default: a negotiated rate.
    applicationFee: { fixed: 0.15, percentage: 1.0 },
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
    // Explicitly unconfigured: the platform takes the handling fee.
    applicationFee: { fixed: null, percentage: null },
  },
];

export const SUPER_ADMIN = {
  email: 'super.admin@itsplainsailing.test',
  firstName: 'Sam',
  lastName: 'Platform',
};

export const ORG_ADMINS: Record<SeedOrg['key'], { email: string; firstName: string; lastName: string }> = {
  kildare: { email: 'admin@kildarehunt.test', firstName: 'Aoife', lastName: 'Byrne' },
  laois: { email: 'admin@laoishunt.test', firstName: 'Seán', lastName: 'Delaney' },
  ward: { email: 'admin@wardunion.test', firstName: 'Máire', lastName: 'Ní Fhloinn' },
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
  { email: 'niamh.walsh@example.test', firstName: 'Niamh', lastName: 'Walsh', orgs: ['kildare', 'laois', 'ward'] },
  { email: 'cillian.murphy@example.test', firstName: 'Cillian', lastName: 'Murphy', orgs: ['kildare', 'laois', 'ward'] },
  { email: 'orla.kavanagh@example.test', firstName: 'Órla', lastName: 'Kavanagh', orgs: ['kildare', 'laois'] },
  { email: 'darragh.otoole@example.test', firstName: 'Darragh', lastName: "O'Toole", orgs: ['laois', 'ward'] },
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
  { email: 'lorcan.hayes@example.test', firstName: 'Lorcán', lastName: 'Hayes', orgs: ['ward'] },
];

/* ------------------------------------------------------------------ forms */

export type FieldType =
  | 'text' | 'textarea' | 'number' | 'email' | 'phone' | 'date' | 'time'
  | 'datetime' | 'boolean' | 'select' | 'multiselect' | 'radio' | 'checkbox';

export interface SeedField {
  key: string;
  name: string;
  label: string;
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
  { key: 'riderName', name: 'rider_name', label: 'Rider name', datatype: 'text', validation: { required: true, maxLength: 120 } },
  { key: 'riderDob', name: 'rider_dob', label: 'Date of birth', datatype: 'date', validation: { required: true } },
  { key: 'riderEmail', name: 'rider_email', label: 'Email address', datatype: 'email', validation: { required: true } },
  { key: 'riderPhone', name: 'rider_phone', label: 'Mobile number', datatype: 'phone' },
  { key: 'ageGroup', name: 'age_group', label: 'Age group', datatype: 'select', options: ['Under 12', '12–14', '15–17', '18+'], validation: { required: true } },
  { key: 'ponyName', name: 'pony_name', label: 'Pony or horse name', datatype: 'text', validation: { required: true } },
  { key: 'ponyHeight', name: 'pony_height', label: 'Height (hands)', datatype: 'number', description: 'To one decimal place, e.g. 14.2', validation: { min: 8, max: 19 } },
  { key: 'ponyBreed', name: 'pony_breed', label: 'Breed', datatype: 'select', options: ['Connemara', 'Irish Sport Horse', 'Welsh', 'Thoroughbred', 'Other'] },
  { key: 'vaccinated', name: 'vaccination_status', label: 'Vaccination status', datatype: 'radio', options: ['Up to date', 'Due within 30 days', 'Not vaccinated'], validation: { required: true } },
  { key: 'gradeLevel', name: 'grade_level', label: 'Grade', datatype: 'radio', options: ['Grade 1', 'Grade 2', 'Grade 3', 'Ungraded'] },
  { key: 'dietary', name: 'dietary_requirements', label: 'Dietary requirements', datatype: 'multiselect', options: ['None', 'Vegetarian', 'Vegan', 'Gluten free', 'Dairy free', 'Nut allergy'] },
  { key: 'sessions', name: 'preferred_sessions', label: 'Preferred sessions', datatype: 'checkbox', options: ['Morning', 'Afternoon', 'Both'] },
  { key: 'arrivalTime', name: 'arrival_time', label: 'Expected arrival time', datatype: 'time' },
  { key: 'stablingFrom', name: 'stabling_from', label: 'Stabling required from', datatype: 'datetime' },
  { key: 'medicalNotes', name: 'medical_notes', label: 'Medical notes', datatype: 'textarea', description: 'Anything the organisers should know on the day.' },
  { key: 'transportNeeded', name: 'transport_needed', label: 'Transport required?', datatype: 'boolean' },
  { key: 'firstAider', name: 'is_first_aider', label: 'Willing to help as a first aider', datatype: 'boolean' },
  { key: 'emergencyName', name: 'emergency_contact_name', label: 'Emergency contact name', datatype: 'text', validation: { required: true } },
  { key: 'emergencyPhone', name: 'emergency_contact_phone', label: 'Emergency contact number', datatype: 'phone', validation: { required: true } },
  { key: 'yearsRiding', name: 'years_riding', label: 'Years riding', datatype: 'number', validation: { min: 0, max: 80 } },
  { key: 'addressLine', name: 'address_line', label: 'Address', datatype: 'text', validation: { required: true, maxLength: 200 } },
  { key: 'county', name: 'county', label: 'County', datatype: 'select', options: ['Kildare', 'Laois', 'Meath', 'Dublin', 'Other'], validation: { required: true } },
  { key: 'guardianName', name: 'guardian_name', label: 'Parent or guardian', datatype: 'text', description: 'Required for members under 18.' },
  { key: 'guardianPhone', name: 'guardian_phone', label: 'Parent or guardian number', datatype: 'phone' },
  { key: 'photoConsent', name: 'photo_consent', label: 'Consent to photographs at club events', datatype: 'boolean' },
];

export interface SeedForm {
  key: string;
  name: string;
  description: string;
  /** Field keys, in order. Grouped headings drive the form's sections. */
  fields: Array<{ field: string; group?: string; wizardStep?: number; wizardStepTitle?: string }>;
}

export const FORMS: SeedForm[] = [
  {
    key: 'fullEntry',
    name: 'Full competition entry',
    description: 'Rider, pony and safety details. Uses every field type the builder offers.',
    fields: [
      { field: 'riderName', group: 'Rider', wizardStep: 1, wizardStepTitle: 'Rider' },
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
    name: 'Camp booking',
    description: 'Multi-day camp: sessions, stabling, dietary needs.',
    fields: [
      { field: 'riderName', group: 'Rider' },
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
    name: 'Short entry',
    description: 'The minimum a club can ask for. Two required fields and nothing else.',
    fields: [{ field: 'riderName' }, { field: 'ponyName' }],
  },
  {
    key: 'spectator',
    name: 'Spectator registration',
    description: 'No pony. Contact details only, for gate lists and catering numbers.',
    fields: [
      { field: 'riderName' },
      { field: 'riderEmail' },
      { field: 'riderPhone' },
      { field: 'dietary' },
    ],
  },
  {
    key: 'membershipSingle',
    name: 'Membership application',
    description: 'What a club asks of one person joining for the season.',
    fields: [
      { field: 'riderName', group: 'Member', wizardStep: 1, wizardStepTitle: 'Member' },
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
    name: 'Family membership application',
    description: 'Asked once of the household, then once per person on the membership.',
    fields: [
      { field: 'riderName', group: 'Person' },
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
];

/* -------------------------------------------------------------- discounts */

export interface SeedDiscount {
  key: string;
  org: SeedOrg['key'];
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
  {
    key: 'earlyBird',
    org: 'kildare',
    name: 'Early bird 10%',
    description: 'Ten per cent off entries made well before the closing date.',
    code: 'EARLYBIRD',
    discountType: 'percentage',
    discountValue: 10,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: true },
    validFromDays: -30,
    validUntilDays: 30,
    priority: 10,
  },
  {
    key: 'memberFiver',
    org: 'kildare',
    name: 'Club member €5 off',
    description: 'Five euro off each entry for club members. No code — applied automatically.',
    discountType: 'fixed',
    discountValue: 5,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: false },
    validFromDays: -60,
    priority: 20,
  },
  {
    key: 'thirdFree',
    org: 'kildare',
    name: 'Third entry free',
    description: 'Enter three classes, pay for two.',
    discountType: 'percentage',
    discountValue: 100,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 3, applyToQuantity: 1, applyEveryN: 3 },
    validFromDays: -14,
    combinable: false,
    priority: 5,
  },
  {
    key: 'expiredSpring',
    org: 'kildare',
    name: 'Spring promotion (expired)',
    description: 'Deliberately expired, so the expiry path has a subject.',
    code: 'SPRING24',
    discountType: 'percentage',
    discountValue: 25,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: true },
    validFromDays: -120,
    validUntilDays: -30,
    status: 'expired',
  },
  {
    key: 'cartTenner',
    org: 'laois',
    name: '€10 off baskets over €60',
    description: 'Applies once to the whole basket, not per item.',
    code: 'BASKET10',
    discountType: 'fixed',
    discountValue: 10,
    applicationScope: 'cart',
    eligibilityCriteria: { requiresCode: true, minimumPurchaseAmount: 60 },
    usageLimits: { totalUsageLimit: 50, perUserLimit: 1, currentUsageCount: 0 },
    validFromDays: -7,
    validUntilDays: 60,
  },
  {
    key: 'laoisFamily',
    org: 'laois',
    name: 'Family rate 15%',
    description: 'Fifteen per cent off from the second entry onwards.',
    discountType: 'percentage',
    discountValue: 15,
    applicationScope: 'quantity-based',
    quantityRules: { minimumQuantity: 2 },
    validFromDays: -30,
  },
  {
    key: 'wardCapped',
    org: 'ward',
    name: 'Winter league 20% (capped)',
    description: 'Twenty per cent off, capped at €15, limited to 25 uses.',
    code: 'WINTER20',
    discountType: 'percentage',
    discountValue: 20,
    applicationScope: 'item',
    eligibilityCriteria: { requiresCode: true, maximumDiscountAmount: 15 },
    usageLimits: { totalUsageLimit: 25, perUserLimit: 2, currentUsageCount: 4 },
    validFromDays: -10,
    validUntilDays: 45,
  },
  /* ------------------------------------------------- membership discounts */
  {
    key: 'familyMembership',
    org: 'kildare',
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
    key: 'earlyRenewal',
    org: 'laois',
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

  /* ------------------------------------------------ merchandise discounts */
  {
    key: 'kitBundle',
    org: 'kildare',
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

  /* --------------------------------------------------- booking discounts */
  {
    key: 'offPeakArena',
    org: 'laois',
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

];

/* ----------------------------------------------------------------- events */

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
  /** Null leaves the column empty, which means "no window configured". */
  openDays: number | null;
  closeDays: number | null;
  status: 'draft' | 'published';
  limitEntries?: boolean;
  entriesLimit?: number;
  addConfirmationMessage?: boolean;
  confirmationMessage?: string;
  discounts?: string[];
  activities: SeedActivity[];
}

export const EVENT_TYPES = ['Show Jumping', 'Cross Country', 'Dressage', 'Camp', 'Rally', 'Fun Day'];

export const VENUES: Record<SeedOrg['key'], Array<{ name: string; address: string }>> = {
  kildare: [
    { name: 'Craddockstown Equestrian', address: 'Craddockstown, Naas, Co. Kildare' },
    { name: 'Punchestown Event Centre', address: 'Punchestown, Naas, Co. Kildare' },
  ],
  laois: [{ name: 'Ballyroan Showgrounds', address: 'Ballyroan, Co. Laois' }],
  ward: [{ name: 'Ward Union Grounds', address: 'Ashbourne, Co. Meath' }],
};

/**
 * Thirteen events covering every entry-window state, both limit mechanisms,
 * quantity, all three payment arrangements and each form.
 *
 * The window states are the ones worth naming:
 *
 *   not-open   openDays  > 0                     entries have not opened
 *   open       openDays  < 0, closeDays > 14      open, closing in a while
 *   closing    openDays  < 0, closeDays 1–3       closing soon
 *   closed     closeDays < 0                      closed to entries
 *   no-window  openDays and closeDays both null   never gated
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
    limitEntries: true,
    entriesLimit: 120,
    addConfirmationMessage: true,
    confirmationMessage: 'Numbers can be collected from the secretary’s office from 8am.',
    discounts: ['earlyBird', 'memberFiver'],
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
    limitEntries: true,
    entriesLimit: 60,
    activities: [
      {
        name: 'Full week, residential',
        description: 'Five days including stabling and meals.',
        fee: 395,
        form: 'campBooking',
        limitApplicants: true,
        applicantsLimit: 24,
        payment: 'both',
        useTermsAndConditions: true,
      },
      {
        name: 'Full week, non-residential',
        description: 'Five days, pony travels home each evening.',
        fee: 275,
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
    openDays: null,
    closeDays: null,
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
    limitEntries: true,
    entriesLimit: 80,
    discounts: ['cartTenner', 'laoisFamily'],
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
    activities: [
      { name: 'Novice', description: 'Novice track.', fee: 26, form: 'shortEntry', payment: 'both' },
    ],
  },

  /* ------------------------------------------------------------- Ward */
  {
    key: 'wupc-open-no-window',
    org: 'ward',
    name: 'Ward Union Open Day',
    description: 'No entry window configured at all — entries are never gated by date.',
    eventType: 'Fun Day',
    venue: 'Ward Union Grounds',
    startDays: 45,
    endDays: 45,
    openDays: null,
    closeDays: null,
    status: 'published',
    discounts: ['wardCapped'],
    activities: [
      {
        name: 'Family ticket',
        description: 'Admits two adults and up to three children.',
        fee: 25,
        form: 'spectator',
        allowSpecifyQuantity: true,
        payment: 'offline',
        discounts: ['wardCapped'],
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
        fee: 500,
        form: 'spectator',
        limitApplicants: true,
        applicantsLimit: 20,
        payment: 'offline',
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
    fee: 160,
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
 * The mix is deliberate rather than uniform: active members alongside a pending
 * application awaiting approval, an elapsed member from last season who has not
 * renewed, an unpaid membership, a refunded one, and two households on group
 * memberships. A member list where every row is identical proves nothing about
 * the filters and batch actions the page is built around.
 */
export const MEMBERS: SeedMember[] = [
  /* ------------------------------------------------------------ Kildare */
  { email: 'niamh.walsh@example.test', org: 'kildare', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 120 },
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
  { email: 'aine.mcgrath@example.test', org: 'kildare', type: 'family', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 110, household: 'mcgrath', firstName: 'Conor', lastName: 'McGrath' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', type: 'family', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 110, household: 'mcgrath', firstName: 'Éabha', lastName: 'McGrath' },
  { email: 'aine.mcgrath@example.test', org: 'kildare', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 95, firstName: 'Rónán', lastName: 'McGrath' },

  /* -------------------------------------------------------------- Laois */
  { email: 'niamh.walsh@example.test', org: 'laois', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'stripe', season: 'current', renewedDaysAgo: 74 },
  { email: 'ruairi.kelly@example.test', org: 'laois', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 52 },
  // Playing but not yet paid up — the case the unpaid filter exists for.
  { email: 'oisin.farrell@example.test', org: 'laois', type: 'junior', status: 'active', paymentStatus: 'pending', payment: 'pay-offline', season: 'current', renewedDaysAgo: 30 },
  { email: 'clodagh.moran@example.test', org: 'laois', type: 'senior', status: 'active', paymentStatus: 'refunded', payment: 'stripe', season: 'current', renewedDaysAgo: 66 },
  { email: 'eoin.sheridan@example.test', org: 'laois', type: 'associate', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 20 },
  // Last season's member who has not come back.
  { email: 'darragh.otoole@example.test', org: 'laois', type: 'senior', status: 'elapsed', paymentStatus: 'paid', payment: 'stripe', season: 'previous', renewedDaysAgo: 400 },

  /* --------------------------------------------------------------- Ward */
  { email: 'niamh.walsh@example.test', org: 'ward', type: 'senior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 58 },
  { email: 'grainne.duffy@example.test', org: 'ward', type: 'junior', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 41 },
  { email: 'darragh.otoole@example.test', org: 'ward', type: 'associate', status: 'active', paymentStatus: 'paid', payment: 'pay-offline', season: 'current', renewedDaysAgo: 15 },
  /*
   * A second parent, and the other renewal that is due. Lorcán holds two of his
   * children's memberships and nothing of his own, which is the case where a
   * screen naming only the holder would be wrong on every card.
   */
  { email: 'lorcan.hayes@example.test', org: 'ward', type: 'family', status: 'active', paymentStatus: 'pending', payment: 'pay-offline', season: 'expiring', renewedDaysAgo: 350, household: 'hayes', firstName: 'Maeve', lastName: 'Hayes' },
  { email: 'lorcan.hayes@example.test', org: 'ward', type: 'family', status: 'active', paymentStatus: 'pending', payment: 'pay-offline', season: 'expiring', renewedDaysAgo: 350, household: 'hayes', firstName: 'Cathal', lastName: 'Hayes' },
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
    discounts: ['kitBundle', 'secondItemHalf'],
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
    discounts: ['kitBundle'],
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
    discounts: ['offPeakArena'],
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
];
