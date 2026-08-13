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
    membership_status: 'active',
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

  /** A renewal into a closed type is still closed. */
  it('does not let a renewal override the type being shut', async () => {
    respond([typeRow({ mine: 1, renewable: 1, membership_status: 'inactive' })]);

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
