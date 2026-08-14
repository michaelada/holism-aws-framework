import { Box, Typography, Button, Paper } from '@mui/material';
import { useAuth } from '../context';
import BlockIcon from '@mui/icons-material/Block';

/**
 * AccessDeniedPage component displayed when a user without admin role
 * attempts to access the admin portal.
 */
export function AccessDeniedPage() {
  const { logout, userName } = useAuth();

  return (
    // No `minHeight: 100vh` and no background of its own: this page renders
    // inside Layout's chrome, so claiming a full viewport pushed it below the
    // app bar and left an extra screen of grey beneath it.
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        py: 6,
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          maxWidth: 600,
          textAlign: 'center',
        }}
      >
        <BlockIcon
          sx={{
            fontSize: 80,
            color: 'error.main',
            mb: 2,
          }}
        />
        
        <Typography variant="h4" color="error" gutterBottom>
          Access Denied
        </Typography>
        
        <Typography variant="body1" sx={{ mb: 2 }}>
          You do not have permission to access the Admin Portal.
        </Typography>
        
        {userName && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Logged in as: <strong>{userName}</strong>
          </Typography>
        )}
        
        <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
          This area is restricted to users with administrator privileges.
          <br />
          Please contact your system administrator if you believe this is an error.
        </Typography>
        
        <Button
          variant="contained"
          color="primary"
          onClick={logout}
          size="large"
        >
          Logout
        </Button>
      </Paper>
    </Box>
  );
}
