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
} from '@mui/material';
import {
  Menu as MenuIcon,
  Logout as LogoutIcon,
  Dashboard as DashboardIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useOrganisation } from '@aws-web-framework/orgadmin-core';
import { ModuleRegistration } from '../types/module.types';

const DRAWER_WIDTH = 260;
const SMALL_LOGO_URL = 'https://itsplainsailing.com/admin//logos/ips-logo-sails-transparent-64.png';

interface LayoutProps {
  children: React.ReactNode;
  modules?: ModuleRegistration[];
  onLogout?: () => void;
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
export const Layout: React.FC<LayoutProps> = ({ children, modules = [], onLogout }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { organisation } = useOrganisation();

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

  // Sort modules by order for consistent menu display
  const sortedModules = [...modules].sort((a, b) => (a.order || 999) - (b.order || 99));

  // Determine which module is currently active based on the route
  const currentModule = React.useMemo(() => {
    // If on dashboard, return null (show all modules)
    if (location.pathname === '/') {
      return null;
    }

    // Find the module that matches the current path
    return sortedModules.find(module => {
      // Check if any of the module's routes match the current path
      return module.routes.some(route => {
        const routePath = `/${route.path}`;
        return location.pathname.startsWith(routePath);
      });
    });
  }, [location.pathname, sortedModules]);

  // Filter modules to show only the current module's menu items
  const visibleModules = currentModule ? [currentModule] : [];

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
          alt="ItsPlainSailing"
          sx={{ width: 48, height: 48, mr: 1 }}
        />
        <Typography variant="h6" noWrap component="div">
          ItsPlainSailing
        </Typography>
      </Box>

      <Divider />

      {/* Organisation Name */}
      <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary">
          Organisation
        </Typography>
        <Typography variant="body2" fontWeight="medium" noWrap>
          {organisation?.displayName || 'Loading...'}
        </Typography>
      </Box>

      <Divider />

      {/* Navigation Menu */}
      <List sx={{ flexGrow: 1, pt: 2 }}>
        {/* Back to Main Page Link */}
        <ListItem disablePadding>
          <ListItemButton
            selected={location.pathname === '/'}
            onClick={() => handleNavigation('/')}
          >
            <ListItemIcon>
              <DashboardIcon />
            </ListItemIcon>
            <ListItemText primary="Back to Main Page" />
          </ListItemButton>
        </ListItem>

        {/* Module Menu Items - only show current module's items */}
        {visibleModules.map((module) => {
          // If module has sub-menu items, render them
          if (module.subMenuItems && module.subMenuItems.length > 0) {
            return (
              <React.Fragment key={module.id}>
                {module.subMenuItems.map((subItem) => {
                  const Icon = subItem.icon || DashboardIcon;
                  // Use exact match for sub-items to avoid highlighting multiple items
                  const isActive = location.pathname === subItem.path;

                  return (
                    <ListItem key={`${module.id}-${subItem.path}`} disablePadding>
                      <ListItemButton
                        selected={isActive}
                        onClick={() => handleNavigation(subItem.path)}
                        sx={{ pl: 4 }} // Indent sub-items
                      >
                        <ListItemIcon>
                          <Icon />
                        </ListItemIcon>
                        <ListItemText primary={subItem.label} />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </React.Fragment>
            );
          }

          // Otherwise, render the main menu item
          if (!module.menuItem) return null;

          const Icon = module.menuItem.icon || DashboardIcon;
          const isActive = location.pathname.startsWith(module.menuItem.path);

          return (
            <ListItem key={module.id} disablePadding>
              <ListItemButton
                selected={isActive}
                onClick={() => handleNavigation(module.menuItem!.path)}
              >
                <ListItemIcon>
                  <Icon />
                </ListItemIcon>
                <ListItemText primary={module.menuItem.label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Divider />

      {/* Logout Button */}
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={handleLogout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary="Logout" />
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
        }}
      >
        <Toolbar>
          {/* Mobile Menu Toggle */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          {/* App Title */}
          <Box sx={{ display: 'flex', alignItems: 'center', flexGrow: 1 }}>
            <Avatar
              src={SMALL_LOGO_URL}
              alt="ItsPlainSailing"
              sx={{ width: 32, height: 32, mr: 1, display: { xs: 'none', sm: 'block' } }}
            />
            <Typography variant="h6" noWrap component="div">
              ItsPlainSailing
            </Typography>
          </Box>

          {/* Organisation Name in AppBar (desktop only) */}
          <Typography
            variant="body2"
            sx={{ display: { xs: 'none', md: 'block' } }}
            color="text.secondary"
          >
            {organisation?.displayName || 'Loading...'}
          </Typography>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
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
          flexGrow: 1,
          p: 3,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          mt: 8, // Account for AppBar height
        }}
      >
        {children}
      </Box>
    </Box>
  );
};
