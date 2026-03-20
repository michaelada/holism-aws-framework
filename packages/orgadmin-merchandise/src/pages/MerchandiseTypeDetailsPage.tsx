/**
 * Merchandise Type Details Page
 * 
 * Displays all merchandise type attributes including images, options, stock, delivery, and payment configuration.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation, formatCurrency } from '@aws-web-framework/orgadmin-shell';
import { useApi } from '@aws-web-framework/orgadmin-core';
import type { MerchandiseType } from '../types/merchandise.types';

const MerchandiseTypeDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const { execute } = useApi();
  const [merchandiseType, setMerchandiseType] = useState<MerchandiseType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadMerchandiseType();
  }, [id]);

  const loadMerchandiseType = async () => {
    try {
      setLoading(true);
      setError(null);
      setNotFound(false);
      const response = await execute({
        method: 'GET',
        url: `/api/orgadmin/merchandise-types/${id}`,
      });
      if (response) {
        setMerchandiseType(response as MerchandiseType);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Failed to load merchandise type:', err);
      setError(t('merchandise.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/merchandise/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      await execute({
        method: 'DELETE',
        url: `/api/orgadmin/merchandise-types/${id}`,
      });
      navigate('/merchandise');
    } catch (err) {
      console.error('Failed to delete merchandise type:', err);
      setError(t('merchandise.errors.deleteFailed'));
    }
    setDeleteDialogOpen(false);
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common.messages.loading')}</Typography>
      </Box>
    );
  }

  if (notFound || !merchandiseType) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('merchandise.typeNotFound')}</Typography>
      </Box>
    );
  }

  const renderDeliveryConfig = () => {
    if (merchandiseType.deliveryType === 'free') {
      return <Typography variant="body2">{t('merchandise.delivery.free')}</Typography>;
    }
    if (merchandiseType.deliveryType === 'fixed') {
      return (
        <Typography variant="body2">
          {t('merchandise.delivery.fixed')}: {formatCurrency(merchandiseType.deliveryFee ?? 0, 'EUR', i18n.language)}
        </Typography>
      );
    }
    // quantity_based
    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 1 }}>{t('merchandise.delivery.quantityBased')}</Typography>
        {(merchandiseType.deliveryRules || []).map((rule, index) => (
          <Typography key={rule.id || index} variant="body2" color="text.secondary">
            {rule.minQuantity}–{rule.maxQuantity ?? '∞'}: {formatCurrency(rule.deliveryFee, 'EUR', i18n.language)}
          </Typography>
        ))}
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">{merchandiseType.name}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button startIcon={<EditIcon />} onClick={handleEdit}>
            {t('common.actions.edit')}
          </Button>
          <Button
            startIcon={<DeleteIcon />}
            color="error"
            onClick={() => setDeleteDialogOpen(true)}
          >
            {t('common.actions.delete')}
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {/* Left column */}
        <Grid item xs={12} md={8}>
          {/* Basic Info */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.basicInfo')}</Typography>
              <Typography variant="body2" color="text.secondary" paragraph>
                {merchandiseType.description}
              </Typography>
              <Chip
                label={merchandiseType.status}
                color={merchandiseType.status === 'active' ? 'success' : 'default'}
              />
            </CardContent>
          </Card>

          {/* Images Gallery */}
          {merchandiseType.images && merchandiseType.images.length > 0 && (
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.images')}</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {((merchandiseType as any).imageUrls || merchandiseType.images).map((image: string, index: number) => (
                    <Box
                      key={index}
                      component="img"
                      src={image}
                      alt={`${merchandiseType.name} ${index + 1}`}
                      sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Options and Pricing */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.optionsAndPricing')}</Typography>
              {merchandiseType.optionTypes.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  {t('merchandise.options.noOptions')}
                </Typography>
              ) : (
                merchandiseType.optionTypes.map((optionType) => (
                  <Box key={optionType.id} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight="medium">
                      {optionType.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                      {optionType.optionValues.map((value) => (
                        <Chip
                          key={value.id}
                          label={`${value.name} - ${formatCurrency(value.price, 'EUR', i18n.language)}`}
                          variant="outlined"
                        />
                      ))}
                    </Box>
                  </Box>
                ))
              )}
            </CardContent>
          </Card>

          {/* Delivery Configuration */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.delivery')}</Typography>
              {renderDeliveryConfig()}
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid item xs={12} md={4}>
          {/* Stock Status */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.stockStatus')}</Typography>
              {merchandiseType.trackStockLevels ? (
                <Box>
                  <Typography variant="body2">
                    {t('merchandise.stock.tracking')}: {t('common.enabled')}
                  </Typography>
                  {merchandiseType.lowStockAlert != null && (
                    <Typography variant="body2" color="text.secondary">
                      {t('merchandise.stock.lowStockThreshold')}: {merchandiseType.lowStockAlert}
                    </Typography>
                  )}
                  {merchandiseType.outOfStockBehavior && (
                    <Typography variant="body2" color="text.secondary">
                      {t('merchandise.stock.outOfStockBehavior')}: {merchandiseType.outOfStockBehavior}
                    </Typography>
                  )}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('merchandise.stock.notTracked')}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Quantity Rules */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.quantityRules')}</Typography>
              <Typography variant="body2">
                {t('merchandise.quantity.min')}: {merchandiseType.minOrderQuantity ?? 1}
              </Typography>
              {merchandiseType.maxOrderQuantity != null && (
                <Typography variant="body2">
                  {t('merchandise.quantity.max')}: {merchandiseType.maxOrderQuantity}
                </Typography>
              )}
              {merchandiseType.quantityIncrements != null && merchandiseType.quantityIncrements > 1 && (
                <Typography variant="body2">
                  {t('merchandise.quantity.increment')}: {merchandiseType.quantityIncrements}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Payment Configuration */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.payment')}</Typography>
              {merchandiseType.supportedPaymentMethods.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                  {merchandiseType.supportedPaymentMethods.map((method) => (
                    <Chip key={method} label={method} size="small" variant="outlined" />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('merchandise.payment.noMethods')}
                </Typography>
              )}
              {merchandiseType.handlingFeeIncluded && (
                <Typography variant="body2" color="text.secondary">
                  {t('merchandise.payment.handlingFeeIncluded')}
                </Typography>
              )}
              {merchandiseType.useTermsAndConditions && (
                <Typography variant="body2" color="text.secondary">
                  {t('merchandise.payment.termsEnabled')}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Email Configuration */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.emailConfig')}</Typography>
              {merchandiseType.adminNotificationEmails ? (
                <Typography variant="body2">
                  {t('merchandise.email.notificationEmails')}: {merchandiseType.adminNotificationEmails}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  {t('merchandise.email.noNotificationEmails')}
                </Typography>
              )}
              {merchandiseType.customConfirmationMessage && (
                <Typography variant="body2" sx={{ mt: 1 }}>
                  {t('merchandise.email.confirmationMessage')}: {merchandiseType.customConfirmationMessage}
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Order Statistics */}
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.orderStatistics')}</Typography>
              <Typography variant="body2" color="text.secondary">
                {t('merchandise.orders.totalOrders', { count: 0 })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('merchandise.orders.totalRevenue', { amount: '0.00' })}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>{t('merchandise.delete.title')}</DialogTitle>
        <DialogContent>
          {t('merchandise.delete.message')}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>{t('common.actions.cancel')}</Button>
          <Button onClick={handleDelete} color="error">
            {t('common.actions.delete')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MerchandiseTypeDetailsPage;
