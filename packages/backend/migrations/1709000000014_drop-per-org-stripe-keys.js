/* eslint-disable camelcase */

/**
 * Remove the per-organisation Stripe credentials from
 * `organizations.settings.paymentSettings`.
 *
 * These four keys — `stripeEnabled`, `stripePublishableKey`, `stripeSecretKey`
 * and `stripeWebhookSecret` — belonged to the **direct-charge** model, where
 * every club had its own Stripe account and its own keys. The platform moved to
 * **Connect destination charges**: one platform key from the environment, and
 * per organisation nothing but a connected account id in
 * `settings.stripeConnect`. See docs/ACCOUNT_USER_APP_PHASE8_CHECKOUT.md §1.
 *
 * No payment code path has ever read them — `stripe.provider.ts` builds its
 * client from `STRIPE_SECRET_KEY`, and the account-shell loads Stripe.js from
 * `VITE_STRIPE_PUBLISHABLE_KEY`. The org-admin settings tab was the only writer,
 * and it no longer offers the fields.
 *
 * They are deleted rather than left to rot because a `sk_live_…` sitting in a
 * JSONB column that nothing validates, rotates or audits is a credential at
 * rest with no owner. Dropping the fields from the service contract alone would
 * not clear them: `getPaymentSettings` spreads the stored object over the
 * defaults, so any stale key would keep being handed back to the client until
 * someone happened to press Save.
 *
 * `-` on a jsonb object is a no-op when the key is absent, so this is safe on
 * rows that never had payment settings, and re-runnable.
 */

exports.up = (pgm) => {
  pgm.sql(`
    UPDATE organizations
    SET settings = jsonb_set(
          settings,
          '{paymentSettings}',
          (settings->'paymentSettings')
            - 'stripeEnabled'
            - 'stripePublishableKey'
            - 'stripeSecretKey'
            - 'stripeWebhookSecret',
          false
        ),
        updated_at = NOW()
    WHERE jsonb_typeof(settings->'paymentSettings') = 'object'
      AND (settings->'paymentSettings') ?| array[
        'stripeEnabled',
        'stripePublishableKey',
        'stripeSecretKey',
        'stripeWebhookSecret'
      ]
  `);
};

/**
 * Irreversible by design. The removed values were secrets; this migration is
 * the point at which they stop existing, and re-creating the empty shells would
 * only re-add dead keys. Restoring the *fields* means reverting the code that
 * dropped them, not the data.
 */
exports.down = () => {};
