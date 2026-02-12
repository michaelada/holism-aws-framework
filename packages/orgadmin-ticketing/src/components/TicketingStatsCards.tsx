/**
 * Ticketing Stats Cards
 * 
 * Displays summary statistics for ticketing dashboard
 */

import React, { useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  LinearProgress,
} from '@mui/material';
import {
  ConfirmationNumber as TicketIcon,
  CheckCircle as ScannedIcon,
  RadioButtonUnchecked as NotScannedIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';
import { format } from 'date-fns';
import type { ElectronicTicket } from '../types/ticketing.types';

interface TicketingStatsCardsProps {
  tickets: ElectronicTicket[];
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  color: string;
  progress?: number;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  color,
  progress,
}) => {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="body2" color="textSecondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                {subtitle}
              </Typography>
            )}
            {progress !== undefined && (
              <Box sx={{ mt: 2 }}>
                <LinearProgress
                  variant="determinate"
                  value={progress}
                  sx={{
                    height: 8,
                    borderRadius: 4,
                    bgcolor: 'grey.200',
                    '& .MuiLinearProgress-bar': {
                      bgcolor: color,
                    },
                  }}
                />
              </Box>
            )}
          </Box>
          <Box
            sx={{
              bgcolor: `${color}20`,
              borderRadius: 2,
              p: 1.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

const TicketingStatsCards: React.FC<TicketingStatsCardsProps> = ({ tickets }) => {
  const stats = useMemo(() => {
    const totalIssued = tickets.length;
    const scanned = tickets.filter(t => t.scanStatus === 'scanned').length;
    const notScanned = tickets.filter(t => t.scanStatus === 'not_scanned').length;
    const scanPercentage = totalIssued > 0 ? Math.round((scanned / totalIssued) * 100) : 0;
    
    // Find most recent scan
    const scannedTickets = tickets.filter(t => t.scanDate);
    const lastScan = scannedTickets.length > 0
      ? scannedTickets.reduce((latest, ticket) => {
          const ticketDate = new Date(ticket.scanDate!);
          return ticketDate > latest ? ticketDate : latest;
        }, new Date(scannedTickets[0].scanDate!))
      : null;

    return {
      totalIssued,
      scanned,
      notScanned,
      scanPercentage,
      lastScan,
    };
  }, [tickets]);

  return (
    <Box sx={{ mb: 3 }}>
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Tickets Issued"
            value={stats.totalIssued}
            icon={<TicketIcon sx={{ fontSize: 32, color: '#1976d2' }} />}
            color="#1976d2"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tickets Scanned"
            value={stats.scanned}
            subtitle={`${stats.scanPercentage}% of total`}
            icon={<ScannedIcon sx={{ fontSize: 32, color: '#2e7d32' }} />}
            color="#2e7d32"
            progress={stats.scanPercentage}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Tickets Not Scanned"
            value={stats.notScanned}
            subtitle={`${100 - stats.scanPercentage}% of total`}
            icon={<NotScannedIcon sx={{ fontSize: 32, color: '#ed6c02' }} />}
            color="#ed6c02"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Last Scan Time"
            value={stats.lastScan ? format(stats.lastScan, 'HH:mm') : 'N/A'}
            subtitle={stats.lastScan ? format(stats.lastScan, 'MMM dd, yyyy') : 'No scans yet'}
            icon={<TimeIcon sx={{ fontSize: 32, color: '#9c27b0' }} />}
            color="#9c27b0"
          />
        </Grid>
      </Grid>
    </Box>
  );
};

export default TicketingStatsCards;
