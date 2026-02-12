/**
 * Dashboard Page
 * 
 * Displays high-level metrics and overview for the organisation
 * Shows: events, members, revenue, payments
 */

import React, { useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Alert,
  Skeleton,
} from '@mui/material';
import {
  Event as EventIcon,
  People as PeopleIcon,
  AttachMoney as MoneyIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import { useApiGet } from '../../hooks/useApi';

/**
 * Dashboard metrics data structure
 */
interface DashboardMetrics {
  events: {
    total: number;
    upcoming: number;
    active: number;
  };
  members: {
    total: number;
    active: number;
    expiringSoon: number;
  };
  revenue: {
    total: number;
    thisMonth: number;
    lastMonth: number;
  };
  payments: {
    total: number;
    pending: number;
    completed: number;
  };
}

/**
 * Metric card component
 */
interface MetricCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  loading?: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  loading = false,
}) => {
  return (
    <Card
      sx={{
        height: '100%',
        background: `linear-gradient(135deg, ${color}15 0%, ${color}05 100%)`,
        border: `1px solid ${color}30`,
      }}
    >
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Typography variant="h6" color="textSecondary" gutterBottom>
            {title}
          </Typography>
          <Box
            sx={{
              bgcolor: `${color}20`,
              borderRadius: '50%',
              p: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>

        {loading ? (
          <Skeleton variant="text" width="60%" height={48} />
        ) : (
          <Typography variant="h3" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
            {value}
          </Typography>
        )}

        {subtitle && !loading && (
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Dashboard Page Component
 */
const DashboardPage: React.FC = () => {
  const { data, error, loading, execute } = useApiGet<DashboardMetrics>(
    '/api/orgadmin/reports/dashboard'
  );

  // Fetch dashboard metrics on mount
  useEffect(() => {
    execute();
  }, [execute]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IE', {
      style: 'currency',
      currency: 'EUR',
    }).format(amount);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
        Dashboard
      </Typography>

      <Typography variant="body1" color="textSecondary" paragraph>
        Overview of your organisation's key metrics
      </Typography>

      {/* Error state */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Loading state - show skeleton cards */}
      {loading && !data && (
        <Grid container spacing={3}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={12} sm={6} md={3} key={i}>
              <Card>
                <CardContent>
                  <Skeleton variant="text" width="60%" height={32} />
                  <Skeleton variant="text" width="80%" height={48} sx={{ mt: 2 }} />
                  <Skeleton variant="text" width="50%" height={24} />
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Metrics grid */}
      {!loading && data && (
        <Grid container spacing={3}>
          {/* Events metric */}
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Events"
              value={data.events.total}
              subtitle={`${data.events.upcoming} upcoming, ${data.events.active} active`}
              icon={<EventIcon sx={{ color: '#1976d2', fontSize: 32 }} />}
              color="#1976d2"
            />
          </Grid>

          {/* Members metric */}
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Members"
              value={data.members.total}
              subtitle={`${data.members.active} active, ${data.members.expiringSoon} expiring soon`}
              icon={<PeopleIcon sx={{ color: '#2e7d32', fontSize: 32 }} />}
              color="#2e7d32"
            />
          </Grid>

          {/* Revenue metric */}
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Revenue"
              value={formatCurrency(data.revenue.total)}
              subtitle={`${formatCurrency(data.revenue.thisMonth)} this month`}
              icon={<MoneyIcon sx={{ color: '#ed6c02', fontSize: 32 }} />}
              color="#ed6c02"
            />
          </Grid>

          {/* Payments metric */}
          <Grid item xs={12} sm={6} md={3}>
            <MetricCard
              title="Payments"
              value={data.payments.total}
              subtitle={`${data.payments.pending} pending, ${data.payments.completed} completed`}
              icon={<PaymentIcon sx={{ color: '#9c27b0', fontSize: 32 }} />}
              color="#9c27b0"
            />
          </Grid>
        </Grid>
      )}

      {/* Empty state - no data available */}
      {!loading && !error && !data && (
        <Alert severity="info" sx={{ mt: 3 }}>
          No dashboard data available. Please check back later.
        </Alert>
      )}
    </Box>
  );
};

export default DashboardPage;
