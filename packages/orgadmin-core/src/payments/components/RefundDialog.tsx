/**
 * Refunding a payment, or part of one.
 *
 * Four ways to arrive at an amount, because a club asked about a refund is
 * answering four different questions:
 *
 *  - *the whole thing* — the entry is off, give them their money back;
 *  - *the whole thing bar the fee* — the card cost us that, and we are not out
 *    of pocket on somebody's change of mind;
 *  - *this item* — one of two children withdrew;
 *  - *this much* — a goodwill figure agreed on the phone.
 *
 * The first two settle the payment. The other two leave it **partially
 * refunded** and can be repeated: refunding two children's entries a week apart
 * ends at *Refunded*, not at a payment that is "partially" so for ever.
 *
 * Where the refund names entries, the club is **asked** whether to withdraw
 * them from the event. Not assumed: a refund can be a goodwill gesture with the
 * rider still expected on the day.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  InputAdornment,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from '@aws-web-framework/orgadmin-shell';

export type RefundScope = 'full' | 'lessHandlingFee' | 'items' | 'amount';

/** One line of the payment, as the detail endpoint returns it. */
export interface RefundableLine {
  id: string;
  itemType: string;
  description: string;
  subjectName: string | null;
  /** Minor units. */
  fee: number;
  handlingFee: number;
  refundedAmount: number;
  entryStatus: string | null;
}

export interface RefundRequest {
  scope: RefundScope;
  refundAmount?: number;
  lineIds?: string[];
  refundReason: string;
  removeEntries: boolean;
}

interface RefundDialogProps {
  open: boolean;
  /** Major units, both. */
  remaining: number;
  /** Minor units, as the payment records it. Zero where it was never added on. */
  handlingFee: number;
  lines: RefundableLine[];
  processing: boolean;
  formatMoney: (amount: number) => string;
  onClose: () => void;
  onConfirm: (request: RefundRequest) => void;
}

/** What is left to refund on one line, in minor units. */
export const refundableOn = (line: RefundableLine): number =>
  line.fee + line.handlingFee - line.refundedAmount;

/**
 * The amount a scope comes to, in major units.
 *
 * The server computes this again and is the authority — this is what the club
 * is shown before they commit, and the two must agree or the dialog is lying.
 */
export function amountFor(
  scope: RefundScope,
  options: {
    remaining: number;
    handlingFee: number;
    lines: RefundableLine[];
    selected: string[];
    typed: string;
  }
): number {
  switch (scope) {
    case 'full':
      return options.remaining;
    case 'lessHandlingFee':
      return Math.round((options.remaining - options.handlingFee / 100) * 100) / 100;
    case 'items':
      return (
        options.lines
          .filter((line) => options.selected.includes(line.id))
          .reduce((total, line) => total + refundableOn(line), 0) / 100
      );
    case 'amount':
    default: {
      const typed = Number(options.typed);
      return Number.isFinite(typed) ? typed : 0;
    }
  }
}

const RefundDialog: React.FC<RefundDialogProps> = ({
  open,
  remaining,
  handlingFee,
  lines,
  processing,
  formatMoney,
  onClose,
  onConfirm,
}) => {
  const { t } = useTranslation();

  const [scope, setScope] = useState<RefundScope>('full');
  const [selected, setSelected] = useState<string[]>([]);
  const [typed, setTyped] = useState('');
  const [reason, setReason] = useState('');
  const [removeEntries, setRemoveEntries] = useState(false);

  // A dialog reopened must not still hold the last refund's answers.
  useEffect(() => {
    if (open) {
      setScope('full');
      setSelected([]);
      setTyped('');
      setReason('');
      setRemoveEntries(false);
    }
  }, [open]);

  /** Lines with something left on them. A refunded item cannot go back twice. */
  const refundable = useMemo(() => lines.filter((line) => refundableOn(line) > 0), [lines]);

  const amount = amountFor(scope, { remaining, handlingFee, lines, selected, typed });

  /*
   * Which entries this refund would withdraw. Only where the refund names
   * items, or settles the whole payment — an arbitrary amount off a basket of
   * four names no item, so there is nothing to offer.
   */
  const entriesInScope = useMemo(() => {
    if (scope === 'amount') return [];
    const covered =
      scope === 'items' ? refundable.filter((line) => selected.includes(line.id)) : refundable;
    return covered.filter(
      (line) => line.itemType === 'event_entry' && line.entryStatus !== 'removed'
    );
  }, [scope, selected, refundable]);

  /*
   * More than the payment has left.
   *
   * Reachable from the items list as well as from a typed figure: an earlier
   * refund of an arbitrary amount comes off the payment without naming a line,
   * so the lines can still add up to more than remains. The server refuses it
   * either way; saying so here means the club sees why before they commit.
   */
  const tooMuch = amount > remaining + 0.0001;
  const valid =
    reason.trim().length > 0 &&
    amount > 0 &&
    !tooMuch &&
    (scope !== 'items' || selected.length > 0);

  const confirm = () =>
    onConfirm({
      scope,
      // Only the arbitrary scope sends a figure; the rest are the server's to
      // compute, or it could be told a scope and an amount that disagree.
      refundAmount: scope === 'amount' ? Number(typed) : undefined,
      lineIds: scope === 'items' ? selected : undefined,
      refundReason: reason.trim(),
      removeEntries: removeEntries && entriesInScope.length > 0,
    });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('payments.refund.title')}</DialogTitle>
      <DialogContent>
        <FormControl sx={{ mt: 1 }}>
          <FormLabel>{t('payments.refund.howMuch')}</FormLabel>
          <RadioGroup value={scope} onChange={(event) => setScope(event.target.value as RefundScope)}>
            <FormControlLabel
              value="full"
              control={<Radio />}
              label={t('payments.refund.scopes.full', { amount: formatMoney(remaining) })}
            />
            {/*
              Offered only where a fee was added on. An item whose price already
              absorbs its fee has none to keep back, and the option would be a
              distinction that is not one.
            */}
            {handlingFee > 0 && (
              <FormControlLabel
                value="lessHandlingFee"
                control={<Radio />}
                label={t('payments.refund.scopes.lessHandlingFee', {
                  amount: formatMoney(Math.round((remaining - handlingFee / 100) * 100) / 100),
                  fee: formatMoney(handlingFee / 100),
                })}
              />
            )}
            {/*
              Only where there is a choice to make.
              
              With one refundable item left, "particular items" and "the whole
              payment" are the same refund said two ways — and offering it
              invites a click, a checkbox and a second confirmation to reach
              somewhere one click already goes.
            */}
            {refundable.length > 1 && (
              <FormControlLabel
                value="items"
                control={<Radio />}
                label={t('payments.refund.scopes.items')}
              />
            )}
            <FormControlLabel
              value="amount"
              control={<Radio />}
              label={t('payments.refund.scopes.amount')}
            />
          </RadioGroup>
        </FormControl>

        {scope === 'items' && (
          <Box sx={{ mt: 1, mb: 2 }}>
            <Divider sx={{ mb: 1 }} />
            {refundable.map((line) => (
              <FormControlLabel
                key={line.id}
                sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}
                control={
                  <Checkbox
                    checked={selected.includes(line.id)}
                    onChange={(event) =>
                      setSelected((current) =>
                        event.target.checked
                          ? [...current, line.id]
                          : current.filter((id) => id !== line.id)
                      )
                    }
                  />
                }
                label={
                  <Box sx={{ pt: 1 }}>
                    <Typography variant="body2">
                      {line.description} — {formatMoney(refundableOn(line) / 100)}
                    </Typography>
                    {line.subjectName && (
                      <Typography variant="caption" color="textSecondary">
                        {line.subjectName}
                      </Typography>
                    )}
                  </Box>
                }
              />
            ))}
            {refundable.length < lines.length && (
              <Typography variant="caption" color="textSecondary" display="block">
                {t('payments.refund.someAlreadyRefunded')}
              </Typography>
            )}
            {tooMuch && (
              <Typography variant="caption" color="error" display="block">
                {t('payments.refund.tooMuch', { amount: formatMoney(remaining) })}
              </Typography>
            )}
          </Box>
        )}

        {scope === 'amount' && (
          <TextField
            sx={{ mt: 1, mb: 2 }}
            fullWidth
            type="number"
            label={t('payments.refund.amountLabel')}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            error={tooMuch}
            helperText={
              tooMuch
                ? t('payments.refund.tooMuch', { amount: formatMoney(remaining) })
                : t('payments.refund.upTo', { amount: formatMoney(remaining) })
            }
            InputProps={{ startAdornment: <InputAdornment position="start">€</InputAdornment> }}
          />
        )}

        <TextField
          sx={{ mt: 1 }}
          fullWidth
          multiline
          rows={3}
          label={t('payments.refund.reasonLabel')}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('payments.refund.reasonPlaceholder')}
          required
        />

        {/*
          Withdrawing the entries is asked, not assumed. A club may refund an
          entry as a goodwill gesture and still expect the rider on the day.
        */}
        {entriesInScope.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={removeEntries}
                  onChange={(event) => setRemoveEntries(event.target.checked)}
                />
              }
              label={t('payments.refund.removeEntries', { count: entriesInScope.length })}
            />
            <Typography variant="caption" color="textSecondary" display="block">
              {t('payments.refund.removeEntriesHelp')}
            </Typography>
          </Box>
        )}

        <Alert severity="info" sx={{ mt: 2 }}>
          {t('payments.refund.summary', { amount: formatMoney(Math.max(amount, 0)) })}
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={processing}>
          {t('common.actions.cancel')}
        </Button>
        <Button onClick={confirm} color="error" variant="contained" disabled={!valid || processing}>
          {processing ? t('payments.refund.processing') : t('payments.refund.confirmButton')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RefundDialog;
