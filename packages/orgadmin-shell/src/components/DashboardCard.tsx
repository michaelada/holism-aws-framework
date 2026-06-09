import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleRegistration } from '../types/module.types';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DashboardIcon from '@mui/icons-material/Dashboard';

interface DashboardCardProps {
  module: ModuleRegistration;
}

/**
 * DashboardCard Component
 * 
 * Displays a card for a module on the dashboard with:
 * - Icon, title, and description
 * - Clean white background with subtle border
 * - Animated gradient left border on hover
 * - Hover effects for interactivity
 * - Click navigation to module
 * - Matches features page card styling
 * 
 * Requirements: 2.2.2, 2.2.3, 3.4.2
 */
export const DashboardCard: React.FC<DashboardCardProps> = ({ module }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { card } = module;
  const Icon = card?.icon || DashboardIcon; // Fallback to DashboardIcon if no icon provided
  
  // Debug: log if icon is missing
  if (!card?.icon) {
    console.warn(`Module ${module.id} is missing an icon`);
  }

  const handleClick = () => {
    navigate(card.path);
  };

  // Create soft background color for icon container
  const getSoftColor = (color: string) => {
    // Convert hex to RGB and create a very light version
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.1)`;
  };

  return (
    <Card
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden',
        background: '#FFFFFF',
        border: '1px solid rgba(0,0,0,0.04)',
        borderRadius: '16px',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.04)',
        },
        '&:hover::before': {
          height: '100%',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '4px',
          height: 0,
          background: `linear-gradient(to bottom, ${card.color || '#FF9800'}, ${card.color || '#FF9800'}dd, ${card.color || '#FF9800'}aa)`,
          transition: 'height 0.4s ease',
          borderRadius: '0 0 4px 0',
          zIndex: 2,
        },
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ p: '1.5rem 1.25rem', position: 'relative', zIndex: 1 }}>
        {/* Icon */}
        {Icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: getSoftColor(card.color || '#FF9800'),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: '1rem',
            }}
          >
            <Box sx={{ fontSize: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: card.color || '#FF9800' }}>
              <Icon />
            </Box>
          </Box>
        )}

        {/* Title */}
        <Typography
          variant="h6"
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            mb: '0.4rem',
            fontSize: '1.05rem',
          }}
        >
          {t(card.title)}
        </Typography>

        {/* Description */}
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

        {/* Learn more link */}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.3rem',
            fontSize: '0.8rem',
            fontWeight: 600,
            color: card.color || '#FF9800',
            transition: 'gap 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              gap: '0.6rem',
            },
          }}
        >
          {t('dashboard.learnMore')}
          <ArrowForwardIcon sx={{ fontSize: '1rem' }} />
        </Box>
      </CardContent>
    </Card>
  );
};
