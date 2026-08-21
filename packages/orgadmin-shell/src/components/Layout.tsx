import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
  Divider,
  Avatar,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import { useTranslation } from '../hooks/useTranslation';
import { ModuleRegistration } from '../types/module.types';
import { HelpButton } from './HelpButton';
import { OrganisationSwitcher } from './OrganisationSwitcher';
import { useOnboarding } from '../context/OnboardingContext';

// 248px is the rail width DESIGN.md specifies.
const DRAWER_WIDTH = 248;
const SMALL_LOGO_URL = 'https://itsplainsailing.com/admin//logos/ips-logo-sails-transparent-64.png';

interface LayoutProps {
  children: React.ReactNode;
  modules?: ModuleRegistration[];
  onLogout?: () => void;
  /**
   * Every organisation the administrator belongs to.
   *
   * Defaulted rather than required so the many existing renders of this layout
   * — and its tests — do not all have to be taught about a switcher that most
   * administrators will never see.
   */
  organisations?: Array<{ id: string; displayName: string }>;
  onSwitchOrganisation?: (organisationId: string) => void | Promise<void>;
}

/**
 * Layout Component
 * 
 * Provides the main application layout with:
 * - AppBar with ItsPlainSailing branding and logo
 * - Responsive navigation drawer with dynamic menu items
 * - Mobile-responsive drawer toggle
 * - Logout button in drawer
 * 
 * Requirements: 2.2.1, 3.4.1, 1.2
 */
/**
 * Is `pathname` at, or beneath, `path`?
 *
 * The `/` boundary is what stops `/payments` from claiming `/payments-report`
 * — a prefix test without it matches any route whose name merely begins the
 * same way, which is a navigation rail highlighting the wrong thing.
 */
function isUnderPath(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/**
 * Core areas that belong under "running", not "setup".
 *
 * See the note in `moduleGroups`: these two carry no capability because every
 * organisation has them, but neither is something you configure once and leave.
 */
const RUNNING_MODULES = new Set(['payments', 'reporting']);

export const Layout: React.FC<LayoutProps> = ({
  children,
  modules = [],
  onLogout,
  organisations = [],
  onSwitchOrganisation,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  /**
   * Switch club, then go to the dashboard.
   *
   * Not a preference: capabilities belong to the organisation, so half the time
   * the page currently open is a module the other club does not have. Staying
   * put would land the administrator on a capability-denied screen the instant
   * they chose — and the dashboard is the one page every organisation has.
   */
  const handleSwitchOrganisation = async (organisationId: string) => {
    if (!onSwitchOrganisation) return;
    await onSwitchOrganisation(organisationId);
    navigate('/');
  };
  const location = useLocation();
  const { organisation } = useOrganisation();
  const { t } = useTranslation();
  const { helpDrawerOpen, toggleHelpDrawer } = useOnboarding();

  /*
   * The dashboard is a destination, not a mode.
   *
   * The rail used to be suppressed here and the app bar rendered a different
   * shell, so the one screen every administrator starts from was the one screen
   * with no navigation. It is now framed like every other route; only the
   * highlighted rail item changes.
   */
  const isDashboard = location.pathname === '/';

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    }
  };

  /*
   * Sorted by `order`, with the same fallback on both sides — the previous
   * `(a.order || 999) - (b.order || 99)` sorted an unordered module *ahead* of
   * an ordered one, because the two defaults disagreed by a factor of ten.
   */
  const sortedModules = React.useMemo(
    () => [...modules].sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [modules]
  );

  /*
   * Two groups, work first.
   *
   * `capability: undefined` marks an always-on core area, which gets the split
   * *almost* right for free: everything gated by a capability is something the
   * organisation does, and most ungated areas are how it is set up.
   *
   * Almost. Payments and Reporting are core — every organisation has them, so
   * neither carries a capability — but neither is setup either. You do not
   * configure your payments once and walk away; you go and look at what came
   * in. They are named here rather than given new metadata on the registry,
   * because two exceptions do not justify a field on every module.
   *
   * A group with no visible members renders nothing at all — a memberships-only
   * organisation should look deliberate, not broken.
   */
  /*
   * `dashboard` is withheld from the rail, deliberately and temporarily.
   *
   * It registers a second destination also called "Dashboard" (at `/dashboard`,
   * not `/`), so the rail would show the label twice — and that page currently
   * throws `Cannot read properties of undefined (reading 'total')` at
   * orgadmin-core `dashboard/pages/DashboardPage.tsx:186`, rendering a blank
   * screen. It was unreachable from the interface before this rail existed,
   * which is why nobody had hit it.
   *
   * Listing a duplicate label that white-screens is worse than not listing it.
   * Delete this filter the moment that page renders — the rail is meant to be
   * driven by the registry, not by exceptions.
   */
  const railModules = React.useMemo(
    () => sortedModules.filter((m) => m.id !== 'dashboard'),
    [sortedModules]
  );

  const moduleGroups = React.useMemo(
    () => [
      {
        key: 'work',
        labelKey: 'navigation.groupWork',
        /*
         * Capability modules first, then Payments and Reporting.
         *
         * Not what `order` alone gives: the core areas were numbered 1–9 back
         * when every one of them sat in Setup, so on merit of number alone
         * Payments (4) and Reporting (5) lead the section and Events (10)
         * follows them — which reads as an accident. Renumbering them would
         * move the dashboard cards too, and this is a question about the rail.
         *
         * It is also the truer order: Events, Memberships and Calendar are what
         * an organisation runs; Payments and Reporting are what it then goes
         * and looks at.
         */
        modules: [
          ...railModules.filter((m) => m.capability),
          ...railModules.filter((m) => !m.capability && RUNNING_MODULES.has(m.id)),
        ],
      },
      {
        key: 'setup',
        labelKey: 'navigation.groupSetup',
        modules: railModules.filter((m) => !m.capability && !RUNNING_MODULES.has(m.id)),
      },
    ].filter((group) => group.modules.length > 0),
    [railModules]
  );

  // Determine which module is currently active based on the route
  const currentModule = React.useMemo(() => {
    // If on dashboard, return null (show all modules)
    if (location.pathname === '/') {
      return null;
    }

    // Find the module that matches the current path
    return sortedModules.find((module) =>
      module.routes.some((route) => location.pathname.startsWith(`/${route.path}`))
    );
  }, [location.pathname, sortedModules]);

  // Create gradient background based on module color (same as DashboardCard)
  const getGradientBackground = (color: string) => {
    // Lighten the color for gradient effect
    const lightenColor = (hex: string, percent: number) => {
      const num = parseInt(hex.replace('#', ''), 16);
      const amt = Math.round(2.55 * percent);
      const R = (num >> 16) + amt;
      const G = (num >> 8 & 0x00FF) + amt;
      const B = (num & 0x0000FF) + amt;
      return '#' + (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      ).toString(16).slice(1);
    };

    const lightColor = lightenColor(color, 40);
    // Use the same opacity values as the card: 15 (~8% opacity) and 25 (~15% opacity)
    return `linear-gradient(135deg, ${color}15 0%, ${lightColor}25 100%)`;
  };

  // Get the current module's color for theming
  const moduleColor = currentModule?.card?.color;
  const moduleGradient = moduleColor ? getGradientBackground(moduleColor) : undefined;

  /** Sub-items the organisation's capabilities actually allow. */
  const visibleSubItems = React.useCallback(
    (module: ModuleRegistration) =>
      (module.subMenuItems ?? []).filter(
        (subItem) =>
          !subItem.capability || organisation?.enabledCapabilities?.includes(subItem.capability)
      ),
    [organisation?.enabledCapabilities]
  );

  /**
   * The sub-item the current route is on — the *longest* one that matches.
   *
   * Exact equality was not enough once a sub-item gained a child route.
   * Drilling from `/payments/lodgements` into `/payments/lodgements/po_2` left
   * the rail with nothing selected and the breadcrumb stopping at "Payments":
   * the reader lost their place in the navigation by following a link in it.
   *
   * Longest-match, because `/payments` is a prefix of `/payments/lodgements`
   * and a plain `startsWith` would light up "All payments" on every page in the
   * module. The `/` boundary keeps `/payments` from claiming `/payments-report`.
   */
  const currentSubItem = currentModule
    ? visibleSubItems(currentModule)
        .filter((subItem) => isUnderPath(location.pathname, subItem.path))
        .sort((a, b) => b.path.length - a.path.length)[0]
    : undefined;

  /*
   * Selection is carried by ground *and* colour together, never colour alone,
   * and the focus ring is explicit — DESIGN.md forbids relying on the browser
   * default. `whiteSpace: normal` is deliberate: the longest module label in
   * the six locales is Spanish at 30 characters ("Venta de entradas para
   * eventos"), which cannot fit 248px on one line. A wrapped label is correct;
   * a truncated one in a navigation rail is not.
   */
  const railItemSx = {
    mx: 1,
    borderRadius: 1,
    py: 0.75,
    '&.Mui-selected': { fontWeight: 600 },
    '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: '-3px' },
  } as const;

  const railLabelProps = { variant: 'body2' as const, sx: { whiteSpace: 'normal' } };

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Drawer Header */}
      <Box
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 64,
        }}
      >
        <Avatar
          src={SMALL_LOGO_URL}
          alt={t('navigation.appName')}
          sx={{ width: 48, height: 48, mr: 1 }}
        />
        <Typography variant="h6" noWrap component="div">
          {t('navigation.appName')}
        </Typography>
      </Box>

      <Divider />

      {/* Organisation Name */}
      <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary">
          {t('navigation.organisation')}
        </Typography>
        <Typography variant="body2" fontWeight="medium" noWrap>
          {organisation?.displayName || t('navigation.loading')}
        </Typography>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, pt: 1, overflowY: 'auto' }}>
        <ListItem disablePadding>
          <ListItemButton
            selected={isDashboard}
            aria-current={isDashboard ? 'page' : undefined}
            onClick={() => handleNavigation('/')}
            sx={railItemSx}
          >
            <ListItemIcon sx={{ minWidth: 36 }}><DashboardIcon /></ListItemIcon>
            <ListItemText primary={t('navigation.dashboard')} primaryTypographyProps={railLabelProps} />
          </ListItemButton>
        </ListItem>

        {moduleGroups.map((group) => (
          <Box key={group.key} component="li" sx={{ listStyle: 'none', mt: 1.5 }}>
            <Typography
              variant="caption"
              component="h2"
              sx={{ display: 'block', px: 2.5, pb: 0.5, color: 'text.secondary', fontWeight: 600 }}
            >
              {t(group.labelKey)}
            </Typography>

            <List disablePadding>
              {group.modules.map((module) => {
                const target = module.menuItem?.path ?? `/${module.routes[0]?.path ?? ''}`;
                const Icon = module.menuItem?.icon || DashboardIcon;
                const isCurrent = currentModule?.id === module.id;
                const subItems = isCurrent ? visibleSubItems(module) : [];

                return (
                  <React.Fragment key={module.id}>
                    <ListItem disablePadding>
                      <ListItemButton
                        selected={isCurrent}
                        aria-current={isCurrent && !currentSubItem ? 'page' : undefined}
                        onClick={() => handleNavigation(target)}
                        sx={railItemSx}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}><Icon /></ListItemIcon>
                        <ListItemText
                          primary={t(module.menuItem?.label ?? module.name)}
                          primaryTypographyProps={railLabelProps}
                        />
                      </ListItemButton>
                    </ListItem>

                    {/*
                      Only the module you are in opens. Expansion follows the
                      route rather than a toggle the user has to manage, so the
                      rail's height is predictable and there is no state to
                      restore after a reload.
                    */}
                    {subItems.map((subItem) => {
                      const SubIcon = subItem.icon;
                      // The same longest-match the breadcrumb uses, so the two
                      // never disagree about where the reader is.
                      const isActive = currentSubItem?.path === subItem.path;
                      return (
                        <ListItem key={`${module.id}-${subItem.path}`} disablePadding>
                          <ListItemButton
                            selected={isActive}
                            aria-current={isActive ? 'page' : undefined}
                            onClick={() => handleNavigation(subItem.path)}
                            sx={{ ...railItemSx, pl: SubIcon ? 4 : 6.5 }}
                          >
                            {SubIcon && (
                              <ListItemIcon sx={{ minWidth: 32 }}><SubIcon /></ListItemIcon>
                            )}
                            <ListItemText
                              primary={t(subItem.label)}
                              primaryTypographyProps={{ ...railLabelProps, fontSize: '0.875rem' }}
                            />
                          </ListItemButton>
                        </ListItem>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </List>
          </Box>
        ))}
      </List>

      <Divider />

      {/* Logout Button */}
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary={t('navigation.logout')} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* AppBar */}
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          ...(moduleGradient && {
            background: moduleGradient,
          }),
        }}
      >
        <Toolbar>
          {/* Mobile Menu Toggle */}
          <IconButton
              color="inherit"
              aria-label={t('common.accessibility.openDrawer')}
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 2, display: { md: 'none' } }}
            >
              <MenuIcon />
          </IconButton>

          {/*
            Where you are, spelled out. The app bar used to show only the
            module name, so a sub-page announced its module and nothing else —
            and the dashboard announced the product. Three steps at most, and
            the last one is plain text because you are already there.
          */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1, minWidth: 0 }}>
            <Breadcrumbs
              aria-label={t('navigation.breadcrumb')}
              separator="›"
              sx={{ color: 'inherit', '& .MuiBreadcrumbs-separator': { mx: 0.75, opacity: 0.6 } }}
            >
              <Link
                component="button"
                type="button"
                underline="hover"
                color="inherit"
                onClick={() => handleNavigation('/')}
                sx={{ font: 'inherit', cursor: 'pointer' }}
              >
                {organisation?.displayName || t('navigation.appName')}
              </Link>

              {currentModule && (
                currentSubItem ? (
                  <Link
                    component="button"
                    type="button"
                    underline="hover"
                    color="inherit"
                    onClick={() => handleNavigation(currentModule.menuItem?.path ?? '/')}
                    sx={{ font: 'inherit', cursor: 'pointer' }}
                  >
                    {t(currentModule.name)}
                  </Link>
                ) : (
                  <Typography variant="h6" component="span" noWrap sx={{ color: 'inherit' }}>
                    {t(currentModule.name)}
                  </Typography>
                )
              )}

              {currentSubItem && (
                <Typography variant="h6" component="span" noWrap sx={{ color: 'inherit' }}>
                  {t(currentSubItem.label)}
                </Typography>
              )}
            </Breadcrumbs>
          </Box>

          {/*
            Which club is being administered, and — for somebody who administers
            several — how to change it. Renders as a plain label when there is
            only one, which is the ordinary case.
          */}
          <OrganisationSwitcher
            organisations={organisations}
            currentId={organisation?.id}
            onSwitch={handleSwitchOrganisation}
          />

          {/* Help Button */}
          <HelpButton 
            onClick={toggleHelpDrawer} 
            active={helpDrawerOpen}
          />

        </Toolbar>
      </AppBar>

      {/* Navigation Drawer — present on every route, dashboard included */}
      <Box
          component="nav"
          aria-label={t('navigation.sections')}
          sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        >
          {/* Mobile Drawer */}
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={handleDrawerToggle}
            ModalProps={{
              keepMounted: true, // Better mobile performance
            }}
            sx={{
              display: { xs: 'block', md: 'none' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
                ...(moduleGradient && {
                  background: moduleGradient,
                }),
              },
            }}
          >
            {drawerContent}
          </Drawer>

          {/* Desktop Drawer */}
          <Drawer
            variant="permanent"
            sx={{
              display: { xs: 'none', md: 'block' },
              '& .MuiDrawer-paper': {
                boxSizing: 'border-box',
                width: DRAWER_WIDTH,
                ...(moduleGradient && {
                  background: moduleGradient,
                }),
              },
            }}
            open
          >
            {drawerContent}
          </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          /*
           * `minWidth: 0` is what stops the page scrolling sideways.
           *
           * This is a flex child, and a flex child's default `min-width: auto`
           * refuses to shrink below its content. A 997px table therefore pushed
           * the whole document to 1093px on a 390px phone: "Add Member" sat 464px
           * beyond the right edge, with nothing on screen to suggest the page
           * scrolled at all. Allowing the region to shrink moves the overflow
           * inside the table, where it belongs and where it is visible.
           */
          minWidth: 0,
          flexGrow: 1,
          /* The dashboard supplies its own padding; every other route gets it here. */
          p: isDashboard ? 0 : 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8, // Account for AppBar height
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
