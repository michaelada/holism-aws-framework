import { AccountCatalogueService } from '../account-catalogue.service';
import { db } from '../../database/pool';
import { RENEWAL_WINDOW_DAYS } from '../../utils/activity-status';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * Renewing a membership, rather than being refused one.
 *
 * Holding a membership bars applying for it again — that is right, and stops a
 * member buying the same year twice. But a member whose year is nearly up is
 * not applying, they are **renewing**, and refusing them is why C4's Renew
 * button led nowhere: the catalogue it sent them to marked the type
 * `already-a-member`.
 *
 * The window is the same 30 days C4 uses to decide whether to offer the button
 * at all, shared through `activity-status` so the screen and the catalogue
 * cannot disagree.
 */
describe('AccountCatalogueService — membership renewal', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';
  const USER = 'ou-1';
  const TODAY = new Date('2026-08-12T00:00:00Z');

  const typeRow = (over: Record<string, unknown> = {}) => ({
    id: 'mt-1',
    name: 'Full membership 2026',
    description: null,
    valid_until: '2026-12-31',
    membership_form_id: 'form-1',
    automatically_approve: true,
    /*
     * `'open'`, which is the word this column uses — the default in migration
     * `1707000000006`, what the org-admin form writes, and what
     * `account-activity.service` selects on.
     *
     * These fixtures said `'active'`, and so did the check they were written
     * against. Both being wrong in the same way is why nothing failed: the
     * service refused every membership type in every club, and this suite
     * agreed with it. A fixture that speaks the code's vocabulary rather than
     * the database's cannot catch the code getting it wrong.
     */
    membership_status: 'open',
    supported_payment_methods: ['pm-card'],
    fee: '120.00',
    handling_fee_included: false,
    use_terms_and_conditions: false,
    terms_and_conditions: null,
    // How many of this type the member holds, and how many are near expiry.
    mine: 0,
    renewable: 0,
    ...over,
  });

  const respond = (rows: any[]) => {
    mockDb.query = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  };

  const service = new AccountCatalogueService();

  it('offers a type the member does not hold as a fresh application', async () => {
    respond([typeRow()]);

    const [type] = await service.listMembershipTypes(ORG, USER, TODAY);

    expect(type).toMatchObject({ available: true, isRenewal: false });
  });

  it('refuses one the member holds and is nowhere near losing', async () => {
    respond([typeRow({ mine: 1, renewable: 0 })]);

    const [type] = await service.listMembershipTypes(ORG, USER, TODAY);

    expect(type).toMatchObject({
      available: false,
      unavailableReason: 'already-a-member',
      isRenewal: false,
    });
  });

  /** The case that was broken: nearly up, so this is a renewal. */
  it('offers one the member holds and is about to lose', async () => {
    respond([typeRow({ mine: 1, renewable: 1 })]);

    const [type] = await service.listMembershipTypes(ORG, USER, TODAY);

    expect(type).toMatchObject({ available: true, isRenewal: true });
  });

  /**
   * Two held, one expiring: the other still covers them, so renewing now would
   * buy overlapping cover they did not ask for.
   */
  it('refuses when only some of what the member holds is expiring', async () => {
    respond([typeRow({ mine: 2, renewable: 1 })]);

    const [type] = await service.listMembershipTypes(ORG, USER, TODAY);

    expect(type).toMatchObject({ available: false, unavailableReason: 'already-a-member' });
  });

  it('asks the database for exactly the shared renewal window', async () => {
    respond([typeRow()]);

    await service.listMembershipTypes(ORG, USER, TODAY);

    const [, params] = mockDb.query.mock.calls[0];
    const windowEnd = (params as any[])[3] as Date;
    const days = Math.round((windowEnd.getTime() - TODAY.getTime()) / 86_400_000);
    expect(days).toBe(RENEWAL_WINDOW_DAYS);
  });

  /*
   * The vocabulary itself, asserted.
   *
   * Every membership type in every club read as not open for applications,
   * because the service tested `membership_status !== 'active'` against a
   * column that holds `'open'`. Nothing failed — no member could apply for or
   * pay for a membership, and the list simply came back all-refused.
   */
  it('treats the column’s own word for open as open', async () => {
    respond([typeRow({ membership_status: 'open' })]);

    const [type] = await service.listMembershipTypes(ORG, USER, TODAY);

    expect(type).toMatchObject({ available: true, unavailableReason: null });
  });

  it('does not accept some other word for it', async () => {
    respond([typeRow({ membership_status: 'active' })]);

    const [type] = await service.listMembershipTypes(ORG, USER, TODAY);

    expect(type).toMatchObject({
      available: false,
      unavailableReason: 'not-open-for-applications',
    });
  });

  /** A renewal into a closed type is still closed. */
  it('does not let a renewal override the type being shut', async () => {
    respond([typeRow({ mine: 1, renewable: 1, membership_status: 'closed' })]);

    const [type] = await service.listMembershipTypes(ORG, USER, TODAY);

    expect(type).toMatchObject({
      available: false,
      unavailableReason: 'not-open-for-applications',
    });
  });

  it('does not offer a renewal into a period that has already ended', async () => {
    respond([typeRow({ mine: 1, renewable: 1, valid_until: '2026-01-31' })]);

    expect((await service.listMembershipTypes(ORG, USER, TODAY))[0].available).toBe(false);
  });
});
