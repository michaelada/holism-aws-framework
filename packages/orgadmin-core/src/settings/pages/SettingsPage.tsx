/**
 * Settings Page
 * 
 * Main settings page with tabs for different settings sections:
 * - Organisation Details
 * - Payment Settings
 * - Email Templates
 * - Branding
 */

import React from 'react';
import { useSearchParams } from 'react-router-dom';
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
  HowToReg as HowToRegIcon,
} from '@mui/icons-material';
import { useOnboarding, usePageHelp, useTranslation } from '@itsplainsailing/orgadmin-shell';
import OrganisationDetailsTab from '../components/OrganisationDetailsTab';
import PaymentSettingsTab from '../components/PaymentSettingsTab';
import EmailTemplatesTab from '../components/EmailTemplatesTab';
import BrandingTab from '../components/BrandingTab';
import RegistrationSettingsTab from '../components/RegistrationSettingsTab';

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

/**
 * The tab, in the order the strip renders it, addressable as `?tab=<slug>`.
 *
 * Slugs rather than indices: `?tab=payments` survives a tab being inserted
 * ahead of it, and it is a link somebody can read.
 */
const TAB_SLUGS = ['organisation', 'payments', 'email', 'branding', 'registration'] as const;

const SettingsPage: React.FC = () => {
  /*
   * The open tab lives in the URL, not in component state.
   *
   * Held in `useState` it could not be linked, shared or bookmarked; a reload
   * dropped the administrator back on Organisation Details, and browser Back
   * left the module entirely instead of returning to the previous tab. For a
   * user working in interrupted bursts, losing your place on refresh is the
   * expensive failure.
   */
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = Math.max(0, TAB_SLUGS.indexOf(searchParams.get('tab') as typeof TAB_SLUGS[number]));
  const { t } = useTranslation();
  const { setCurrentModule, checkModuleVisit } = useOnboarding();

  // Register page for contextual help
  usePageHelp('overview');

  React.useEffect(() => {
    setCurrentModule('settings');
    checkModuleVisit('settings');
  }, [setCurrentModule, checkModuleVisit]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    // `replace` so tabbing through settings does not fill the back stack —
    // Back should leave settings, not walk back through five tabs.
    setSearchParams({ tab: TAB_SLUGS[newValue] }, { replace: true });
  };

  // Tab labels reuse each tab's own title key, so the tab and the panel it
  // opens are always named identically in every locale.
  const tabs = [
    { icon: <BusinessIcon />, labelKey: 'settings.organisationDetails.title' },
    { icon: <PaymentIcon />, labelKey: 'settings.paymentSettings.title' },
    { icon: <EmailIcon />, labelKey: 'settings.emailTemplates.title' },
    { icon: <BrandingIcon />, labelKey: 'settings.branding.title' },
    { icon: <HowToRegIcon />, labelKey: 'settings.registration.title' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('settings.pageTitle')}
      </Typography>
      <Typography variant="body1" color="textSecondary" paragraph>
        {t('settings.pageSubtitle')}
      </Typography>

      <Card>
        <CardContent>
          <Tabs
            value={currentTab}
            onChange={handleTabChange}
            aria-label={t('settings.tabsAriaLabel')}
            variant="scrollable"
            scrollButtons="auto"
          >
            {tabs.map((tab, index) => (
              <Tab
                key={tab.labelKey}
                icon={tab.icon}
                iconPosition="start"
                label={t(tab.labelKey)}
                id={`settings-tab-${index}`}
                aria-controls={`settings-tabpanel-${index}`}
              />
            ))}
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

          <TabPanel value={currentTab} index={4}>
            <RegistrationSettingsTab />
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
