import React from 'react';
import { Card, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleRegistration } from '../types/module.types';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DashboardIcon from '@mui/icons-material/Dashboard';

interface DashboardCardHeroProps {
  module: ModuleRegistration;
}

/**
 * DashboardCardHero — design "B" mock.
 *
 * Compact card with a colour hero band keyed to the module's accent colour,
 * an enlarged semi-transparent watermark icon inside the band, and a crisp
 * icon tile straddling the band/content seam.
 */
export const DashboardCardHero: React.FC<DashboardCardHeroProps> = ({ module }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { card } = module;
  const Icon = card?.icon || DashboardIcon;
  const accent = card.color || '#FF9800';

  const handleClick = () => navigate(card.path);

  return (
    <Card
      onClick={handleClick}
      sx={{
        height: '100%',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.04)',
        borderRadius: '16px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        },
        '&:hover .hero-arrow': {
          gap: '0.6rem',
        },
      }}
    >
      {/* Hero band */}
      <Box
        sx={{
          position: 'relative',
          height: 84,
          overflow: 'hidden',
          background: `linear-gradient(135deg, ${accent} 0%, ${accent}cc 100%)`,
        }}
      >
        {/* Soft highlight */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(120% 120% at 0% 0%, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0) 55%)',
          }}
        />
        {/* Watermark icon */}
        <Box
          sx={{
            position: 'absolute',
            right: -6,
            bottom: -18,
            color: 'rgba(255,255,255,0.28)',
            fontSize: 104,
            display: 'flex',
            '& svg': { fontSize: 'inherit' },
          }}
        >
          <Icon />
        </Box>
      </Box>

      {/* Content (pulled up so the icon tile overlaps the band seam) */}
      <Box sx={{ px: '1.25rem', pb: '1.25rem' }}>
        <Box
          sx={{
            mt: '-22px',
            mb: '0.75rem',
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: '#FFFFFF',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: accent,
            '& svg': { fontSize: 24 },
          }}
        >
          <Icon />
        </Box>

        <Typography
          variant="h6"
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
          className="hero-arrow"
          sx={{
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
