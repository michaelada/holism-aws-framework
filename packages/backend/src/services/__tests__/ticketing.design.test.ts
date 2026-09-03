/**
 * What a ticket needs to be drawn, and where it comes from.
 *
 * A ticket row knows its reference, its code and its holder. The event's name,
 * its dates and both descriptions — everything a club actually reads on a
 * ticket — live on other tables, and `ticket_data` is written as `{}`. That is
 * why the org-admin's Activity column said *Not available* for every row, and
 * why a printed ticket was headed by nothing.
 */

import { TicketingService } from '../ticketing.service';
import { db } from '../../database/pool';
import { fileUploadService } from '../file-upload.service';

jest.mock('../../database/pool', () => ({ db: { query: jest.fn(), getClient: jest.fn() } }));
jest.mock('../file-upload.service', () => ({
  fileUploadService: { getFileUrl: jest.fn() },
}));
jest.mock('../../config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const service = new TicketingService();
const mockDb = db as jest.Mocked<typeof db>;
const signUrl = fileUploadService.getFileUrl as jest.Mock;

const row = (over: Record<string, unknown> = {}) => ({
  id: 'ticket-1',
  ticket_reference: 'TKT-2026-000018',
  qr_code: 'qr-uuid',
  customer_name: 'Bríd McNamara',
  customer_email: 'brid@example.test',
  event_name: 'Tara Hunter Trial',
  event_description: 'Cross country over the Tara banks.',
  start_date: '2026-09-22',
  end_date: '2026-09-22',
  activity_name: 'Open class',
  activity_description: 'Open to all grades.',
  ticket_header_text: 'Meath Hunt Pony Club',
  ticket_instructions: 'Show this at the gate.',
  ticket_footer_text: 'Hard hats to current standard.',
  ticket_background_color: '#123c2b',
  ticket_image_key: null,
  ticket_image_placement: null,
  ticket_layout: 'stacked',
  ...over,
});

beforeEach(() => {
  mockDb.query.mockReset();
  signUrl.mockReset();
  signUrl.mockResolvedValue('https://signed.example.test/banks.jpg');
});

describe('getTicketForRendering', () => {
  it('joins the event, the activity and the club’s design', async () => {
    /*
     * Joined on read rather than copied at issue: copying would leave every
     * ticket already issued blank, and would freeze a description the club
     * later corrects.
     */
    mockDb.query.mockResolvedValue({ rows: [row()] } as never);

    const ticket = await service.getTicketForRendering('ticket-1');

    expect(ticket).toMatchObject({
      eventName: 'Tara Hunter Trial',
      eventDescription: 'Cross country over the Tara banks.',
      activityName: 'Open class',
      activityDescription: 'Open to all grades.',
      headerText: 'Meath Hunt Pony Club',
      backgroundColour: '#123c2b',
      layout: 'stacked',
    });

    const sql = String(mockDb.query.mock.calls[0][0]);
    expect(sql).toContain('JOIN events');
    expect(sql).toContain('LEFT JOIN event_activities');
    expect(sql).toContain('LEFT JOIN event_ticketing_config');
  });

  it('joins the activity and the config loosely', async () => {
    // A ticket for an event with no activity, or a config nobody has filled in,
    // is still a ticket that has to print.
    mockDb.query.mockResolvedValue({
      rows: [
        row({
          activity_name: null,
          activity_description: null,
          ticket_header_text: null,
          ticket_layout: null,
        }),
      ],
    } as never);

    const ticket = await service.getTicketForRendering('ticket-1');

    expect(ticket?.activityName).toBeNull();
    expect(ticket?.headerText).toBeNull();
    // Defaulted, because every ticket has a layout.
    expect(ticket?.layout).toBe('stacked');
  });

  it('signs the picture rather than handing out a key', async () => {
    mockDb.query.mockResolvedValue({
      rows: [row({ ticket_image_key: 'organisations/o/events/e/ticket.jpg', ticket_image_placement: 'background' })],
    } as never);

    const ticket = await service.getTicketForRendering('ticket-1');

    expect(signUrl).toHaveBeenCalledWith('organisations/o/events/e/ticket.jpg', 3600);
    expect(ticket?.imageUrl).toBe('https://signed.example.test/banks.jpg');
    expect(ticket?.imagePlacement).toBe('background');
  });

  it('still renders when the picture cannot be signed', async () => {
    // The picture is decoration; the code is the ticket. A gate cannot be held
    // up by an S3 object that went astray.
    signUrl.mockRejectedValue(new Error('no such object'));
    mockDb.query.mockResolvedValue({ rows: [row({ ticket_image_key: 'gone.jpg' })] } as never);

    const ticket = await service.getTicketForRendering('ticket-1');

    expect(ticket?.ticketReference).toBe('TKT-2026-000018');
    expect(ticket?.imageUrl).toBeNull();
  });

  it('reports no placement where there is no picture', async () => {
    // Otherwise a ticket claims a background it has nothing to fill with.
    mockDb.query.mockResolvedValue({
      rows: [row({ ticket_image_key: null, ticket_image_placement: 'background' })],
    } as never);

    expect((await service.getTicketForRendering('ticket-1'))?.imagePlacement).toBeNull();
  });

  it('answers nothing for a ticket that is not there', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as never);

    expect(await service.getTicketForRendering('gone')).toBeNull();
  });
});

describe('the ticket image', () => {
  it('reports the key it replaced, so the old object can be removed', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ ticket_image_key: 'old.jpg' }] } as never)
      .mockResolvedValueOnce({ rows: [{ ...row(), ticket_image_key: 'new.jpg' }] } as never);

    const { previousKey } = await service.setTicketImage('event-1', {
      s3Key: 'new.jpg',
      mimeType: 'image/jpeg',
    });

    expect(previousKey).toBe('old.jpg');
  });

  it('gives an uploaded picture somewhere to go', async () => {
    // A picture with no placement renders as nothing, and forgetting the radio
    // buttons is the commonest way to get there.
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ ticket_image_key: null }] } as never)
      .mockResolvedValueOnce({ rows: [row()] } as never);

    await service.setTicketImage('event-1', { s3Key: 'new.jpg', mimeType: 'image/jpeg' });

    expect(String(mockDb.query.mock.calls[1][0])).toContain(
      "COALESCE($4, ticket_image_placement, 'header')"
    );
  });

  it('refuses a placement that is not one of the four', async () => {
    mockDb.query.mockResolvedValue({ rows: [{ ticket_image_key: null }] } as never);

    await expect(
      service.setTicketImage('event-1', {
        s3Key: 'new.jpg',
        mimeType: 'image/jpeg',
        placement: 'sideways',
      })
    ).rejects.toThrow(/header, footer, topRight or background/);
  });

  it('forgets the placement along with the picture', async () => {
    mockDb.query
      .mockResolvedValueOnce({ rows: [{ ticket_image_key: 'old.jpg' }] } as never)
      .mockResolvedValueOnce({ rows: [row()] } as never);

    const { previousKey } = await service.clearTicketImage('event-1');

    expect(previousKey).toBe('old.jpg');
    expect(String(mockDb.query.mock.calls[1][0])).toContain('ticket_image_placement = NULL');
  });

  it('refuses an event with no ticketing configuration', async () => {
    mockDb.query.mockResolvedValue({ rows: [] } as never);

    await expect(service.clearTicketImage('event-1')).rejects.toThrow(/not found/i);
  });
});

describe('the layout', () => {
  it('is stored when a club chooses one', async () => {
    mockDb.query.mockResolvedValue({ rows: [row({ ticket_layout: 'compact' })] } as never);

    const config = await service.updateTicketedEvent('event-1', { ticketLayout: 'compact' });

    expect(config.ticketLayout).toBe('compact');
    expect(String(mockDb.query.mock.calls[0][0])).toContain('ticket_layout');
  });

  it('refuses one nobody can render', async () => {
    await expect(
      service.updateTicketedEvent('event-1', { ticketLayout: 'diagonal' as never })
    ).rejects.toThrow(/stacked, sideBySide or compact/);
  });
});
