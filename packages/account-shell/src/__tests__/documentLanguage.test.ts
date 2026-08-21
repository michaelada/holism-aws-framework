/**
 * The document says what language it is in.
 *
 * `index.html` hard-codes `lang="en"` and nothing had ever changed it, so every
 * page in this application claimed to be English — including a German club's,
 * read by a German member, in German.
 *
 * Three things read that attribute and all three were being misled: screen
 * readers pick a voice and pronunciation from it, browsers offer translation
 * from it, and search engines take it as a language signal — which matters most
 * on the public pages a stranger reaches from a search result.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { initializeI18n, changeLocale } from '../i18n/config';

beforeEach(() => {
  document.documentElement.lang = 'en';
});

describe('document language', () => {
  it('is set when i18n starts, not left at the shell’s default', async () => {
    await initializeI18n();

    expect(document.documentElement.lang).not.toBe('en');
    expect(document.documentElement.lang).toMatch(/^[a-z]{2}(-[A-Z]{2})?$/);
  });

  it('follows a locale change', async () => {
    await initializeI18n();

    await changeLocale('de-DE');
    expect(document.documentElement.lang).toBe('de-DE');

    await changeLocale('fr-FR');
    expect(document.documentElement.lang).toBe('fr-FR');
  });

  it('carries the region, not just the language', async () => {
    /*
     * `pt-PT` and `pt-BR` are different catalogues here, and a screen reader
     * pronounces them differently. Truncating to `pt` would discard the only
     * part that distinguishes them.
     */
    await initializeI18n();
    await changeLocale('pt-PT');

    expect(document.documentElement.lang).toBe('pt-PT');
  });
});
