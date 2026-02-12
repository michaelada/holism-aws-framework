/**
 * Merchandise Order Details Page
 * 
 * Displays complete order information with pricing breakdown and status management.
 */

import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  TextField,
  Typography,
} from '@mui/material';
import { Edit as EditIcon, Print as PrintIcon } from '@mui/icons-material';
import OrderStatusUpdateDialog from '../components/OrderStatusUpdateDialog';
import type { MerchandiseOrder, OrderStatus } from '../types/merchandise.types';

const MerchandiseOrderDetailsPage: React.FC = () => {
  const { id } = useParams();
  const [order, setOrder] = useState<MerchandiseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      // TODO: Implement API call
      setOrder(null);
    } catch (error) {
      console.error('Failed to load order:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: OrderStatus, notes?: string, sendEmail?: boolean) => {
    try {
      // TODO: Implement API call
      console.log('Updating status:', { newStatus, notes, sendEmail });
      await loadOrder();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleSaveNotes = async () => {
    try {
      // TODO: Implement API call
      console.log('Saving notes:', adminNotes);
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  if (!order) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography>Order not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Order #{order.id}</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button startIcon={<PrintIcon />} onClick={handlePrint}>
            Print
          </Button>
          <Button
            startIcon={<EditIcon />}
            variant="contained"
            onClick={() => setStatusDialogOpen(true)}
          >
            Update Status
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Order Information</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Order Date:</Typography>
                  <Typography>{new Date(order.orderDate).toLocaleString()}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Customer:</Typography>
                  <Typography>{order.customerName || 'N/A'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Email:</Typography>
                  <Typography>{order.customerEmail || 'N/A'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Order Status:</Typography>
                  <Chip label={order.orderStatus} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Payment Status:</Typography>
                  <Chip label={order.paymentStatus} />
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Order Items</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Merchandise:</Typography>
                  <Typography>{order.merchandiseType?.name || 'N/A'}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Options:</Typography>
                  <Typography>
                    {Object.entries(order.selectedOptions).map(([key, value]) => `${key}: ${value}`).join(', ')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Quantity:</Typography>
                  <Typography>{order.quantity}</Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 2 }} />

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Unit Price:</Typography>
                  <Typography>€{order.unitPrice.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Subtotal:</Typography>
                  <Typography>€{order.subtotal.toFixed(2)}</Typography>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography color="text.secondary">Delivery Fee:</Typography>
                  <Typography>€{order.deliveryFee.toFixed(2)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6">Total:</Typography>
                  <Typography variant="h6">€{order.totalPrice.toFixed(2)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Admin Notes</Typography>
              <TextField
                multiline
                rows={4}
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add notes about this order..."
                fullWidth
                sx={{ mb: 2 }}
              />
              <Button variant="contained" onClick={handleSaveNotes}>
                Save Notes
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Order History</Typography>
              <Typography variant="body2" color="text.secondary">
                No history available
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <OrderStatusUpdateDialog
        open={statusDialogOpen}
        currentStatus={order.orderStatus}
        onClose={() => setStatusDialogOpen(false)}
        onUpdate={handleStatusUpdate}
      />
    </Box>
  );
};

export default MerchandiseOrderDetailsPage;
