import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateTicketPDFHTML,
  generateMultipleTickets,
  generateQRCodeBuffer,
  validateTicketReference,
  type TicketPDFData,
} from '../ticketGeneration';

/**
 * The printable ticket itself, and issuing several at once.
 *
 * A ticket is scanned at a gate, so the two things it cannot get wrong are the
 * QR image and the reference printed beneath it — one is what the scanner
 * reads, the other is what a steward reads aloud when the scan fails. Optional
 * decoration (logo, instructions, footer) must be genuinely optional: an
 * `undefined` interpolated into the template prints the word "undefined" on a
 * ticket a member is holding.
 *
 * `generateMultipleTickets` is the other risk. Two people arriving on one
 * booking need two *different* tickets; a shared reference or a shared QR means
 * the second person through the gate is refused as a duplicate.
 *
 * The format and parsing rules are covered in ticketGeneration.test.ts.
 */

const base: TicketPDFData = {
  ticketReference: 'TKT-2026-000123',
  qrCodeDataURL: 'data:image/png;base64,QQ==',
  eventName: 'Winter Dressage',
  eventDate: '18 November 2026',
  customerName: 'Aoife Byrne',
  customerEmail: 'aoife@example.com',
};

const html = (over: Partial<TicketPDFData> = {}) => generateTicketPDFHTML({ ...base, ...over });

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateTicketPDFHTML — what has to be on the ticket', () => {
  it('is a complete document a renderer can take', () => {
    const output = html();

    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('</html>');
  });

  it('shows the QR code, which is what the scanner reads', () => {
    const output = html();

    expect(output).toContain('src="data:image/png;base64,QQ=="');
  });

  it('prints the reference, which is what a steward reads when a scan fails', () => {
    const output = html();

    expect(output).toContain('TKT-2026-000123');
  });

  it('names the event and when it is', () => {
    const output = html();

    expect(output).toContain('Winter Dressage');
    expect(output).toContain('18 November 2026');
  });

  it('names the person the ticket belongs to', () => {
    const output = html();

    expect(output).toContain('Aoife Byrne');
    expect(output).toContain('aoife@example.com');
  });
});

describe('generateTicketPDFHTML — the optional parts', () => {
  it('omits the location rather than printing an empty field', () => {
    const output = html({ eventLocation: undefined });

    expect(output).not.toContain('Location:');
    expect(output).not.toContain('undefined');
  });

  it('shows the location when there is one', () => {
    const output = html({ eventLocation: 'Punchestown' });

    expect(output).toContain('Punchestown');
  });

  it('leaves out instructions that were never written', () => {
    const output = html();

    expect(output).not.toContain('Important Instructions');
  });

  it('includes instructions when a club wrote some', () => {
    const output = html({ instructions: 'Arrive thirty minutes early.' });

    expect(output).toContain('Important Instructions');
    expect(output).toContain('Arrive thirty minutes early.');
  });

  it('leaves out an empty footer', () => {
    const output = html({ footerText: '' });

    expect(output).not.toContain('class="footer"');
  });

  it('includes a footer when there is one', () => {
    const output = html({ footerText: 'Meath Hunt Club' });

    expect(output).toContain('Meath Hunt Club');
  });

  it('prints no logo unless a club both asked for one and supplied it', () => {
    // Asking for a logo with no URL would print a broken image on every ticket.
    expect(html({ includeLogo: true, logoURL: undefined })).not.toContain('alt="Logo"');
    expect(html({ includeLogo: false, logoURL: 'https://x/logo.png' })).not.toContain('alt="Logo"');
  });

  it('prints the logo when both are given', () => {
    const output = html({ includeLogo: true, logoURL: 'https://x/logo.png' });

    expect(output).toContain('alt="Logo"');
    expect(output).toContain('https://x/logo.png');
  });

  it('never prints the word "undefined" on a ticket a member is holding', () => {
    const output = html({
      eventLocation: undefined,
      headerText: undefined,
      instructions: undefined,
      footerText: undefined,
      logoURL: undefined,
    });

    expect(output).not.toContain('undefined');
  });
});

describe('generateMultipleTickets', () => {
  it('issues one ticket per person on the booking', async () => {
    const tickets = await generateMultipleTickets(base, 3);

    expect(tickets).toHaveLength(3);
  });

  it('gives every ticket its own reference', async () => {
    const tickets = await generateMultipleTickets(base, 5);

    // A shared reference means the second person through is a duplicate scan.
    const references = tickets.map((t) => t.ticketReference);
    expect(new Set(references).size).toBe(references.length);
  });

  it('gives every ticket a reference the scanner will accept', async () => {
    const tickets = await generateMultipleTickets(base, 3);

    tickets.forEach((t) => expect(validateTicketReference(t.ticketReference)).toBe(true));
  });

  it('gives every ticket its own QR code', async () => {
    const tickets = await generateMultipleTickets(base, 3);

    const codes = tickets.map((t) => t.qrCodeDataURL);
    expect(codes.every(Boolean)).toBe(true);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('carries the event and customer details onto each one', async () => {
    const tickets = await generateMultipleTickets(base, 2);

    tickets.forEach((t) => {
      expect(t.eventName).toBe('Winter Dressage');
      expect(t.customerName).toBe('Aoife Byrne');
    });
  });

  it('issues nothing for a booking of none', async () => {
    await expect(generateMultipleTickets(base, 0)).resolves.toEqual([]);
  });
});

describe('generateQRCodeBuffer', () => {
  it('produces bytes for a ticket that is being emailed or printed', async () => {
    const buffer = await generateQRCodeBuffer('a-uuid');

    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('says plainly when a QR code could not be produced', async () => {
    // Silently returning an empty buffer prints a ticket with a blank square.
    await expect(generateQRCodeBuffer(undefined as never)).rejects.toThrow(/QR code/i);
  });
});
