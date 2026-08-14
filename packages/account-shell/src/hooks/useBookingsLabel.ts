import { useTranslation } from 'react-i18next';
import { useAccountOrganisation } from '../context/AccountOrganisationContext';

/**
 * What this club calls its bookings area.
 *
 * "Bookings" is what the software does; a club's members know it as the court,
 * the arena or the pool. An organisation can set its own word under Branding,
 * and every place the member app names the area reads it from here — the
 * navigation entry and the home screen's section heading — so the two cannot
 * drift apart.
 *
 * Falls back to the translated default when a club has not set one, which is
 * the ordinary case. The custom label is deliberately **not** translated: it is
 * a name the club chose, and machine-translating "Court Booking" into five
 * languages would produce five things the club never agreed to.
 */
export function useBookingsLabel(): string {
  const { t } = useTranslation();
  const { publicDetail } = useAccountOrganisation();

  return publicDetail?.branding?.bookingsLabel?.trim() || t('nav.calendar');
}

export default useBookingsLabel;
