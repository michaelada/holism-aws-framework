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

  return (
    <Card
      sx={{
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.3s ease-in-out',
        position: 'relative',
        '&:hover': {
          transform: 'translateY(-8px)',
          boxShadow: '10px 10px 20px #c5c5c5, -10px -10px 20px #ffffff',
        },
        '&:active': {
          transform: 'translateY(-4px)',
          boxShadow: 'inset 4px 4px 8px #c5c5c5, inset -4px -4px 8px #ffffff',
        },
      }}
      onClick={handleClick}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Icon */}
        <Box display="flex" alignItems="center" mb={2}>
          <Avatar
            sx={{
              bgcolor: card.color || 'primary.main',
              width: 64,
              height: 64,
              boxShadow: '4px 4px 8px #c5c5c5, -4px -4px 8px #ffffff',
            }}
          >
            <Box sx={{ fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
