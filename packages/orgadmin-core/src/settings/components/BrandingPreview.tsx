import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControlLabel,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

export interface BrandingPreviewColours {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  textColor: string;
}

/** #rgb or #rrggbb. Anything else is a half-typed value, not a colour yet. */
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const FALLBACK: BrandingPreviewColours = {
  logoUrl: '',
  primaryColor: '#1976d2',
  secondaryColor: '#dc004e',
  accentColor: '#ff9800',
  backgroundColor: '#ffffff',
  textColor: '#000000',
};

const safe = (value: string, fallback: string) =>
  HEX.test((value || '').trim()) ? value.trim() : fallback;

/**
 * Relative luminance, so text placed on a brand colour stays legible.
 *
 * Without this a club that picks a pale primary gets white-on-yellow buttons in
 * the preview and, worse, believes that is what their members will see. The
 * threshold is the usual 0.6 rule of thumb rather than a full WCAG contrast
 * calculation — it is deciding between black and white, not grading a palette.
 */
function readableTextOn(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;

  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  return luminance > 0.6 ? 'rgba(0, 0, 0, 0.87)' : '#ffffff';
}

/**
 * A live preview of an organisation's branding.
 *
 * **Built as a real MUI theme, not as hand-tinted elements.** The previous
 * preview set `sx={{ backgroundColor: primaryColor }}` on three buttons, which
 * meant everything else in it — inputs, tables, chips, switches — kept the
 * org-admin's own palette and the preview looked largely unaffected by the
 * colours being chosen. Feeding the colours through `createTheme` instead makes
 * every component inside pick them up the same way the real applications do,
 * which is the only way the preview can be evidence of anything.
 *
 * The account-user section matters for a second reason: the branding is applied
 * to the **member-facing** app, not to the screen the administrator is looking
 * at, so a preview that only shows admin-style chrome shows the wrong product.
 */
export const BrandingPreview: React.FC<{ colours: BrandingPreviewColours }> = ({ colours }) => {
  const { t } = useTranslation();

  const primary = safe(colours.primaryColor, FALLBACK.primaryColor);
  const secondary = safe(colours.secondaryColor, FALLBACK.secondaryColor);
  const accent = safe(colours.accentColor, FALLBACK.accentColor);
  const background = safe(colours.backgroundColor, FALLBACK.backgroundColor);
  const text = safe(colours.textColor, FALLBACK.textColor);

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          primary: { main: primary, contrastText: readableTextOn(primary) },
          secondary: { main: secondary, contrastText: readableTextOn(secondary) },
          warning: { main: accent, contrastText: readableTextOn(accent) },
          background: { default: background, paper: background },
          text: { primary: text },
        },
        typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
          h1: { fontFamily: '"Sora", "Roboto", sans-serif', fontSize: '1.75rem', fontWeight: 600 },
          h2: { fontFamily: '"Sora", "Roboto", sans-serif', fontSize: '1.25rem', fontWeight: 600 },
        },
        components: {
          MuiButton: { styleOverrides: { root: { textTransform: 'none' } } },
        },
      }),
    [primary, secondary, accent, background, text]
  );

  const initial = t('settings.branding.preview.organisationName').charAt(0).toUpperCase();

  return (
    <ThemeProvider theme={theme}>
      <Paper
        variant="outlined"
        sx={{ overflow: 'hidden', backgroundColor: background, color: text }}
      >
        {/*
          What a signed-in member sees. The logo sits in the app bar on the
          member's own primary colour, which is the single most common place it
          appears and the one an administrator is really choosing for.
        */}
        <AppBar position="static" elevation={0}>
          <Toolbar variant="dense">
            <IconButton edge="start" color="inherit" sx={{ mr: 1 }} aria-hidden tabIndex={-1}>
              <MenuIcon />
            </IconButton>

            <Avatar
              src={colours.logoUrl || undefined}
              variant="rounded"
              sx={{
                width: 32,
                height: 32,
                mr: 1.5,
                bgcolor: 'rgba(255,255,255,0.2)',
                color: 'inherit',
                fontSize: '0.9rem',
              }}
            >
              {initial}
            </Avatar>

            <Typography variant="body1" sx={{ flexGrow: 1, fontWeight: 500 }}>
              {t('settings.branding.preview.organisationName')}
            </Typography>

            <IconButton color="inherit" aria-hidden tabIndex={-1}>
              <ShoppingCartIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Box sx={{ p: 2.5 }}>
          <Typography variant="caption" color="text.secondary">
            {t('settings.branding.preview.accountUserCaption')}
          </Typography>

          {/* Headings and body, so the text colour is visible on the background. */}
          <Typography variant="h1" sx={{ mt: 1 }}>
            {t('settings.branding.preview.headingSample')}
          </Typography>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {t('settings.branding.preview.bodySample')}
          </Typography>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Button variant="contained">{t('settings.branding.preview.primaryButton')}</Button>
            <Button variant="contained" color="secondary">
              {t('settings.branding.preview.secondaryButton')}
            </Button>
            <Button variant="contained" color="warning">
              {t('settings.branding.preview.accentButton')}
            </Button>
            <Button variant="outlined">{t('settings.branding.preview.outlinedButton')}</Button>
            <Button variant="text">{t('settings.branding.preview.textButton')}</Button>
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
            <Chip label={t('settings.branding.preview.chipPrimary')} color="primary" />
            <Chip label={t('settings.branding.preview.chipSecondary')} color="secondary" />
            <Chip label={t('settings.branding.preview.chipAccent')} color="warning" />
            <Chip label={t('settings.branding.preview.chipDefault')} variant="outlined" />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* A form, because this is where most member time is actually spent. */}
          <Typography variant="h2" gutterBottom>
            {t('settings.branding.preview.formHeading')}
          </Typography>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <TextField
              size="small"
              fullWidth
              label={t('settings.branding.preview.fieldLabel')}
              defaultValue={t('settings.branding.preview.fieldValue')}
            />
            <TextField
              size="small"
              fullWidth
              select
              label={t('settings.branding.preview.selectLabel')}
              defaultValue="one"
            >
              <MenuItem value="one">{t('settings.branding.preview.selectOption')}</MenuItem>
            </TextField>

            <Box>
              <FormControlLabel
                control={<Checkbox defaultChecked />}
                label={t('settings.branding.preview.checkboxLabel')}
              />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label={t('settings.branding.preview.switchLabel')}
              />
            </Box>

            <RadioGroup row defaultValue="a">
              <FormControlLabel
                value="a"
                control={<Radio />}
                label={t('settings.branding.preview.radioOne')}
              />
              <FormControlLabel
                value="b"
                control={<Radio />}
                label={t('settings.branding.preview.radioTwo')}
              />
            </RadioGroup>

            <LinearProgress variant="determinate" value={60} />
          </Stack>

          <Divider sx={{ my: 2 }} />

          {/* A table — the shape most org-admin and member list screens take. */}
          <Typography variant="h2" gutterBottom>
            {t('settings.branding.preview.tableHeading')}
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: primary }}>
                  <TableCell sx={{ color: readableTextOn(primary), fontWeight: 600 }}>
                    {t('settings.branding.preview.tableItem')}
                  </TableCell>
                  <TableCell sx={{ color: readableTextOn(primary), fontWeight: 600 }}>
                    {t('settings.branding.preview.tableStatus')}
                  </TableCell>
                  <TableCell align="right" sx={{ color: readableTextOn(primary), fontWeight: 600 }}>
                    {t('settings.branding.preview.tableAmount')}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell>{t('settings.branding.preview.tableRowOne')}</TableCell>
                  <TableCell>
                    <Chip size="small" color="primary" label={t('settings.branding.preview.statusPaid')} />
                  </TableCell>
                  <TableCell align="right">€45.00</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell>{t('settings.branding.preview.tableRowTwo')}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color="warning"
                      label={t('settings.branding.preview.statusPending')}
                    />
                  </TableCell>
                  <TableCell align="right">€12.50</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>

          {/* A list, the mobile counterpart of that table. */}
          <Typography variant="h2" gutterBottom>
            {t('settings.branding.preview.listHeading')}
          </Typography>
          <Card variant="outlined">
            <List disablePadding>
              <ListItemButton divider>
                <ListItemText
                  primary={t('settings.branding.preview.listItemOne')}
                  secondary={t('settings.branding.preview.listItemOneDetail')}
                />
                <Chip size="small" color="primary" label={t('settings.branding.preview.listBadge')} />
              </ListItemButton>
              <ListItemButton selected>
                <ListItemText
                  primary={t('settings.branding.preview.listItemTwo')}
                  secondary={t('settings.branding.preview.listItemTwoDetail')}
                />
              </ListItemButton>
            </List>
          </Card>

          <Card sx={{ mt: 2, borderLeft: `4px solid ${accent}` }} variant="outlined">
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="body2">
                {t('settings.branding.preview.calloutText')}
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Paper>
    </ThemeProvider>
  );
};

export default BrandingPreview;
