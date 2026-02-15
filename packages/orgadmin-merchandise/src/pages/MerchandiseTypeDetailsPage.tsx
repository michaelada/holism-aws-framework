/**
 * Merchandise Type Details Page
 * 
 * Displays all merchandise type attributes including images, options, stock, delivery, and payment configuration.
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useTranslation, formatCurrency } from '@aws-web-framework/orgadmin-shell';
import type { MerchandiseType } from '../types/merchandise.types';

const MerchandiseTypeDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t } = useTranslation();
  const [merchandiseType, setMerchandiseType] = useState<MerchandiseType | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadMerchandiseType();
  }, [id]);

  const loadMerchandiseType = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call
      setMerchandiseType(null);
    } catch (error) {
      console.error('Failed to load merchandise type:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/orgadmin/merchandise/${id}/edit`);
  };

  const handleDelete = async () => {
    try {
      // TODO: Implement API call
      navigate('/merchandise');
    } catch (error) {
      console.error('Failed to delete merchandise type:', error);
    }
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('common.messages.loading')}</Typography>
      </Box>
    );
  }

  if (!merchandiseType) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>{t('merchandise.typeNotFound')}</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
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
        <Grid item xs={12} md={8}>
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

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>{t('merchandise.sections.optionsAndPricing')}</Typography>
              {merchandiseType.optionTypes.map((optionType) => (
                <Box key={optionType.id} sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" fontWeight="medium">
                    {optionType.name}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {optionType.optionValues.map((value) => (
                      <Chip
                        key={value.id}
                        label={`${value.name} - ${formatCurrency(value.price, 'EUR')}`}
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
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
