import { AccountCatalogueService } from '../account-catalogue.service';
import { db } from '../../database/pool';
import { ValidationError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * Registration schemes, as a member sees them (D7, D8).
 *
 * Two things here are unlike every other catalogue:
 *
 *  - **A registration is of a thing.** `entity_name` is the club's word for it —
 *    horse, boat, dog — and is carried through to the screens verbatim.
 *  - **Holding one is no bar to another.** A member with two horses registers
 *    twice, so there is no "already registered" reason, unlike memberships.
 */
describe('AccountCatalogueService — registration types', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';
  const TODAY = new Date('2026-08-12T00:00:00Z');

  const typeRow = (over: Record<string, unknown> = {}) => ({
    id: 'rt-1',
    name: 'Horse registration 2026',
    description: 'Annual',
    entity_name: 'Horse',
    registration_form_id: 'form-1',
    registration_status: 'open',
    is_rolling_registration: false,
    valid_until: '2026-12-31',
    number_of_months: null,
    automatically_approve: true,
    fee: '45.00',
    handling_fee_included: false,
    supported_payment_methods: ['pm-card'],
    use_terms_and_conditions: false,
    terms_and_conditions: null,
    ...over,
  });

  const respond = (rows: any[]) => {
    mockDb.query = jest.fn().mockResolvedValue({ rows, rowCount: rows.length });
  };

  const service = new AccountCatalogueService();

  describe('listing', () => {
    it('carries the club’s word for the thing and the fee in minor units', async () => {
      respond([typeRow()]);

      const [type] = await service.listRegistrationTypes(ORG, TODAY);

      expect(type).toMatchObject({
        id: 'rt-1',
        entityName: 'Horse',
        fee: 4500,
        automaticallyApprove: true,
        available: true,
      });
    });

    it('marks a closed scheme with a reason rather than hiding it', async () => {
      respond([typeRow({ registration_status: 'closed' })]);

      expect((await service.listRegistrationTypes(ORG, TODAY))[0]).toMatchObject({
        available: false,
        unavailableReason: 'not-open-for-applications',
      });
    });

    it('closes a fixed-period scheme whose period has ended', async () => {
      respond([typeRow({ valid_until: '2026-01-31' })]);

      expect((await service.listRegistrationTypes(ORG, TODAY))[0].available).toBe(false);
    });

    /**
     * A rolling scheme runs from the day it is taken out, so a date on the type
     * says nothing about whether it is open.
     */
    it('leaves a rolling scheme open whatever date is on it', async () => {
      respond([
        typeRow({ is_rolling_registration: true, number_of_months: 12, valid_until: '2020-01-01' }),
      ]);

      const [type] = await service.listRegistrationTypes(ORG, TODAY);

      expect(type.available).toBe(true);
      expect(type.numberOfMonths).toBe(12);
      // The date would be misleading on the screen, so it is not returned.
      expect(type.validUntil).toBeNull();
    });

    it('reports that the club reviews registrations', async () => {
      respond([typeRow({ automatically_approve: false })]);

      expect((await service.listRegistrationTypes(ORG, TODAY))[0].automaticallyApprove).toBe(false);
    });

    it('carries terms only when the club switched them on', async () => {
      respond([typeRow({ use_terms_and_conditions: false, terms_and_conditions: '<p>Jabs.</p>' })]);
      expect((await service.listRegistrationTypes(ORG, TODAY))[0].termsAndConditions).toBeNull();

      respond([typeRow({ use_terms_and_conditions: true, terms_and_conditions: '<p>Jabs.</p>' })]);
      expect((await service.listRegistrationTypes(ORG, TODAY))[0].termsAndConditions).toBe(
        '<p>Jabs.</p>'
      );
    });

    it('treats a scheme with no fee as free rather than as unpriced', async () => {
      respond([typeRow({ fee: null })]);

      expect((await service.listRegistrationTypes(ORG, TODAY))[0].fee).toBe(0);
    });
  });

  describe('adding to the basket', () => {
    it('accepts an open scheme with something named', async () => {
      respond([typeRow()]);

      await expect(
        service.assertRegistrationTypeAvailable(ORG, 'rt-1', 'Rocket', TODAY)
      ).resolves.toMatchObject({ id: 'rt-1' });
    });

    it('refuses a scheme this club does not offer', async () => {
      respond([typeRow()]);

      await expect(
        service.assertRegistrationTypeAvailable(ORG, 'another-club', 'Rocket', TODAY)
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('refuses a closed scheme', async () => {
      respond([typeRow({ registration_status: 'closed' })]);

      await expect(
        service.assertRegistrationTypeAvailable(ORG, 'rt-1', 'Rocket', TODAY)
      ).rejects.toThrow(/not open/i);
    });

    /**
     * `registrations.entity_name` is NOT NULL and is the substance of the
     * record. Refusing here beats a constraint violation after the money.
     */
    it.each([
      ['nothing', undefined],
      ['an empty name', ''],
      ['only spaces', '   '],
      ['a number', 42],
    ])('refuses %s in place of a name', async (_label, entityName) => {
      respond([typeRow()]);

      await expect(
        service.assertRegistrationTypeAvailable(ORG, 'rt-1', entityName, TODAY)
      ).rejects.toThrow(/name of the horse/i);
    });

    it('names the club’s own word in the refusal', async () => {
      respond([typeRow({ entity_name: 'Boat' })]);

      await expect(
        service.assertRegistrationTypeAvailable(ORG, 'rt-1', '', TODAY)
      ).rejects.toThrow(/name of the boat/i);
    });
  });
});
