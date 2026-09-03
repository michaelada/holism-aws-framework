import React from 'react';
import { Box, Button, Card, CardContent, CardMedia, Typography } from '@mui/material';
import { RichText } from '../RichText/RichText';

/**
 * One club announcement, as a member sees it.
 *
 * Shared between the two applications on purpose: the account app renders it on
 * a member's home page, and the org-admin editor renders **this same
 * component** as its preview. A preview built separately drifts from the thing
 * it previews, and the first thing it gets wrong is always the thing the
 * preview existed to check — how long a title can be before it wraps, how dark
 * a photograph turns out.
 *
 * ## The background placement darkens the picture for the club
 *
 * A club uploads whatever photograph it has. Asking an administrator to prepare
 * a suitably dark version is asking for something they cannot easily do, will
 * not check, and would have to redo for every image. So the card lays a scrim
 * over the image and sets the text white: legibility stops depending on the
 * photograph and becomes a property of the card.
 *
 * The scrim is a gradient rather than a flat wash — darkest where the text
 * begins and lighter at the top — so a photograph is still recognisably a
 * photograph rather than a grey rectangle with words on it.
 */

export type AnnouncementImagePlacement = 'background' | 'header' | 'footer';

/** Where a notice points. Both halves, or the link is not shown at all. */
export interface AnnouncementCardLink {
  label: string;
  url: string;
}

export interface AnnouncementCardAnnouncement {
  id?: string;
  title: string;
  /** HTML from the org-admin editor. Sanitised again by `RichText`. */
  description: string;
  /** An absolute URL, a blob URL while an upload is in flight, or null. */
  imageUrl: string | null;
  imagePlacement: AnnouncementImagePlacement | null;
  /** Optional: where this notice points, as a labelled button. */
  link?: AnnouncementCardLink | null;
}

export interface AnnouncementCardProps {
  announcement: AnnouncementCardAnnouncement;
}

/** Tall enough to be a picture, short enough to leave the words on screen. */
const IMAGE_ASPECT = '16 / 9';

/**
 * What the card actually does with its image.
 *
 * A placement with no image renders as no image, rather than as a background
 * that is a plain dark rectangle — an announcement whose picture has been
 * removed is an announcement, not a broken one.
 */
export const effectivePlacement = (
  announcement: AnnouncementCardAnnouncement
): AnnouncementImagePlacement | null => (announcement.imageUrl ? announcement.imagePlacement : null);

export const AnnouncementCard: React.FC<AnnouncementCardProps> = ({ announcement }) => {
  const placement = effectivePlacement(announcement);
  const onDarkBackground = placement === 'background';

  const words = (
    <CardContent
      sx={{
        position: onDarkBackground ? 'relative' : 'static',
        color: onDarkBackground ? '#FFFFFF' : 'inherit',
        // Enough for the words to sit clear of a busy photograph's edges.
        ...(onDarkBackground ? { p: 3 } : {}),
      }}
    >
      <Typography
        variant="h6"
        component="h3"
        gutterBottom
        sx={
          onDarkBackground
            ? { color: '#FFFFFF', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }
            : undefined
        }
      >
        {announcement.title}
      </Typography>
      <RichText
        html={announcement.description}
        sx={
          onDarkBackground
            ? { color: 'rgba(255,255,255,0.94)', textShadow: '0 1px 3px rgba(0,0,0,0.6)' }
            : { color: 'text.secondary' }
        }
      />

      {/*
        Where the notice points, under the words it belongs to — the same
        arrangement the platform's own posts use.

        Shown only when both halves are there: a button with no destination
        does nothing, and one with no words cannot be read. The service refuses
        half a link on the way in; this is what makes a row that predates that
        rule, or arrives another way, render as an ordinary notice instead of a
        broken button.
      */}
      {announcement.link?.label && announcement.link?.url && (
        <Button
          size="small"
          variant="outlined"
          href={announcement.link.url}
          /*
           * A new tab, with `noopener`. A member reading the home page is in
           * the middle of their own business — a basket half-filled, an entry
           * half-made — and taking the tab away to a club's booking page loses
           * it.
           */
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            mt: 2,
            ...(onDarkBackground
              ? {
                  // Over a photograph the default outline disappears into
                  // whatever the picture happens to be behind it.
                  color: '#FFFFFF',
                  borderColor: 'rgba(255,255,255,0.7)',
                  '&:hover': { borderColor: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.12)' },
                }
              : {}),
          }}
        >
          {announcement.link.label}
        </Button>
      )}
    </CardContent>
  );

  const picture = announcement.imageUrl ? (
    <CardMedia
      component="img"
      image={announcement.imageUrl}
      /*
       * Empty alt on purpose. The picture illustrates the announcement it sits
       * with and adds nothing a screen reader needs; describing it as "Summer
       * camp" would read the title out twice. A club cannot supply alt text
       * here, so inventing it would be inventing it.
       */
      alt=""
      sx={{ aspectRatio: IMAGE_ASPECT, objectFit: 'cover', width: '100%' }}
    />
  ) : null;

  return (
    <Card
      variant="outlined"
      sx={{
        overflow: 'hidden',
        position: 'relative',
        ...(onDarkBackground
          ? {
              backgroundImage: `url(${announcement.imageUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              // A floor under the card, so a very short announcement over a
              // photograph is still a photograph.
              minHeight: 180,
            }
          : {}),
      }}
      data-placement={placement ?? 'none'}
    >
      {onDarkBackground && (
        /*
         * The scrim. Absolutely positioned rather than a semi-transparent
         * background on the content, so it covers the whole card including the
         * space beside short text — a half-darkened photograph is worse than
         * either extreme.
         */
        <Box
          aria-hidden
          data-testid="announcement-scrim"
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.62) 55%, rgba(0,0,0,0.72) 100%)',
          }}
        />
      )}

      {placement === 'header' && picture}
      {words}
      {placement === 'footer' && picture}
    </Card>
  );
};

export default AnnouncementCard;
