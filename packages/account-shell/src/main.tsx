/*
 * Self-hosted fonts.
 *
 * These were loaded from `fonts.googleapis.com`, which costs a DNS lookup, a
 * TLS handshake and a round trip to a third party before any text can be drawn
 * in the intended face. On the member app that is a minor delay; on the public
 * event pages it is the first impression a stranger gets, and Core Web Vitals
 * are a ranking input on exactly those pages.
 *
 * Only the weights the theme uses. Importing a family wholesale ships a dozen
 * files nothing asks for.
 *
 * See docs/PUBLIC_EVENTS_SEO.md §4.
 */
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import '@fontsource/sora/400.css';
import '@fontsource/sora/500.css';
import '@fontsource/sora/600.css';
import '@fontsource/sora/700.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initializeI18n } from './i18n/config';

/**
 * i18next is initialised before the first render.
 *
 * Rendering first and initialising after would flash raw key paths — the
 * organisation's own language is applied later, once it resolves, but the app
 * must never draw with no catalogue at all.
 */
initializeI18n()
  .catch((error) => {
    // A failed catalogue leaves i18next falling back to keys: visibly wrong,
    // but still navigable. Refusing to render would be worse.
    console.error('Failed to initialise translations:', error);
  })
  .finally(() => {
    ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  });
