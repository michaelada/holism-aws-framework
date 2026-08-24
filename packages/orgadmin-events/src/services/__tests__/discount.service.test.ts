import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The discount API client, which predates `useApi` and therefore has to do for
 * itself what that hook does for everything else.
 *
 * Two things here have already gone wrong in production and are worth holding
 * still. The **organisation scoping** in the request interceptor is what tells
 * the server which club a discount belongs to — without it an administrator of
 * several clubs edits whichever one the server guesses. And the **date
 * transformation** turns the JSON strings the API returns into real `Date`s;
 * skip it and every screen that formats `validUntil` renders "Invalid Date".
 *
 * The error handling is the third: an axios error carries the server's own
 * explanation nested three levels down, and losing it leaves the UI showing
 * "Request failed with status code 409" to a club secretary.
 */

const { client } = vi.hoisted(() => ({
  client: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() } },
  },
}));

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<{ default: Record<string, unknown> }>();
  return {
    ...actual,
    default: {
      ...actual.default,
      create: vi.fn(() => client),
      isAxiosError: (e: unknown) => Boolean((e as { isAxiosError?: boolean })?.isAxiosError),
    },
  };
});

import { discountService } from '../discount.service';

/*
 * Captured at import time: the service registers this in its constructor, and
 * `clearAllMocks` between tests erases the record of that one-off call.
 */
const registeredInterceptor = client.interceptors.request.use.mock.calls[0][0];
const onRequest = () => registeredInterceptor;

const DISCOUNT = {
  id: 'd-1',
  name: 'Early Bird',
  code: 'EARLY',
  validFrom: '2026-01-01T00:00:00Z',
  validUntil: '2026-03-01T00:00:00Z',
  createdAt: '2025-12-01T00:00:00Z',
  updatedAt: '2025-12-02T00:00:00Z',
};

const axiosError = (message: string, serverMessage?: string) => ({
  isAxiosError: true,
  message,
  response: serverMessage ? { data: { error: { message: serverMessage } } } : undefined,
});

/** The URL of the most recent call on a given verb. */
const urlOf = (verb: 'get' | 'post' | 'put' | 'delete') => client[verb].mock.calls.at(-1)![0];

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  client.get.mockResolvedValue({ data: [] });
  client.post.mockResolvedValue({ data: DISCOUNT });
  client.put.mockResolvedValue({ data: DISCOUNT });
  client.delete.mockResolvedValue({ data: undefined });
  discountService.setTokenProvider(() => null);
  discountService.setOrganisationProvider(() => null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('discountService — what every request carries', () => {
  it('attaches the token that is current when the request is made', () => {
    let token = 'first';
    discountService.setTokenProvider(() => token);

    const before = onRequest()({ headers: {}, url: '/api/orgadmin/discounts' });
    token = 'refreshed';
    const after = onRequest()({ headers: {}, url: '/api/orgadmin/discounts' });

    expect(before.headers.Authorization).toBe('Bearer first');
    expect(after.headers.Authorization).toBe('Bearer refreshed');
  });

  it('names the organisation both in a header and in the path', () => {
    discountService.setOrganisationProvider(() => 'org-1');

    const config = onRequest()({ headers: {}, url: '/api/orgadmin/discounts' });

    // Unscoped, the server has to guess which club an admin of several meant.
    expect(config.headers['X-Organisation-Id']).toBe('org-1');
    expect(config.url).toBe('/api/orgadmin/organisations/org-1/discounts');
  });

  it('leaves a URL that already names an organisation alone', () => {
    discountService.setOrganisationProvider(() => 'org-1');

    const config = onRequest()({
      headers: {},
      url: '/api/orgadmin/organisations/org-2/discounts',
    });

    // Scoping twice produces /organisations/org-1/organisations/org-2/…
    expect(config.url).toBe('/api/orgadmin/organisations/org-2/discounts');
  });

  it('leaves the auth endpoints unscoped', () => {
    discountService.setOrganisationProvider(() => 'org-1');

    const config = onRequest()({ headers: {}, url: '/api/orgadmin/auth/me' });

    // "Who am I" is asked before the answer names an organisation.
    expect(config.url).toBe('/api/orgadmin/auth/me');
  });

  it('leaves URLs outside the orgadmin API alone', () => {
    discountService.setOrganisationProvider(() => 'org-1');

    const config = onRequest()({ headers: {}, url: '/api/public/discounts' });

    expect(config.url).toBe('/api/public/discounts');
  });

  it('sends nothing extra when nobody is signed in anywhere', () => {
    const config = onRequest()({ headers: {}, url: '/api/orgadmin/discounts' });

    expect(config.headers.Authorization).toBeUndefined();
    expect(config.headers['X-Organisation-Id']).toBeUndefined();
  });
});

describe('discountService — reading discounts', () => {
  it('asks for one organisation’s discounts', async () => {
    await discountService.getDiscounts({ organisationId: 'org-1' } as never);

    expect(urlOf('get')).toContain('/api/orgadmin/organisations/org-1/discounts');
  });

  it('narrows to one module when asked', async () => {
    await discountService.getDiscounts({ organisationId: 'org-1', moduleType: 'events' } as never);

    expect(urlOf('get')).toContain('/discounts/events');
  });

  it('passes search, status and paging to the server', async () => {
    await discountService.getDiscounts({
      organisationId: 'org-1',
      status: 'active',
      search: 'early',
      page: 2,
      limit: 25,
    } as never);

    const url = urlOf('get');
    expect(url).toContain('status=active');
    expect(url).toContain('search=early');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=25');
  });

  it('turns the dates on every discount into real dates', async () => {
    client.get.mockResolvedValue({ data: [DISCOUNT, { ...DISCOUNT, id: 'd-2' }] });

    const discounts = await discountService.getDiscounts({ organisationId: 'org-1' } as never);

    // Left as strings these render as "Invalid Date" wherever they are formatted.
    expect(discounts).toHaveLength(2);
    discounts.forEach((d) => {
      expect(d.validFrom).toBeInstanceOf(Date);
      expect(d.createdAt).toBeInstanceOf(Date);
    });
  });

  it('reads one discount, saying which organisation it belongs to', async () => {
    client.get.mockResolvedValue({ data: DISCOUNT });

    const discount = await discountService.getDiscountById('d-1', 'org-1');

    expect(urlOf('get')).toContain('/api/orgadmin/discounts/d-1');
    expect(urlOf('get')).toContain('organisationId=org-1');
    expect(discount.validUntil).toBeInstanceOf(Date);
  });

  it('leaves an open-ended discount without a start or end date', async () => {
    client.get.mockResolvedValue({ data: { ...DISCOUNT, validFrom: null, validUntil: null } });

    const discount = await discountService.getDiscountById('d-1', 'org-1');

    // `new Date(null)` is 1 January 1970, which reads as an expired discount.
    expect(discount.validFrom).toBeUndefined();
    expect(discount.validUntil).toBeUndefined();
  });
});

describe('discountService — writing discounts', () => {
  it('creates a discount with its organisation and module attached', async () => {
    await discountService.createDiscount('org-1', 'events' as never, { name: 'Early Bird' } as never);

    expect(client.post).toHaveBeenCalledWith('/api/orgadmin/discounts', {
      name: 'Early Bird',
      organisationId: 'org-1',
      moduleType: 'events',
    });
  });

  it('updates a discount in place', async () => {
    await discountService.updateDiscount('d-1', { name: 'Earlier Bird' } as never);

    expect(client.put).toHaveBeenCalledWith('/api/orgadmin/discounts/d-1', {
      name: 'Earlier Bird',
    });
  });

  it('deletes a discount', async () => {
    await discountService.deleteDiscount('d-1');

    expect(client.delete).toHaveBeenCalledWith('/api/orgadmin/discounts/d-1');
  });
});

describe('discountService — attaching discounts to things', () => {
  it('applies a discount to a target', async () => {
    await discountService.applyDiscount('d-1', { targetType: 'event', targetId: 'ev-1' } as never);

    expect(client.post).toHaveBeenCalledWith('/api/orgadmin/discounts/d-1/apply', {
      targetType: 'event',
      targetId: 'ev-1',
    });
  });

  it('removes a discount from one target only', async () => {
    await discountService.removeDiscount('d-1', 'event', 'ev-1');

    // Deleting /discounts/d-1 instead would remove the discount everywhere.
    expect(client.delete).toHaveBeenCalledWith('/api/orgadmin/discounts/d-1/apply/event/ev-1');
  });

  it('lists what is applied to a target, with usable dates', async () => {
    client.get.mockResolvedValue({ data: [DISCOUNT] });

    const discounts = await discountService.getDiscountsForTarget('event', 'ev-1');

    expect(urlOf('get')).toBe('/api/orgadmin/discounts/target/event/ev-1');
    expect(discounts[0].createdAt).toBeInstanceOf(Date);
  });
});

describe('discountService — checking and costing', () => {
  it('validates a discount for a member and an amount', async () => {
    client.post.mockResolvedValue({ data: { valid: true } });

    const result = await discountService.validateDiscount({ discountId: 'd-1', amount: 50 } as never);

    expect(client.post).toHaveBeenCalledWith('/api/orgadmin/discounts/validate', {
      discountId: 'd-1',
      amount: 50,
    });
    expect(result).toEqual({ valid: true });
  });

  it('validates a code and returns the discount behind it', async () => {
    client.post.mockResolvedValue({ data: DISCOUNT });

    const discount = await discountService.validateCode({ code: 'EARLY' } as never);

    expect(urlOf('post')).toBe('/api/orgadmin/discounts/validate-code');
    expect(discount.validUntil).toBeInstanceOf(Date);
  });

  it('costs a single item', async () => {
    client.post.mockResolvedValue({ data: { discountAmount: 5 } });

    const result = await discountService.calculateDiscount({ amount: 50 } as never);

    expect(urlOf('post')).toBe('/api/orgadmin/discounts/calculate');
    expect(result).toEqual({ discountAmount: 5 });
  });

  it('costs a whole cart', async () => {
    client.post.mockResolvedValue({ data: { total: 45 } });

    const result = await discountService.calculateCart({ items: [] } as never);

    expect(urlOf('post')).toBe('/api/orgadmin/discounts/calculate-cart');
    expect(result).toEqual({ total: 45 });
  });
});

describe('discountService — usage', () => {
  it('reads a discount’s usage history', async () => {
    await discountService.getUsage({ discountId: 'd-1' } as never);

    expect(urlOf('get')).toContain('/api/orgadmin/discounts/d-1/usage');
  });

  it('narrows usage by date, member and page', async () => {
    await discountService.getUsage({
      discountId: 'd-1',
      startDate: '2026-01-01',
      endDate: '2026-02-01',
      userId: 'u-1',
      page: 3,
      limit: 10,
    } as never);

    const url = urlOf('get');
    expect(url).toContain('startDate=2026-01-01');
    expect(url).toContain('endDate=2026-02-01');
    expect(url).toContain('userId=u-1');
    expect(url).toContain('page=3');
  });

  it('reads the usage totals', async () => {
    client.get.mockResolvedValue({ data: { timesUsed: 12 } });

    const stats = await discountService.getUsageStats('d-1');

    expect(urlOf('get')).toBe('/api/orgadmin/discounts/d-1/stats');
    expect(stats).toEqual({ timesUsed: 12 });
  });
});

describe('discountService — when a call fails', () => {
  it('surfaces the server’s own explanation', async () => {
    client.delete.mockRejectedValue(
      axiosError('Request failed with status code 409', 'Discount has been used 12 times')
    );

    // The status line tells a club secretary nothing they can act on.
    await expect(discountService.deleteDiscount('d-1')).rejects.toThrow(
      'Discount has been used 12 times'
    );
  });

  it('falls back to the axios message when the server explained nothing', async () => {
    client.get.mockRejectedValue(axiosError('Network Error'));

    await expect(discountService.getUsageStats('d-1')).rejects.toThrow('Network Error');
  });

  it('passes a plain error through unchanged', async () => {
    client.post.mockRejectedValue(new Error('boom'));

    await expect(
      discountService.createDiscount('org-1', 'events' as never, {} as never)
    ).rejects.toThrow('boom');
  });

  it('produces a real error even from something that was never one', async () => {
    client.get.mockRejectedValue('just a string');

    await expect(discountService.getDiscountsForTarget('event', 'ev-1')).rejects.toThrow(Error);
  });
});
