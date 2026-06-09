import React from 'react';
import { Card, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleRegistration } from '../types/module.types';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DashboardIcon from '@mui/icons-material/Dashboard';

interface DashboardCardPhotoProps {
  module: ModuleRegistration;
  /** Real photo URL. When omitted, an accent-keyed placeholder stands in for the photo. */
  image?: string;
}

/**
 * DashboardCardPhoto — design "D" mock.
 *
 * Photographic header treatment: a full-bleed media band with a dark gradient
 * scrim so overlaid white text stays legible, a frosted-glass icon chip, and
 * the title sitting on the image. Pass `image` to drop in a real photo; the
 * placeholder gradient only stands in for one.
 */
export const DashboardCardPhoto: React.FC<DashboardCardPhotoProps> = ({ module, image }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { card } = module;
  const Icon = card?.icon || DashboardIcon;
  const accent = card.color || '#FF9800';

  const handleClick = () => navigate(card.path);

  // Placeholder "photo": a layered gradient keyed to the accent. A real rollout
  // would set `backgroundImage: url(<photo>)` from the `image` prop instead.
  const mediaBackground = image
    ? `url(${image})`
    : `linear-gradient(135deg, ${accent} 0%, ${accent}aa 45%, #2b2b3a 100%)`;

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
        '&:hover .photo-img': {
          transform: 'scale(1.06)',
        },
        '&:hover .photo-arrow': {
          gap: '0.6rem',
        },
      }}
    >
      {/* Media band */}
      <Box sx={{ position: 'relative', height: 124, overflow: 'hidden' }}>
        <Box
          className="photo-img"
          sx={{
            position: 'absolute',
            inset: 0,
            background: mediaBackground,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        />
        {/* Soft top highlight to give the placeholder some depth */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(120% 90% at 15% 0%, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 50%)',
          }}
        />
        {/* Bottom scrim for text legibility */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.15) 45%, rgba(0,0,0,0) 70%)',
          }}
        />
        {/* Frosted icon chip */}
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: 12,
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(6px)',
            border: '1px solid rgba(255,255,255,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            '& svg': { fontSize: 20 },
          }}
        >
          <Icon />
        </Box>
        {/* Title overlaid on the image */}
        <Typography
          variant="h6"
          sx={{
            position: 'absolute',
            left: 16,
            bottom: 10,
            right: 16,
            color: '#fff',
            fontWeight: 700,
            fontSize: '1.1rem',
            textShadow: '0 1px 3px rgba(0,0,0,0.45)',
          }}
        >
          {t(card.title)}
        </Typography>
      </Box>

      {/* Content */}
      <Box sx={{ px: '1.25rem', pt: '0.9rem', pb: '1.25rem' }}>
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
          className="photo-arrow"
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
