import React from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  InputAdornment,
  TextField,
  Typography,
} from '@mui/material';
import type { OrganisationApplicationFee } from '../types/organization.types';
import { currencySymbol, EXAMPLE_CHARGE, exampleFee } from './PaymentFeeEditor';
import type { PaymentFeeRates } from '../types/organization.types';

/**
 * The Stripe Connect application fee for one organisation.
 *
 * This is **not** the handling fee. The handling fee is added to what the
 * member pays and is configured on the organisation type; this decides how the
 * money already collected is split between the platform and the club, and it
 * changes nothing the member sees. The two were the same number until they were
 * separated — see docs/CONNECT_APPLICATION_FEE.md — and the copy here works
 * hard to keep them apart, because confusing them is the expensive mistake.
 *
 * The organisation receives a copy of its type's value when it is created and
 * is independent from that moment: editing the type does not reach back into
 * organisations that already exist. Screens K2 and K3 in
 * docs/ORGANISATION_APPLICATION_FEE_WIREFRAMES.md.
 */

export interface ApplicationFeeDraft {
  paymentMethodId: string;
  applicationFeeFixed: number | '' | null;
  applicationFeePercentage: number | '' | null;
}

export interface ApplicationFeeEditorProps {
  fees: OrganisationApplicationFee[];
  /** Current draft values, keyed by payment method id. */
  draft: ApplicationFeeDraft[];
  currency: string;
  organisationTypeName: string;
  organisationName: string;
  /**
   * The organisation's handling fee rates, used only to work out what "not set"
   * would actually cost. Read from the type, because that is where handling
   * fees live.
   */
  handlingRatesByMethod?: Record<string, PaymentFeeRates>;
  disabled?: boolean;
  onChange: (draft: ApplicationFeeDraft[]) => void;
  onResetToTypeDefault?: (paymentMethodId: string) => void;
}

const isBlank = (value: unknown): boolean =>
  value === '' || value === null || value === undefined;

const format = (value: number, currency: string): string =>
  `${currencySymbol(currency)}${value.toFixed(2)}`;

/** Half a pair is never a legitimate state — see the both-or-neither rule. */
export const hasHalfSetApplicationFee = (draft: ApplicationFeeDraft[]): boolean =>
  draft.some(
    (d) => isBlank(d.applicationFeeFixed) !== isBlank(d.applicationFeePercentage)
  );

/** What the platform keeps from the worked example charge. */
export function organisationApplicationExample(
  entry: ApplicationFeeDraft,
  handlingTotal: number,
  charge: number = EXAMPLE_CHARGE
): { amount: number; configured: boolean } {
  if (isBlank(entry.applicationFeeFixed) || isBlank(entry.applicationFeePercentage)) {
    return { amount: handlingTotal, configured: false };
  }
  // Mirrors calculateApplicationFee: the percentage is on the value sold, not
  // on the handling fee. Taking a percentage of our own surcharge would
  // compound it.
  const minor = Math.round(
    Math.round(Number(entry.applicationFeeFixed) * 100) +
      (Math.round(charge * 100) * Number(entry.applicationFeePercentage)) / 100
  );
  return { amount: minor / 100, configured: true };
}

const differsFromType = (
  entry: ApplicationFeeDraft,
  fee: OrganisationApplicationFee
): boolean => {
  const norm = (v: unknown) => (isBlank(v) ? null : Number(v));
  return (
    norm(entry.applicationFeeFixed) !== norm(fee.typeDefaultFixed) ||
    norm(entry.applicationFeePercentage) !== norm(fee.typeDefaultPercentage)
  );
};

export const ApplicationFeeEditor: React.FC<ApplicationFeeEditorProps> = ({
  fees,
  draft,
  currency,
  organisationTypeName,
  organisationName,
  handlingRatesByMethod,
  disabled = false,
  onChange,
  onResetToTypeDefault,
}) => {
  const update = (
    paymentMethodId: string,
    field: 'applicationFeeFixed' | 'applicationFeePercentage',
    raw: string
  ) => {
    onChange(
      draft.map((d) =>
        d.paymentMethodId === paymentMethodId
          ? { ...d, [field]: raw === '' ? '' : Number(raw) }
          : d
      )
    );
  };

  if (fees.length === 0) {
    // K3 — nothing to configure rather than an empty box.
    return (
      <Alert severity="info">
        This organisation has no card payment method enabled, so there is no platform share to
        configure. Enable one above and save to set it.
      </Alert>
    );
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      {fees.map((fee) => {
        const entry =
          draft.find((d) => d.paymentMethodId === fee.paymentMethodId) ?? {
            paymentMethodId: fee.paymentMethodId,
            applicationFeeFixed: fee.applicationFeeFixed,
            applicationFeePercentage: fee.applicationFeePercentage,
          };

        const handling = handlingRatesByMethod?.[fee.paymentMethodId];
        const handlingTotal = handling ? exampleFee(handling).total : 0;
        const example = organisationApplicationExample(entry, handlingTotal);
        const diverged = differsFromType(entry, fee);
        const halfSet =
          isBlank(entry.applicationFeeFixed) !== isBlank(entry.applicationFeePercentage);

        return (
          <Card variant="outlined" key={fee.paymentMethodId}>
            <CardContent>
              <Typography variant="subtitle1" component="h3" gutterBottom>
                {fee.paymentMethodDisplayName}
              </Typography>

              <Box display="flex" gap={2} flexWrap="wrap">
                <TextField
                  label="Application fee (fixed)"
                  type="number"
                  value={entry.applicationFeeFixed ?? ''}
                  onChange={(e) =>
                    update(fee.paymentMethodId, 'applicationFeeFixed', e.target.value)
                  }
                  disabled={disabled}
                  error={halfSet && isBlank(entry.applicationFeeFixed)}
                  helperText={
                    halfSet && isBlank(entry.applicationFeeFixed)
                      ? 'Set both, or clear both.'
                      : `Type default: ${
                          /*
                           * `isBlank`, not `=== null`: a response without the
                           * key at all yields `undefined`, and `format` then
                           * throws on `.toFixed` — taking the whole edit page
                           * blank rather than showing "not set".
                           */
                          isBlank(fee.typeDefaultFixed)
                            ? 'not set'
                            : format(fee.typeDefaultFixed as number, currency)
                        }`
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">{currencySymbol(currency)}</InputAdornment>
                    ),
                  }}
                  inputProps={{
                    min: 0,
                    step: '0.01',
                    // Two methods can appear on one page, so the label alone is
                    // ambiguous to a screen-reader user.
                    'aria-label': `${fee.paymentMethodDisplayName} application fee, fixed amount`,
                  }}
                  sx={{ width: 230 }}
                />

                <TextField
                  label="Application fee (%)"
                  type="number"
                  value={entry.applicationFeePercentage ?? ''}
                  onChange={(e) =>
                    update(fee.paymentMethodId, 'applicationFeePercentage', e.target.value)
                  }
                  disabled={disabled}
                  error={halfSet && isBlank(entry.applicationFeePercentage)}
                  helperText={
                    halfSet && isBlank(entry.applicationFeePercentage)
                      ? 'Set both, or clear both.'
                      : `Type default: ${
                          isBlank(fee.typeDefaultPercentage)
                            ? 'not set'
                            : `${fee.typeDefaultPercentage}%`
                        }`
                  }
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  inputProps={{
                    min: 0,
                    max: 100,
                    step: '0.01',
                    'aria-label': `${fee.paymentMethodDisplayName} application fee, percentage`,
                  }}
                  sx={{ width: 230 }}
                />
              </Box>

              {halfSet && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Set both the amount and the percentage, or clear both. A half-set pair would take
                  a fixed fee and no percentage, which is almost never what was meant.
                </Alert>
              )}

              <Box
                mt={2}
                display="flex"
                justifyContent="space-between"
                alignItems="flex-end"
                gap={2}
                flexWrap="wrap"
              >
                <Box>
                  {/* Text, not a coloured dot: state must not be carried by colour alone. */}
                  <Typography variant="body2" color="text.secondary">
                    {diverged
                      ? `Differs from the ${organisationTypeName} default`
                      : `Same as the ${organisationTypeName} default`}
                  </Typography>

                  {/*
                    Live region: a screen-reader user typing a rate should hear
                    the consequence change. Being able to check the consequence
                    is the entire reason this example exists.
                  */}
                  <Typography variant="body2" color="text.secondary" aria-live="polite" mt={0.5}>
                    {halfSet ? (
                      'Finish both fields to see what the platform would keep.'
                    ) : example.configured ? (
                      <>
                        The platform keeps{' '}
                        <strong>{format(example.amount, currency)}</strong> of a{' '}
                        {format(EXAMPLE_CHARGE, currency)} charge; {organisationName} receives the
                        rest.
                      </>
                    ) : (
                      <>
                        Not set — the platform keeps the handling fee{' '}
                        <strong>{format(example.amount, currency)}</strong>, as it does today.
                      </>
                    )}
                  </Typography>
                </Box>

                {diverged && onResetToTypeDefault && (
                  <Button
                    size="small"
                    disabled={disabled}
                    onClick={() => onResetToTypeDefault(fee.paymentMethodId)}
                  >
                    Copy the {organisationTypeName} default
                  </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        );
      })}
    </Box>
  );
};

export default ApplicationFeeEditor;
