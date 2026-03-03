/**
 * Membership Type Details Page
 * 
 * Displays all membership type attributes
 * Shows field configuration for group memberships
 * Shows person titles and labels for group memberships
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  // Divider,
  Grid,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as BackIcon,
} from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { formatDate } from '../../../orgadmin-shell/src/utils/dateFormatting';
import { useDiscountService } from '../../../orgadmin-events/src/hooks/useDiscountService';
import type { MembershipType } from '../types/membership.types';
import type { Discount } from '../../../backend/src/types/discount.types';

// Mock API hook - will be replaced with actual implementation
const useApi = () => ({
  execute: async ({ method, url }: { method: string; url: string }) => {
    console.log('API call:', method, url);
    return null;
  },
});

const MembershipTypeDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { execute } = useApi();
  const { t, i18n } = useTranslation();
  const discountService = useDiscountService();

  const [membershipType, setMembershipType] = useState<MembershipType | null>(null);
  const [discounts, setDiscounts] = useState<(Discount | null)[]>([]);
  const [discountsLoading, setDiscountsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadMembershipType(id);
    }
  }, [id]);

  useEffect(() => {
    if (membershipType?.discountIds && membershipType.discountIds.length > 0) {
      loadDiscounts(membershipType.discountIds, membershipType.organisationId);
    } else {
      setDiscounts([]);
    }
  }, [membershipType?.discountIds]);

  const loadDiscounts = async (discountIds: string[], organisationId: string) => {
    try {
      setDiscountsLoading(true);
      const discountPromises = discountIds.map(async (discountId) => {
        try {
          return await discountService.getDiscountById(discountId, organisationId);
        } catch (error) {
          console.error(`Failed to load discount ${discountId}:`, error);
          return null;
        }
      });
      const loadedDiscounts = await Promise.all(discountPromises);
      setDiscounts(loadedDiscounts);
    } catch (error) {
      console.error('Failed to load discounts:', error);
    } finally {
      setDiscountsLoading(false);
    }
  };

  const loadMembershipType = async (typeId: string) => {
    try {
      setLoading(true);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/membership-types/${typeId}`,
      });
      setMembershipType(response);
    } catch (error) {
      console.error('Failed to load membership type:', error);
      setError(t('memberships.failedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/orgadmin/members/types/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/membership-types/${id}`,
      });
      navigate('/members/types');
    } catch (error) {
      console.error('Failed to delete membership type:', error);
      setError(t('memberships.failedToDelete'));
    }
    setDeleteDialogOpen(false);
  };

  const handleBack = () => {
    navigate('/members/types');
  };

  const formatDiscountValue = (discount: Discount) => {
    if (discount.discountType === 'percentage') {
      return `${discount.discountValue}%`;
    }
    return `£${discount.discountValue.toFixed(2)}`;
  };

  const getDiscountTypeLabel = (discountType: string) => {
    return discountType === 'percentage' 
      ? t('discounts.types.percentage') 
      : t('discounts.types.fixed');
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('memberships.loadingType')}</Typography>
      </Box>
    );
  }

  if (error || !membershipType) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error || t('memberships.typeNotFound')}</Alert>
        <Button onClick={handleBack} sx={{ mt: 2 }}>
          {t('memberships.details.backToTypes')}
        </Button>
      </Box>
    );
  }

  const isGroupMembership = membershipType.membershipTypeCategory === 'group';

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
          <Typography variant="h4">{membershipType.name}</Typography>
          <Chip
            label={t(`memberships.statusOptions.${membershipType.membershipStatus}`)}
            color={membershipType.membershipStatus === 'open' ? 'success' : 'default'}
          />
          <Chip
            label={isGroupMembership ? t('memberships.typeOptions.group') : t('memberships.typeOptions.single')}
            variant="outlined"
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={handleEdit}
          >
            {t('common.actions.edit')}
          </Button>
          <Button
            variant="outlined"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t('common.actions.delete')}
          </Button>
        </Box>
      </Box>

      {/* Basic Information */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('memberships.sections.basicInfo')}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('memberships.fields.description')}
              </Typography>
              <Typography variant="body1">
                {membershipType.description}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('memberships.fields.membershipForm')}
              </Typography>
              <Typography variant="body1">
                {membershipType.membershipFormId}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('memberships.fields.status')}
              </Typography>
              <Typography variant="body1">
                {t(`memberships.statusOptions.${membershipType.membershipStatus}Accepting`)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Associated Discounts */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('memberships.sections.discounts')}
          </Typography>
          {discountsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : !membershipType.discountIds || membershipType.discountIds.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t('memberships.discounts.noDiscounts')}
            </Typography>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('memberships.discounts.name')}</TableCell>
                    <TableCell>{t('memberships.discounts.type')}</TableCell>
                    <TableCell>{t('memberships.discounts.value')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {membershipType.discountIds.map((discountId, index) => {
                    const discount = discounts[index];
                    if (!discount) {
                      return (
                        <TableRow key={discountId}>
                          <TableCell colSpan={3}>
                            <Typography variant="body2" color="error">
                              {t('memberships.discounts.notFound')}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    return (
                      <TableRow key={discountId}>
                        <TableCell>
                          <Typography variant="body2">{discount.name}</Typography>
                          {discount.description && (
                            <Typography variant="caption" color="text.secondary">
                              {discount.description}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={getDiscountTypeLabel(discount.discountType)}
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {formatDiscountValue(discount)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Group Configuration */}
      {isGroupMembership && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('memberships.sections.groupConfig')}
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('memberships.fields.maxPeople')}
                </Typography>
                <Typography variant="body1">
                  {membershipType.maxPeopleInApplication}
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  {t('memberships.fields.minPeople')}
                </Typography>
                <Typography variant="body1">
                  {membershipType.minPeopleInApplication}
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Person Configuration */}
      {isGroupMembership && membershipType.personTitles && membershipType.personTitles.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('memberships.sections.personConfig')}
            </Typography>
            <Grid container spacing={2}>
              {membershipType.personTitles.map((title, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="subtitle2" gutterBottom>
                        {t('memberships.personConfig.person', { number: index + 1 })}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {t('memberships.fields.title')}: {title || '(Not set)'}
                      </Typography>
                      {membershipType.personLabels && membershipType.personLabels[index] && (
                        <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {membershipType.personLabels[index].map((label) => (
                            <Chip key={label} label={label} size="small" />
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* Field Configuration */}
      {isGroupMembership && membershipType.fieldConfiguration && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('memberships.sections.fieldConfig')}
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('memberships.fields.fieldName')}</TableCell>
                    <TableCell>{t('memberships.fields.configuration')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {Object.entries(membershipType.fieldConfiguration).map(([fieldId, config]) => (
                    <TableRow key={fieldId}>
                      <TableCell>{fieldId}</TableCell>
                      <TableCell>
                        <Chip
                          label={t(`memberships.fieldConfig.${config === 'common' ? 'commonToAll' : 'uniqueForEach'}`)}
                          size="small"
                          color={config === 'common' ? 'primary' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Membership Duration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('memberships.sections.duration')}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('memberships.duration.type')}
              </Typography>
              <Typography variant="body1">
                {t(`memberships.duration.${membershipType.isRollingMembership ? 'rolling' : 'fixedPeriod'}`)}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                {membershipType.isRollingMembership ? t('memberships.duration.duration') : t('memberships.fields.validUntil')}
              </Typography>
              <Typography variant="body1">
                {membershipType.isRollingMembership
                  ? t('memberships.duration.months', { count: membershipType.numberOfMonths })
                  : membershipType.validUntil ? formatDate(membershipType.validUntil, 'dd MMM yyyy', i18n.language) : t('memberships.duration.notSet')}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Application Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('memberships.sections.applicationSettings')}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('memberships.fields.automaticallyApprove')}
              </Typography>
              <Typography variant="body1">
                {t(`memberships.approval.${membershipType.automaticallyApprove ? 'yes' : 'no'}`)}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('memberships.fields.memberLabels')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {membershipType.memberLabels.length > 0 ? (
                  membershipType.memberLabels.map((label) => (
                    <Chip key={label} label={label} size="small" />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    {t('memberships.labels.noLabels')}
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            {t('memberships.sections.paymentSettings')}
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                {t('memberships.fields.supportedPaymentMethods')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
                {membershipType.supportedPaymentMethods.map((methodId) => (
                  <Chip key={methodId} label={methodId} size="small" />
                ))}
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Terms and Conditions */}
      {membershipType.useTermsAndConditions && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              {t('memberships.sections.termsAndConditions')}
            </Typography>
            <Box
              sx={{ mt: 2 }}
              dangerouslySetInnerHTML={{ __html: membershipType.termsAndConditions || '' }}
            />
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('memberships.delete.title')}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t('memberships.delete.message', { name: membershipType.name })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.actions.cancel')}</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            {t('common.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MembershipTypeDetailsPage;
