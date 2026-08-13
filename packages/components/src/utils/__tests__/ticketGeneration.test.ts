/**
 * Tests for the shared ticket-generation utilities.
 *
 * These moved here with `ticketGeneration.ts` itself (CLAUDE.md §1.5) — both
 * org-admin and the account-user app render the same ticket, so the reference
 * format and QR payload are shared code and are tested where they live.
 *
 * The reference format matters beyond this file: the backend issues references
 * in the same `TKT-YYYY-NNNNNN` shape from a Postgres sequence
 * (`ticketing.service.ts`), so a change to `validateTicketReference` that is
 * not matched there produces references the client rejects as malformed.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTicketReference,
  generateQRCodeUUID,
  validateTicketReference,
  parseTicketReference,
  generateQRCodeDataURL,
} from '../ticketGeneration';

describe('Ticket Generation Utilities', () => {
  describe('generateTicketReference', () => {
    it('generates ticket reference with correct format', () => {
      const reference = generateTicketReference(2024, 123);
      expect(reference).toBe('TKT-2024-000123');
    });

    it('pads sequence number with zeros', () => {
      const reference = generateTicketReference(2024, 1);
      expect(reference).toBe('TKT-2024-000001');
    });

    it('uses current year when not specified', () => {
      const reference = generateTicketReference();
      const currentYear = new Date().getFullYear();
      expect(reference).toMatch(new RegExp(`^TKT-${currentYear}-\\d{6}$`));
    });

    it('accepts the six-digit references the backend sequence produces', () => {
      // The server builds these in SQL, so nothing else checks the two agree.
      expect(validateTicketReference(generateTicketReference(2026, 1))).toBe(true);
      expect(validateTicketReference(generateTicketReference(2026, 999999))).toBe(true);
    });
  });

  describe('generateQRCodeUUID', () => {
    it('generates a valid UUID', () => {
      const uuid = generateQRCodeUUID();
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(uuid).toMatch(uuidPattern);
    });

    it('generates unique UUIDs', () => {
      const uuid1 = generateQRCodeUUID();
      const uuid2 = generateQRCodeUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('validateTicketReference', () => {
    it('validates correct ticket reference format', () => {
      expect(validateTicketReference('TKT-2024-000001')).toBe(true);
      expect(validateTicketReference('TKT-2024-123456')).toBe(true);
    });

    it('rejects invalid ticket reference formats', () => {
      expect(validateTicketReference('TKT-2024-1')).toBe(false);
      expect(validateTicketReference('TKT-24-000001')).toBe(false);
      expect(validateTicketReference('TICKET-2024-000001')).toBe(false);
      expect(validateTicketReference('TKT-2024-0000001')).toBe(false);
    });
  });

  describe('parseTicketReference', () => {
    it('parses valid ticket reference', () => {
      const result = parseTicketReference('TKT-2024-000123');
      expect(result).toEqual({ year: 2024, sequence: 123 });
    });

    it('returns null for invalid ticket reference', () => {
      const result = parseTicketReference('INVALID');
      expect(result).toBeNull();
    });
  });

  describe('generateQRCodeDataURL', () => {
    it('generates QR code data URL', async () => {
      const dataUrl = await generateQRCodeDataURL('test-data');
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('accepts custom options', async () => {
      const dataUrl = await generateQRCodeDataURL('test-data', {
        width: 200,
        margin: 1,
      });
      expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    });
  });
});
