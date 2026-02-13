import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Avatar,
  Box,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { ModuleRegistration } from '../types/module.types';

interface DashboardCardProps {
  module: ModuleRegistration;
}

/**
 * DashboardCard Component
 * 
 * Displays a card for a module on the dashboard with:
 * - Icon, title, and description
 * - Gradient background based on module color
 * - Hover effects for interactivity
 * - Click navigation to module
 * - Neumorphic theme styling
 * 
 * Requirements: 2.2.2, 2.2.3, 3.4.2
 */
export const DashboardCard: React.FC<DashboardCardProps> = ({ module }) => {
  const navigate = useNavigate();
  const { card } = module;
  const Icon = card.icon;

  const handleClick = () => {
    navigate(card.path);
  };

  // Create gradient background based on module color
  const getGradientBackground = (color: string) => {
    // Lighten the color for gradient effect
    const lightenColor = (hex: string, percent: number) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      ).toString(16).slice(1);
    };

    const lightColor = lightenColor(color, 40);
    return `linear-gradient(135deg, ${color}15 0%, ${lightColor}25 100%)`;
  };

  return (
    <Card
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        overflow: 'hidden',
        background: getGradientBackground(card.color || '#1976d2'),
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '10px 10px 20px #c5c5c5, -10px -10px 20px #ffffff',
        },
        '&:active': {
          transform: 'translateY(-4px)',
          boxShadow: 'inset 4px 4px 8px #c5c5c5, inset -4px -4px 8px #ffffff',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          right: 0,
          width: '150px',
          height: '150px',
          background: `radial-gradient(circle, ${card.color || '#1976d2'}10 0%, transparent 70%)`,
          borderRadius: '50%',
          transform: 'translate(40%, -40%)',
          pointerEvents: 'none',
        },
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ p: 3, position: 'relative', zIndex: 1 }}>
        {/* Icon */}
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar
            sx={{
              bgcolor: card.color || 'primary.main',
              width: 72,
              height: 72,
              boxShadow: `4px 4px 12px ${card.color || '#1976d2'}40, -4px -4px 12px #ffffff`,
              background: `linear-gradient(135deg, ${card.color || '#1976d2'} 0%, ${card.color || '#1976d2'}dd 100%)`,
            }}
          >
            <Box sx={{ fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
              <Icon />
            </Box>
          </Avatar>
        </Box>

        {/* Title */}
        <Typography
          variant="h6"
          gutterBottom
          sx={{
            fontWeight: 600,
            color: 'text.primary',
            mb: 1,
          }}
        >
          {card.title}
        </Typography>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            lineHeight: 1.6,
            minHeight: '3em', // Ensure consistent card heights
          }}
        >
          {card.description}
        </Typography>
      </CardContent>
    </Card>
  );
};
