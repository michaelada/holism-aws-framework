import { AccountCatalogueService } from '../account-catalogue.service';
import { db } from '../../database/pool';
import { ValidationError } from '../../middleware/errors';

jest.mock('../../database/pool');
jest.mock('../../config/logger');

/**
 * The club shop, as a member sees it (D9, D10).
 *
 * Two things are load-bearing here and neither is obvious from the row:
 *
 *  - **The price is the sum of the chosen option values.** There is no price on
 *    `merchandise_types` at all, so "what does this cost" cannot be answered
 *    until every option is answered, and the list can only quote a *from*
 *    price.
 *  - **`assertMerchandiseAvailable` is the real gate.** The cart trusts its
 *    caller, so a POST that skips the screens must still be refused — for a
 *    withdrawn item, an option belonging to another item, a quantity outside
 *    the club's rules, or stock that has gone since the page was drawn.
 */
describe('AccountCatalogueService — merchandise', () => {
  const mockDb = db as jest.Mocked<typeof db>;
  const ORG = 'org-1';

  const itemRow = (over: Record<string, unknown> = {}) => ({
    id: 'item-1',
    name: 'Club polo',
    description: 'Navy, embroidered',
    images: ['polo.jpg'],
    status: 'active',
    track_stock_levels: false,
    out_of_stock_behavior: 'show',
    delivery_type: 'free',
    delivery_fee: null,
    min_order_quantity: 1,
    max_order_quantity: null,
    quantity_increments: null,
    require_application_form: false,
    application_form_id: null,
    supported_payment_methods: ['pm-card'],
    handling_fee_included: false,
    use_terms_and_conditions: false,
    terms_and_conditions: null,
    ...over,
  });

  /** One option type ("Size") with the values given. */
  const optionRows = (
    values: Array<{ id: string; name: string; price: string; stock?: number | null }>,
    over: Record<string, unknown> = {}
  ) =>
    values.map((value) => ({
      id: 'opt-size',
      merchandise_type_id: 'item-1',
      name: 'Size',
      order: 1,
      value_id: value.id,
      value_name: value.name,
      price: value.price,
      stock_quantity: value.stock === undefined ? null : value.stock,
      value_order: 1,
      ...over,
    }));

  /** First query returns the items, second their option types and values. */
  const respond = (items: any[], options: any[] = []) => {
    mockDb.query = jest
      .fn()
      .mockResolvedValueOnce({ rows: items, rowCount: items.length })
      .mockResolvedValueOnce({ rows: options, rowCount: options.length });
  };

  const service = new AccountCatalogueService();

  const sizes = [
    { id: 'val-s', name: 'Small', price: '25.00' },
    { id: 'val-l', name: 'Large', price: '27.50' },
  ];

  describe('listing', () => {
    it('quotes the cheapest combination as the from-price, in minor units', async () => {
      respond([itemRow()], optionRows(sizes));

      const [item] = await service.listMerchandise(ORG);

      expect(item.fromPrice).toBe(2500);
      expect(item.optionTypes[0].values.map((value) => value.price)).toEqual([2500, 2750]);
      expect(item.available).toBe(true);
    });

    it('sums one value per option type, not the cheapest value overall', async () => {
      respond(
        [itemRow()],
        [
          ...optionRows(sizes),
          ...optionRows([{ id: 'val-navy', name: 'Navy', price: '5.00' }], {
            id: 'opt-colour',
            name: 'Colour',
            order: 2,
          }),
        ]
      );

      const [item] = await service.listMerchandise(ORG);

      // Small (25.00) + Navy (5.00) — a shirt is a size *and* a colour.
      expect(item.fromPrice).toBe(3000);
      expect(item.optionTypes).toHaveLength(2);
    });

    it('shows a withdrawn item with a reason rather than hiding it', async () => {
      respond([itemRow({ status: 'inactive' })], optionRows(sizes));

      const [item] = await service.listMerchandise(ORG);

      expect(item.available).toBe(false);
      expect(item.unavailableReason).toBe('not-on-sale');
    });

    it('reports an item as out of stock when every size has gone', async () => {
      respond(
        [itemRow({ track_stock_levels: true })],
        optionRows([
          { id: 'val-s', name: 'Small', price: '25.00', stock: 0 },
          { id: 'val-l', name: 'Large', price: '27.50', stock: 0 },
        ])
      );

      const [item] = await service.listMerchandise(ORG);

      expect(item.available).toBe(false);
      expect(item.unavailableReason).toBe('out-of-stock');
    });

    it('is still available while one size is left', async () => {
      respond(
        [itemRow({ track_stock_levels: true })],
        optionRows([
          { id: 'val-s', name: 'Small', price: '25.00', stock: 0 },
          { id: 'val-l', name: 'Large', price: '27.50', stock: 3 },
        ])
      );

      expect((await service.listMerchandise(ORG))[0].available).toBe(true);
    });

    /** The one case where the club has asked for the row to disappear. */
    it('drops a sold-out item when the club chose to hide it', async () => {
      respond(
        [itemRow({ track_stock_levels: true, out_of_stock_behavior: 'hide' })],
        optionRows([{ id: 'val-s', name: 'Small', price: '25.00', stock: 0 }])
      );

      expect(await service.listMerchandise(ORG)).toEqual([]);
    });

    it('keeps a hide-when-sold-out item while it is in stock', async () => {
      respond(
        [itemRow({ track_stock_levels: true, out_of_stock_behavior: 'hide' })],
        optionRows([{ id: 'val-s', name: 'Small', price: '25.00', stock: 2 }])
      );

      expect(await service.listMerchandise(ORG)).toHaveLength(1);
    });

    /** A club that has not finished setting an item up has nothing to sell. */
    it('refuses an item with no options to choose', async () => {
      respond([itemRow()], []);

      const [item] = await service.listMerchandise(ORG);
      expect(item.unavailableReason).toBe('not-on-sale');
    });

    it('carries the terms only when the club has switched them on', async () => {
      respond(
        [itemRow({ use_terms_and_conditions: false, terms_and_conditions: '<p>No refunds.</p>' })],
        optionRows(sizes)
      );
      expect((await service.listMerchandise(ORG))[0].termsAndConditions).toBeNull();

      respond(
        [itemRow({ use_terms_and_conditions: true, terms_and_conditions: '<p>No refunds.</p>' })],
        optionRows(sizes)
      );
      expect((await service.listMerchandise(ORG))[0].termsAndConditions).toBe('<p>No refunds.</p>');
    });

    it('carries a form only when the item requires one', async () => {
      respond(
        [itemRow({ require_application_form: false, application_form_id: 'form-1' })],
        optionRows(sizes)
      );
      expect((await service.listMerchandise(ORG))[0].applicationFormId).toBeNull();

      respond(
        [itemRow({ require_application_form: true, application_form_id: 'form-1' })],
        optionRows(sizes)
      );
      expect((await service.listMerchandise(ORG))[0].applicationFormId).toBe('form-1');
    });

    it('converts a fixed delivery fee to minor units', async () => {
      respond([itemRow({ delivery_type: 'fixed', delivery_fee: '4.50' })], optionRows(sizes));

      expect((await service.listMerchandise(ORG))[0].deliveryFee).toBe(450);
    });

    it('asks for nothing when the club sells nothing', async () => {
      mockDb.query = jest.fn().mockResolvedValueOnce({ rows: [], rowCount: 0 });

      expect(await service.listMerchandise(ORG)).toEqual([]);
      // No second query: there are no items whose options need fetching.
      expect(mockDb.query).toHaveBeenCalledTimes(1);
    });
  });

  describe('adding to the basket', () => {
    const addable = (over: Record<string, unknown> = {}, options = optionRows(sizes)) =>
      respond([itemRow(over)], options);

    it('accepts a choice from each list within the club’s quantity rules', async () => {
      addable();

      await expect(
        service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l'], 2)
      ).resolves.toMatchObject({ id: 'item-1' });
    });

    it('refuses an item that is not in the catalogue at all', async () => {
      addable();

      await expect(
        service.assertMerchandiseAvailable(ORG, 'another-club-item', ['val-l'], 1)
      ).rejects.toBeInstanceOf(ValidationError);
    });

    it('refuses a withdrawn item', async () => {
      addable({ status: 'inactive' });

      await expect(service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l'], 1)).rejects.toThrow(
        /not for sale/i
      );
    });

    it('refuses an unanswered option, naming the list', async () => {
      addable();

      await expect(service.assertMerchandiseAvailable(ORG, 'item-1', [], 1)).rejects.toThrow(
        /Choose one Size/i
      );
    });

    /** An id that answers no list at all — only reachable by hand. */
    it('refuses an option that belongs to no list on this item', async () => {
      addable();

      await expect(
        service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l', 'val-from-elsewhere'], 1)
      ).rejects.toThrow(/each list/i);
    });

    /** Two sizes is not an answer to "which size". */
    it('refuses two values from the same list', async () => {
      addable();

      await expect(
        service.assertMerchandiseAvailable(ORG, 'item-1', ['val-s', 'val-l'], 1)
      ).rejects.toThrow(/Choose one Size/i);
    });

    it('refuses an option value that belongs to something else', async () => {
      addable();

      await expect(
        service.assertMerchandiseAvailable(ORG, 'item-1', ['val-from-another-item'], 1)
      ).rejects.toThrow(/Choose one Size/i);
    });

    it('enforces the smallest and largest order', async () => {
      addable({ min_order_quantity: 2, max_order_quantity: 6 });
      await expect(service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l'], 1)).rejects.toThrow(
        /smallest order is 2/i
      );

      addable({ min_order_quantity: 2, max_order_quantity: 6 });
      await expect(service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l'], 7)).rejects.toThrow(
        /largest order is 6/i
      );
    });

    it('enforces the club’s increments', async () => {
      addable({ quantity_increments: 5 });

      await expect(service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l'], 7)).rejects.toThrow(
        /multiples of 5/i
      );
    });

    it('refuses more than is left, and says how many that is', async () => {
      addable({ track_stock_levels: true }, optionRows([
        { id: 'val-l', name: 'Large', price: '27.50', stock: 2 },
      ]));

      await expect(service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l'], 3)).rejects.toThrow(
        /Only 2 left of Large/i
      );
    });

    it('ignores stock when the club does not track it', async () => {
      addable({ track_stock_levels: false }, optionRows([
        { id: 'val-l', name: 'Large', price: '27.50', stock: 0 },
      ]));

      await expect(
        service.assertMerchandiseAvailable(ORG, 'item-1', ['val-l'], 50)
      ).resolves.toBeDefined();
    });
  });
});
