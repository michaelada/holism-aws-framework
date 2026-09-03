import React from 'react';
import { useTranslation } from 'react-i18next';
import { Stack, Typography } from '@mui/material';
import { AnnouncementCard } from '@aws-web-framework/components';
import { DashboardAnnouncement } from '../types/account';

/**
 * What the club is telling its members, in the home page's right-hand third.
 *
 * **Headed**, because a photograph in a sidebar with no heading reads as
 * decoration — and worse, as an advertisement. A heading is the difference
 * between a notice and a banner.
 *
 * The cards are the shared `AnnouncementCard`: the same component the org-admin
 * editor previews with, so what an administrator approved is literally what is
 * rendered here.
 */

export interface AnnouncementsPanelProps {
  announcements: DashboardAnnouncement[];
}

export const AnnouncementsPanel: React.FC<AnnouncementsPanelProps> = ({ announcements }) => {
  const { t } = useTranslation();

  if (announcements.length === 0) return null;

  return (
    <Stack spacing={2} component="section" aria-label={t('announcements.heading')}>
      <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
        {t('announcements.heading')}
      </Typography>
      {announcements.map((announcement) => (
        <AnnouncementCard key={announcement.id} announcement={announcement} />
      ))}
    </Stack>
  );
};

export default AnnouncementsPanel;
