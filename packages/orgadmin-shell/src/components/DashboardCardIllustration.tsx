import React from 'react';
import { Card, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleRegistration } from '../types/module.types';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface DashboardCardIllustrationProps {
  module: ModuleRegistration;
}

/**
 * Spot illustrations, drawn as line-art that inherits the accent colour via
 * `currentColor`. A real rollout would ship one cohesive illustration per
 * module; this mock includes a couple to demonstrate the look.
 */
const illustrations: Record<string, React.ReactNode> = {
  events: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="22" y="20" width="76" height="48" rx="8" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <path d="M22 35h76" stroke="currentColor" strokeWidth="3" />
      <path d="M40 13v10M80 13v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="60" cy="51" r="10" fill="currentColor" />
      <path d="M55.5 51l3 3 6-6.5" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  memberships: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="12" y="16" width="96" height="50" rx="9" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <circle cx="38" cy="37" r="8" stroke="currentColor" strokeWidth="3" />
      <path d="M26 56c0-7 5.4-12 12-12s12 5 12 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <rect x="60" y="32" width="38" height="6" rx="3" fill="currentColor" fillOpacity="0.5" />
      <rect x="60" y="44" width="26" height="6" rx="3" fill="currentColor" fillOpacity="0.3" />
      <circle cx="98" cy="20" r="10" fill="currentColor" />
      <path d="M94 20l3 3 5-6" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  registrations: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="26" y="16" width="68" height="54" rx="8" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <rect x="50" y="9" width="20" height="13" rx="3.5" fill="#fff" stroke="currentColor" strokeWidth="3" />
      <path d="M37 36h24M37 48h16" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.4" />
      <circle cx="74" cy="50" r="12" fill="currentColor" />
      <path d="M68.5 50l3.5 3.5 6.5-7.5" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  merchandise: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <path d="M34 32h52l-4 33a5 5 0 0 1-5 4.5H43a5 5 0 0 1-5-4.5z" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
      <path d="M47 33v-3a13 13 0 0 1 26 0v3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="22" y="20" width="76" height="48" rx="8" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <path d="M22 35h76" stroke="currentColor" strokeWidth="3" />
      <path d="M40 13v10M80 13v10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <g fill="currentColor" fillOpacity="0.4">
        <circle cx="40" cy="47" r="3" /><circle cx="52" cy="47" r="3" /><circle cx="64" cy="47" r="3" /><circle cx="76" cy="47" r="3" />
        <circle cx="40" cy="59" r="3" /><circle cx="52" cy="59" r="3" /><circle cx="64" cy="59" r="3" />
      </g>
      <circle cx="76" cy="59" r="5" fill="currentColor" />
    </svg>
  ),
  ticketing: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="20" y="26" width="80" height="34" rx="7" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <path d="M76 28v30" stroke="currentColor" strokeWidth="2.5" strokeDasharray="3 4" strokeLinecap="round" />
      <circle cx="88" cy="43" r="6" stroke="currentColor" strokeWidth="3" />
      <path d="M30 38h32M30 48h22" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  forms: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="28" y="14" width="64" height="56" rx="8" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <rect x="38" y="26" width="44" height="10" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <rect x="38" y="42" width="44" height="10" rx="3" fill="#fff" stroke="currentColor" strokeWidth="2.5" />
      <rect x="38" y="57" width="10" height="10" rx="2.5" fill="currentColor" />
      <path d="M40 62l1.8 1.8 3.2-3.6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M54 62h20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  ),
  payments: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="16" y="24" width="76" height="46" rx="8" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <path d="M16 36h76" stroke="currentColor" strokeWidth="6" strokeOpacity="0.8" />
      <rect x="26" y="48" width="15" height="11" rx="2.5" fill="currentColor" fillOpacity="0.5" />
      <path d="M50 54h20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.4" />
      <circle cx="92" cy="58" r="13" fill="currentColor" />
    </svg>
  ),
  users: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <circle cx="46" cy="32" r="9" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <path d="M32 58c0-8 6.3-13 14-13s14 5 14 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      <circle cx="74" cy="32" r="9" fill="#fff" stroke="currentColor" strokeWidth="3" />
      <path d="M60 58c0-8 6.3-13 14-13s14 5 14 13" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  ),
  settings: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <path d="M26 30h68M26 46h68M26 62h68" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeOpacity="0.35" />
      <circle cx="46" cy="30" r="7.5" fill="#fff" stroke="currentColor" strokeWidth="3" />
      <circle cx="76" cy="46" r="7.5" fill="#fff" stroke="currentColor" strokeWidth="3" />
      <circle cx="54" cy="62" r="7.5" fill="currentColor" />
    </svg>
  ),
  reporting: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <path d="M28 16v48h70" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="40" y="44" width="12" height="20" rx="2" fill="currentColor" fillOpacity="0.25" stroke="currentColor" strokeWidth="2.5" />
      <rect x="60" y="34" width="12" height="30" rx="2" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="2.5" />
      <rect x="80" y="26" width="12" height="38" rx="2" fill="currentColor" fillOpacity="0.6" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="86" cy="20" r="3.5" fill="currentColor" />
    </svg>
  ),
  default: (
    <svg viewBox="0 0 120 80" width="100%" height="100%" fill="none">
      <rect x="16" y="22" width="60" height="44" rx="8" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="3" />
      <rect x="44" y="14" width="60" height="44" rx="8" fill="#fff" stroke="currentColor" strokeWidth="3" />
      <rect x="54" y="26" width="40" height="6" rx="3" fill="currentColor" fillOpacity="0.5" />
      <rect x="54" y="38" width="28" height="6" rx="3" fill="currentColor" fillOpacity="0.3" />
    </svg>
  ),
};

export const DashboardCardIllustration: React.FC<DashboardCardIllustrationProps> = ({ module }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { card } = module;
  /*
   * Signal Orange, not Flare. The accent paints the "Go" affordance as well as
   * the illustration, and Flare Orange is 2.16:1 — unreadable at the 0.8rem
   * that label runs at.
   */
  const accent = card.color || '#D24400';
  const illustration = illustrations[module.id] ?? illustrations.default;

  const handleClick = () => navigate(card.path);

  /*
   * The card is a clickable div, so without this it cannot be reached or
   * activated from the keyboard at all — it needs the role, a tab stop, and
   * the two keys a button responds to.
   */
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <Card
      role="button"
      tabIndex={0}
      aria-label={t(card.title)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      sx={{
        height: '100%',
        /*
         * A column, so the "Go" affordance can be pushed to the foot of the
         * card. Descriptions run to one line or two depending on the module and
         * the locale, which left the twelve links scattered across two
         * different heights in every row.
         */
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.04)',
        borderRadius: '16px',
        transition: 'box-shadow 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        // The shadow lifts, the card does not move — see MuiCard in warmTheme.
        '&:hover': {
          boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        },
        '&:hover .illus-art': {
          transform: 'scale(1.04)',
        },
        '&:hover .illus-arrow': {
          gap: '0.6rem',
        },
      }}
    >
      {/* Soft tinted illustration panel */}
      <Box
        sx={{
          height: 104,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${accent}14 0%, ${accent}08 100%)`,
        }}
      >
        <Box
          className="illus-art"
          sx={{
            color: accent,
            width: 110,
            height: 72,
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {illustration}
        </Box>
      </Box>

      {/* Content */}
      <Box
        sx={{
          px: '1.25rem',
          pt: '1rem',
          pb: '1.25rem',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}
      >
        {/*
          Rendered as an h5, not the h6 the variant implies: the page title
          above is an h4, and a screen reader announcing a jump from h4 to h6
          reports a level as missing. The styling is unchanged.
        */}
        <Typography
          variant="h6"
          component="h5"
          sx={{ fontWeight: 600, color: 'text.primary', mb: '0.4rem', fontSize: '1.05rem' }}
        >
          {t(card.title)}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontSize: '0.825rem',
            lineHeight: 1.55,
            mb: '0.85rem',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {t(card.description)}
        </Typography>

        <Box
          className="illus-arrow"
          sx={{
            mt: 'auto', // sits on the card's floor, level with its neighbours
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: accent,
            transition: 'gap 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {t('dashboard.learnMore')}
          <ArrowForwardIcon sx={{ fontSize: '1rem' }} />
        </Box>
      </Box>
    </Card>
  );
};
