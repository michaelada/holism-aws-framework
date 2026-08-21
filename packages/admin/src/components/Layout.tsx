import { ReactNode, useState } from 'react';
import {
  AppBar,
  Box,
  Button,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Assessment as DashboardIcon,
  Business as OrganisationsIcon,
  Campaign as PostsIcon,
  DevicesOther as SessionsIcon,
  FactCheck as AuditIcon,
  Category as OrganisationTypesIcon,
  ExitToApp as LogoutIcon,
  Menu as MenuIcon,
  People as UsersIcon,
  VpnKey as RolesIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const RAIL_WIDTH = 248;

/*
 * This application is not served from the root. It sits under `/admin/` in the
 * deployment, so a literal `src="/logo.png"` resolves to `https://host/logo.png`
 * — a 404, and a missing mark in the bar after sign-in.
 *
 * Vite rewrites absolute paths it finds in `index.html`, which is why the
 * favicon is unaffected; it does not rewrite string literals in components.
 * `BASE_URL` is what the app was built with: `/` in development, `/admin/` once
 * built with `--base=/admin/`.
 *
 * The trailing slash is forced rather than assumed, because `BASE_URL` is that
 * setting verbatim — a base written without one yields `/adminlogo.png`, a 404
 * that no test running at the default `/` would show.
 */
const LOGO_SRC = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}logo.png`;

interface NavItem {
  label: string;
  path: string;
  icon: ReactNode;
}

interface NavGroup {
  heading: string;
  items: NavItem[];
}

/**
 * Every destination the router registers appears here.
 *
 * The previous AppBar listed three of the router's destinations; Users and
 * Roles were fully built and reachable only by typing a URL that appeared
 * nowhere in the interface.
 *
 * There is no Tenants entry. A tenant was a top tier that the schema never
 * implemented — `organizations` has no `tenant_id`, and nothing outside the
 * super-admin UI read one. The real top tier is the **organisation type**. See
 * docs/RETIRE_TENANTS.md.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Platform',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
    ],
  },
  {
    heading: 'Configuration',
    items: [
      { label: 'Organisation Types', path: '/organization-types', icon: <OrganisationTypesIcon /> },
      { label: 'Organisations', path: '/organizations', icon: <OrganisationsIcon /> },
    ],
  },
  {
    heading: 'Content',
    items: [
      { label: 'Posts', path: '/posts', icon: <PostsIcon /> },
    ],
  },
  {
    heading: 'Oversight',
    items: [
      { label: 'Sessions', path: '/sessions', icon: <SessionsIcon /> },
      { label: 'Audit log', path: '/audit', icon: <AuditIcon /> },
    ],
  },
  {
    heading: 'Access',
    items: [
      { label: 'Users', path: '/users', icon: <UsersIcon /> },
      { label: 'Roles', path: '/roles', icon: <RolesIcon /> },
    ],
  },
];

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
  userName?: string;
}

export function Layout({ children, onLogout, userName }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A section stays current while you are inside it, so a detail page does not
  // silently orphan the rail.
  const isCurrent = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const go = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };

  const railContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ px: 2.5, py: 2.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        {/*
          The mark and the wordmark are one lockup, so the image is decorative
          and carries an empty alt — a screen reader announcing "Its Plain
          Sailing logo" immediately before the words "Its Plain Sailing" says
          the brand twice and tells the listener nothing.

          Width and height are set explicitly so the rail does not reflow as the
          asset loads. The source is 56×64, drawn here at exactly half, which
          keeps it crisp on 2x displays.
        */}
        <img
          src={LOGO_SRC}
          alt=""
          width={28}
          height={32}
          style={{ display: 'block', flexShrink: 0 }}
        />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h6" component="p" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            Its Plain Sailing
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Platform Admin
          </Typography>
        </Box>
      </Box>
      <Divider />
      <Box sx={{ flex: 1, overflowY: 'auto', py: 1 }}>
        {NAV_GROUPS.map((group) => (
          <Box key={group.heading} sx={{ mb: 1.5 }}>
            <Typography
              variant="subtitle2"
              component="h2"
              color="text.secondary"
              sx={{ px: 2.5, pb: 0.5 }}
            >
              {group.heading}
            </Typography>
            <List disablePadding>
              {group.items.map((item) => {
                const current = isCurrent(item.path);
                return (
                  <ListItemButton
                    key={item.path}
                    selected={current}
                    onClick={() => go(item.path)}
                    aria-current={current ? 'page' : undefined}
                    sx={{ mx: 1, px: 1.5 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ variant: 'body2', fontWeight: current ? 600 : 400 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Keyboard users reach content without tabbing the whole rail on every page. */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: -9999,
          top: 8,
          zIndex: (t) => t.zIndex.tooltip + 1,
          bgcolor: 'background.paper',
          border: 1,
          borderColor: 'divider',
          borderRadius: 1,
          px: 2,
          py: 1,
          '&:focus': { left: 8 },
        }}
      >
        Skip to main content
      </Box>

      <Box component="nav" aria-label="Sections" sx={{ width: { md: RAIL_WIDTH }, flexShrink: 0 }}>
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': { width: RAIL_WIDTH, boxSizing: 'border-box' },
            }}
          >
            {railContent}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={drawerOpen}
            onClose={() => setDrawerOpen(false)}
            ModalProps={{ keepMounted: true }}
            sx={{ '& .MuiDrawer-paper': { width: RAIL_WIDTH, boxSizing: 'border-box' } }}
          >
            {railContent}
          </Drawer>
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <AppBar position="static" elevation={0}>
          <Toolbar>
            {!isDesktop && (
              <>
                <IconButton
                  edge="start"
                  onClick={() => setDrawerOpen(true)}
                  aria-label="Open navigation"
                  sx={{ mr: 1 }}
                >
                  <MenuIcon />
                </IconButton>
                {/*
                  Below md the rail is behind the hamburger, so the mark would
                  be invisible until the drawer opens. It carries the identity
                  in the bar instead — labelled this time, because no wordmark
                  sits beside it here to say the name.
                */}
                <img
                  src={LOGO_SRC}
                  alt="Its Plain Sailing"
                  width={21}
                  height={24}
                  style={{ display: 'block', flexShrink: 0 }}
                />
              </>
            )}
            <Box sx={{ flexGrow: 1 }} />
            {userName && (
              <Typography variant="body2" sx={{ mr: 2 }} color="text.secondary">
                {userName}
              </Typography>
            )}
            <Button color="inherit" size="small" onClick={onLogout} startIcon={<LogoutIcon />}>
              Sign out
            </Button>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          id="main-content"
          sx={{ flex: 1, px: { xs: 2, md: 4 }, py: { xs: 2.5, md: 4 }, minWidth: 0 }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
