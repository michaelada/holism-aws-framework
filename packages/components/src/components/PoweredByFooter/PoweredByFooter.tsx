import React from 'react';
import { Box, Link, Typography } from '@mui/material';

export interface PoweredByFooterProps {
  /** The ItsPlainSailing mark. Supplied by the app, which knows its own base path. */
  logoSrc?: string;
  /** "Powered by ItsPlainSailing.com" — translated by the caller. */
  poweredBy: string;
  /** "© 2026 Esker Software. All rights reserved" — the year already in it. */
  copyright: string;
  /** Where the mark and the "powered by" text lead. */
  href?: string;
}

/**
 * Attribution, for the foot of a page a visitor has not signed in on.
 *
 * Deliberately quiet: caption-sized, in `text.secondary`, with a mark small
 * enough to read as a signature rather than as branding. These pages are
 * branded for the *club* the visitor came for, and an attribution that competes
 * with that would answer a question nobody asked at the expense of the one they
 * did.
 *
 * Presentational, like the rest of this package's shared furniture: both
 * strings and the logo arrive as props, so the app that owns the translations
 * and the asset path keeps owning them.
 *
 * The Keycloak login themes render the same footer a second time in FreeMarker
 * (`infrastructure/keycloak/themes/account-user/login/template.ftl`) because
 * they have no React. The two have to be kept in step by hand — the same
 * bargain as `PostCard`.
 */
export const PoweredByFooter: React.FC<PoweredByFooterProps> = ({
  logoSrc,
  poweredBy,
  copyright,
  href = 'https://itsplainsailing.com',
}) => (
  /*
   * Ordinary inline flow, deliberately, rather than a flex row.
   *
   * As flex items the link and the copyright were two separate boxes centred
   * against each other, and the logo made the first one taller than the second
   * — so the two runs of text sat on visibly different lines within the same
   * row. Inline content shares one line box and therefore one baseline, which
   * is the thing that actually needs to line up. The mark is then aligned to
   * the text rather than the text to the mark.
   */
  <Typography
    component="p"
    variant="caption"
    sx={{ mt: 2, color: 'text.secondary', textAlign: 'center' }}
  >
    <Link
      href={href}
      /*
       * A new tab, with `noopener`. A visitor halfway through a registration
       * form should not lose it to a click on a footer.
       */
      target="_blank"
      rel="noopener noreferrer"
      underline="hover"
      sx={{ color: 'inherit' }}
    >
      {logoSrc && (
        <Box
          component="img"
          src={logoSrc}
          /*
           * Decorative: the words beside it say the same thing, so a screen
           * reader announcing the mark as well would read the brand twice.
           */
          alt=""
          sx={{
            width: 14,
            height: 14,
            objectFit: 'contain',
            /*
             * Sat on the text's baseline and nudged down by the descender, so
             * the mark reads as part of the line rather than floating above it.
             */
            verticalAlign: 'baseline',
            position: 'relative',
            top: 2,
            mr: 0.75,
          }}
        />
      )}
      {poweredBy}
    </Link>
    {/*
      The separator is markup rather than part of either string, so a translator
      is never handed a dangling " - " to puzzle over, and it can wrap away
      cleanly on a narrow screen.
    */}
    <Box component="span" aria-hidden="true">
      {' – '}
    </Box>
    {copyright}
  </Typography>
);

export default PoweredByFooter;
