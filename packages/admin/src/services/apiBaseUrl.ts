/**
 * Where the admin app sends its API calls.
 *
 * Empty by default, which makes every request relative to the page's own
 * origin. In development that is the Vite dev server, whose `/api` proxy names
 * `127.0.0.1:3000` explicitly (see `vite.config.ts`); in production nginx
 * serves `/api/` and `/admin` from the same host. Either way the request lands
 * on the backend without the app having to know its address.
 *
 * An absolute `http://localhost:3000` was what this used to be, and it is the
 * one address that cannot be trusted here: on macOS `localhost` resolves to
 * `::1` first, so any other project's dev server holding `[::1]:3000` answers
 * instead — returning its own `index.html` with a 200 for every call, which the
 * app then treats as JSON. The symptom is a table crashing on
 * `rows.every is not a function`, because the "array" is a string of HTML.
 *
 * Set `VITE_API_URL` (or `VITE_API_BASE_URL`, the name the `.env` files use)
 * to override, for the case where the API genuinely lives on another host.
 */
export const API_BASE_URL: string =
  import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '';
