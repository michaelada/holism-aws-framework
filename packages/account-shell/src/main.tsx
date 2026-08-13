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
