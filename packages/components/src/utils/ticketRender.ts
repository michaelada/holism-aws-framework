/**
 * What a ticket looks like.
 *
 * One function, rendering the HTML a club prints and the preview it designs
 * against — because a preview drawn separately drifts from what prints, and
 * what it gets wrong first is exactly what somebody is checking: whether the
 * name fits, how dark the photograph comes out.
 *
 * ## The QR code is always on white
 *
 * A scanner reads dark on light. A code drawn over a photograph, or over a
 * club's chosen background colour, is a code that *sometimes* does not scan —
 * and a ticket that fails at the gate has failed completely. So the code sits
 * in its own white panel with white padding, in every layout and under every
 * placement. It is the one part of the ticket a club cannot restyle.
 *
 * ## Everything is inline
 *
 * No stylesheet, no web font, no network. The HTML is written into a print
 * frame and printed a moment later; anything that has to be fetched is a
 * ticket that prints half-drawn. The QR code arrives as a data URL for the same
 * reason.
 *
 * See docs/TICKET_DESIGN.md.
 */

export type TicketImagePlacement = 'header' | 'footer' | 'topRight' | 'background';
export type TicketLayout = 'stacked' | 'sideBySide' | 'compact';

export const TICKET_IMAGE_PLACEMENTS: TicketImagePlacement[] = [
  'header',
  'footer',
  'topRight',
  'background',
];

export const TICKET_LAYOUTS: TicketLayout[] = ['stacked', 'sideBySide', 'compact'];

export interface TicketRenderData {
  ticketReference: string;
  /** A data URL. Anything fetched would print half-drawn. */
  qrCodeDataURL: string;

  eventName: string;
  /** Shown under the event's name — often where a club puts the detail. */
  eventDescription?: string | null;
  activityName?: string | null;
  /** Shown under the activity's name; may carry the gate's own instructions. */
  activityDescription?: string | null;

  /** ISO or anything `Date` accepts. One date is printed where they match. */
  startDate?: string | Date | null;
  endDate?: string | Date | null;

  customerName: string;
  customerEmail?: string | null;

  headerText?: string | null;
  instructions?: string | null;
  footerText?: string | null;

  imageUrl?: string | null;
  imagePlacement?: TicketImagePlacement | null;
  layout?: TicketLayout | null;
  backgroundColour?: string | null;

  /** The reader's locale, for the dates. */
  locale?: string;
  /** Labels, so the ticket speaks the language the rest of the app does. */
  labels?: Partial<TicketLabels>;
}

export interface TicketLabels {
  ticketReference: string;
  ticketHolder: string;
  date: string;
  instructions: string;
}

const DEFAULT_LABELS: TicketLabels = {
  ticketReference: 'Ticket reference',
  ticketHolder: 'Ticket holder',
  date: 'Date',
  instructions: 'Please note',
};

/**
 * Text a club typed, made safe to put in HTML.
 *
 * A club's own administrator is not a stranger, but "not a stranger" is not
 * "cannot be compromised", and this HTML is printed and — through the preview —
 * rendered in an administrator's browser. Escaped rather than sanitised because
 * none of these fields is rich text: they are names and sentences.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * A URL safe to put in `src`.
 *
 * `http`, `https`, a `data:` image, or a `blob:` — the last because a club
 * choosing a picture sees it in the preview *before* it is uploaded, and a blob
 * URL is content this same page created. Leaving it out is what made a chosen
 * image not appear at all: the URL was dropped, and with it the placement, so
 * the preview looked as though nothing had been chosen.
 *
 * Everything else — `javascript:` above all — is dropped.
 */
const safeUrl = (url: unknown): string | null => {
  const value = String(url ?? '').trim();
  if (!value) return null;
  return /^(https?:\/\/|data:image\/|blob:)/i.test(value) ? escapeHtml(value) : null;
};

/**
 * Whether text on this colour has to be light.
 *
 * Rec. 709 luminance, which is what the eye actually weighs — a saturated green
 * at the same "brightness" as a blue is far lighter to look at. The threshold
 * is deliberately generous: a ticket read at arm's length at a gate in the rain
 * is not a design portfolio.
 */
export const isDark = (colour: string): boolean => {
  const hex = colour.replace('#', '');
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(0, 6);
  if (!/^[0-9a-f]{6}$/i.test(full)) return false;

  const [r, g, b] = [0, 2, 4].map((at) => parseInt(full.slice(at, at + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.55;
};

const asDate = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/**
 * The event's date, as one date or two.
 *
 * "22 Sep 2026 – 22 Sep 2026" reads as a two-day event whose second day is
 * missing, which is why the same day collapses to one.
 */
export const ticketDateLine = (
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
  locale = 'en-GB'
): string => {
  const start = asDate(startDate);
  const end = asDate(endDate);
  if (!start && !end) return '';

  const format = (date: Date) =>
    date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });

  if (!start) return format(end!);
  if (!end || sameDay(start, end)) return format(start);
  return `${format(start)} – ${format(end)}`;
};

/**
 * The QR panel: white, padded, and the same everywhere.
 *
 * `display:inline-block` with white padding rather than a border, so the quiet
 * zone a scanner needs is white rather than whatever is behind the ticket.
 */
const qrPanel = (qrCodeDataURL: string, size: number): string => {
  const source = safeUrl(qrCodeDataURL);
  if (!source) return '';

  return `<div class="qr"><img src="${source}" alt="" width="${size}" height="${size}" /></div>`;
};

const block = (className: string, value: unknown): string => {
  const text = String(value ?? '').trim();
  return text ? `<div class="${className}">${escapeHtml(text)}</div>` : '';
};

export const renderTicketHTML = (data: TicketRenderData): string => {
  const labels = { ...DEFAULT_LABELS, ...(data.labels ?? {}) };
  const layout: TicketLayout = TICKET_LAYOUTS.includes(data.layout as TicketLayout)
    ? (data.layout as TicketLayout)
    : 'stacked';

  const image = safeUrl(data.imageUrl);
  // A placement with no image is no placement: a "background" with no picture
  // would otherwise be a plain dark rectangle nobody asked for.
  const placement = image ? (data.imagePlacement ?? null) : null;
  const onDark = placement === 'background';

  const chosenColour = /^#[0-9a-f]{3,8}$/i.test(String(data.backgroundColour ?? ''))
    ? String(data.backgroundColour)
    : '#ffffff';

  /*
   * A background picture **replaces** the colour rather than sitting on it.
   *
   * They were both applied, and a club that had chosen a deep green and then a
   * photograph got the two fighting: the colour showing through wherever the
   * picture did not reach, and the picture itself lost under a scrim heavy
   * enough for the colour. Choosing a picture is choosing what the background
   * is; the colour is what a ticket has *instead* of one.
   *
   * The near-black underneath is the base the picture is painted on, so a
   * ticket whose image has not arrived yet is dark — which is what the white
   * text on it expects — rather than a white card with white writing.
   */
  const background = onDark ? '#1a1a1a' : chosenColour;

  /*
   * Light text on anything dark — a scrim *or* a dark colour the club chose.
   *
   * This used to key off the image placement alone, so a club whose ticket
   * colour was a deep green got near-black text on it and a ticket nobody
   * could read. What decides legibility is the background actually behind the
   * words, not how that background came to be there.
   */
  const lightText = onDark || isDark(chosenColour);
  const ink = lightText ? '#ffffff' : '#1a1a1a';
  const muted = lightText ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.6)';

  const dateLine = ticketDateLine(data.startDate, data.endDate, data.locale);
  const compact = layout === 'compact';
  const qr = qrPanel(data.qrCodeDataURL, compact ? 120 : 200);

  const picture = (className: string) =>
    image ? `<img class="${className}" src="${image}" alt="" />` : '';

  /*
   * The words, in the order they answer a reader's questions: whose club, what
   * event, what about it, which class, what about that, and when.
   *
   * Descriptions are dropped from the compact layout on purpose — at stub size
   * they crowd out the name and the code, which are the two things a gate
   * actually needs.
   */
  const details = `
    ${block('header-text', data.headerText)}
    ${block('event-name', data.eventName)}
    ${compact ? '' : block('event-description', data.eventDescription)}
    ${block('activity-name', data.activityName)}
    ${compact ? '' : block('activity-description', data.activityDescription)}
    ${dateLine ? `<div class="date"><span class="label">${escapeHtml(labels.date)}</span> ${escapeHtml(dateLine)}</div>` : ''}
  `;

  const holder = `
    <div class="holder">
      <span class="label">${escapeHtml(labels.ticketHolder)}</span>
      <span class="value">${escapeHtml(data.customerName)}</span>
      ${data.customerEmail ? `<span class="email">${escapeHtml(data.customerEmail)}</span>` : ''}
    </div>
    <div class="reference">
      <span class="label">${escapeHtml(labels.ticketReference)}</span>
      <span class="value">${escapeHtml(data.ticketReference)}</span>
    </div>
  `;

  const notes = compact
    ? ''
    : `
    ${
      data.instructions
        ? `<div class="instructions"><span class="label">${escapeHtml(labels.instructions)}</span> ${escapeHtml(data.instructions)}</div>`
        : ''
    }
    ${block('footer-text', data.footerText)}
  `;

  const body =
    layout === 'sideBySide'
      ? `<div class="columns">
           <div class="column-details">${details}${holder}</div>
           <div class="column-code">${qr}</div>
         </div>
         ${notes}`
      : compact
        ? `<div class="columns compact">
             <div class="column-code">${qr}</div>
             <div class="column-details">${details}${holder}</div>
           </div>`
        : `${details}${qr}${holder}${notes}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<title>${escapeHtml(data.ticketReference)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
    background: #f4f4f4;
  }
  .ticket {
    position: relative;
    overflow: hidden;
    max-width: ${compact ? '520px' : '640px'};
    margin: 0 auto;
    border-radius: 14px;
    border: 1px solid rgba(0,0,0,0.12);
    background: ${background};
    ${
      onDark
        ? `background-image: url('${image}'); background-size: cover; background-position: center;`
        : ''
    }
    color: ${ink};
  }
  /* The scrim, so legibility does not depend on the photograph a club had. */
  .scrim {
    position: absolute;
    inset: 0;
    /*
     * Enough to read white text through, and no more. It was heavier — 0.55 to
     * 0.78 — which made a photograph read as a dark rectangle and left a club
     * unable to see what they had chosen.
     */
    background: linear-gradient(180deg, rgba(0,0,0,0.30) 0%, rgba(0,0,0,0.45) 55%, rgba(0,0,0,0.62) 100%);
  }
  .content { position: relative; padding: ${compact ? '16px' : '28px'}; }
  .banner { display: block; width: 100%; max-height: 200px; object-fit: cover; }
  .corner {
    position: absolute;
    top: ${compact ? '12px' : '20px'};
    right: ${compact ? '12px' : '20px'};
    width: ${compact ? '56px' : '84px'};
    height: ${compact ? '56px' : '84px'};
    object-fit: cover;
    border-radius: 8px;
    background: #ffffff;
  }
  .header-text {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 11px;
    color: ${muted};
    margin-bottom: 10px;
  }
  .event-name { font-size: ${compact ? '18px' : '26px'}; font-weight: 700; line-height: 1.2; }
  .event-description { font-size: 13px; color: ${muted}; margin: 6px 0 14px; }
  .activity-name { font-size: ${compact ? '14px' : '18px'}; font-weight: 600; }
  .activity-description { font-size: 13px; color: ${muted}; margin: 4px 0 14px; }
  .date { font-size: ${compact ? '13px' : '15px'}; font-weight: 600; margin: 10px 0 4px; }
  .label {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 10px;
    color: ${muted};
    display: block;
  }
  .holder, .reference { margin-top: 14px; font-size: 14px; }
  .holder .value, .reference .value { font-weight: 600; }
  .holder .email { display: block; font-size: 12px; color: ${muted}; }
  .instructions { margin-top: 18px; font-size: 13px; line-height: 1.5; }
  .footer-text {
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid ${lightText ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.12)'};
    font-size: 12px;
    color: ${muted};
  }
  /*
   * Always white, whatever the club chose around it. A scanner reads dark on
   * light, and the padding is the quiet zone the code needs.
   */
  .qr {
    display: inline-block;
    margin: ${compact ? '0' : '18px 0 6px'};
    padding: 12px;
    background: #ffffff;
    border-radius: 10px;
    line-height: 0;
  }
  .qr img { display: block; }
  .columns { display: flex; gap: ${compact ? '14px' : '24px'}; align-items: flex-start; }
  .columns .column-details { flex: 1 1 auto; min-width: 0; }
  .columns .column-code { flex: 0 0 auto; }
  @media print {
    body { background: #ffffff; padding: 0; }
    .ticket { border: none; border-radius: 0; }
  }
</style>
</head>
<body>
  <div class="ticket">
    ${onDark ? '<div class="scrim"></div>' : ''}
    ${placement === 'header' ? picture('banner') : ''}
    <div class="content">
      ${placement === 'topRight' ? picture('corner') : ''}
      ${body}
    </div>
    ${placement === 'footer' ? picture('banner') : ''}
  </div>
</body>
</html>`;
};

export default renderTicketHTML;
