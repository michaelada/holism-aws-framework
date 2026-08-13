import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  FieldRenderer,
  RichText,
  applicationFieldToFieldDefinition,
  emptyValueForField,
  formatCurrency,
  validateApplicationField,
} from '@aws-web-framework/components';
import FormLocalizationProvider from '../components/FormLocalizationProvider';
import { useAccountApi } from '../hooks/useAccountApi';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';
import { CatalogueMerchandise } from '../types/account';

interface FormField {
  id: string;
  name: string;
  label: string;
  order: number;
  required?: boolean;
  validation?: { required?: boolean } | null;
  datatype?: string;
  options?: unknown;
  description?: string | null;
}

interface ApplicationForm {
  id: string;
  fields: FormField[];
}

const isRequired = (field: FormField): boolean =>
  field.required === true || field.validation?.required === true;

/**
 * D10 — one item, its options, and what it will cost.
 *
 * **The price is arithmetic, not a lookup.** An item's price is the sum of the
 * option values chosen — a large costs more than a small because the *value*
 * carries the price — so nothing can be quoted until every option is answered.
 * The total is recomputed here as the member chooses, and computed again by
 * `merchandise.service` when the order is created. That is the one that
 * decides what is charged; this one exists so the member is not asked to
 * commit to a number they have not seen.
 *
 * Delivery is shown as its own line for the same reason: a fee that appears
 * only in the basket reads as something added behind the member's back.
 */
export const ShopItemPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { itemId } = useParams<{ itemId: string }>();
  const { orgCode, me } = useAccountOrganisation();
  const online = useOnlineStatus();

  const { execute: executeCatalogue } = useAccountApi<CatalogueMerchandise[]>();
  const { execute: executeForm } = useAccountApi<ApplicationForm>();
  const { execute: executeSubmit } = useAccountApi<{ id: string }>();
  const { execute: executeAdd } = useAccountApi<unknown>();

  const currency = me?.organisation.currency ?? 'EUR';
  const locale = i18n.language;

  const [item, setItem] = useState<CatalogueMerchandise | null>(null);
  const [form, setForm] = useState<ApplicationForm | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [agreed, setAgreed] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backTo = `/${orgCode}/shop`;

  const load = useCallback(async () => {
    if (!orgCode || !itemId) return;
    setLoading(true);
    setError(null);
    try {
      const items =
        (await executeCatalogue({ url: `/api/account/${orgCode}/catalogue/merchandise` })) ?? [];
      const found = items.find((candidate) => candidate.id === itemId) ?? null;

      if (!found) {
        setNotFound(true);
        return;
      }
      setItem(found);
      setQuantity(found.minOrderQuantity || 1);

      /*
       * A single-choice option is answered for the member. Asking someone to
       * choose "One size" from a list of one is a click that carries no
       * information, and it would otherwise block the button.
       */
      const preselected: Record<string, string> = {};
      for (const type of found.optionTypes) {
        if (type.values.length === 1) preselected[type.id] = type.values[0].id;
      }
      setSelected(preselected);

      if (found.applicationFormId) {
        setForm(
          await executeForm({
            url: `/api/account/${orgCode}/forms/${found.applicationFormId}`,
          })
        );
      }
    } catch {
      setError(t('shop.loadError'));
    } finally {
      setLoading(false);
    }
  }, [orgCode, itemId, executeCatalogue, executeForm, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const fields = useMemo(
    () => (form?.fields ? [...form.fields].sort((a, b) => a.order - b.order) : []),
    [form]
  );

  /** The chosen option value on each option type, where one has been chosen. */
  const chosenValues = useMemo(() => {
    if (!item) return [];
    return item.optionTypes
      .map((type) => type.values.find((value) => value.id === selected[type.id]))
      .filter((value): value is NonNullable<typeof value> => value !== undefined);
  }, [item, selected]);

  const allOptionsChosen = Boolean(item) && chosenValues.length === (item?.optionTypes.length ?? 0);

  const unitPrice = chosenValues.reduce((total, value) => total + value.price, 0);
  const subtotal = unitPrice * quantity;

  /**
   * Delivery, as far as this screen can know it.
   *
   * `free` and `fixed` are answerable here. `quantity_based` is a table of
   * rules the catalogue does not carry, so it is named rather than guessed —
   * quoting a number that the server then contradicts is worse than saying the
   * fee depends on how many are ordered.
   */
  const deliveryKnown = item?.deliveryType !== 'quantity_based';
  const deliveryFee = item?.deliveryType === 'fixed' ? item.deliveryFee : 0;
  const total = subtotal + (deliveryKnown ? deliveryFee : 0);

  /** How much of the chosen options is left, when the club tracks stock. */
  const stockRemaining = useMemo(() => {
    if (!item?.trackStockLevels || chosenValues.length === 0) return null;
    const counted = chosenValues
      .map((value) => value.stockQuantity)
      .filter((count): count is number => count !== null);
    return counted.length === 0 ? null : Math.min(...counted);
  }, [item, chosenValues]);

  const outstanding = useMemo(
    () =>
      fields
        .filter((field) => validateApplicationField(field, values[field.name], isRequired(field)) !== null)
        .map((field) => field.label),
    [fields, values]
  );

  const termsRequired = Boolean(item?.termsAndConditions);
  const quantityValid =
    item !== null &&
    quantity >= item.minOrderQuantity &&
    (item.maxOrderQuantity === null || quantity <= item.maxOrderQuantity) &&
    (!item.quantityIncrements || quantity % item.quantityIncrements === 0) &&
    (stockRemaining === null || quantity <= stockRemaining);

  const canAdd =
    // Adding to the basket needs the server: it re-checks stock and options.
    online &&
    !saving &&
    item !== null &&
    item.available &&
    allOptionsChosen &&
    quantityValid &&
    outstanding.length === 0 &&
    (!termsRequired || agreed);

  const addToBasket = async () => {
    if (!item || !orgCode) return;
    setSaving(true);
    setError(null);

    try {
      let formSubmissionId: string | null = null;

      if (form) {
        const submission = await executeSubmit({
          method: 'POST',
          url: `/api/account/${orgCode}/form-submissions`,
          data: {
            formId: form.id,
            contextId: item.id,
            submissionType: 'merchandise_order',
            submissionData: values,
          },
        });
        formSubmissionId = submission?.id ?? null;
      }

      await executeAdd({
        method: 'POST',
        url: `/api/account/${orgCode}/cart/items`,
        data: {
          itemType: 'merchandise',
          /*
           * The options are keyed by option *type* — "which size", not "large"
           * — because that is the shape `merchandise.service.createOrder`
           * prices and decrements stock from. The basket line carries it
           * through checkout into the payment line, which is what fulfilment
           * reads long after the basket is gone.
           */
          contextRef: { merchandiseTypeId: item.id, selectedOptions: selected },
          quantity,
          description: `${item.name}${
            chosenValues.length > 0 ? ` — ${chosenValues.map((v) => v.name).join(', ')}` : ''
          }`,
          unitFee: unitPrice,
          handlingFeeIncluded: item.handlingFeeIncluded,
          supportedPaymentMethodIds: item.supportedPaymentMethodIds,
          formSubmissionId,
        },
      });

      navigate(`/${orgCode}/cart`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('shop.addFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress aria-label={t('common.loading')} />
      </Box>
    );
  }

  if (notFound || !item) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Alert severity="error">{t('shop.itemNotFound')}</Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mt: 2 }}>
          {t('shop.back')}
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, md: 4 } }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(backTo)} sx={{ mb: 2 }}>
        {t('shop.back')}
      </Button>

      <Paper sx={{ p: 3, mb: 3 }}>
        {item.images.length > 0 && (
          <Box
            component="img"
            src={item.images[0]}
            alt=""
            sx={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 1, mb: 2 }}
          />
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
          <Typography variant="h1">{item.name}</Typography>
          {!item.available && (
            <Chip
              label={
                item.unavailableReason === 'out-of-stock'
                  ? t('shop.outOfStock')
                  : t('shop.notOnSale')
              }
            />
          )}
        </Stack>

        {item.description && (
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {item.description}
          </Typography>
        )}
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {item.available && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('shop.chooseHeading')}
          </Typography>

          <Stack spacing={2}>
            {item.optionTypes.map((type) => (
              <FormControl fullWidth key={type.id}>
                <InputLabel id={`option-${type.id}`} required>
                  {type.name}
                </InputLabel>
                <Select
                  labelId={`option-${type.id}`}
                  label={type.name}
                  value={selected[type.id] ?? ''}
                  onChange={(event) =>
                    setSelected((previous) => ({ ...previous, [type.id]: event.target.value }))
                  }
                  disabled={saving}
                >
                  {type.values.map((value) => {
                    const soldOut = item.trackStockLevels && value.stockQuantity === 0;
                    return (
                      /*
                        Sold-out choices are listed and disabled, not removed.
                        A member looking for their size needs to see that it is
                        the size that is gone, not wonder whether the club
                        stocks it at all.
                      */
                      <MenuItem key={value.id} value={value.id} disabled={soldOut}>
                        {value.name}
                        {soldOut ? ` — ${t('shop.outOfStock')}` : ''}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            ))}

            <TextField
              type="number"
              label={t('shop.quantity')}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
              disabled={saving}
              inputProps={{
                min: item.minOrderQuantity,
                max: item.maxOrderQuantity ?? undefined,
                step: item.quantityIncrements ?? 1,
              }}
              helperText={
                item.quantityIncrements
                  ? t('shop.quantityIncrements', { step: item.quantityIncrements })
                  : item.maxOrderQuantity
                    ? t('shop.quantityRange', {
                        min: item.minOrderQuantity,
                        max: item.maxOrderQuantity,
                      })
                    : undefined
              }
              sx={{ maxWidth: 220 }}
            />

            {stockRemaining !== null && stockRemaining > 0 && (
              <Typography variant="body2" color="text.secondary">
                {t('shop.stockRemaining', { count: stockRemaining })}
              </Typography>
            )}
          </Stack>
        </Paper>
      )}

      {form && item.available && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('form.detailsHeading')}
          </Typography>
          <FormLocalizationProvider>
            <Stack spacing={2}>
              {fields.map((field) => (
                <FieldRenderer
                  key={field.id}
                  fieldDefinition={applicationFieldToFieldDefinition(field)}
                  value={values[field.name] ?? emptyValueForField(field)}
                  onChange={(value: unknown) =>
                    setValues((previous) => ({ ...previous, [field.name]: value }))
                  }
                  required={isRequired(field)}
                  disabled={saving}
                />
              ))}
            </Stack>
          </FormLocalizationProvider>
        </Paper>
      )}

      {item.termsAndConditions && item.available && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h2" gutterBottom>
            {t('form.termsHeading')}
          </Typography>
          <Box
            tabIndex={0}
            sx={{
              maxHeight: 320,
              overflowY: 'auto',
              p: 2,
              mb: 2,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              backgroundColor: 'action.hover',
            }}
          >
            <RichText html={item.termsAndConditions} sx={{ fontSize: '0.875rem' }} />
          </Box>
          <Divider sx={{ mb: 2 }} />
          <FormControlLabel
            control={
              <Checkbox
                checked={agreed}
                onChange={(event) => setAgreed(event.target.checked)}
                disabled={saving}
              />
            }
            label={t('form.agreeTerms')}
          />
        </Paper>
      )}

      {item.available && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">
                {t('shop.subtotalLine', { quantity })}
              </Typography>
              <Typography>{formatCurrency(subtotal / 100, currency, locale)}</Typography>
            </Stack>

            <Stack direction="row" justifyContent="space-between">
              <Typography color="text.secondary">{t('shop.delivery')}</Typography>
              <Typography>
                {!deliveryKnown
                  ? t('shop.deliveryByQuantity')
                  : deliveryFee === 0
                    ? t('shop.deliveryFree')
                    : formatCurrency(deliveryFee / 100, currency, locale)}
              </Typography>
            </Stack>

            <Divider />

            <Stack direction="row" justifyContent="space-between">
              <Typography variant="h6">{t('shop.total')}</Typography>
              <Typography variant="h6">
                {allOptionsChosen ? formatCurrency(total / 100, currency, locale) : '—'}
              </Typography>
            </Stack>
          </Stack>
        </Paper>
      )}

      <Stack direction="row" spacing={2} justifyContent="flex-end">
        <Button onClick={() => navigate(backTo)} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button variant="contained" size="large" onClick={addToBasket} disabled={!canAdd}>
          {saving ? t('shop.adding') : t('shop.addToBasket')}
        </Button>
      </Stack>

      {/* Why the button is unavailable, in the order a member would fix it. */}
      {!online && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('offline.actionBlocked')}
        </Typography>
      )}
      {online && item.available && !allOptionsChosen && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('shop.chooseAllOptions')}
        </Typography>
      )}
      {item.available && allOptionsChosen && !quantityValid && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {stockRemaining !== null && quantity > stockRemaining
            ? t('shop.notEnoughStock', { count: stockRemaining })
            : t('shop.quantityNotAllowed')}
        </Typography>
      )}
      {item.available && allOptionsChosen && quantityValid && outstanding.length > 0 && (
        <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
          {t('form.stillRequired', { fields: outstanding.join(', ') })}
        </Typography>
      )}
      {item.available &&
        allOptionsChosen &&
        quantityValid &&
        outstanding.length === 0 &&
        termsRequired &&
        !agreed && (
          <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 1 }}>
            {t('form.mustAgree')}
          </Typography>
        )}
    </Container>
  );
};

export default ShopItemPage;
