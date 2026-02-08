import { Typography, Box, Paper, Grid } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome to AWS Web Application Framework
      </Typography>
      <Typography variant="body1" paragraph>
        A metadata-driven framework for building web applications on AWS.
      </Typography>

      <Grid container spacing={3} sx={{ mt: 2 }}>
        <Grid item xs={12} md={4}>
          <Paper
            sx={{ p: 3, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => navigate('/fields')}
          >
            <Typography variant="h6" gutterBottom>
              Field Definitions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Define reusable field definitions that can be used across multiple objects.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper
            sx={{ p: 3, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
            onClick={() => navigate('/objects')}
          >
            <Typography variant="h6" gutterBottom>
              Object Definitions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Define application objects using field definitions to generate CRUD APIs.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Object Instances
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create and manage instances of your defined objects.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
