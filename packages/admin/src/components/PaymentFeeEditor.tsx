import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  InputAdornment,
  Alert,
} from '@mui/material';
import type {
  PaymentFeeRates,
  CardPaymentMethodDefault,
} from '../types/organization.types';

/**
 * Card handling fees for an organisation type.
 *
 * Every organisation of the type inherits these — there is no per-organisation
 * override — so the editor states the blast radius before anything is saved.
 *
 * The worked example under each method is the point of the component. Three
 * abstract numbers are hard to sanity-check; a concrete figure that updates as
 * you type makes a mistyped 15% instead of 1.5% obvious immediately.
 *
 * See G5 and screen J1 in docs/ACCOUNT_USER_APP_WIREFRAMES.md.
 */

export interface PaymentFeeEditorMethod extends PaymentFeeRates {
  paymentMethodId: string;
  displayName: string;
  /**
   * The platform's Stripe Connect cut. Both null means "not configured", which
   * the checkout reads as "take the handling fee" — see the note below.
   */
  applicationFeeFixed?: number | '' | null;
  applicationFeePercentage?: number | '' | null;
}

/**
 * What the platform keeps out of a charge, on a worked example.
 *
 * Deliberately separate from `exampleFee`, because the two answer different
 * questions: that one is what the **member pays on top**, this one is what the
 * **platform keeps out of the money collected**. Confusing them is the whole
 * risk this editor exists to reduce.
 */
export function exampleApplicationFee(
  method: PaymentFeeEditorMethod,
  handlingFeeTotal: number,
  charge: number = EXAMPLE_CHARGE
): { amount: number; configured: boolean } {
  const fixed = method.applicationFeeFixed;
  const percentage = method.applicationFeePercentage;

  const blank = (value: unknown) => value === '' || value === null || value === undefined;
  if (blank(fixed) || blank(percentage)) {
    return { amount: handlingFeeTotal, configured: false };
  }

  // Mirrors calculateApplicationFee: the percentage is on the value sold, not
  // on the handling fee.
  const minor = Math.round(Math.round(Number(fixed) * 100) + (Math.round(charge * 100) * Number(percentage)) / 100);
  return { amount: minor / 100, configured: true };
}

export interface PaymentFeeEditorProps {
  methods: PaymentFeeEditorMethod[];
  /** Currency the fixed element is expressed in — the organisation type's. */
  currency: string;
  defaults?: CardPaymentMethodDefault[];
  /** Organisations that would be affected. Omit on create. */
  organisationCount?: number;
  onChange: (methods: PaymentFeeEditorMethod[]) => void;
  disabled?: boolean;
}

/** Amount the worked example is calculated on, in major units. */
export const EXAMPLE_CHARGE = 62;

const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: '€',
  GBP: '£',
  USD: '$',
  AUD: '$',
  CAD: '$',
  JPY: '¥',
  CNY: '¥',
};

export const currencySymbol = (currency: string): string =>
  CURRENCY_SYMBOLS[currency] || currency;

/**
 * The fee on a given charge, mirroring the backend calculation so the example
 * matches what a member will actually be charged.
 *
 * Rounds twice — once on the net fee, once on the tax — exactly as
 * src/utils/handling-fee.ts does. Working in cents keeps the two in step.
 */
export function exampleFee(
  rates: PaymentFeeRates,
  charge: number = EXAMPLE_CHARGE
): { net: number; tax: number; total: number } {
  const baseMinor = Math.round(charge * 100);
  const netMinor = Math.round(
    Math.round(rates.fixedFee * 100) + (baseMinor * rates.percentageFee) / 100
  );
  const taxMinor = Math.round((netMinor * rates.taxPercentage) / 100);
  return {
    net: netMinor / 100,
    tax: taxMinor / 100,
    total: (netMinor + taxMinor) / 100,
  };
}

const format = (value: number, currency: string): string =>
  `${currencySymbol(currency)}${value.toFixed(2)}`;

/** Keeps a cleared field empty rather than snapping it to 0 while typing. */
const parseRate = (raw: string): number | '' => (raw === '' ? '' : Number(raw));

export const PaymentFeeEditor: React.FC<PaymentFeeEditorProps> = ({
  methods,
  currency,
  defaults,
  organisationCount,
  onChange,
  disabled = false,
}) => {
  const update = (
    paymentMethodId: string,
    field: keyof PaymentFeeRates,
    raw: string
  ) => {
    const value = parseRate(raw);
    onChange(
      methods.map((m) =>
        m.paymentMethodId === paymentMethodId
          ? { ...m, [field]: value === '' ? ('' as unknown as number) : value }
          : m
      )
    );
  };

  const resetToDefault = (paymentMethodId: string) => {
    const fallback = defaults?.find((d) => d.paymentMethodId === paymentMethodId);
    if (!fallback) return;
    onChange(
      methods.map((m) =>
        m.paymentMethodId === paymentMethodId
          ? {
              ...m,
              fixedFee: fallback.fixedFee,
              percentageFee: fallback.percentageFee,
              taxPercentage: fallback.taxPercentage,
            }
          : m
      )
    );
  };

  if (methods.length === 0) {
    return (
      <Alert severity="info">
        No card payment methods are available on the platform, so there are no
        handling fees to configure.
      </Alert>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Card handling fees
      </Typography>
      <Typography variant="body2" color="textSecondary" gutterBottom>
        Every organisation of this type charges these handling fees on card
        payments. Pay Offline never carries a handling fee.
      </Typography>

      {organisationCount !== undefined && organisationCount > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Changing these fees affects{' '}
          <strong>
            {organisationCount} organisation{organisationCount === 1 ? '' : 's'}
          </strong>
          . They will charge the new fees on card payments as soon as you save.
          Payments already taken are unaffected.
        </Alert>
      )}

      <Box display="flex" flexDirection="column" gap={2}>
        {methods.map((method) => {
          const rates: PaymentFeeRates = {
            fixedFee: Number(method.fixedFee) || 0,
            percentageFee: Number(method.percentageFee) || 0,
            taxPercentage: Number(method.taxPercentage) || 0,
          };
          const example = exampleFee(rates);
          const applicationExample = exampleApplicationFee(method, example.total);
          const hasDefault = defaults?.some(
            (d) => d.paymentMethodId === method.paymentMethodId
          );

          return (
            <Card variant="outlined" key={method.paymentMethodId}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  {method.displayName}
                </Typography>

                <Box display="flex" gap={2} flexWrap="wrap">
                  <TextField
                    label="Fixed fee"
                    type="number"
                    value={method.fixedFee}
                    onChange={(e) =>
                      update(method.paymentMethodId, 'fixedFee', e.target.value)
                    }
                    disabled={disabled}
                    inputProps={{ min: 0, step: 0.01, 'aria-label': `${method.displayName} fixed fee` }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          {currencySymbol(currency)}
                        </InputAdornment>
                      ),
                    }}
                    helperText="Charged once per card payment"
                    sx={{ width: 200 }}
                  />

                  <TextField
                    label="Percentage fee"
                    type="number"
                    value={method.percentageFee}
                    onChange={(e) =>
                      update(method.paymentMethodId, 'percentageFee', e.target.value)
                    }
                    disabled={disabled}
                    inputProps={{ min: 0, max: 100, step: 0.001, 'aria-label': `${method.displayName} percentage fee` }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    helperText="Of the amount charged to the card"
                    sx={{ width: 200 }}
                  />

                  <TextField
                    label="Tax on fee"
                    type="number"
                    value={method.taxPercentage}
                    onChange={(e) =>
                      update(method.paymentMethodId, 'taxPercentage', e.target.value)
                    }
                    disabled={disabled}
                    inputProps={{ min: 0, max: 100, step: 0.001, 'aria-label': `${method.displayName} tax on fee` }}
                    InputProps={{
                      endAdornment: <InputAdornment position="end">%</InputAdornment>,
                    }}
                    helperText="0 = no tax added"
                    sx={{ width: 200 }}
                  />
                </Box>

                {/*
                  The platform's share. Kept visually apart from the three
                  fields above because it answers a different question: those
                  decide what the member is charged, this decides how the money
                  collected is split between the platform and the club.
                */}
                <Box mt={3}>
                  <Typography variant="subtitle2" gutterBottom>
                    Platform share (Stripe Connect application fee)
                  </Typography>
                  <Typography variant="body2" color="textSecondary" gutterBottom>
                    Taken out of each card payment. This does not change what the
                    member pays. Leave both blank to keep the handling fee above.
                  </Typography>

                  <Box display="flex" gap={2} flexWrap="wrap" mt={1}>
                    <TextField
                      label="Application fee (fixed)"
                      type="number"
                      value={method.applicationFeeFixed ?? ''}
                      onChange={(e) =>
                        update(
                          method.paymentMethodId,
                          'applicationFeeFixed' as never,
                          e.target.value
                        )
                      }
                      disabled={disabled}
                      InputProps={{ startAdornment: currencySymbol(currency) }}
                      inputProps={{ min: 0, step: '0.01' }}
                      sx={{ width: 200 }}
                    />
                    <TextField
                      label="Application fee (%)"
                      type="number"
                      value={method.applicationFeePercentage ?? ''}
                      onChange={(e) =>
                        update(
                          method.paymentMethodId,
                          'applicationFeePercentage' as never,
                          e.target.value
                        )
                      }
                      disabled={disabled}
                      InputProps={{ endAdornment: '%' }}
                      inputProps={{ min: 0, max: 100, step: '0.01' }}
                      sx={{ width: 200 }}
                    />
                  </Box>

                  <Typography variant="body2" color="textSecondary" mt={1}>
                    {applicationExample.configured ? (
                      <>
                        The platform keeps{' '}
                        <strong>{format(applicationExample.amount, currency)}</strong> of
                        that {format(EXAMPLE_CHARGE, currency)} charge; the
                        organisation receives the rest.
                      </>
                    ) : (
                      <>
                        Not set — the platform keeps the handling fee{' '}
                        <strong>{format(applicationExample.amount, currency)}</strong>,
                        as it does today.
                      </>
                    )}
                  </Typography>
                </Box>

                <Box
                  mt={2}
                  display="flex"
                  justifyContent="space-between"
                  alignItems="flex-end"
                  gap={2}
                  flexWrap="wrap"
                >
                  <Typography variant="body2" color="textSecondary">
                    Example: a {format(EXAMPLE_CHARGE, currency)} card charge attracts{' '}
                    {format(rates.fixedFee, currency)} +{' '}
                    {format(example.net - rates.fixedFee, currency)} ={' '}
                    <strong>{format(example.net, currency)}</strong>
                    {rates.taxPercentage > 0 && (
                      <>
                        , plus {rates.taxPercentage}% tax{' '}
                        {format(example.tax, currency)} ={' '}
                        <strong>{format(example.total, currency)}</strong>
                      </>
                    )}
                  </Typography>

                  {hasDefault && (
                    <Button
                      size="small"
                      onClick={() => resetToDefault(method.paymentMethodId)}
                      disabled={disabled}
                    >
                      Reset to default
                    </Button>
                  )}
                </Box>
              </CardContent>
            </Card>
          );
        })}
      </Box>
    </Box>
  );
};

export default PaymentFeeEditor;
