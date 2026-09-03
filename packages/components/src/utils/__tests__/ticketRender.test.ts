import { describe, it, expect } from 'vitest';
import { renderTicketHTML, ticketDateLine, escapeHtml, isDark } from '../ticketRender';

/**
 * What has to be on a ticket, and what must never be wrong about it.
 *
 * The one non-negotiable is the QR code: a scanner reads dark on light, so the
 * code sits on white whatever a club chooses around it. A ticket that will not
 * scan has failed completely, and it fails at a gate with a queue behind it.
 */

const base = {
  ticketReference: 'TKT-2026-000018',
  qrCodeDataURL: 'data:image/png;base64,AAAA',
  eventName: 'Tara Hunter Trial',
  eventDescription: 'Cross country over the Tara banks.',
  activityName: 'Open class',
  activityDescription: 'Open to all grades.',
  startDate: '2026-09-22T00:00:00.000Z',
  endDate: '2026-09-22T00:00:00.000Z',
  customerName: 'Bríd McNamara',
  customerEmail: 'brid@example.test',
};

const html = (over: Record<string, unknown> = {}) =>
  renderTicketHTML({ ...base, ...over } as never);

/**
 * The ticket itself, without the stylesheet above it.
 *
 * Order assertions have to read the body: the CSS names every class too, and
 * `.column-details { … }` appears above `.column-code { … }` whatever the
 * markup does.
 */
const body = (over: Record<string, unknown> = {}) => html(over).split('<body>')[1] ?? '';

describe('what the ticket says', () => {
  it('names the event and the class, each with its description under it', () => {
    /*
     * The descriptions are where a club puts what a gate needs to know — bring
     * a hat, park in the top field — so they belong with the names they explain
     * rather than in a footnote.
     */
    const ticket = body();

    expect(ticket).toContain('Tara Hunter Trial');
    expect(ticket).toContain('Cross country over the Tara banks.');
    expect(ticket).toContain('Open class');
    expect(ticket).toContain('Open to all grades.');

    // In that order: event, its description, class, its description.
    expect(ticket.indexOf('Tara Hunter Trial')).toBeLessThan(
      ticket.indexOf('Cross country over the Tara banks.')
    );
    expect(ticket.indexOf('Cross country over the Tara banks.')).toBeLessThan(
      ticket.indexOf('Open class')
    );
  });

  it('carries the holder, the reference and the code', () => {
    const ticket = html();

    expect(ticket).toContain('Bríd McNamara');
    expect(ticket).toContain('TKT-2026-000018');
    expect(ticket).toContain('data:image/png;base64,AAAA');
  });
});

describe('the date', () => {
  it('is one date when the event starts and ends the same day', () => {
    // "22 September 2026 – 22 September 2026" reads as a two-day event whose
    // second day is missing.
    expect(ticketDateLine('2026-09-22', '2026-09-22')).toBe('22 September 2026');
  });

  it('is two when they differ', () => {
    expect(ticketDateLine('2026-09-22', '2026-09-23')).toBe(
      '22 September 2026 – 23 September 2026'
    );
  });

  it('copes with only one of them', () => {
    expect(ticketDateLine('2026-09-22', null)).toBe('22 September 2026');
    expect(ticketDateLine(null, '2026-09-23')).toBe('23 September 2026');
  });

  it('says nothing rather than "Invalid Date"', () => {
    expect(ticketDateLine(null, null)).toBe('');
    expect(ticketDateLine('not a date', null)).toBe('');
  });

  it('reads in the reader’s language', () => {
    expect(ticketDateLine('2026-09-22', '2026-09-22', 'fr-FR')).toMatch(/septembre/);
  });
});

describe('the QR code is always on white', () => {
  /*
   * The requirement in the club's own words: *"make sure that the QR code is
   * clear, e.g. use a white background for it regardless"*.
   */
  it('sits on a white panel over a photograph', () => {
    const ticket = html({
      imageUrl: 'https://example.test/banks.jpg',
      imagePlacement: 'background',
    });

    expect(ticket).toMatch(/\.qr\s*\{[^}]*background:\s*#ffffff/i);
  });

  it('sits on a white panel over a club’s own background colour', () => {
    const ticket = html({ backgroundColour: '#123c2b' });

    expect(ticket).toContain('#123c2b');
    expect(ticket).toMatch(/\.qr\s*\{[^}]*background:\s*#ffffff/i);
  });

  it('keeps its quiet zone, whatever the layout', () => {
    // The padding is the margin a scanner needs, and it is white too.
    for (const layout of ['stacked', 'sideBySide', 'compact'] as const) {
      expect(html({ layout })).toMatch(/\.qr\s*\{[^}]*padding:\s*12px/);
    }
  });
});

describe('the image placements', () => {
  const IMAGE = 'https://example.test/banks.jpg';

  it('puts a header image above everything', () => {
    const ticket = body({ imageUrl: IMAGE, imagePlacement: 'header' });

    expect(ticket).toContain(`class="banner" src="${IMAGE}"`);
    expect(ticket.indexOf('class="banner"')).toBeLessThan(ticket.indexOf('Tara Hunter Trial'));
  });

  it('puts a footer image below everything', () => {
    const ticket = body({ imageUrl: IMAGE, imagePlacement: 'footer' });

    expect(ticket.indexOf('Tara Hunter Trial')).toBeLessThan(ticket.indexOf('class="banner"'));
  });

  it('puts a top-right image in the corner, small', () => {
    // A ticket is a dense thing; a club's logo is often all the room it deserves.
    const ticket = html({ imageUrl: IMAGE, imagePlacement: 'topRight' });

    expect(body({ imageUrl: IMAGE, imagePlacement: 'topRight' })).toContain('class="corner"');
    expect(ticket).toMatch(/\.corner\s*\{[^}]*position:\s*absolute/);
  });

  it('darkens a background image rather than asking the club to', () => {
    const ticket = html({ imageUrl: IMAGE, imagePlacement: 'background' });

    expect(ticket).toContain('class="scrim"');
    expect(ticket).toContain(`background-image: url('${IMAGE}')`);
    // And writes over it in white.
    expect(ticket).toMatch(/color:\s*#ffffff/);
  });

  it('ignores a placement with no image', () => {
    // A "background" with no picture would be a plain dark rectangle nobody
    // chose, and text in white on white.
    const ticket = body({ imagePlacement: 'background' });

    expect(ticket).not.toContain('class="scrim"');
    expect(ticket).not.toContain('class="banner"');
  });
});

describe('the layouts', () => {
  it('stacks by default, which is what a ticket used to look like', () => {
    expect(body()).not.toContain('class="columns"');
  });

  it('puts the code beside the details when asked', () => {
    const ticket = body({ layout: 'sideBySide' });

    expect(ticket).toContain('class="columns"');
    expect(ticket.indexOf('column-details')).toBeLessThan(ticket.indexOf('column-code'));
  });

  it('leads with the code in the compact layout', () => {
    // Stub proportions: the gate wants the code and the name, in that order.
    const ticket = body({ layout: 'compact' });

    expect(ticket.indexOf('column-code')).toBeLessThan(ticket.indexOf('column-details'));
  });

  it('trims the descriptions in the compact layout', () => {
    /*
     * At stub size they crowd out the name and the code, which are the two
     * things a gate actually needs.
     */
    const ticket = body({ layout: 'compact' });

    expect(ticket).toContain('Open class');
    expect(ticket).not.toContain('Cross country over the Tara banks.');
  });

  it('falls back to stacked for a layout it does not know', () => {
    expect(body({ layout: 'diagonal' })).not.toContain('class="columns"');
  });
});

describe('what a club types', () => {
  it('is escaped, not interpreted', () => {
    /*
     * A club's administrator is not a stranger, but this HTML is printed and —
     * through the preview — rendered in an administrator's browser.
     */
    const ticket = html({ eventName: '<script>alert(1)</script>' });

    expect(ticket).not.toContain('<script>alert(1)</script>');
    expect(ticket).toContain('&lt;script&gt;');
  });

  it('escapes the ampersands a club actually types', () => {
    expect(escapeHtml('Ward Union & Meath')).toBe('Ward Union &amp; Meath');
  });

  it('refuses an image URL that is not a picture', () => {
    // eslint-disable-next-line no-script-url
    const ticket = body({ imageUrl: 'javascript:alert(1)', imagePlacement: 'header' });

    expect(ticket).not.toContain('javascript:');
    expect(ticket).not.toContain('class="banner"');
  });

  it('refuses a background colour that is not a colour', () => {
    const ticket = html({ backgroundColour: 'red; } body { display:none' });

    expect(ticket).not.toContain('display:none');
  });
});

describe('what it needs from the network', () => {
  it('needs nothing', () => {
    /*
     * The HTML is written into a print frame and printed a moment later.
     * Anything fetched — a stylesheet, a web font — is a ticket that prints
     * half-drawn.
     */
    const ticket = html();

    expect(ticket).not.toContain('<link');
    expect(ticket).not.toContain('@import');
    expect(ticket).not.toContain('fonts.googleapis');
  });
});

/**
 * Legibility follows the background, not the picture.
 *
 * Reported from the product: *"the preview is all darkened so it is hard to
 * make out how it will look"*. The seeded clubs' ticket colour is a deep green,
 * and the text colour keyed off the image placement alone — so a dark ticket
 * got near-black text and nobody could read it. What decides legibility is the
 * background actually behind the words, however it got there.
 */
describe('text on a dark ticket', () => {
  it('is light when the club chose a dark colour', () => {
    const ticket = html({ backgroundColour: '#123c2b' });

    expect(ticket).toContain('#123c2b');
    expect(ticket).toMatch(/color:\s*#ffffff/);
    expect(ticket).not.toMatch(/color:\s*#1a1a1a/);
  });

  it('is dark on a light ticket, which is the ordinary case', () => {
    const ticket = html({ backgroundColour: '#ffffff' });

    expect(ticket).toMatch(/color:\s*#1a1a1a/);
  });

  it('is light over a background photograph, as before', () => {
    const ticket = html({
      imageUrl: 'https://example.test/banks.jpg',
      imagePlacement: 'background',
    });

    expect(ticket).toMatch(/color:\s*#ffffff/);
  });

  it('keeps the quieter lines readable too', () => {
    // The descriptions and labels used to be dimmed with `opacity`, which on a
    // dark ticket dimmed near-black text into the background.
    const ticket = html({ backgroundColour: '#123c2b' });

    expect(ticket).toContain('rgba(255,255,255,0.85)');
    expect(ticket).not.toMatch(/opacity:\s*\$/);
  });
});

describe('isDark', () => {
  it('knows a deep green needs light text', () => {
    // The colour the seeded clubs actually use.
    expect(isDark('#123c2b')).toBe(true);
  });

  it('knows white and a pale cream do not', () => {
    expect(isDark('#ffffff')).toBe(false);
    expect(isDark('#faf8f5')).toBe(false);
  });

  it('weighs green as the eye does, not as arithmetic would', () => {
    // Equal channel values, very different to look at: a saturated green is
    // far lighter than a blue of the same number.
    expect(isDark('#00cc00')).toBe(false);
    expect(isDark('#0000cc')).toBe(true);
  });

  it('reads the short form, and shrugs at nonsense', () => {
    expect(isDark('#000')).toBe(true);
    expect(isDark('#fff')).toBe(false);
    expect(isDark('not a colour')).toBe(false);
  });
});

describe('a picture chosen but not yet uploaded', () => {
  it('appears in the preview from a blob URL', () => {
    /*
     * Reported from the product: choosing an image showed nothing. `blob:` was
     * not in the allow-list, so the URL was dropped — and with it the
     * placement, so the preview looked exactly as though nothing was chosen.
     */
    const ticket = body({ imageUrl: 'blob:http://localhost:5175/abc', imagePlacement: 'header' });

    expect(ticket).toContain('class="banner"');
    expect(ticket).toContain('blob:http://localhost:5175/abc');
  });

  it('appears from a data URL, which is what the settings screen sends', () => {
    const ticket = body({
      imageUrl: 'data:image/png;base64,AAAA',
      imagePlacement: 'background',
    });

    expect(ticket).toContain('class="scrim"');
  });
});

/**
 * A background picture replaces the colour.
 *
 * Reported from the product: *"if I have selected an image as a background for
 * the ticket it seems to get mixed with the Ticket Background Color and is not
 * shown"*. Both were applied, so a club that had chosen a deep green and then a
 * photograph got the two fighting — and a scrim heavy enough for the colour
 * left the photograph unreadable. Choosing a picture is choosing what the
 * background *is*.
 */
describe('a picture and a colour together', () => {
  const withBoth = () =>
    html({
      imageUrl: 'https://example.test/banks.jpg',
      imagePlacement: 'background',
      backgroundColour: '#123c2b',
    });

  it('drops the colour when the picture is the background', () => {
    const ticket = withBoth();

    expect(ticket).not.toContain('#123c2b');
    expect(ticket).toContain("background-image: url('https://example.test/banks.jpg')");
  });

  it('paints the picture on near-black, not on white', () => {
    // A ticket whose image has not arrived yet is dark, which is what the white
    // text on it expects — rather than a white card with white writing.
    expect(withBoth()).toMatch(/background:\s*#1a1a1a/);
  });

  it('keeps the colour when the picture goes somewhere else', () => {
    // A header or footer picture sits *on* the ticket; the colour is still the
    // ticket's own background.
    const ticket = html({
      imageUrl: 'https://example.test/banks.jpg',
      imagePlacement: 'header',
      backgroundColour: '#123c2b',
    });

    expect(ticket).toContain('#123c2b');
  });

  it('darkens the photograph enough to read, and no more', () => {
    /*
     * The scrim was 0.55–0.78, which made a photograph read as a dark
     * rectangle — the club could not see what they had chosen. Light enough to
     * see the picture, heavy enough for white text on it.
     */
    const scrim = withBoth().match(/\.scrim\s*\{[^}]*\}/)?.[0] ?? '';
    const opacities = [...scrim.matchAll(/rgba\(0,0,0,([\d.]+)\)/g)].map((m) => Number(m[1]));

    expect(opacities.length).toBeGreaterThan(0);
    expect(Math.max(...opacities)).toBeLessThan(0.7);
    expect(Math.min(...opacities)).toBeGreaterThan(0.25);
  });
});
