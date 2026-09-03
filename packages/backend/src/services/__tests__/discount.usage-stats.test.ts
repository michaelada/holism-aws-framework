/**
 * What a discount has actually taken off.
 *
 * The figures behind the org-admin's usage page. Two things had to be right
 * before that page was worth showing at all:
 *
 *  - **Where the uses are read from.** The original query counted rows in
 *    `discount_usage`, which `recordUsage` writes and *nothing calls* — so it
 *    would have reported nought uses for a discount used all season. The cart
 *    line is where a discount is recorded against a purchase, and the cart
 *    survives checkout as `ordered`.
 *  - **What units come back.** Cart lines are in minor units; every other money
 *    field this API returns is major. A page that formats one field in cents is
 *    worse than one that formats none.
 */

import { DiscountService } from '../discount.service';
import { db } from '../../database/pool';

jest.mock('../../database/pool', () => ({
  db: { query: jest.fn(), getClient: jest.fn() },
}));

jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const service = new DiscountService();
const mockDb = db as jest.Mocked<typeof db>;

/** Totals, then the breakdown by member, then the discount's own limits. */
const answer = (
  totals: { uses: number; total: number | string },
  members: Array<Record<string, unknown>>,
  usageLimits: unknown = null
) => {
  mockDb.query.mockReset();
  mockDb.query
    .mockResolvedValueOnce({ rows: [totals] } as never)
    .mockResolvedValueOnce({ rows: members } as never)
    .mockResolvedValueOnce({ rows: [{ usage_limits: usageLimits }] } as never);
};

describe('getUsageStats', () => {
  beforeEach(() => mockDb.query.mockReset());

  it('counts the cart lines a discount came off, not `discount_usage`', async () => {
    // The table the original design intended holds no rows in any environment,
    // because nothing has ever called `recordUsage`.
    answer({ uses: 3, total: 4500 }, []);

    await service.getUsageStats('discount-1');

    const sql = String(mockDb.query.mock.calls[0][0]);
    expect(sql).toContain('cart_items');
    expect(sql).not.toContain('discount_usage');
  });

  it('counts only carts that became an order', async () => {
    /*
     * An open cart is a shopper still thinking, and an abandoned one never
     * bought anything — counting either would report uses the club cannot find
     * a payment for.
     */
    answer({ uses: 0, total: 0 }, []);

    await service.getUsageStats('discount-1');

    expect(String(mockDb.query.mock.calls[0][0])).toContain("c.status = 'ordered'");
  });

  it('returns money in major units, as every other amount does', async () => {
    answer({ uses: 3, total: '4500' }, []);

    const stats = await service.getUsageStats('discount-1');

    expect(stats.totalDiscountGiven).toBe(45);
    expect(stats.averageDiscountAmount).toBe(15);
  });

  it('does not divide by nought for a discount nobody has used', async () => {
    answer({ uses: 0, total: 0 }, []);

    const stats = await service.getUsageStats('discount-1');

    expect(stats).toMatchObject({
      totalUses: 0,
      totalDiscountGiven: 0,
      averageDiscountAmount: 0,
      topUsers: [],
    });
  });

  it('names the members who used it', async () => {
    answer({ uses: 4, total: 6000 }, [
      { userId: 'user-1', name: 'Aoife Byrne', usageCount: 3, total: '4500' },
      { userId: 'user-2', name: 'Conor McGrath', usageCount: 1, total: '1500' },
    ]);

    const stats = await service.getUsageStats('discount-1');

    expect(stats.topUsers).toEqual([
      { userId: 'user-1', name: 'Aoife Byrne', usageCount: 3, totalDiscountReceived: 45 },
      { userId: 'user-2', name: 'Conor McGrath', usageCount: 1, totalDiscountReceived: 15 },
    ]);
  });

  it('still counts a use by a member no longer on record', async () => {
    // The join is left outer on purpose: the use happened either way.
    answer({ uses: 1, total: 1500 }, [
      { userId: 'user-9', name: null, usageCount: 1, total: '1500' },
    ]);

    const stats = await service.getUsageStats('discount-1');

    expect(stats.topUsers[0]).toMatchObject({ userId: 'user-9', usageCount: 1 });
    expect(stats.topUsers[0].name).toBeUndefined();
  });

  it('reports what is left of a capped discount', async () => {
    answer({ uses: 12, total: 18000 }, [], { totalUsageLimit: 40 });

    expect((await service.getUsageStats('discount-1')).remainingUses).toBe(28);
  });

  it('never reports fewer than nought left', async () => {
    // A cap lowered after the fact, or uses recorded around it.
    answer({ uses: 45, total: 67500 }, [], { totalUsageLimit: 40 });

    expect((await service.getUsageStats('discount-1')).remainingUses).toBe(0);
  });

  it('leaves the remainder absent where there is no cap', async () => {
    // `0` would read as a discount that has run out — the opposite of no limit.
    answer({ uses: 12, total: 18000 }, [], { perUserLimit: 1 });

    expect((await service.getUsageStats('discount-1')).remainingUses).toBeUndefined();
  });

  it('survives a discount that has been deleted under it', async () => {
    mockDb.query.mockReset();
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ uses: 0, total: 0 }] } as never)
      .mockResolvedValueOnce({ rows: [] } as never)
      .mockResolvedValueOnce({ rows: [] } as never);

    await expect(service.getUsageStats('gone')).resolves.toMatchObject({ totalUses: 0 });
  });
});
