import React from 'react';
import { Box, Typography } from '@mui/material';

export interface EventDateTileProps {
  /** ISO date. An unparseable or missing value renders nothing. */
  date?: string | null;
  /** Optional end date; when it differs from `date` the tile shows a range. */
  endDate?: string | null;
  locale?: string;
  size?: 'small' | 'medium';
  /** Defaults to the theme's primary colour. */
  accentColor?: string;
}

/**
 * A date drawn as a tear-off calendar page.
 *
 * Month band, weekday, day number, year — the shape people read at a glance
 * without parsing it as text. Event lists are scanned for *when*, and a date
 * rendered as another line of prose forces the reader to decode every row.
 *
 * The month band carries the accent colour, so the tile also anchors a card
 * that is otherwise mostly text.
 *
 * Locale-aware throughout: month and weekday come from `Intl`, so a French
 * member sees AOÛT / jeudi rather than a translated-looking English date.
 */
export const EventDateTile: React.FC<EventDateTileProps> = ({
  date,
  endDate,
  locale = 'en-GB',
  size = 'medium',
  accentColor,
}) => {
  const parsed = date ? new Date(date) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) {
    return null;
  }

  const end = endDate ? new Date(endDate) : null;
  const hasRange =
    end && !Number.isNaN(end.getTime()) && end.toDateString() !== parsed.toDateString();

  const month = new Intl.DateTimeFormat(locale, { month: 'short' })
    .format(parsed)
    .toUpperCase();
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(parsed);
  const day = new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(parsed);
  const year = parsed.getFullYear();

  const compact = size === 'small';
  const width = compact ? 72 : 92;

  return (
    <Box
      // A single accessible date rather than four separate scraps of text: a
      // screen reader announcing "AUG Thursday 20 2026" is worse than the
      // sighted reading, and the visual pieces are decorative once it is read.
      role="group"
      aria-label={new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(parsed)}
      sx={{
        width,
        flexShrink: 0,
        borderRadius: 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'background.paper',
        textAlign: 'center',
        boxShadow: 1,
      }}
    >
      <Box
        aria-hidden
        sx={{
          backgroundColor: accentColor || 'primary.main',
          color: (theme) =>
            accentColor ? '#fff' : theme.palette.primary.contrastText,
          py: 0.25,
        }}
      >
        <Typography
          component="div"
          sx={{
            fontSize: compact ? '0.65rem' : '0.75rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            lineHeight: 1.6,
          }}
        >
          {month}
        </Typography>
      </Box>

      <Box aria-hidden sx={{ px: 0.5, py: compact ? 0.5 : 0.75 }}>
        <Typography
          component="div"
          color="text.secondary"
          sx={{
            fontSize: compact ? '0.6rem' : '0.7rem',
            textTransform: 'capitalize',
            lineHeight: 1.2,
            // A long weekday in some locales would otherwise widen the tile and
            // ripple through the row it sits in.
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {weekday}
        </Typography>

        <Typography
          component="div"
          sx={{
            fontSize: compact ? '1.6rem' : '2rem',
            fontWeight: 700,
            lineHeight: 1.1,
          }}
        >
          {day}
        </Typography>

        <Typography
          component="div"
          color="text.secondary"
          sx={{ fontSize: compact ? '0.6rem' : '0.7rem', lineHeight: 1.2 }}
        >
          {year}
        </Typography>
      </Box>

      {hasRange && (
        <Box
          aria-hidden
          sx={{
            borderTop: '1px dashed',
            borderColor: 'divider',
            py: 0.25,
          }}
        >
          <Typography
            component="div"
            color="text.secondary"
            sx={{ fontSize: compact ? '0.55rem' : '0.65rem', lineHeight: 1.3 }}
          >
            {new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(end!)}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default EventDateTile;
