import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useApi, SortableTableCell, useTableSort } from '@aws-web-framework/orgadmin-core';
import { useTranslation, formatDateTime, useLocale } from '@aws-web-framework/orgadmin-shell';
import { Announcement, AnnouncementState, announcementState } from '../types/announcement.types';

/** One array, so a page that has not loaded yet does not re-sort every render. */
const NONE: Announcement[] = [];

/**
 * Every notice a club has written, and whether it is showing.
 *
 * Finished ones stay on the list. It is a record as well as a working screen —
 * "what did we tell members about the AGM last year" has nowhere else to be
 * asked — and an announcement that vanishes when its window closes would leave
 * a club unable to reuse the wording.
 */

export const stateColour = (state: AnnouncementState): 'success' | 'info' | 'default' => {
  switch (state) {
    case 'showing':
      return 'success';
    case 'scheduled':
      return 'info';
    default:
      return 'default';
  }
};

const AnnouncementsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { execute } = useApi();
  const { t } = useTranslation();
  const { locale } = useLocale();

  const [announcements, setAnnouncements] = useState<Announcement[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState<Announcement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const response = await execute({ method: 'GET', url: '/api/orgadmin/announcements' });
      if (!response) {
        setFailed(true);
        setAnnouncements([]);
        return;
      }
      setAnnouncements(response.announcements ?? []);
    } catch (error) {
      console.error('Failed to load announcements:', error);
      setFailed(true);
      setAnnouncements([]);
    } finally {
      setLoading(false);
    }
  }, [execute]);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await execute({ method: 'DELETE', url: `/api/orgadmin/announcements/${deleting.id}` });
    } catch (error) {
      console.error('Failed to remove the announcement:', error);
    } finally {
      setDeleting(null);
      void load();
    }
  };

  /*
   * Both ends, with their times. An announcement's window is often a matter of
   * hours — a closure on Saturday goes up on Friday evening — so a date alone
   * would leave a club unable to tell the notice they scheduled for this
   * morning from the one going up tonight.
   */
  const when = (announcement: Announcement) =>
    `${formatDateTime(announcement.startsAt, locale)} – ${formatDateTime(announcement.endsAt, locale)}`;

  /*
   * Sorted by when the notice starts showing, which is what the column reads
   * as — the cell holds a window and a state chip, neither of which orders.
   */
  const sort = useTableSort(announcements ?? NONE);

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}
      >
        <Box>
          <Typography variant="h4">{t('announcements.title')}</Typography>
          <Typography variant="body2" color="textSecondary">
            {t('announcements.subtitle')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/announcements/new')}
        >
          {t('announcements.actions.create')}
        </Button>
      </Box>

      {failed && (
        <Alert severity="error" sx={{ my: 2 }}>
          {t('announcements.loadFailed')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : announcements && announcements.length === 0 ? (
        /*
         * Said in full rather than as "No announcements". A club that has never
         * written one cannot tell from an empty table whether members are
         * seeing nothing or whether the screen failed.
         */
        <Paper sx={{ p: 4, mt: 2, textAlign: 'center' }}>
          <Typography variant="body1">{t('announcements.empty')}</Typography>
        </Paper>
      ) : (
        <Paper sx={{ mt: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                <SortableTableCell sort={sort} field="title">
                  {t('announcements.table.title')}
                </SortableTableCell>
                <SortableTableCell sort={sort} field="startsAt">
                  {t('announcements.table.showing')}
                </SortableTableCell>
                <SortableTableCell sort={sort} field="imagePlacement">
                  {t('announcements.table.image')}
                </SortableTableCell>
                <TableCell align="right">{t('announcements.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sort.rows.map((announcement) => {
                const state = announcementState(announcement);
                return (
                  <TableRow key={announcement.id} hover>
                    <TableCell>{announcement.title}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t(`announcements.states.${state}`)}
                        color={stateColour(state)}
                      />
                      {/* The window under the state, because "showing now"
                          immediately begs the question "until when". */}
                      <Typography variant="caption" display="block" color="textSecondary">
                        {when(announcement)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {announcement.imagePlacement
                        ? t(`announcements.placements.${announcement.imagePlacement}`)
                        : '—'}
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('announcements.actions.edit')}>
                        <IconButton
                          size="small"
                          aria-label={t('announcements.actions.edit')}
                          onClick={() => navigate(`/announcements/${announcement.id}/edit`)}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('announcements.actions.delete')}>
                        <IconButton
                          size="small"
                          aria-label={t('announcements.actions.delete')}
                          onClick={() => setDeleting(announcement)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Paper>
      )}

      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)}>
        <DialogTitle>{t('announcements.delete.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('announcements.delete.message', { title: deleting?.title ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleting(null)}>{t('common.actions.cancel')}</Button>
          <Button color="error" variant="contained" onClick={confirmDelete}>
            {t('announcements.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AnnouncementsListPage;
