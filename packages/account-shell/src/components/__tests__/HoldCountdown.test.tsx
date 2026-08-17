import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { HoldCountdown, formatRemaining } from '../HoldCountdown';

/*
 * `t()` is the identity here, as elsewhere in this suite, so assertions match
 * the interpolated key rather than English prose.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.time ? `${key}:${options.time}` : key,
  }),
}));

const NOW = new Date('2026-08-16T13:00:00.000Z');
const inSeconds = (seconds: number) =>
  new Date(NOW.getTime() + seconds * 1000).toISOString();

describe('HoldCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the time left on a live hold', () => {
    render(<HoldCountdown expiresAt={inSeconds(118)} />);

    expect(screen.getByText('holds.remaining:1:58')).toBeInTheDocument();
  });

  it('counts down as time passes', () => {
    render(<HoldCountdown expiresAt={inSeconds(120)} />);

    act(() => {
      vi.advanceTimersByTime(65_000);
    });

    expect(screen.getByText('holds.remaining:0:55')).toBeInTheDocument();
  });

  it('reads the clock afresh rather than assuming one tick per second', () => {
    // A backgrounded tab has its timers throttled. A counter that decremented
    // per tick would still be promising time the member does not have.
    render(<HoldCountdown expiresAt={inSeconds(120)} />);

    act(() => {
      // The clock jumps 90s; only one tick fires. A decrementing counter would
      // still read 1:59.
      vi.setSystemTime(new Date(NOW.getTime() + 90_000));
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('holds.remaining:0:29')).toBeInTheDocument();
  });

  it('stops at zero rather than counting into negative time', () => {
    render(<HoldCountdown expiresAt={inSeconds(2)} />);

    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(screen.getByText('holds.expired')).toBeInTheDocument();
  });

  it('tells the page once when the hold lapses, so it can reload', () => {
    const onExpire = vi.fn();
    render(<HoldCountdown expiresAt={inSeconds(3)} onExpire={onExpire} />);

    expect(onExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('does not keep firing on every later tick', () => {
    const onExpire = vi.fn();
    render(<HoldCountdown expiresAt={inSeconds(1)} onExpire={onExpire} />);

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a line that holds nothing', () => {
    // Memberships and merchandise take no hold; a clock beside them would be
    // an expiry the member does not in fact have.
    const { container } = render(<HoldCountdown expiresAt={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it('treats a hold that already lapsed as expired straight away', () => {
    render(<HoldCountdown expiresAt={inSeconds(-30)} />);

    expect(screen.getByText('holds.expired')).toBeInTheDocument();
  });

  it('drops its timer when it goes away', () => {
    const { unmount } = render(<HoldCountdown expiresAt={inSeconds(120)} />);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('formatRemaining', () => {
  it('reads as a clock rather than a count of seconds', () => {
    expect(formatRemaining(120)).toBe('2:00');
    expect(formatRemaining(65)).toBe('1:05');
    expect(formatRemaining(9)).toBe('0:09');
    expect(formatRemaining(0)).toBe('0:00');
  });
});
