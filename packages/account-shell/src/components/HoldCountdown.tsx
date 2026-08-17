import React, { useEffect, useState } from 'react';
import { Typography, TypographyProps } from '@mui/material';
import { useTranslation } from 'react-i18next';

export interface HoldCountdownProps {
  /** ISO instant the hold lapses. */
  expiresAt: string | null | undefined;
  /**
   * Called once, when the countdown reaches zero.
   *
   * The screen behind it is now wrong — a slot the member no longer holds is
   * still drawn as theirs — so this is how the page knows to reload rather than
   * leaving them looking at a lie until they navigate.
   */
  onExpire?: () => void;
  variant?: TypographyProps['variant'];
  color?: TypographyProps['color'];
}

/** Seconds left, floored at zero. */
const remainingSeconds = (expiresAt: string, now: number): number =>
  Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));

/** `m:ss`, because a bare count of seconds reads as a number, not a clock. */
export const formatRemaining = (seconds: number): string =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/**
 * How long a member has left on something they are holding.
 *
 * A hold that expires silently is worse than no hold at all: the member is told
 * the slot is theirs, looks away, and comes back to find it gone with no
 * explanation. A visible clock makes the deal honest — you have this, for this
 * long — and gives them a reason to finish rather than browse.
 *
 * Ticks once a second and stops dead at zero rather than counting negative.
 */
export const HoldCountdown: React.FC<HoldCountdownProps> = ({
  expiresAt,
  onExpire,
  variant = 'caption',
  color = 'text.secondary',
}) => {
  const { t } = useTranslation();
  const [seconds, setSeconds] = useState(() =>
    expiresAt ? remainingSeconds(expiresAt, Date.now()) : 0
  );

  useEffect(() => {
    if (!expiresAt) return undefined;

    // Re-read the clock on every tick rather than decrementing: a tab that was
    // backgrounded gets throttled, and a counter that assumed one tick per
    // second would still be showing time the member does not have.
    const tick = () => setSeconds(remainingSeconds(expiresAt, Date.now()));

    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  /*
   * Fired from an effect keyed on the expiry rather than from the tick itself,
   * so a re-render cannot call it twice for the same hold.
   */
  useEffect(() => {
    if (!expiresAt || seconds > 0 || !onExpire) return undefined;

    onExpire();
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt, seconds === 0]);

  if (!expiresAt) return null;

  return (
    <Typography variant={variant} color={seconds === 0 ? 'error.main' : color}>
      {seconds > 0
        ? t('holds.remaining', { time: formatRemaining(seconds) })
        : t('holds.expired')}
    </Typography>
  );
};

export default HoldCountdown;
