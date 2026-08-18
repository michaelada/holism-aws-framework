import { allowedOrigins, isAllowedOrigin, isAllowedRedirectUrl } from '../allowed-origins';

const ORIGINAL = { ...process.env };

beforeEach(() => {
  // Both are read by `allowedOrigins`; leaving either set makes the case under
  // test depend on the machine it runs on.
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.PUBLIC_URL;
});

afterEach(() => {
  process.env = { ...ORIGINAL };
});

describe('allowedOrigins', () => {
  it('parses the comma-separated list', () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5175, http://localhost:5174';
    expect(allowedOrigins()).toEqual(['http://localhost:5175', 'http://localhost:5174']);
  });

  it('ignores empty entries from a trailing comma', () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5175,';
    expect(allowedOrigins()).toEqual(['http://localhost:5175']);
  });

  it('falls back when nothing is configured', () => {
    expect(allowedOrigins()).toEqual(['http://localhost:3000']);
  });

  /*
   * The deployment sets PUBLIC_URL and nothing else, so before this the list
   * was the localhost fallback and the site refused its own origin.
   *
   * The damage was hidden by which requests carry an `Origin` header at all:
   * browsers omit it on a same-origin GET and send it on PUT, POST and DELETE.
   * So every page loaded and nothing could be saved — and the refusal surfaced
   * as a 500 whose message never left the server.
   */
  describe('the deployment’s own origin', () => {
    it('is trusted without having to be listed twice', () => {
      process.env.PUBLIC_URL = 'https://itsps.org';

      expect(allowedOrigins()).toContain('https://itsps.org');
    });

    it('is the origin only — a path in PUBLIC_URL must not leak into it', () => {
      process.env.PUBLIC_URL = 'https://itsps.org/orgadmin';

      // An Origin header is scheme+host+port and never carries a path, so a
      // list entry with one could never match anything.
      expect(allowedOrigins()).toEqual(['https://itsps.org']);
    });

    it('joins anything else the operator has listed', () => {
      process.env.PUBLIC_URL = 'https://itsps.org';
      process.env.ALLOWED_ORIGINS = 'https://admin.example.test';

      expect(allowedOrigins()).toEqual([
        'https://admin.example.test',
        'https://itsps.org',
      ]);
    });

    it('is not repeated when the operator has listed it as well', () => {
      process.env.PUBLIC_URL = 'https://itsps.org';
      process.env.ALLOWED_ORIGINS = 'https://itsps.org';

      expect(allowedOrigins()).toEqual(['https://itsps.org']);
    });

    it('is ignored when PUBLIC_URL is not a URL, rather than poisoning the list', () => {
      process.env.PUBLIC_URL = 'itsps.org';
      process.env.ALLOWED_ORIGINS = 'https://admin.example.test';

      expect(allowedOrigins()).toEqual(['https://admin.example.test']);
    });

    it('lets the browser write, which is the whole point', () => {
      process.env.PUBLIC_URL = 'https://itsps.org';

      // The exact refusal from the deployed logs.
      expect(isAllowedOrigin('https://itsps.org')).toBe(true);
    });

    it('still refuses an origin nobody configured', () => {
      process.env.PUBLIC_URL = 'https://itsps.org';

      expect(isAllowedOrigin('https://not-itsps.org')).toBe(false);
    });
  });
});

describe('isAllowedRedirectUrl', () => {
  beforeEach(() => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5175,https://admin.example.com';
    process.env.NODE_ENV = 'production';
  });

  /**
   * The bug this replaced. Every front end reaches the API through a proxy that
   * rewrites `Host` — Vite's dev server with `changeOrigin: true`, nginx in
   * production — so comparing against the request's own host rejected the very
   * origin the browser was on. The org-admin app on :5175 was refused because
   * the backend saw its own :3000.
   */
  it('accepts an allowed origin regardless of how the request was routed', () => {
    expect(isAllowedRedirectUrl('http://localhost:5175/settings?tab=payments')).toBe(true);
    expect(isAllowedRedirectUrl('https://admin.example.com/settings')).toBe(true);
  });

  it('refuses an origin that is not on the list', () => {
    // The point of the check: Stripe redirects the administrator's browser to
    // this URL, so an unvalidated value is an open redirect the victim is
    // walked through by Stripe itself.
    expect(isAllowedRedirectUrl('https://evil.example.com/steal')).toBe(false);
  });

  it('refuses a look-alike host', () => {
    expect(isAllowedRedirectUrl('https://admin.example.com.evil.test/')).toBe(false);
  });

  it('refuses a different port on an allowed host', () => {
    expect(isAllowedRedirectUrl('http://localhost:9999/')).toBe(false);
  });

  it('refuses a different scheme on an allowed host', () => {
    expect(isAllowedRedirectUrl('https://localhost:5175/')).toBe(false);
  });

  /** These parse perfectly well as URLs and are what the check exists for. */
  it('refuses non-http schemes outright', () => {
    expect(isAllowedRedirectUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedRedirectUrl('file:///etc/passwd')).toBe(false);
  });

  it('refuses anything that is not a URL', () => {
    expect(isAllowedRedirectUrl('/settings')).toBe(false);
    expect(isAllowedRedirectUrl('')).toBe(false);
    expect(isAllowedRedirectUrl('not a url')).toBe(false);
  });

  it('accepts any localhost origin in development only', () => {
    process.env.NODE_ENV = 'development';
    expect(isAllowedRedirectUrl('http://localhost:5176/')).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(isAllowedRedirectUrl('http://localhost:5176/')).toBe(false);
  });
});

describe('isAllowedOrigin', () => {
  it('matches the CORS behaviour it shares a definition with', () => {
    process.env.ALLOWED_ORIGINS = 'http://localhost:5175';
    process.env.NODE_ENV = 'production';

    expect(isAllowedOrigin('http://localhost:5175')).toBe(true);
    expect(isAllowedOrigin('http://localhost:5174')).toBe(false);
  });
});
