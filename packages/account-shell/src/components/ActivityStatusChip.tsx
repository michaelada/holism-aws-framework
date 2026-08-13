import React from 'react';
import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ActivityStatus } from '../types/account';

/**
 * The shared status chip for entries, bookings and memberships.
 *
 * One component rather than one per screen, because the four words are a single
 * vocabulary (C1/C2/C4/C6/C8) — a member seeing "Confirmed" in green on one
 * screen and amber on another would reasonably assume they meant different
 * things.
 */
const COLOURS: Record<ActivityStatus, 'warning' | 'success' | 'default' | 'error'> = {
  'awaiting-payment': 'warning',
  confirmed: 'success',
  // Completed is deliberately neutral rather than green: it is history, not an
  // achievement, and colouring it like success competes with what is actionable.
  completed: 'default',
  cancelled: 'error',
};

export const ActivityStatusChip: React.FC<{ status: ActivityStatus; size?: 'small' | 'medium' }> = ({
  status,
  size = 'small',
}) => {
  const { t } = useTranslation();

  return (
    <Chip
      size={size}
      color={COLOURS[status] ?? 'default'}
      label={t(`status.${status}`, { defaultValue: status })}
      variant={status === 'completed' ? 'outlined' : 'filled'}
    />
  );
};

export default ActivityStatusChip;
