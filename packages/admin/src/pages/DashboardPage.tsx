import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  CardContent,
  Typography,
  Grid,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Business as OrganizationIcon,
  Category as TypeIcon,
  Extension as CapabilityIcon,
  People as UsersIcon,
  Payment as PaymentIcon,
} from '@mui/icons-material';
import {
  getOrganizations,
  getOrganizationTypes,
  getCapabilities,
  getPaymentMethods,
} from '../services/organizationApi';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../context/NotificationContext';
import { PageHeader } from '../components/PageHeader';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  /** Where this figure lives. A number you cannot click is a dead end. */
  to?: string;
}

/**
 * One figure on the dashboard.
 *
 * The six cards used to carry six hardcoded MUI stock hues — #1976d2, #9c27b0,
 * #f57c00, #388e3c, #0288d1, #7b1fa2 — none of which was the theme's own
 * colour. Six unrelated hues on the first screen after login, chosen by nobody,
 * and all competing equally for attention.
 *
 * They are neutral now. The figure carries the weight, the icon is quiet, and
 * the only colour on this screen belongs to something actionable.
 */
const StatCard: React.FC<StatCardProps> = ({ title, value, icon, subtitle, to }) => {
  const navigate = useNavigate();

  const body = (
    <CardContent sx={{ height: '100%' }}>
      <Box display="flex" alignItems="flex-start" justifyContent="space-between" mb={1.5}>
        <Box
          sx={{
            color: 'text.secondary',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </Box>
        <Typography variant="h1" component="p" sx={{ lineHeight: 1 }}>
          {value}
        </Typography>
      </Box>
      <Typography variant="h6" component="h3" gutterBottom>
        {title}
      </Typography>
      {subtitle && (
        <Typography variant="body2" color="text.secondary">
          {subtitle}
        </Typography>
      )}
    </CardContent>
  );

  return (
    <Card sx={{ height: '100%' }}>
      {to ? (
        <CardActionArea onClick={() => navigate(to)} sx={{ height: '100%' }}>
          {body}
        </CardActionArea>
      ) : (
        body
      )}
    </Card>
  );
};

export const DashboardPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrganizations: 0,
    activeOrganizations: 0,
    totalOrganizationTypes: 0,
    totalCapabilities: 0,
    totalAdminUsers: 0,
    totalAccountUsers: 0,
    totalPaymentMethods: 0,
  });
  const { showError } = useNotification();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [organizations, organizationTypes, capabilities, paymentMethods] = await Promise.all([
        getOrganizations(),
        getOrganizationTypes(),
        getCapabilities(),
        getPaymentMethods(),
      ]);

      // Calculate statistics
      const activeOrgs = organizations.filter((org) => org.status === 'active').length;
      const totalAdminUsers = organizations.reduce(
        (sum, org) => sum + (org.adminUserCount || 0),
        0
      );
      const totalAccountUsers = organizations.reduce(
        (sum, org) => sum + (org.accountUserCount || 0),
        0
      );

      setStats({
        totalOrganizations: organizations.length,
        activeOrganizations: activeOrgs,
        totalOrganizationTypes: organizationTypes.length,
        totalCapabilities: capabilities.length,
        totalAdminUsers,
        totalAccountUsers,
        totalPaymentMethods: paymentMethods.length,
      });
    } catch (error) {
      showError('Failed to load dashboard data');
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Dashboard" description="The platform at a glance." />

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Organisations"
            value={stats.totalOrganizations}
            icon={<OrganizationIcon />}
            subtitle={`${stats.activeOrganizations} active`}
            to="/organizations"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Organisation Types"
            value={stats.totalOrganizationTypes}
            icon={<TypeIcon />}
            to="/organization-types"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Capabilities"
            value={stats.totalCapabilities}
            icon={<CapabilityIcon />}
            subtitle="Available platform-wide"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Administrators"
            value={stats.totalAdminUsers}
            icon={<UsersIcon />}
            subtitle="Across all organisations"
            to="/users"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Members"
            value={stats.totalAccountUsers}
            icon={<UsersIcon />}
            subtitle="Across all organisations"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Payment Methods"
            value={stats.totalPaymentMethods}
            icon={<PaymentIcon />}
            subtitle="Enabled platform-wide"
          />
        </Grid>
      </Grid>

      {/*
        There used to be a hardcoded `<Chip label="System Operational"
        color="success" />` here. It asserted platform health regardless of
        platform health, on the first screen after login, and nothing in this
        app measures uptime. The figures below are the ones this page can
        actually stand behind.
      */}
      <Box mt={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              Totals
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
              <Chip label={`${stats.totalOrganizations} organisations`} variant="outlined" />
              <Chip
                label={`${stats.activeOrganizations} active, ${
                  stats.totalOrganizations - stats.activeOrganizations
                } not`}
                variant="outlined"
              />
              <Chip
                label={`${stats.totalAdminUsers + stats.totalAccountUsers} people`}
                variant="outlined"
              />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
