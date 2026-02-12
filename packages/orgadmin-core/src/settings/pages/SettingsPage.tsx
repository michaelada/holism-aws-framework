/**
 * Settings Page
 * 
 * Main settings page with tabs for different settings sections:
 * - Organisation Details
 * - Payment Settings
 * - Email Templates
 * - Branding
 */

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import {
  Business as BusinessIcon,
  Payment as PaymentIcon,
  Email as EmailIcon,
  Palette as BrandingIcon,
} from '@mui/icons-material';
import OrganisationDetailsTab from '../components/OrganisationDetailsTab';
import PaymentSettingsTab from '../components/PaymentSettingsTab';
import EmailTemplatesTab from '../components/EmailTemplatesTab';
import BrandingTab from '../components/BrandingTab';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const [currentTab, setCurrentTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setCurrentTab(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Organisation Settings
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        Manage your organisation's configuration and preferences
      </Typography>

      <Card>
        <CardContent>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            aria-label="settings tabs"
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab
              icon={<BusinessIcon />}
              iconPosition="start"
              label="Organisation Details"
              id="settings-tab-0"
              aria-controls="settings-tabpanel-0"
            />
            <Tab
              icon={<PaymentIcon />}
              iconPosition="start"
              label="Payment Settings"
              id="settings-tab-1"
              aria-controls="settings-tabpanel-1"
            />
            <Tab
              icon={<EmailIcon />}
              iconPosition="start"
              label="Email Templates"
              id="settings-tab-2"
              aria-controls="settings-tabpanel-2"
            />
            <Tab
              icon={<BrandingIcon />}
              iconPosition="start"
              label="Branding"
              id="settings-tab-3"
              aria-controls="settings-tabpanel-3"
            />
          </Tabs>

          <TabPanel value={currentTab} index={0}>
            <OrganisationDetailsTab />
          </TabPanel>

          <TabPanel value={currentTab} index={1}>
            <PaymentSettingsTab />
          </TabPanel>

          <TabPanel value={currentTab} index={2}>
            <EmailTemplatesTab />
          </TabPanel>

          <TabPanel value={currentTab} index={3}>
            <BrandingTab />
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
