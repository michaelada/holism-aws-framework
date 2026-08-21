/*
 * Platform announcements, on the Keycloak login page.
 *
 * This is the second implementation of the card that
 * `packages/components/src/components/PostCard` renders, and it exists because
 * this page cannot use the first one: Keycloak serves FreeMarker and plain
 * JavaScript, with no React and no build step. The two have to be kept in step
 * by hand, and the order — image, title, message, links — is the part that
 * matters. See docs/PLATFORM_POSTS.md.
 *
 * ## Rules this file follows
 *
 * **It must never be able to break the sign-in form.** Everything is inside a
 * try/catch and a failure leaves the panel empty. Nobody reading this page has
 * signed in, so nobody can report a broken announcements column — but everybody
 * needs the password field beside it to work.
 *
 * **The body HTML is inserted as markup, and that is only safe because the
 * server sanitises it.** `/api/public/posts` runs every body through DOMPurify
 * with a narrow allowlist before it is sent, precisely because this consumer
 * has no sanitiser of its own. Link URLs are re-checked here anyway, since a
 * check that costs one regex is worth having twice.
 */
(function () {
  'use strict';

  /** Only http and https ever become an anchor. */
  function safeHref(url) {
    return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
  }

  /**
   * Where the API is.
   *
   * Same origin in any deployed environment: nginx serves Keycloak under
   * `/auth/` and the API under `/api/` on one host, so a relative path is
   * correct and needs no configuration. The theme property is the override for
   * a split-host setup, and the port check is the development affordance —
   * Keycloak runs on :8080 there while the API is on :3000.
   */
  function apiBase(root) {
    var configured = root.getAttribute('data-api-base');
    if (configured) return configured.replace(/\/$/, '');
    if (window.location.port === '8080') return 'http://localhost:3000';
    return '';
  }

  function element(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function renderPost(post) {
    var card = element('article', 'ips-post');

    if (post.imageUrl) {
      var image = element('img', 'ips-post-image');
      image.src = /^https?:\/\//i.test(post.imageUrl)
        ? post.imageUrl
        : apiBase(document.getElementById('ips-posts')) + post.imageUrl;
      // Empty by design: the title and body sit in the same card, so a
      // description here would be read out twice.
      image.alt = '';
      image.loading = 'lazy';
      card.appendChild(image);
    }

    var content = element('div', 'ips-post-content');

    var title = element('h3', 'ips-post-title');
    // textContent, not innerHTML: the title is a plain string and is never
    // sanitised on the way out, because nothing should ever render it as markup.
    title.textContent = post.title || '';
    content.appendChild(title);

    if (post.body) {
      var body = element('div', 'ips-post-body');
      // Sanitised server-side; see the note at the top of this file.
      body.innerHTML = post.body;
      content.appendChild(body);
    }

    var links = Array.isArray(post.links) ? post.links : [];
    if (links.length > 0) {
      var row = element('div', 'ips-post-links');
      links.forEach(function (link) {
        var href = safeHref(link && link.url);
        if (!href) return;
        var anchor = element('a', 'ips-post-link');
        anchor.href = href;
        anchor.textContent = link.label || href;
        anchor.target = '_blank';
        // The reader may have a half-typed password behind this tab.
        anchor.rel = 'noopener noreferrer';
        row.appendChild(anchor);
      });
      if (row.childNodes.length > 0) content.appendChild(row);
    }

    card.appendChild(content);
    return card;
  }

  function load() {
    var root = document.getElementById('ips-posts');
    if (!root) return;

    var surface = root.getAttribute('data-surface');
    if (!surface) return;

    var request = new XMLHttpRequest();
    request.open('GET', apiBase(root) + '/api/public/posts?surface=' + encodeURIComponent(surface), true);

    request.onload = function () {
      try {
        if (request.status < 200 || request.status >= 300) return;

        var posts = JSON.parse(request.responseText);
        if (!Array.isArray(posts) || posts.length === 0) return;

        var list = document.createDocumentFragment();
        posts.forEach(function (post) {
          list.appendChild(renderPost(post));
        });
        root.appendChild(list);

        /*
         * The column is hidden until there is something in it, so a deployment
         * with no posts — which is every one of them until somebody writes the
         * first — gets the original single-column login page rather than an
         * empty half of a screen beside it.
         */
        var shell = document.querySelector('.ips-shell');
        if (shell) shell.setAttribute('data-has-posts', 'true');
      } catch (error) {
        // Deliberately silent. See the note at the top of this file.
      }
    };

    // Both no-ops for the same reason: the sign-in form is what matters here.
    request.onerror = function () {};
    request.ontimeout = function () {};
    request.timeout = 4000;

    try {
      request.send();
    } catch (error) {
      /* ignored */
    }
  }

  // The theme loads scripts in <head> with no `defer`, so the panel does not
  // exist yet at this point.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
