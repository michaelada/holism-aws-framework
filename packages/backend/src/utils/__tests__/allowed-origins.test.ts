import { allowedOrigins, isAllowedOrigin, isAllowedRedirectUrl } from '../allowed-origins';

const ORIGINAL = { ...process.env };

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
    delete process.env.ALLOWED_ORIGINS;
    expect(allowedOrigins()).toEqual(['http://localhost:3000']);
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
