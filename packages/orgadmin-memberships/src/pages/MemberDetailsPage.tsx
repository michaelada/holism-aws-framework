/**
 * Member Details Page
 * 
 * Display all member information from application form
 * Show membership type, number, status, dates
 * Display payment status and method
 * Show uploaded files with download links
 * Status change controls and label management
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Switch,
  Typography,
  Alert,
  FormControlLabel,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  // Download as DownloadIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../orgadmin-shell/src/utils/dateFormatting';
import type { Member } from '../types/membership.types';

// Mock API hook
const useApi = () => ({
  execute: async (_params: { method: string; url: string }) => {
    return null;
  },
});

const MemberDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t, i18n } = useTranslation();

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      loadMember(id);
    }
  }, [id]);

  const loadMember = async (memberId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/members/${memberId}`,
      });
      setMember(response);
    } catch (error) {
      console.error('Failed to load member:', error);
      setError(t('memberships.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!member) return;
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/members/${member.id}`,
      });
      setMember({ ...member, status: newStatus as any });
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleProcessedToggle = async () => {
    if (!member) return;
    try {
      await execute({
        method: 'PATCH',
        url: `/api/orgadmin/members/${member.id}`,
      });
      setMember({ ...member, processed: !member.processed });
    } catch (error) {
      console.error('Failed to toggle processed status:', error);
    }
  };

  const handleBack = () => {
    navigate('/members');
  };

  const handleEdit = () => {
    navigate(`/orgadmin/members/${id}/edit`);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('memberships.loadingMember')}</Typography>
      </Box>
    );
  }

  if (error || !member) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || t('memberships.memberNotFound')}</Alert>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          {t('memberships.details.backToMembers')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4">
            {member.firstName} {member.lastName}
          </Typography>
          <Chip label={t(`memberships.memberStatus.${member.status}`)} color={member.status === 'active' ? 'success' : 'default'} />
        </Box>
        <Button variant="outlined" startIcon={<EditIcon />} onClick={handleEdit}>
          {t('common.actions.edit')}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('memberships.sections.membershipInfo')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('memberships.fields.membershipNumber')}
                  </Typography>
                  <Typography variant="body1">{member.membershipNumber}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('memberships.fields.membershipType')}
                  </Typography>
                  <Typography variant="body1">{member.membershipTypeId}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('memberships.fields.dateLastRenewed')}
                  </Typography>
                  <Typography variant="body1">{formatDate(member.dateLastRenewed, 'dd MMM yyyy', i18n.language)}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('memberships.fields.validUntilDate')}
                  </Typography>
                  <Typography variant="body1">{formatDate(member.validUntil, 'dd MMM yyyy', i18n.language)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('memberships.sections.statusManagement')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>{t('memberships.fields.status')}</InputLabel>
                    <Select
                      value={member.status}
                      label={t('memberships.fields.status')}
                      onChange={(e) => handleStatusChange(e.target.value)}
                    >
                      <MenuItem value="pending">{t('memberships.memberStatus.pending')}</MenuItem>
                      <MenuItem value="active">{t('memberships.memberStatus.active')}</MenuItem>
                      <MenuItem value="elapsed">{t('memberships.memberStatus.elapsed')}</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={member.processed}
                        onChange={handleProcessedToggle}
                      />
                    }
                    label={t('memberships.fields.processed')}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('memberships.table.labels')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {member.labels.length > 0 ? (
                  member.labels.map((label) => (
                    <Chip key={label} label={label} />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.labels.noLabelsAssigned')}
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('memberships.table.paymentStatus')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('memberships.table.paymentStatus')}
                  </Typography>
                  <Chip
                    label={t(`memberships.paymentStatus.${member.paymentStatus}`)}
                    color={member.paymentStatus === 'paid' ? 'success' : 'default'}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('memberships.table.paymentMethod')}
                  </Typography>
                  <Typography variant="body1">{member.paymentMethod || t('memberships.paymentStatus.notSpecified')}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default MemberDetailsPage;
