import React, { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import HomeIcon from '@mui/icons-material/Home';
import ListAltIcon from '@mui/icons-material/ListAlt';
import CardMembershipIcon from '@mui/icons-material/CardMembership';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import EventIcon from '@mui/icons-material/Event';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PersonIcon from '@mui/icons-material/Person';
import type { NavIcon } from './navigation';

/**
 * Icon per menu item.
 *
 * Kept here rather than in `navigation.ts` so that file stays a plain data
 * model with no JSX — `visibleSections` is tested without rendering anything,
 * and importing the icon set into that test would be a needless dependency.
 *
 * A `Record` rather than a lookup with a fallback: a new `NavIcon` that nobody
 * has drawn should fail the typecheck, not quietly render a gap where every
 * sibling has an icon.
 */
const NAV_ICONS: Record<NavIcon, React.ElementType> = {
  home: HomeIcon,
  entries: ListAltIcon,
  memberships: CardMembershipIcon,
  registrations: HowToRegIcon,
  events: EventIcon,
  tickets: ConfirmationNumberIcon,
  merchandise: StorefrontIcon,
  calendar: CalendarMonthIcon,
  cart: ShoppingCartIcon,
  payments: ReceiptLongIcon,
  profile: PersonIcon,
};
import { useBookingsLabel } from '../hooks/useBookingsLabel';
import { useCartCount } from '../cart/useCartCount';
import { useAuthContext } from '../context/AuthContext';
import { visibleSections } from './navigation';
import OfflineBanner from './OfflineBanner';
import StaleDataNotice from './StaleDataNotice';
import InstallPrompt from './InstallPrompt';

const DRAWER_WIDTH = 264;

/**
 * B1 / B2 — the application shell, in one responsive component.
 *
 * Desktop gets a permanent drawer; below the `md` breakpoint the same
 * navigation moves into a temporary drawer behind a menu button. One component
 * rather than two keeps the capability gating and the active-route logic in a
 * single place — the two layouts differ only in how the drawer is presented.
 *
 * The organisation name in the header doubles as the switcher trigger, which is
 * also the "make it clear which organisation they are in" affordance the brief
 * asks for.
 */
export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const { orgCode, me, hasCapability, publicDetail } = useAccountOrganisation();

  /*
   * The club's logo, from its public record — the same place the gateway (A2)
   * takes it from, so a member sees the same mark before and after signing in.
   *
   * It is not on `me.organisation`: that payload carries capabilities, currency
   * and language, not branding. The Avatar simply had no `src` at all, so it
   * always fell back to the initial however good the uploaded logo was.
   */
  const logoUrl = publicDetail?.branding?.logoUrl || undefined;
  const { logout } = useAuthContext();
  const bookingsLabel = useBookingsLabel();
  const cartCount = useCartCount(orgCode);

  const [mobileOpen, setMobileOpen] = useState(false);

  const sections = useMemo(() => visibleSections(hasCapability), [hasCapability]);

  const displayName = me?.organisation.displayName || orgCode || '';

  const navigation = (
    <Box role="navigation" aria-label={t('nav.menu')} sx={{ width: DRAWER_WIDTH }}>
      {sections.map((section, index) => (
        <React.Fragment key={section.titleKey ?? `section-${index}`}>
          {index > 0 && <Divider />}
          <List
            dense
            subheader={
              section.titleKey ? (
                <ListSubheader disableSticky>{t(`nav.${section.titleKey}`)}</ListSubheader>
              ) : undefined
            }
          >
            {section.items.map((item) => {
              const to = `/${orgCode}${item.path}`;
              const Icon = NAV_ICONS[item.icon];
              return (
                <ListItemButton
                  key={item.labelKey}
                  component={RouterLink}
                  to={to}
                  // An exact match for the home item, prefix otherwise —
                  // without the exact test, home stays highlighted everywhere.
                  selected={
                    item.path === ''
                      ? location.pathname === to
                      : location.pathname.startsWith(to)
                  }
                  onClick={() => setMobileOpen(false)}
                >
                  {/*
                    Decorative: the label beside it already names the
                    destination, so announcing the icon as well would read the
                    item twice.
                  */}
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <Icon fontSize="small" aria-hidden />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      // The bookings entry takes the club's own word for it.
                      item.labelKey === 'calendar' ? bookingsLabel : t(`nav.${item.labelKey}`)
                    }
                  />
                  {/*
                    How full the basket is, beside the word Basket.

                    Rendered only when there is something in it: a badge reading
                    "0" is a permanent fixture that stops meaning anything, and
                    the member has nothing to go and look at.

                    The count is announced rather than left to the colour —
                    `aria-label` on a plain `<span>` would be read as a bare
                    number, so the whole phrase is given to a screen reader and
                    the digits are hidden from it.
                  */}
                  {item.labelKey === 'cart' && cartCount > 0 && (
                    <Box
                      component="span"
                      aria-label={t('nav.cartCount', { count: cartCount })}
                      sx={{
                        ml: 1,
                        px: 0.75,
                        minWidth: 20,
                        height: 20,
                        borderRadius: '10px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        // The club's own primary is used by the selected state
                        // of this very list, so the count takes a colour that
                        // cannot be mistaken for selection.
                        backgroundColor: 'warning.main',
                        color: 'common.white',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        lineHeight: 1,
                      }}
                    >
                      <Box component="span" aria-hidden>
                        {cartCount}
                      </Box>
                    </Box>
                  )}
                </ListItemButton>
              );
            })}
          </List>
        </React.Fragment>
      ))}
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (t2) => t2.zIndex.drawer + 1 }}
        elevation={1}
      >
        <Toolbar>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label={t('nav.menu')}
              onClick={() => setMobileOpen((open) => !open)}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Button
            color="inherit"
            onClick={() => navigate('/switch')}
            endIcon={<UnfoldMoreIcon />}
            aria-label={t('switcher.trigger')}
            sx={{ textTransform: 'none', minWidth: 0 }}
          >
            <Avatar
              src={logoUrl}
              // The initial stays as the fallback: Avatar shows children when
              // there is no src, and also when the image fails to load — which
              // covers a logo whose signed URL has expired mid-session.
              alt={displayName}
              sx={{ width: 28, height: 28, mr: 1, bgcolor: 'primary.dark' }}
            >
              {displayName.charAt(0)}
            </Avatar>
            <Typography noWrap>{displayName}</Typography>
          </Button>

          <Box sx={{ flexGrow: 1 }} />

          <Button color="inherit" onClick={logout}>
            {t('common.signOut')}
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop || mobileOpen}
        onClose={() => setMobileOpen(false)}
        // Keeping the mobile drawer mounted makes reopening it instant on the
        // low-end phones this app is largely used on.
        ModalProps={{ keepMounted: true }}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            /*
             * The temporary drawer slides over the page rather than beside it,
             * so the panel has to be opaque in its own right — without this the
             * page showed through the menu items on a narrow screen and they
             * were hard to read. `backgroundImage: none` keeps that true if the
             * club's theme ever moves to a dark palette, where MUI paints an
             * elevation overlay gradient over the paper colour.
             */
            backgroundColor: 'background.paper',
            backgroundImage: 'none',
            borderRight: '1px solid',
            borderColor: 'divider',
          },
        }}
      >
        <Toolbar />
        {navigation}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        {/*
          Above the page rather than inside it: everything below may be the
          last thing the server said, whichever screen the member is on.
        */}
        <OfflineBanner />
        {/* How old what follows is, when any of it came from the cache. */}
        <StaleDataNotice />
        {children}
        {/* Held until the third visit; never on a first load. */}
        <InstallPrompt />
      </Box>
    </Box>
  );
};

export default AppShell;
