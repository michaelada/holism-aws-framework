/**
 * Where the discount screens send their requests.
 *
 * This service keeps its own axios instance rather than going through `useApi`,
 * and its base URL used to be `VITE_API_URL || 'http://localhost:3000'`. Nothing
 * in this repository sets `VITE_API_URL` — every other client reads
 * `VITE_API_BASE_URL`, which the deployment build defines as the empty string so
 * that requests stay on the origin that served the page.
 *
 * So these screens alone told a browser on itsps.org to call port 3000 on the
 * *user's own machine*. Every discount request failed there while the rest of
 * the application worked, which is why it survived to production: it is correct
 * on a developer machine, where something usually is listening on that port.
 *
 * An absolute default cannot be right. There is no host that is correct in every
 * deployment, and a relative base is already correct in development because each
 * dev server proxies `/api` to the backend.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const create = vi.fn(() => ({
  interceptors: { request: { use: vi.fn() } },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: { create },
  create,
}));

/** The config the service handed to `axios.create` when it was constructed. */
const baseUrlAfterImport = async (): Promise<string> => {
  vi.resetModules();
  create.mockClear();
  await import('../discount.service');
  expect(create).toHaveBeenCalledTimes(1);
  return create.mock.calls[0][0].baseURL;
};

describe('discount API base URL', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('is relative when nothing is configured, so it follows the serving origin', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_API_BASE_URL', '');

    expect(await baseUrlAfterImport()).toBe('');
  });

  it('never falls back to an absolute localhost', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_API_BASE_URL', '');

    // The specific regression: a deployed browser asking its own machine for
    // the API. Asserted by shape rather than by string, because any absolute
    // default is the same mistake.
    expect(await baseUrlAfterImport()).not.toMatch(/^https?:\/\//);
  });

  it('reads VITE_API_BASE_URL, the variable the rest of the repo and the image use', async () => {
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');

    expect(await baseUrlAfterImport()).toBe('https://api.example.test');
  });

  it('still honours an explicit VITE_API_URL, which took precedence before', async () => {
    vi.stubEnv('VITE_API_URL', 'https://explicit.example.test');
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');

    expect(await baseUrlAfterImport()).toBe('https://explicit.example.test');
  });
});
