/**
 * Ticket Generation Service
 * 
 * Utilities for generating unique ticket references, QR codes, and ticket PDFs
 */

import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';

/**
 * Generate a unique ticket reference in format TKT-YYYY-NNNNNN
 * @param year - The year for the ticket (defaults to current year)
 * @param sequenceNumber - The sequence number for the ticket
 * @returns Formatted ticket reference string
 */
export const generateTicketReference = (year?: number, sequenceNumber?: number): string => {
  const ticketYear = year || new Date().getFullYear();
  const sequence = sequenceNumber || Math.floor(Math.random() * 1000000);
  const paddedSequence = sequence.toString().padStart(6, '0');
  return `TKT-${ticketYear}-${paddedSequence}`;
};

/**
 * Generate a unique QR code UUID
 * @returns UUID string for QR code
 */
export const generateQRCodeUUID = (): string => {
  return uuidv4();
};

/**
 * Generate QR code as data URL
 * @param qrCodeData - The data to encode in the QR code (typically the UUID)
 * @param options - QR code generation options
 * @returns Promise resolving to data URL of QR code image
 */
export const generateQRCodeDataURL = async (
  qrCodeData: string,
  options?: {
    width?: number;
    margin?: number;
    color?: {
      dark?: string;
      light?: string;
    };
  }
): Promise<string> => {
  const defaultOptions = {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const dataUrl = await QRCode.toDataURL(qrCodeData, mergedOptions);
    return dataUrl;
  } catch (error) {
    console.error('Failed to generate QR code:', error);
    throw new Error('QR code generation failed');
  }
};

/**
 * Generate QR code as buffer (for PDF generation)
 * @param qrCodeData - The data to encode in the QR code
 * @param options - QR code generation options
 * @returns Promise resolving to buffer of QR code image
 */
export const generateQRCodeBuffer = async (
  qrCodeData: string,
  options?: {
    width?: number;
    margin?: number;
  }
): Promise<Buffer> => {
  const defaultOptions = {
    width: 300,
    margin: 2,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const buffer = await QRCode.toBuffer(qrCodeData, mergedOptions);
    return buffer;
  } catch (error) {
    console.error('Failed to generate QR code buffer:', error);
    throw new Error('QR code buffer generation failed');
  }
};

/**
 * Ticket data interface for PDF generation
 */
export interface TicketPDFData {
  ticketReference: string;
  qrCodeDataURL: string;
  eventName: string;
  eventDate: string;
  eventLocation?: string;
  customerName: string;
  customerEmail: string;
  headerText?: string;
  instructions?: string;
  footerText?: string;
  backgroundColor?: string;
  includeLogo?: boolean;
  logoURL?: string;
}

/**
 * Generate ticket PDF HTML template
 * This would typically be used with a PDF generation library like puppeteer or pdfkit
 * @param ticketData - The ticket data to include in the PDF
 * @returns HTML string for PDF generation
 */
export const generateTicketPDFHTML = (ticketData: TicketPDFData): string => {
  const {
    ticketReference,
    qrCodeDataURL,
    eventName,
    eventDate,
    eventLocation,
    customerName,
    customerEmail,
    headerText,
    instructions,
    footerText,
    backgroundColor = '#ffffff',
    includeLogo,
    logoURL,
  } = ticketData;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 20px;
          background-color: #f5f5f5;
        }
        .ticket {
          max-width: 600px;
          margin: 0 auto;
          background-color: ${backgroundColor};
          border: 2px solid #333;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
          text-align: center;
          margin-bottom: 20px;
        }
        .logo {
          max-width: 150px;
          margin-bottom: 10px;
        }
        .header-text {
          font-size: 18px;
          color: #333;
          margin: 10px 0;
        }
        .event-info {
          margin: 20px 0;
          padding: 20px;
          background-color: #f9f9f9;
          border-radius: 5px;
        }
        .event-name {
          font-size: 24px;
          font-weight: bold;
          color: #1976d2;
          margin-bottom: 10px;
        }
        .event-details {
          font-size: 14px;
          color: #666;
          margin: 5px 0;
        }
        .qr-code {
          text-align: center;
          margin: 30px 0;
        }
        .qr-code img {
          max-width: 300px;
          border: 1px solid #ddd;
          padding: 10px;
          background-color: white;
        }
        .ticket-reference {
          text-align: center;
          font-size: 16px;
          font-weight: bold;
          color: #333;
          margin: 10px 0;
        }
        .customer-info {
          margin: 20px 0;
          padding: 15px;
          background-color: #f0f0f0;
          border-radius: 5px;
        }
        .customer-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
        .customer-value {
          font-size: 14px;
          color: #333;
          margin-bottom: 10px;
        }
        .instructions {
          margin: 20px 0;
          padding: 15px;
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 3px;
        }
        .instructions-title {
          font-weight: bold;
          margin-bottom: 10px;
          color: #856404;
        }
        .instructions-text {
          font-size: 14px;
          color: #856404;
          line-height: 1.6;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #ddd;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="ticket">
        <div class="header">
          ${includeLogo && logoURL ? `<img src="${logoURL}" alt="Logo" class="logo" />` : ''}
          ${headerText ? `<div class="header-text">${headerText}</div>` : ''}
        </div>

        <div class="event-info">
          <div class="event-name">${eventName}</div>
          <div class="event-details"><strong>Date:</strong> ${eventDate}</div>
          ${eventLocation ? `<div class="event-details"><strong>Location:</strong> ${eventLocation}</div>` : ''}
        </div>

        <div class="qr-code">
          <img src="${qrCodeDataURL}" alt="Ticket QR Code" />
        </div>

        <div class="ticket-reference">
          Ticket Reference: ${ticketReference}
        </div>

        <div class="customer-info">
          <div class="customer-label">Ticket Holder</div>
          <div class="customer-value">${customerName}</div>
          <div class="customer-label">Email</div>
          <div class="customer-value">${customerEmail}</div>
        </div>

        ${instructions ? `
          <div class="instructions">
            <div class="instructions-title">Important Instructions</div>
            <div class="instructions-text">${instructions}</div>
          </div>
        ` : ''}

        ${footerText ? `
          <div class="footer">
            ${footerText}
          </div>
        ` : ''}
      </div>
    </body>
    </html>
  `;
};

/**
 * Generate multiple tickets for a booking with quantity > 1
 * @param baseTicketData - Base ticket data
 * @param quantity - Number of tickets to generate
 * @returns Array of ticket data with unique references and QR codes
 */
export const generateMultipleTickets = async (
  baseTicketData: Omit<TicketPDFData, 'ticketReference' | 'qrCodeDataURL'>,
  quantity: number
): Promise<TicketPDFData[]> => {
  const tickets: TicketPDFData[] = [];
  const year = new Date().getFullYear();

  for (let i = 0; i < quantity; i++) {
    const qrCodeUUID = generateQRCodeUUID();
    const qrCodeDataURL = await generateQRCodeDataURL(qrCodeUUID);
    const ticketReference = generateTicketReference(year);

    tickets.push({
      ...baseTicketData,
      ticketReference,
      qrCodeDataURL,
    });
  }

  return tickets;
};

/**
 * Validate ticket reference format
 * @param ticketReference - The ticket reference to validate
 * @returns True if valid, false otherwise
 */
export const validateTicketReference = (ticketReference: string): boolean => {
  const pattern = /^TKT-\d{4}-\d{6}$/;
  return pattern.test(ticketReference);
};

/**
 * Parse ticket reference to extract year and sequence number
 * @param ticketReference - The ticket reference to parse
 * @returns Object with year and sequence number, or null if invalid
 */
export const parseTicketReference = (
  ticketReference: string
): { year: number; sequence: number } | null => {
  if (!validateTicketReference(ticketReference)) {
    return null;
  }

  const parts = ticketReference.split('-');
  const year = parseInt(parts[1], 10);
  const sequence = parseInt(parts[2], 10);

  return { year, sequence };
};
