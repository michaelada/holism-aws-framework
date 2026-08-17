/**
 * Drawings of the things the demo shop sells.
 *
 * The first pass at seeded images was a coloured tile with the product's name
 * on it, which proved the plumbing and nothing else: every card looked like
 * every other card, and a screen meant to show a shop showed a colour chart.
 * A shopper recognises a polo shirt by its shape before they read a word, and a
 * fixture that cannot exercise that is not exercising the page.
 *
 * Still SVG, still generated, for the same reasons as before — a few hundred
 * bytes each, no binary assets to commit, no bucket to configure, and a `data:`
 * URI is the one form both the org-admin and member paths render without
 * signing. See `images.ts` for that argument in full.
 *
 * These are simple flat shapes, not illustrations. They have to read at 56
 * pixels in a teaser thumbnail, where detail turns to mud.
 */

/** Every drawing is composed on the same square canvas. */
const SIZE = 400;

const svg = (background: string, body: string): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">` +
  `<rect width="${SIZE}" height="${SIZE}" fill="${background}"/>` +
  body +
  `</svg>`;

/**
 * A collared shirt. The body is one path so the sleeves and hem stay attached
 * when the colour changes; the placket and collar are drawn over it.
 */
const shirt = (fabric: string, trim: string, sleeves: 'short' | 'long'): string => {
  const cuff = sleeves === 'long' ? 250 : 170;
  return (
    `<path d="M150 96 L110 118 L64 168 L104 214 L136 186 L136 ${cuff + 76} L264 ${cuff + 76} L264 186 L296 214 L336 168 L290 118 L250 96 Z" fill="${fabric}"/>` +
    `<path d="M150 96 L200 142 L250 96 L228 88 L200 112 L172 88 Z" fill="${trim}"/>` +
    `<rect x="193" y="140" width="14" height="62" rx="3" fill="${trim}" opacity="0.85"/>` +
    `<circle cx="200" cy="158" r="4" fill="${fabric}"/>` +
    `<circle cx="200" cy="184" r="4" fill="${fabric}"/>`
  );
};

const hoodie = (fabric: string, trim: string): string =>
  `<path d="M146 104 L104 126 L58 182 L100 226 L134 196 L134 330 L266 330 L266 196 L300 226 L342 182 L296 126 L254 104 Z" fill="${fabric}"/>` +
  `<path d="M146 104 Q200 168 254 104 Q228 84 200 84 Q172 84 146 104 Z" fill="${trim}"/>` +
  `<path d="M186 150 L186 210" stroke="${trim}" stroke-width="7" stroke-linecap="round"/>` +
  `<path d="M214 150 L214 210" stroke="${trim}" stroke-width="7" stroke-linecap="round"/>` +
  `<rect x="150" y="246" width="100" height="48" rx="10" fill="${trim}" opacity="0.35"/>`;

const cap = (fabric: string, trim: string): string =>
  `<path d="M96 236 Q96 128 200 128 Q304 128 304 236 Z" fill="${fabric}"/>` +
  `<path d="M96 236 Q60 244 52 272 L300 272 Q308 244 304 236 Z" fill="${trim}"/>` +
  `<path d="M200 128 L200 236" stroke="${trim}" stroke-width="5" opacity="0.5"/>` +
  `<circle cx="200" cy="130" r="10" fill="${trim}"/>`;

const saddlePad = (fabric: string, binding: string): string =>
  `<path d="M92 132 L292 132 Q320 132 316 164 L294 286 Q290 310 262 310 L138 310 Q110 310 106 286 L84 164 Q80 132 108 132 Z" fill="${fabric}"/>` +
  `<path d="M92 132 L292 132 Q320 132 316 164 L294 286 Q290 310 262 310 L138 310 Q110 310 106 286 L84 164 Q80 132 108 132 Z" fill="none" stroke="${binding}" stroke-width="12"/>` +
  `<path d="M168 150 Q200 210 232 150" fill="none" stroke="${binding}" stroke-width="8" opacity="0.7"/>`;

const rosette = (ribbon: string, centre: string): string => {
  const petals = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 * Math.PI) / 180;
    const x = 200 + Math.cos(angle) * 74;
    const y = 172 + Math.sin(angle) * 74;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34" fill="${ribbon}" opacity="0.92"/>`;
  }).join('');

  return (
    `<path d="M168 232 L150 348 L200 318 L250 348 L232 232 Z" fill="${ribbon}"/>` +
    petals +
    `<circle cx="200" cy="172" r="46" fill="${centre}"/>` +
    `<circle cx="200" cy="172" r="34" fill="${ribbon}" opacity="0.35"/>`
  );
};

const book = (cover: string, page: string): string =>
  `<path d="M112 92 L112 320 Q160 300 200 316 L200 100 Q160 84 112 92 Z" fill="${cover}"/>` +
  `<path d="M288 92 L288 320 Q240 300 200 316 L200 100 Q240 84 288 92 Z" fill="${cover}" opacity="0.82"/>` +
  `<path d="M132 132 L182 146 M132 168 L182 182 M132 204 L182 218" stroke="${page}" stroke-width="7" stroke-linecap="round" opacity="0.85"/>` +
  `<path d="M218 146 L268 132 M218 182 L268 168 M218 218 L268 204" stroke="${page}" stroke-width="7" stroke-linecap="round" opacity="0.85"/>`;

const groomingKit = (bag: string, tools: string): string =>
  `<rect x="88" y="176" width="224" height="146" rx="18" fill="${bag}"/>` +
  `<path d="M150 176 Q150 130 200 130 Q250 130 250 176" fill="none" stroke="${bag}" stroke-width="16"/>` +
  `<rect x="126" y="206" width="46" height="70" rx="10" fill="${tools}" opacity="0.9"/>` +
  `<rect x="182" y="206" width="46" height="70" rx="10" fill="${tools}" opacity="0.7"/>` +
  `<rect x="238" y="206" width="40" height="70" rx="10" fill="${tools}" opacity="0.55"/>`;

/** A jumper with a band of snowflakes across the chest. */
const christmasJumper = (fabric: string, trim: string): string =>
  shirt(fabric, trim, 'long') +
  `<rect x="136" y="216" width="128" height="46" fill="${trim}" opacity="0.9"/>` +
  [168, 200, 232]
    .map(
      (x) =>
        `<path d="M${x} 226 L${x} 252 M${x - 11} 232 L${x + 11} 246 M${x + 11} 232 L${x - 11} 246" stroke="${fabric}" stroke-width="5" stroke-linecap="round"/>`
    )
    .join('');

/**
 * Each product's drawing, by its `MERCHANDISE` key.
 *
 * Keyed rather than inferred from the name: a fixture that guessed from words
 * would quietly fall back to a blank tile the first time somebody renamed a
 * product, and the seed would stop testing the thing it exists to test.
 */
const ARTWORK: Record<string, (background: string) => string> = {
  'club-polo': (bg) => svg(bg, shirt('#1a3a6b', '#f2f4f8', 'short')),
  'club-hoodie': (bg) => svg(bg, hoodie('#2f4f4f', '#e8ece9')),
  'baseball-cap': (bg) => svg(bg, cap('#0f4c81', '#f2f4f8')),
  'saddle-pad': (bg) => svg(bg, saddlePad('#f4efe6', '#6b4423')),
  'rosette-set': (bg) => svg(bg, rosette('#b3123b', '#f6d365')),
  yearbook: (bg) => svg(bg, book('#3d5a3d', '#f4f6f2')),
  'grooming-kit': (bg) => svg(bg, groomingKit('#5a4a7d', '#f0ecf7')),
  'christmas-jumper': (bg) => svg(bg, christmasJumper('#8b1a1a', '#f6f2ea')),
  /*
   * Meath's shop. The same drawings in the club's own colours rather than new
   * shapes — a second club selling a cap should look like a different club's
   * cap, which is exactly what the colour change gives. The palettes must stay
   * distinct from the ones above, or `draws each product differently` fails.
   */
  'mhpc-softshell': (bg) => svg(bg, hoodie('#123c2b', '#dfe9e3')),
  'mhpc-show-cap': (bg) => svg(bg, cap('#5c1a2b', '#f4e9ec')),
  'mhpc-numnah': (bg) => svg(bg, saddlePad('#e9e2f4', '#3b2d5c')),
};

/** A pale wash of the product's colour, so the drawing has ground to sit on. */
const backgroundFor = (colour: string): string => `${colour}1a`;

/**
 * The images for one product, as `data:` URIs.
 *
 * `count` above one repeats the drawing on progressively deeper grounds, which
 * gives a gallery something to page through without pretending to be a second
 * photograph of the same thing.
 */
export const productArtwork = (key: string, colour: string, count = 1): string[] => {
  const draw = ARTWORK[key];

  return Array.from({ length: Math.max(1, count) }, (_, variant) => {
    const background = variant === 0 ? backgroundFor(colour) : `${colour}${variant === 1 ? '33' : '4d'}`;
    // A product with no drawing yet still gets a tile rather than nothing.
    const body = draw ? draw(background) : svg(background, '');
    return `data:image/svg+xml;base64,${Buffer.from(body, 'utf8').toString('base64')}`;
  });
};

export const hasArtwork = (key: string): boolean => key in ARTWORK;
