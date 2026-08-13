import {
  slugifyUrlCode,
  validateUrlCode,
  ensureUniqueUrlCode,
  RESERVED_URL_CODES,
  URL_CODE_MAX_LENGTH,
} from '../url-code';

describe('slugifyUrlCode', () => {
  it('lower-cases and hyphenates a normal name', () => {
    expect(slugifyUrlCode('Kildare Hunt Pony Club')).toBe('kildare-hunt-pony-club');
  });

  it('collapses punctuation and runs of separators', () => {
    expect(slugifyUrlCode('Ballinasloe & Districts  Tennis   Club!!'))
      .toBe('ballinasloe-districts-tennis-club');
  });

  it('never leaves a leading or trailing hyphen', () => {
    expect(slugifyUrlCode('  --Westport Sailing--  ')).toBe('westport-sailing');
  });

  it('falls back rather than returning an empty code', () => {
    // Matches the backfill in 1709000000003_add-organization-url-code.js, so a
    // nameless organisation gets the same code either way.
    expect(slugifyUrlCode('')).toBe('org');
    expect(slugifyUrlCode('!!!')).toBe('org');
    expect(slugifyUrlCode('   ')).toBe('org');
  });

  it('suffixes a name that would land on a reserved word', () => {
    expect(slugifyUrlCode('Admin')).toBe('admin-org');
    expect(slugifyUrlCode('API')).toBe('api-org');
  });

  it('suffixes a single-character name so it clears the minimum length', () => {
    expect(slugifyUrlCode('A')).toBe('a-org');
  });

  it('truncates long names without leaving a trailing hyphen', () => {
    const slug = slugifyUrlCode(
      'The Very Long Organisation Name That Goes On Well Past Fifty Characters Indeed'
    );
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith('-')).toBe(false);
  });

  it('always produces something that validates', () => {
    const names = ['A', '', 'admin', '!!!', 'Ökoclub Grün', '2026', 'x'.repeat(200)];
    names.forEach((n) => {
      expect(validateUrlCode(slugifyUrlCode(n)).valid).toBe(true);
    });
  });
});

describe('validateUrlCode', () => {
  it('accepts a well-formed code', () => {
    expect(validateUrlCode('khpc')).toEqual({ valid: true });
    expect(validateUrlCode('bdtc-2026').valid).toBe(true);
    expect(validateUrlCode('a1').valid).toBe(true);
  });

  it('rejects a missing code', () => {
    expect(validateUrlCode(undefined).problem).toBe('required');
    expect(validateUrlCode(null).problem).toBe('required');
    expect(validateUrlCode('   ').problem).toBe('required');
  });

  it('rejects codes outside the length bounds', () => {
    expect(validateUrlCode('a').problem).toBe('too_short');
    expect(validateUrlCode('a'.repeat(URL_CODE_MAX_LENGTH + 1)).problem).toBe('too_long');
    expect(validateUrlCode('a'.repeat(URL_CODE_MAX_LENGTH)).valid).toBe(true);
  });

  it('rejects anything but lower-case alphanumerics and hyphens', () => {
    ['KHPC', 'kh pc', 'khpc!', 'khpc_2', 'khpc.ie', 'ökoclub', 'kh/pc']
      .forEach((code) => {
        expect(validateUrlCode(code).problem).toBe('invalid_characters');
      });
  });

  it('rejects a code starting with a hyphen', () => {
    expect(validateUrlCode('-khpc').problem).toBe('invalid_characters');
  });

  it('rejects reserved codes so they cannot shadow application paths', () => {
    ['admin', 'api', 'account', 'cart', 'checkout', 'login', 'switch']
      .forEach((code) => {
        expect(validateUrlCode(code).problem).toBe('reserved');
      });
  });

  it('allows a reserved word as part of a longer code', () => {
    expect(validateUrlCode('admin-club').valid).toBe(true);
    expect(validateUrlCode('my-account').valid).toBe(true);
  });

  it('does not silently repair a code the user typed', () => {
    // Quietly trimming or lower-casing means the code shown in the form is not
    // the one that ends up in members' URLs.
    expect(validateUrlCode(' khpc ').valid).toBe(false);
    expect(validateUrlCode('KHPC').valid).toBe(false);
  });

  it('returns a usable message for every problem', () => {
    ['', 'a', 'A'.repeat(60), 'KHPC', 'admin'].forEach((code) => {
      const result = validateUrlCode(code);
      expect(result.valid).toBe(false);
      expect(typeof result.message).toBe('string');
      expect(result.message!.length).toBeGreaterThan(0);
    });
  });
});

describe('ensureUniqueUrlCode', () => {
  it('returns the candidate untouched when it is free', () => {
    expect(ensureUniqueUrlCode('khpc', new Set())).toBe('khpc');
  });

  it('suffixes on collision', () => {
    expect(ensureUniqueUrlCode('khpc', new Set(['khpc']))).toBe('khpc-2');
  });

  it('keeps counting past repeated collisions', () => {
    expect(ensureUniqueUrlCode('khpc', new Set(['khpc', 'khpc-2', 'khpc-3'])))
      .toBe('khpc-4');
  });

  it('fits the suffix inside the maximum length', () => {
    const long = 'a'.repeat(URL_CODE_MAX_LENGTH);
    const result = ensureUniqueUrlCode(long, new Set([long]));
    expect(result.length).toBeLessThanOrEqual(URL_CODE_MAX_LENGTH);
    expect(result.endsWith('-2')).toBe(true);
  });

  it('still returns a valid code after suffixing', () => {
    const result = ensureUniqueUrlCode('khpc', new Set(['khpc']));
    expect(validateUrlCode(result).valid).toBe(true);
  });
});

describe('reserved list', () => {
  it('covers the application\'s own first-level paths', () => {
    ['account', 'admin', 'api', 'cart', 'checkout', 'payments', 'profile', 'settings']
      .forEach((word) => expect(RESERVED_URL_CODES.has(word)).toBe(true));
  });

  it('contains only entries that would themselves be valid codes', () => {
    // A reserved word that could never be typed anyway is dead weight, and
    // signals the list and the format rule have drifted apart.
    RESERVED_URL_CODES.forEach((word) => {
      expect(word).toMatch(/^[a-z0-9][a-z0-9-]{1,49}$/);
    });
  });
});
