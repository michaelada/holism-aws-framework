import React from 'react';
import { useTranslation } from 'react-i18next';
import { PoweredByFooter } from '@itsplainsailing/components';

/**
 * The attribution footer, wired up for this application.
 *
 * A wrapper rather than five copies of the same three props. It carries the one
 * thing every screen would otherwise have to remember — that the year is read
 * at render, not written into a translation — and the path to the mark, which
 * is this app's to know.
 *
 * Used on every screen a visitor can reach before they are inside a club: the
 * directory, the gateway, register, not-connected and awaiting-approval. Those
 * five are one journey, and a footer that appeared on some of them would read
 * as a page having lost its footing rather than as a deliberate choice.
 */
export const PoweredBy: React.FC = () => {
  const { t } = useTranslation();

  return (
    <PoweredByFooter
      logoSrc={`${import.meta.env.BASE_URL}itsplainsailing-logo.png`}
      poweredBy={t('poweredBy.text')}
      copyright={t('poweredBy.copyright', { year: new Date().getFullYear() })}
    />
  );
};

export default PoweredBy;
