/**
 * Organisation URL codes.
 *
 * An organisation is reached in the account-user application by a short code
 * in the path — itsplainsailing.com/account/khpc. The code is the first path
 * segment, so it competes for namespace with the application's own routes: if
 * an organisation could take the code `admin`, `/account/admin` would stop
 * resolving to whatever the application meant by it.
 *
 * RESERVED_URL_CODES must stay in step with the RESERVED list in
 * migrations/1709000000003_add-organization-url-code.js, which applies the same
 * rule when backfilling existing organisations.
 */

export const URL_CODE_MAX_LENGTH = 50;
export const URL_CODE_MIN_LENGTH = 2;

/** Longest generated base, leaving room for a `-<n>` collision suffix. */
const BASE_MAX_LENGTH = 40;

export const RESERVED_URL_CODES: ReadonlySet<string> = new Set([
  'account', 'accounts', 'admin', 'administrator', 'api', 'app', 'assets',
  'auth', 'cart', 'cdn', 'checkout', 'docs', 'health', 'help', 'images',
  'login', 'logout', 'metrics', 'new', 'orgadmin', 'password', 'payment',
  'payments', 'profile', 'public', 'register', 'settings', 'signin', 'signup',
  'static', 'support', 'switch', 'user', 'users', 'www',
]);

const URL_CODE_PATTERN = new RegExp(
  `^[a-z0-9][a-z0-9-]{${URL_CODE_MIN_LENGTH - 1},${URL_CODE_MAX_LENGTH - 1}}$`
);

export type UrlCodeProblem =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid_characters'
  | 'reserved';

export interface UrlCodeValidation {
  valid: boolean;
  problem?: UrlCodeProblem;
  message?: string;
}

const MESSAGES: Record<UrlCodeProblem, string> = {
  required: 'A URL code is required',
  too_short: `A URL code must be at least ${URL_CODE_MIN_LENGTH} characters`,
  too_long: `A URL code must be ${URL_CODE_MAX_LENGTH} characters or fewer`,
  invalid_characters:
    'A URL code may contain only lower-case letters, numbers and hyphens, and must start with a letter or number',
  reserved: 'That URL code is reserved by the platform — please choose another',
};

const fail = (problem: UrlCodeProblem): UrlCodeValidation => ({
  valid: false,
  problem,
  message: MESSAGES[problem],
});

/**
 * Turn arbitrary text into a candidate URL code.
 *
 * Always returns something usable: text with no usable characters becomes
 * `org`, and a result that would be reserved or too short is suffixed rather
 * than returned as-is, so the caller never has to handle an unusable value.
 */
export function slugifyUrlCode(input: string): string {
  const base = (input || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, BASE_MAX_LENGTH)
    .replace(/-+$/, '');

  const candidate = base || 'org';

  if (candidate.length < URL_CODE_MIN_LENGTH || RESERVED_URL_CODES.has(candidate)) {
    return `${candidate}-org`;
  }
  return candidate;
}

/**
 * Check a code supplied by a user. Format and reserved words only — uniqueness
 * is a database question and belongs in the service.
 */
export function validateUrlCode(code: string | undefined | null): UrlCodeValidation {
  if (code === undefined || code === null || code.trim() === '') {
    return fail('required');
  }

  // Deliberately strict: no trimming or lower-casing on the caller's behalf.
  // Quietly rewriting a code the user typed means the one they see in the form
  // is not the one that ends up in their URLs.
  if (code.length < URL_CODE_MIN_LENGTH) return fail('too_short');
  if (code.length > URL_CODE_MAX_LENGTH) return fail('too_long');
  if (!URL_CODE_PATTERN.test(code)) return fail('invalid_characters');
  if (RESERVED_URL_CODES.has(code)) return fail('reserved');

  return { valid: true };
}

/**
 * Pick a code that is not already taken, by appending a numeric suffix.
 *
 * `taken` is the set of codes already in use. The suffix is fitted inside
 * URL_CODE_MAX_LENGTH by trimming the base rather than overflowing it.
 */
export function ensureUniqueUrlCode(
  candidate: string,
  taken: ReadonlySet<string>
): string {
  if (!taken.has(candidate)) return candidate;

  for (let n = 2; n < 1000; n += 1) {
    const suffix = `-${n}`;
    const base = candidate
      .slice(0, URL_CODE_MAX_LENGTH - suffix.length)
      .replace(/-+$/, '');
    const next = `${base}${suffix}`;
    if (!taken.has(next)) return next;
  }

  throw new Error(`Unable to derive a unique URL code from "${candidate}"`);
}
