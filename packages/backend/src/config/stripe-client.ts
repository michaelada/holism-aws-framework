import type Stripe from 'stripe';

/**
 * How every Stripe client in this application is built.
 *
 * One module because these settings must be **identical everywhere**, and three
 * files were each declaring their own API version already. A timeout that
 * applied to two clients out of three would be the kind of bug that only shows
 * up on the one path nobody tested.
 */

export const STRIPE_API_VERSION = '2025-10-29.clover';

/**
 * **8 seconds, because Stripe gives a webhook 20 to answer in.**
 *
 * `stripe-node` defaults to an **80 second** request timeout and retries
 * network failures on top of that. Nothing in this application overrode it, so
 * a single slow call made from inside a webhook handler could hold the response
 * for longer than Stripe was ever going to wait — Stripe records a timeout,
 * retries, and the same call is made again. That is what produced a run of
 * timed-out deliveries on a system whose payments were otherwise working.
 *
 * Eight seconds leaves room for one retry inside the handler's own deadline
 * (see `webhook.routes.ts`) and is far longer than a healthy Stripe call, which
 * answers in well under a second.
 */
export const STRIPE_TIMEOUT_MS = 8_000;

/**
 * One retry, not the library's default of two.
 *
 * Retries multiply the worst case: three attempts at the timeout above is 24
 * seconds, which is already past Stripe's webhook deadline. One retry still
 * covers a dropped connection, and the caller — a webhook that Stripe will
 * itself redeliver, or an interactive request that a person can repeat — is
 * never the last line of defence.
 */
export const STRIPE_MAX_NETWORK_RETRIES = 1;

/** The options every `new Stripe(...)` in this application is constructed with. */
export const stripeClientOptions = (): Stripe.StripeConfig => ({
  apiVersion: STRIPE_API_VERSION as Stripe.LatestApiVersion,
  timeout: STRIPE_TIMEOUT_MS,
  maxNetworkRetries: STRIPE_MAX_NETWORK_RETRIES,
});
