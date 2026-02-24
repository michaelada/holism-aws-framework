import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
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
import { useNotification } from '../context/NotificationContext';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, subtitle }) => {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
          <Box
            sx={{
              backgroundColor: `${color}20`,
              borderRadius: '8px',
              padding: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
          <Typography variant="h3" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <Typography variant="h6" color="textSecondary" gutterBottom>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="textSecondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
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
      <Box mb={4}>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Typography variant="body1" color="textSecondary">
          System overview and statistics
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Organizations"
            value={stats.totalOrganizations}
            icon={<OrganizationIcon sx={{ fontSize: 32, color: '#1976d2' }} />}
            color="#1976d2"
            subtitle={`${stats.activeOrganizations} active`}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Organization Types"
            value={stats.totalOrganizationTypes}
            icon={<TypeIcon sx={{ fontSize: 32, color: '#9c27b0' }} />}
            color="#9c27b0"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Capabilities"
            value={stats.totalCapabilities}
            icon={<CapabilityIcon sx={{ fontSize: 32, color: '#f57c00' }} />}
            color="#f57c00"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Admin Users"
            value={stats.totalAdminUsers}
            icon={<UsersIcon sx={{ fontSize: 32, color: '#388e3c' }} />}
            color="#388e3c"
            subtitle="Across all organizations"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Account Users"
            value={stats.totalAccountUsers}
            icon={<UsersIcon sx={{ fontSize: 32, color: '#0288d1' }} />}
            color="#0288d1"
            subtitle="Across all organizations"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <StatCard
            title="Payment Methods"
            value={stats.totalPaymentMethods}
            icon={<PaymentIcon sx={{ fontSize: 32, color: '#7b1fa2' }} />}
            color="#7b1fa2"
          />
        </Grid>
      </Grid>

      <Box mt={4}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              System Status
            </Typography>
            <Box display="flex" gap={1} flexWrap="wrap" mt={2}>
              <Chip label="System Operational" color="success" />
              <Chip label={`${stats.totalOrganizations} Organizations`} variant="outlined" />
              <Chip label={`${stats.totalAdminUsers + stats.totalAccountUsers} Total Users`} variant="outlined" />
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
