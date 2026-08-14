import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useBookingsLabel } from '../useBookingsLabel';

const publicDetail = vi.hoisted(() => ({ current: null as any }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => (key === 'nav.calendar' ? 'Bookings' : key) }),
}));

vi.mock('../../context/AccountOrganisationContext', () => ({
  useAccountOrganisation: () => ({ publicDetail: publicDetail.current }),
}));

describe('useBookingsLabel', () => {
  const withBranding = (branding: any) => {
    publicDetail.current = branding === undefined ? null : { branding };
    return renderHook(() => useBookingsLabel()).result.current;
  };

  it('uses the translated default when the club has not renamed it', () => {
    expect(withBranding({ bookingsLabel: '' })).toBe('Bookings');
  });

  it('uses the club’s own word when it has', () => {
    expect(withBranding({ bookingsLabel: 'Court Booking' })).toBe('Court Booking');
  });

  it('falls back when the organisation has not loaded yet', () => {
    // The shell renders before the public record arrives; a blank menu entry
    // would be worse than the default word.
    expect(withBranding(undefined)).toBe('Bookings');
  });

  it('treats a whitespace-only label as unset', () => {
    expect(withBranding({ bookingsLabel: '   ' })).toBe('Bookings');
  });

  it('copes with branding missing entirely', () => {
    expect(withBranding(null)).toBe('Bookings');
  });
});
