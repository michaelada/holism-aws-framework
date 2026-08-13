import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  CardMedia,
  Chip,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { formatCurrency } from '@aws-web-framework/components';
import { useAccountApi } from '../hooks/useAccountApi';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CatalogueMerchandise } from '../types/account';

/**
 * D9 — the club shop.
 *
 * A grid rather than the list the events page uses: merchandise is looked at
 * before it is read. An event row has to carry dates, a window and capacity; a
 * shirt has a picture and a price, and a full-width row of mostly whitespace
 * makes six items feel like a warehouse.
 *
 * **Sold-out items stay on the shelf**, marked, unless the club has chosen to
 * hide them — which the server honours by not sending them. A member who was
 * told about the new polo is better served by "out of stock" than by a shop
 * that behaves as though it never existed.
 *
 * The price shown is a *from* price: the real one is the sum of the options
 * chosen, so it cannot be known until the next screen.
 */
export const ShopPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { orgCode, me } = useAccountOrganisation();

  const { execute } = useAccountApi<CatalogueMerchandise[]>();

  const [items, setItems] = useState<CatalogueMerchandise[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const currency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const load = useCallback(async () => {
    if (!orgCode) return;
    setLoading(true);
    setFailed(false);
    try {
      setItems((await execute({ url: `/api/account/${orgCode}/catalogue/merchandise` })) ?? []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [orgCode, execute]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 } }}>
      <Typography variant="h1" gutterBottom>
        {t('shop.title')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 3 }}>
        {t('shop.subtitle')}
      </Typography>

      {failed && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('shop.loadError')}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress aria-label={t('common.loading')} />
        </Box>
      ) : items.length === 0 ? (
        <Alert severity="info">{t('shop.empty')}</Alert>
      ) : (
        <Grid container spacing={3}>
          {items.map((item) => (
            <Grid item xs={12} sm={6} md={4} key={item.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/*
                  The whole card is the target, not a button in the corner. On a
                  phone the picture is the obvious thing to press, and a card
                  that looks pressable but is not is worse than one that is not.
                */}
                <CardActionArea
                  onClick={() => navigate(`/${orgCode}/shop/${item.id}`)}
                  sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                >
                  {item.images.length > 0 ? (
                    <CardMedia
                      component="img"
                      height="200"
                      image={item.images[0]}
                      alt=""
                      sx={{ objectFit: 'cover' }}
                    />
                  ) : (
                    /*
                      Not an empty box and not a stock photograph: a plain
                      panel, so a club that has not uploaded a picture gets a
                      tidy card rather than a broken one.
                    */
                    <Box
                      sx={{
                        height: 200,
                        backgroundColor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography variant="h2" color="text.disabled">
                        {item.name.slice(0, 1).toUpperCase()}
                      </Typography>
                    </Box>
                  )}

                  <CardContent sx={{ flexGrow: 1, width: '100%' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Typography variant="h2" sx={{ fontSize: '1.125rem' }}>
                        {item.name}
                      </Typography>
                      {!item.available && (
                        <Chip
                          size="small"
                          color="default"
                          label={
                            item.unavailableReason === 'out-of-stock'
                              ? t('shop.outOfStock')
                              : t('shop.notOnSale')
                          }
                        />
                      )}
                    </Stack>

                    {item.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 1,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {item.description}
                      </Typography>
                    )}

                    <Typography variant="h6" sx={{ mt: 2 }}>
                      {t('shop.fromPrice', {
                        price: formatCurrency(item.fromPrice / 100, currency, locale),
                      })}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default ShopPage;
