/**
 * The origins this deployment trusts.
 *
 * One definition, used both by CORS and by anywhere that has to decide whether
 * a client-supplied URL is safe to redirect a browser to. Two copies of this
 * list drift, and the failure when they do is subtle: CORS lets a request
 * through and then something downstream refuses it for a reason the caller
 * cannot see.
 */

/**
 * The origin this deployment is served from, taken from `PUBLIC_URL`.
 *
 * Always trusted, and not something an operator should have to remember to
 * repeat: the browser is *on* this origin, so refusing it refuses the
 * application itself.
 */
function ownOrigin(): string | null {
  const publicUrl = process.env.PUBLIC_URL;
  if (!publicUrl) return null;
  try {
    return new URL(publicUrl).origin;
  } catch {
    // Misconfigured rather than absent. Fall back to the explicit list.
    return null;
  }
}

/**
 * `ALLOWED_ORIGINS`, comma-separated, plus the deployment's own origin.
 *
 * Deriving the latter is what stops the failure this was written for. Only
 * `PUBLIC_URL` was set on the single-instance deployment, so this returned the
 * `http://localhost:3000` fallback and every request carrying an `Origin`
 * header was refused — which meant **every write in every application**, while
 * reads kept working, because browsers omit `Origin` on a same-origin GET but
 * send it on PUT, POST and DELETE.
 *
 * That asymmetry is why it looked like a bug in one endpoint. It was not: the
 * site was readable and entirely unwritable, and the only clue was a 500 whose
 * message never reached the browser.
 *
 * `ALLOWED_ORIGINS` remains the way to trust anything *else* — a separately
 * hosted front end, another domain pointed at the same API.
 */
export function allowedOrigins(): string[] {
  const configured =
    process.env.ALLOWED_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean) ?? [];

  const own = ownOrigin();
  const origins = own && !configured.includes(own) ? [...configured, own] : configured;

  return origins.length > 0 ? origins : ['http://localhost:3000'];
}

/**
 * Whether an origin is trusted.
 *
 * Development additionally accepts any `http://localhost` origin, matching what
 * CORS already does — the front ends run on several ports and requiring every
 * one of them to be listed makes a fresh checkout fail for no good reason.
 */
export function isAllowedOrigin(origin: string): boolean {
  if (allowedOrigins().includes(origin)) return true;
  return process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost');
}

/**
 * Whether a URL is safe to redirect a browser to.
 *
 * **Not** a comparison against the request's own `Host` header. That is the
 * obvious implementation and it is wrong here: every front end reaches this API
 * through a proxy — Vite's dev server with `changeOrigin: true`, and nginx in
 * production — which rewrites `Host` to the backend's own address. Comparing
 * against it rejects the very origin the browser is actually on, which is how
 * this first shipped: the org-admin app on :5175 was refused because the
 * backend saw its own :3000.
 *
 * An explicit allowlist is also the stronger check. It does not depend on how
 * the request happened to be routed, and it is the same list an operator
 * already maintains for CORS.
 */
export function isAllowedRedirectUrl(candidate: string): boolean {
  try {
    const url = new URL(candidate);

    // Only ever hand a browser back to http(s). `javascript:` and `data:` URLs
    // parse perfectly well and are exactly what an open-redirect check is for.
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;

    return isAllowedOrigin(url.origin);
  } catch {
    // Not a URL at all.
    return false;
  }
}
