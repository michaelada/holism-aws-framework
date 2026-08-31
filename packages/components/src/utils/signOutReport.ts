/**
 * Telling the server that somebody signed out.
 *
 * ## Why this has to be reported at all
 *
 * Every other audit event is recorded by the request that causes it. A sign-out
 * causes no request: the application calls `keycloak.logout()`, the browser
 * leaves for Keycloak, and the session ends somewhere the API never sees. So
 * `auth.logout` had a label, a translation in all six locales and a place in the
 * viewer, and nothing that could ever emit it — the trail showed sign-ins with
 * no matching sign-outs.
 *
 * ## Why `fetch` and not the API client
 *
 * `keepalive` is the whole point. The redirect to Keycloak begins immediately
 * after this returns, and a normal request is cancelled when the page goes
 * away; a `keepalive` request is one the browser promises to finish anyway.
 * Anything that awaited a response would either delay signing out or lose the
 * event, and delaying a sign-out to write an audit row is the wrong trade in
 * both directions.
 *
 * Errors are swallowed for the same reason: a person signing out must never be
 * held up, or stopped, by the audit trail. A lost sign-out row is a gap in a
 * log; a failed sign-out is a security problem.
 */

export interface SignOutReportOptions {
  /** The current access token. Identity is taken from this, never from the body. */
  token?: string | null;
  /**
   * Which front end this is — matches the `azp` claim the sign-in event is
   * filed under, so the two halves of a session line up in the trail.
   */
  application: string;
  /** Overridable for tests. */
  endpoint?: string;
  fetchImpl?: typeof fetch;
}

export function reportSignOut({
  token,
  application,
  endpoint = '/api/audit/session/logout',
  fetchImpl,
}: SignOutReportOptions): void {
  // No token means no session to report the end of, and the endpoint would
  // refuse it anyway — it authenticates precisely so the body cannot name
  // somebody else.
  if (!token) return;

  const doFetch = fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!doFetch) return;

  try {
    void doFetch(endpoint, {
      method: 'POST',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ application }),
    })?.catch(() => {
      /* A sign-out is not blocked by a failed report. */
    });
  } catch {
    /* Nor by a fetch that throws synchronously. */
  }
}
