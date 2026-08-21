/* eslint-disable camelcase */

/**
 * Announcements the platform shows on the two login pages.
 *
 * Written by an ItsPlainSailing super admin, read by everybody signing in to
 * either application — planned maintenance, a new feature, a change of terms.
 * The login page is the one screen every user of the product passes through,
 * which is what makes it the right place and also what makes an accident here
 * expensive: a broken post is seen by everyone at once, and by people who are
 * not yet signed in.
 *
 * ## `platform_`, not `posts`
 *
 * The prefix is doing real work. Almost every table in this schema belongs to
 * an organisation and carries `organisation_id`; this one deliberately does
 * not, and a bare `posts` would invite the next person to add one. These are
 * the *platform's* posts. An organisation's own announcements, if they are ever
 * wanted, are a different table with a tenancy column and a different audience.
 *
 * ## Two independent surface flags rather than one enum
 *
 * A post very often belongs on both login pages — planned maintenance affects
 * everyone — and quite often on exactly one: a release note about Lodgements
 * means nothing to a member entering a pony club rally. An enum of
 * `account | orgadmin | both` says the same thing but makes "both" a value that
 * has to be remembered rather than two boxes that are obviously independent,
 * and it makes "neither" unsayable — which is a legitimate state for a post
 * being drafted.
 *
 * ## Status and visibility are separate questions
 *
 * `status` is whether the post is finished; the surface flags are where it
 * belongs. Collapsing them would mean un-publishing a post by unticking two
 * boxes and then having to remember what they were.
 */

exports.up = (pgm) => {
  pgm.createTable('platform_posts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    title: { type: 'varchar(255)', notNull: true },
    /*
     * Rich text, stored as HTML from the same editor the rest of the product
     * uses, and sanitised on the way *out* rather than on the way in — the
     * renderer is the only thing that knows what it is safe to render, and
     * sanitising on input silently destroys content an author can still see in
     * the editor.
     */
    body: { type: 'text', notNull: true, default: '' },
    /**
     * The S3 key of the image, not a URL.
     *
     * URLs belong to a deployment: a bucket rename, a CDN, or a move from
     * signed to public delivery would rewrite every row. The key is the durable
     * fact, and the public URL is derived from it at read time.
     */
    image_key: { type: 'varchar(500)' },
    image_mime: { type: 'varchar(100)' },
    /**
     * `[{ "label": "Read more", "url": "https://…" }]`.
     *
     * JSONB rather than a child table because these are never queried across
     * posts, never joined, and never exist without their post — a table would
     * buy referential integrity nothing needs and cost a join on every read of
     * the busiest anonymous endpoint in the product.
     */
    links: { type: 'jsonb', notNull: true, default: '[]' },
    status: { type: 'varchar(20)', notNull: true, default: 'inactive' },
    show_on_account_login: { type: 'boolean', notNull: true, default: false },
    show_on_orgadmin_login: { type: 'boolean', notNull: true, default: false },
    /**
     * Where this post sits in the arranged order.
     *
     * An integer the admin screen rewrites wholesale when posts are reordered,
     * rather than a fractional index: the list is short, an operator reorders it
     * rarely, and rewriting every row keeps the column dense and readable in a
     * way a fractional scheme does not.
     */
    display_order: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('CURRENT_TIMESTAMP') },
  });

  pgm.addConstraint('platform_posts', 'platform_posts_status_check', {
    check: "status IN ('active', 'inactive')",
  });

  /*
   * The index the login pages actually use.
   *
   * Both anonymous reads are "active posts for this surface, in order". Partial
   * on `status` because an inactive post is never read by them, and the table is
   * read on every single sign-in attempt across the whole platform.
   */
  pgm.createIndex('platform_posts', ['display_order'], {
    name: 'platform_posts_active_order_index',
    where: "status = 'active'",
  });
};

exports.down = (pgm) => {
  pgm.dropTable('platform_posts');
};
