import { OrderAvailabilityService } from '../order-availability.service';
import { db } from '../../database/pool';
import { accountCatalogueService } from '../account-catalogue.service';

jest.mock('../../database/pool');
jest.mock('../../config/logger');
jest.mock('../account-catalogue.service', () => ({
  accountCatalogueService: {
    assertSlotAvailable: jest.fn(),
    findActivity: jest.fn(),
  },
}));

const mockDb = db as jest.Mocked<typeof db>;
const mockCatalogue = accountCatalogueService as jest.Mocked<typeof accountCatalogueService>;

/**
 * The question asked between authorising a card and taking the money.
 *
 * Getting it wrong is expensive in both directions. A false "available"
 * captures money for a slot that has gone, leaving the club a refund. A false
 * "unavailable" reverses a payment that was perfectly fine and turns a member
 * away for nothing — which is why the buyer's *own* hold must never count
 * against them.
 */
describe('OrderAvailabilityService', () => {
  const service = new OrderAvailabilityService();

  const bookingLine = (over: Record<string, any> = {}) => ({
    id: 'ptx-1',
    item_type: 'booking',
    context_ref: { calendarId: 'cal-1', date: '2026-08-19', startTime: '17:00', duration: 60, places: 1 },
    quantity: 1,
    description: 'Outdoor arena',
    organisation_id: 'org-1',
    user_id: 'ou-1',
    ...over,
  });

  const entryLine = (over: Record<string, any> = {}) => ({
    id: 'ptx-2',
    item_type: 'event_entry',
    context_ref: { activityId: 'act-1' },
    quantity: 1,
    description: 'Have-a-go lesson',
    organisation_id: 'org-1',
    user_id: 'ou-1',
    ...over,
  });

  const activity = (over: Record<string, any> = {}) => ({
    event: { entriesLimit: null, unavailableReason: null },
    activity: { placesRemaining: 5, entriesLimit: 10 },
    ...over,
  });

  const withLines = (rows: any[]) => {
    mockDb.query = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCatalogue.assertSlotAvailable.mockResolvedValue({} as any);
    mockCatalogue.findActivity.mockResolvedValue(activity() as any);
  });

  it('passes an order whose slot is still free', async () => {
    withLines([bookingLine()]);

    await expect(service.check('pay-1')).resolves.toEqual({ available: true, reason: null });
  });

  it('excludes the buyer’s own hold, which is the very thing being redeemed', async () => {
    // Counting it would have a member's own reservation report their slot taken
    // and reverse a payment that should have gone through.
    withLines([bookingLine()]);

    await service.check('pay-1');

    const args = mockCatalogue.assertSlotAvailable.mock.calls[0];
    expect(args[7]).toBe('ou-1');
    expect(args[8]).toBe(true);
  });

  it('fails the order, naming the line, when the slot has gone', async () => {
    withLines([bookingLine()]);
    mockCatalogue.assertSlotAvailable.mockRejectedValue(new Error('That slot is fully booked'));

    await expect(service.check('pay-1')).resolves.toEqual({
      available: false,
      reason: 'Outdoor arena: That slot is fully booked',
    });
  });

  it('passes a malformed booking through rather than reversing the payment', async () => {
    // Fulfilment fails that one line with its own message. Reversing the whole
    // order because a context is unreadable would be a worse answer.
    withLines([bookingLine({ context_ref: {} })]);

    await expect(service.check('pay-1')).resolves.toMatchObject({ available: true });
    expect(mockCatalogue.assertSlotAvailable).not.toHaveBeenCalled();
  });

  it('passes an entry that still has room', async () => {
    withLines([entryLine()]);

    await expect(service.check('pay-1')).resolves.toMatchObject({ available: true });
  });

  it('excludes own holds for entries too', async () => {
    withLines([entryLine()]);

    await service.check('pay-1');

    expect(mockCatalogue.findActivity).toHaveBeenCalledWith(
      'org-1',
      'ou-1',
      'act-1',
      expect.any(Date),
      { excludeOwnHolds: true }
    );
  });

  it('fails when the activity filled up while they were paying', async () => {
    withLines([entryLine()]);
    mockCatalogue.findActivity.mockResolvedValue(
      activity({ activity: { placesRemaining: 0, entriesLimit: 10 } }) as any
    );

    await expect(service.check('pay-1')).resolves.toEqual({
      available: false,
      reason: 'Have-a-go lesson: that activity is now full',
    });
  });

  it('fails when fewer places are left than were bought', async () => {
    withLines([entryLine({ quantity: 3 })]);
    mockCatalogue.findActivity.mockResolvedValue(
      activity({ activity: { placesRemaining: 2, entriesLimit: 10 } }) as any
    );

    await expect(service.check('pay-1')).resolves.toMatchObject({ available: false });
  });

  it('ignores capacity for an uncapped activity', async () => {
    // Null places remaining means no limit — there is nothing to run out of.
    withLines([entryLine({ quantity: 50 })]);
    mockCatalogue.findActivity.mockResolvedValue(
      activity({ activity: { placesRemaining: null, entriesLimit: null } }) as any
    );

    await expect(service.check('pay-1')).resolves.toMatchObject({ available: true });
  });

  it('fails when entries closed while they were paying', async () => {
    withLines([entryLine()]);
    mockCatalogue.findActivity.mockResolvedValue(
      activity({ event: { entriesLimit: null, unavailableReason: 'entries-closed' } }) as any
    );

    await expect(service.check('pay-1')).resolves.toMatchObject({ available: false });
  });

  it('fails when the activity has been withdrawn entirely', async () => {
    withLines([entryLine()]);
    mockCatalogue.findActivity.mockResolvedValue(null);

    await expect(service.check('pay-1')).resolves.toEqual({
      available: false,
      reason: 'Have-a-go lesson: that activity is no longer available',
    });
  });

  it('stops at the first problem rather than checking the rest', async () => {
    withLines([bookingLine(), entryLine()]);
    mockCatalogue.assertSlotAvailable.mockRejectedValue(new Error('That slot is fully booked'));

    await service.check('pay-1');

    expect(mockCatalogue.findActivity).not.toHaveBeenCalled();
  });

  it('passes an order with nothing contended in it', async () => {
    // Memberships and merchandise are filtered out by the query: nobody else
    // can take them between authorising and capturing.
    withLines([]);

    await expect(service.check('pay-1')).resolves.toEqual({ available: true, reason: null });
  });

  it('asks only about contended, unfulfilled lines', async () => {
    withLines([]);

    await service.check('pay-1');

    const [sql] = (mockDb.query as jest.Mock).mock.calls[0];
    expect(String(sql)).toContain('fulfilled_at IS NULL');
    expect(String(sql)).toContain("'booking'");
    // Both spellings, because payment_transactions carries whichever the
    // basket wrote at the time.
    expect(String(sql)).toContain("'event_entry'");
    expect(String(sql)).toContain("'event-entry'");
  });

  it('handles the hyphenated entry spelling as an entry', async () => {
    withLines([entryLine({ item_type: 'event-entry' })]);

    await service.check('pay-1');

    expect(mockCatalogue.findActivity).toHaveBeenCalled();
  });
});
