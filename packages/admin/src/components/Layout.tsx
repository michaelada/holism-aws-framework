import { ReactNode } from 'react';
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Container,
} from '@mui/material';
import { ExitToApp as LogoutIcon } from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  onLogout: () => void;
  userName?: string;
}

export function Layout({ children, onLogout, userName }: LayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Organisation Types', path: '/organization-types' },
    { label: 'Organisations', path: '/organizations' },
  ];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <AppBar position="static">
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ mr: 4 }}>
            Admin Portal
          </Typography>
          <Box sx={{ flexGrow: 1, display: 'flex', gap: 2 }}>
            {navItems.map((item) => (
              <Button
                key={item.path}
                color="inherit"
                onClick={() => navigate(item.path)}
                sx={{
                  fontWeight: location.pathname === item.path ? 'bold' : 'normal',
                  textDecoration: location.pathname === item.path ? 'underline' : 'none',
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
          {userName && (
            <Typography variant="body2" sx={{ mr: 2 }}>
              {userName}
            </Typography>
          )}
          <Button
            color="inherit"
            onClick={onLogout}
            startIcon={<LogoutIcon />}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4, flex: 1 }}>
        {children}
      </Container>
    </Box>
  );
}
