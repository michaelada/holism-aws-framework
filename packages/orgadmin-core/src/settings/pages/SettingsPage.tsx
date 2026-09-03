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
  EventNote as EventRulesIcon,
} from '@mui/icons-material';
import {
  useCapabilities,
  useOnboarding,
  usePageHelp,
  useTranslation,
} from '@itsplainsailing/orgadmin-shell';
import OrganisationDetailsTab from '../components/OrganisationDetailsTab';
import PaymentSettingsTab from '../components/PaymentSettingsTab';
import EmailTemplatesTab from '../components/EmailTemplatesTab';
import BrandingTab from '../components/BrandingTab';
import RegistrationSettingsTab from '../components/RegistrationSettingsTab';
import EventRulesTab from '../components/EventRulesTab';

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
 * The tabs, in the order the strip renders them, each addressable as
 * `?tab=<slug>`.
 *
 * Slugs rather than indices: `?tab=payments` survives a tab being inserted
 * ahead of it, and it is a link somebody can read.
 *
 * **One list, not two.** The slug, the icon, the label key and the panel travel
 * together, and the array is filtered before anything is rendered — so a tab
 * that is not shown cannot be reached by index either. When this was five
 * fixed tabs a parallel array of icons and a parallel run of `<TabPanel
 * index={n}>` said the same thing three times, and a conditional tab is exactly
 * the change that makes three copies disagree.
 */
interface SettingsTab {
  slug: string;
  labelKey: string;
  /** An element, not a node — MUI's `Tab` clones it to size it. */
  icon: React.ReactElement;
  panel: React.ReactNode;
  /** Shown only where the organisation holds this capability. */
  capability?: string;
}

const ALL_TABS: SettingsTab[] = [
  {
    slug: 'organisation',
    labelKey: 'settings.organisationDetails.title',
    icon: <BusinessIcon />,
    panel: <OrganisationDetailsTab />,
  },
  {
    slug: 'payments',
    labelKey: 'settings.paymentSettings.title',
    icon: <PaymentIcon />,
    panel: <PaymentSettingsTab />,
  },
  {
    slug: 'email',
    labelKey: 'settings.emailTemplates.title',
    icon: <EmailIcon />,
    panel: <EmailTemplatesTab />,
  },
  {
    slug: 'branding',
    labelKey: 'settings.branding.title',
    icon: <BrandingIcon />,
    panel: <BrandingTab />,
  },
  {
    slug: 'registration',
    labelKey: 'settings.registration.title',
    icon: <HowToRegIcon />,
    panel: <RegistrationSettingsTab />,
  },
  {
    slug: 'event-rules',
    labelKey: 'settings.eventRules.title',
    icon: <EventRulesIcon />,
    panel: <EventRulesTab />,
    capability: 'event-scheduling',
  },
];

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
  const { hasCapability } = useCapabilities();
  const tabs = React.useMemo(
    () => ALL_TABS.filter((tab) => !tab.capability || hasCapability(tab.capability)),
    [hasCapability]
  );
  /*
   * An unknown slug — or one for a tab this club cannot see — lands on the
   * first tab rather than on nothing. A stale bookmark to `?tab=event-rules`
   * after a capability is withdrawn should open Settings, not a blank panel.
   */
  const currentTab = Math.max(
    0,
    tabs.findIndex((tab) => tab.slug === searchParams.get('tab'))
  );
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
    setSearchParams({ tab: tabs[newValue].slug }, { replace: true });
  };

  // Tab labels reuse each tab's own title key, so the tab and the panel it
  // opens are always named identically in every locale.

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
                key={tab.slug}
                icon={tab.icon}
                iconPosition="start"
                label={t(tab.labelKey)}
                id={`settings-tab-${index}`}
                aria-controls={`settings-tabpanel-${index}`}
              />
            ))}
          </Tabs>

          {tabs.map((tab, index) => (
            <TabPanel key={tab.slug} value={currentTab} index={index}>
              {tab.panel}
            </TabPanel>
          ))}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SettingsPage;
