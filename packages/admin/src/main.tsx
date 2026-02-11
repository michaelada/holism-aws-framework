import ReactDOM from 'react-dom/client';
import App from './App';

// Temporarily disable StrictMode to prevent double-mounting during Keycloak initialization
// StrictMode causes components to mount twice in development which can interfere with Keycloak
ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
);
