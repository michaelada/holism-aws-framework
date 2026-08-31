/**
 * An event cannot exist without its four dates.
 *
 * Enforced in the service as well as in the form, because the form is not the
 * only way in. A null entry window means *unbounded* to `public-event.service`
 * (`open_date_entries IS NULL OR open_date_entries <= NOW()`), so an event
 * created without one is permanently open to entries — never what anybody set
 * out to create.
 *
 * The columns stay nullable on purpose: events created before this rule, and
 * the seed's deliberately ungated `Ward Union Open Day`, still have to read
 * back correctly. This is a rule about what may be *written*, not about what
 * the table can hold.
 */

jest.mock('../../database/pool');
jest.mock('../../config/logger');

import { eventService } from '../event.service';
import { db } from '../../database/pool';

const mockDb = db as jest.Mocked<typeof db>;

const ORG = '11111111-1111-1111-1111-111111111111';

const createInput = (overrides: Record<string, unknown> = {}) =>
  ({
    organisationId: ORG,
    name: 'Summer Regatta',
    description: 'Annual regatta',
    eventOwner: 'Committee',
    startDate: '2026-09-19',
    endDate: '2026-09-20',
    openDateEntries: '2026-08-19T12:00:00.000Z',
    entriesClosingDate: '2026-09-12T12:00:00.000Z',
    ...overrides,
  }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  // Any insert that gets as far as the database succeeds.
  (mockDb.query as jest.Mock).mockResolvedValue({
    rows: [{ id: 'event-1', organisation_id: ORG, name: 'Summer Regatta', discount_ids: null }],
  });
});

describe('createEvent — required dates', () => {
  it.each(['startDate', 'endDate', 'openDateEntries', 'entriesClosingDate'])(
    'refuses to create an event with no %s',
    async (field) => {
      await expect(eventService.createEvent(createInput({ [field]: null }))).rejects.toThrow(
        new RegExp(field),
      );

      // Refused before the insert, not after it.
      expect(mockDb.query).not.toHaveBeenCalled();
    },
  );

  it('names every missing date in one message', async () => {
    await expect(
      eventService.createEvent(
        createInput({ openDateEntries: undefined, entriesClosingDate: undefined }),
      ),
    ).rejects.toThrow(/openDateEntries, entriesClosingDate/);
  });

  it('creates an event when all four are present', async () => {
    await expect(eventService.createEvent(createInput())).resolves.toBeDefined();
    expect(mockDb.query).toHaveBeenCalled();
  });

  it('refuses an entry window that closes before it opens', async () => {
    await expect(
      eventService.createEvent(
        createInput({
          openDateEntries: '2026-09-12T12:00:00.000Z',
          entriesClosingDate: '2026-08-19T12:00:00.000Z',
        }),
      ),
    ).rejects.toThrow(/closing date must be after/i);
  });

  it('refuses an entry window of zero length', async () => {
    const instant = '2026-08-19T12:00:00.000Z';
    await expect(
      eventService.createEvent(
        createInput({ openDateEntries: instant, entriesClosingDate: instant }),
      ),
    ).rejects.toThrow(/closing date must be after/i);
  });

  it('still refuses an end date before the start date', async () => {
    await expect(
      eventService.createEvent(createInput({ startDate: '2026-09-20', endDate: '2026-09-19' })),
    ).rejects.toThrow(/End date must be after start date/);
  });
});

describe('updateEvent — required dates cannot be cleared', () => {
  const existing = {
    id: 'event-1',
    organisation_id: ORG,
    name: 'Summer Regatta',
    start_date: new Date('2026-09-19T00:00:00.000Z'),
    end_date: new Date('2026-09-20T00:00:00.000Z'),
    open_date_entries: new Date('2026-08-19T12:00:00.000Z'),
    entries_closing_date: new Date('2026-09-12T12:00:00.000Z'),
    discount_ids: null,
  };

  beforeEach(() => {
    (mockDb.query as jest.Mock).mockResolvedValue({ rows: [existing] });
  });

  it.each(['startDate', 'endDate', 'openDateEntries', 'entriesClosingDate'])(
    'refuses to clear %s',
    async (field) => {
      await expect(
        eventService.updateEvent('event-1', { [field]: null } as any),
      ).rejects.toThrow(new RegExp(`Cannot clear required date.*${field}`));
    },
  );

  it('refuses an empty string as well as null', async () => {
    await expect(
      eventService.updateEvent('event-1', { openDateEntries: '' } as any),
    ).rejects.toThrow(/Cannot clear required date/);
  });

  it('leaves a date alone when the update does not mention it', async () => {
    // `undefined` means "not part of this update" — a partial update of one
    // field has to keep working, and must not be read as a request to clear.
    await expect(
      eventService.updateEvent('event-1', { name: 'Renamed' } as any),
    ).resolves.toBeDefined();
  });

  it('accepts a legitimate change to an entry date', async () => {
    await expect(
      eventService.updateEvent('event-1', {
        entriesClosingDate: '2026-09-15T12:00:00.000Z',
      } as any),
    ).resolves.toBeDefined();
  });

  it('refuses a change that inverts the entry window', async () => {
    await expect(
      eventService.updateEvent('event-1', {
        entriesClosingDate: '2026-08-01T12:00:00.000Z',
      } as any),
    ).rejects.toThrow(/closing date must be after/i);
  });
});
