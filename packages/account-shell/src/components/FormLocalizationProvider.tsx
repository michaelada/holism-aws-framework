import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enGB, de, es, fr, it, pt } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { DEFAULT_LOCALE, localeForLanguage, SupportedLocale } from '../i18n/config';

/**
 * The date/time picker localisation context, for any screen that renders a
 * `FieldRenderer`.
 *
 * `DateRenderer` in `@itsplainsailing/components` deliberately does not carry
 * its own `LocalizationProvider` — in this monorepo Vite can load a second copy
 * of `@mui/x-date-pickers` through the source alias, and a provider inside the
 * library would then belong to a different module instance than the pickers the
 * app renders, so its context would never reach them. The provider therefore
 * has to be supplied by the consuming app, which is what this component is for.
 * Without it a form containing a date, time or datetime field throws
 * "Can not find the date and time pickers localization context" and takes the
 * whole page down with it — a blank screen, not a broken field.
 *
 * It lives here rather than in `App.tsx` so the picker code is only pulled in
 * by the screens that actually render forms, and rather than being repeated at
 * each call site so a new form screen has one obvious thing to wrap with.
 */
const DATE_FNS_LOCALES: Record<SupportedLocale, Locale> = {
  'en-GB': enGB,
  'de-DE': de,
  'es-ES': es,
  'fr-FR': fr,
  'it-IT': it,
  'pt-PT': pt,
};

export const FormLocalizationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { i18n } = useTranslation();

  /*
   * The pickers follow the member's language, so a French club's date field
   * reads and parses as `jj/mm/aaaa`. `localeForLanguage` maps whatever
   * i18next currently holds — which may be a bare `fr` — onto a supported
   * locale, and falls back to en-GB rather than leaving the adapter without
   * one.
   */
  const adapterLocale = useMemo(
    () => DATE_FNS_LOCALES[localeForLanguage(i18n.language)] ?? DATE_FNS_LOCALES[DEFAULT_LOCALE],
    [i18n.language]
  );

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={adapterLocale}>
      {children}
    </LocalizationProvider>
  );
};

export default FormLocalizationProvider;
