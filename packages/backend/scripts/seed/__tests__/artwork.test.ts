import { productArtwork, hasArtwork } from '../artwork';

const decode = (dataUri: string): string =>
  Buffer.from(dataUri.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8');

const PRODUCT_KEYS = [
  'club-polo',
  'club-hoodie',
  'baseball-cap',
  'saddle-pad',
  'rosette-set',
  'yearbook',
  'grooming-kit',
  'christmas-jumper',
];

describe('seed product artwork', () => {
  it('produces a data URI, which is the one form both paths understand', () => {
    // `resolveImageUrls` passes `data:` through instead of trying to sign it,
    // and the member-facing shop renders the stored value directly.
    expect(productArtwork('club-polo', '#1a3a6b')[0]).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('decodes to a well-formed SVG', () => {
    const svg = decode(productArtwork('club-polo', '#1a3a6b')[0]!);

    expect(svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(svg).toContain('</svg>');
  });

  it('draws every product in the shop', () => {
    for (const key of PRODUCT_KEYS) {
      expect(hasArtwork(key)).toBe(true);
    }
  });

  it('draws each product differently', () => {
    // The whole point of the change: a shop of identical tiles tests nothing
    // about a shop.
    const drawings = PRODUCT_KEYS.map((key) => decode(productArtwork(key, '#333333')[0]!));

    expect(new Set(drawings).size).toBe(PRODUCT_KEYS.length);
  });

  it('still yields a tile for a product with no drawing yet', () => {
    // The application refuses a product with an empty images array, so an
    // unknown key must not produce nothing.
    const [image] = productArtwork('not-drawn-yet', '#333333');

    expect(image).toMatch(/^data:image\/svg\+xml;base64,/);
    expect(decode(image!)).toContain('</svg>');
  });

  it('always yields at least one image, because the application demands it', () => {
    expect(productArtwork('club-polo', '#1a3a6b', 0)).toHaveLength(1);
    expect(productArtwork('club-polo', '#1a3a6b')).toHaveLength(1);
    expect(productArtwork('club-polo', '#1a3a6b', 3)).toHaveLength(3);
  });

  it('varies the ground between views rather than repeating one tile', () => {
    const [first, second] = productArtwork('club-polo', '#1a3a6b', 2);

    expect(first).not.toBe(second);
  });

  it('stays small enough to sit in a jsonb column without comment', () => {
    for (const key of PRODUCT_KEYS) {
      expect(productArtwork(key, '#1a3a6b')[0]!.length).toBeLessThan(4000);
    }
  });
});
