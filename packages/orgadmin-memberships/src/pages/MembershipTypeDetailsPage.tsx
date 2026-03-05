/**
 * Membership Type Details Page
 * 
 * Displays detailed information about a specific membership type
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { useApi } from '@aws-web-framework/orgadmin-core';
import type { MembershipType } from '../types/membership.types';

const MembershipTypeDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t } = useTranslation();
  
  const [membershipType, setMembershipType] = useState<MembershipType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMembershipType();
  }, [id]);

  const loadMembershipType = async () => {
    if (!id) {
      setError(t('memberships.typeNotFound'));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/membership-types/${id}`,
      });
      setMembershipType(response);
    } catch (err) {
      console.error('Failed to load membership type:', err);
      setError(t('memberships.typeNotFound'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/members/types');
  };

  const handleEdit = () => {
    if (membershipType) {
      const category = membershipType.membershipTypeCategory === 'single' ? 'single' : 'group';
      navigate(`/members/types/${id}/edit/${category}`);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error || !membershipType) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || t('memberships.typeNotFound')}
        </Alert>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={handleBack}
        >
          {t('memberships.details.backToTypes')}
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
          >
            {t('memberships.details.backToTypes')}
          </Button>
          <Typography variant="h4">{membershipType.name}</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={handleEdit}
        >
          {t('common.actions.edit')}
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('memberships.sections.basicInfo')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.fields.name')}
                  </Typography>
                  <Typography variant="body1">{membershipType.name}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.table.status')}
                  </Typography>
                  <Chip
                    label={membershipType.membershipStatus}
                    color={membershipType.membershipStatus === 'open' ? 'success' : 'default'}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.fields.description')}
                  </Typography>
                  <Typography variant="body1">{membershipType.description}</Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.table.type')}
                  </Typography>
                  <Chip
                    label={membershipType.membershipTypeCategory === 'single' ? t('memberships.typeOptions.single') : t('memberships.typeOptions.group')}
                    variant="outlined"
                    size="small"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('memberships.sections.duration')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.duration.type')}
                  </Typography>
                  <Typography variant="body1">
                    {membershipType.isRollingMembership
                      ? t('memberships.duration.rolling')
                      : t('memberships.duration.fixedPeriod')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.duration.duration')}
                  </Typography>
                  <Typography variant="body1">
                    {membershipType.isRollingMembership
                      ? t('memberships.duration.months', { count: membershipType.numberOfMonths || 0 })
                      : membershipType.validUntil
                      ? new Date(membershipType.validUntil).toLocaleDateString()
                      : t('memberships.duration.notSet')}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                {t('memberships.sections.applicationSettings')}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.fields.automaticallyApprove')}
                  </Typography>
                  <Typography variant="body1">
                    {membershipType.automaticallyApprove
                      ? t('memberships.approval.yes')
                      : t('memberships.approval.no')}
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {membershipType.memberLabels && membershipType.memberLabels.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('memberships.fields.memberLabels')}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {membershipType.memberLabels.map((label, index) => (
                    <Chip key={index} label={label} size="small" />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {membershipType.discountIds && membershipType.discountIds.length > 0 && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('memberships.table.discounts')}
                </Typography>
                <Typography variant="body1">
                  {t('memberships.table.discounts')}: {membershipType.discountIds.length}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {membershipType.useTermsAndConditions && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('memberships.sections.termsAndConditions')}
                </Typography>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                  {membershipType.termsAndConditions || t('memberships.labels.noLabels')}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default MembershipTypeDetailsPage;
