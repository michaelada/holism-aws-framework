/*
 * Which club you are signing in to.
 *
 * A member arrives here from one organisation's gateway — "Meath Hunt Pony
 * Club", with the club's name and colours on it — and lands on a page that says
 * only "Member Login". The realm is shared by every club, so nothing on
 * Keycloak's side names the one they came from, and a member with accounts at
 * two of them has no way to tell which sign-in they are completing.
 *
 * ## How the club is known
 *
 * From this page's own URL. The account app sends `redirect_uri` back to the
 * club it started at:
 *
 *   /auth?client_id=account-app&redirect_uri=…%2Faccount%2Fmhpc&code_challenge=…
 *
 * `${client.name}` cannot answer this — all four clubs share the `account-app`
 * client, so it would say the same thing for every one of them. Keycloak 26's
 * Organizations feature (`kc_org`) is the purpose-built answer and this is
 * Keycloak 23, so the URL is what there is.
 *
 * ## Why sessionStorage
 *
 * **A wrong password loses the parameter.** Keycloak re-renders the form at
 * `/login-actions/authenticate?execution=…&client_id=…&tab_id=…`, which carries
 * no `redirect_uri` — verified in a browser, not assumed. Reading the URL alone
 * would name the club on the first attempt and drop it the moment somebody
 * mistyped, which is the worst moment to look uncertain about where you are.
 *
 * This page is served from Keycloak's own origin, so the code stashed on the
 * first render is still there for the retry, and dies with the tab.
 *
 * ## Rules this file follows, the same as posts.js
 *
 * **It must never be able to break the sign-in form.** Everything is inside a
 * try/catch and any failure leaves the line absent — which is exactly the page
 * as it was before. Nobody reading this page has signed in, so nobody can
 * report it broken; everybody needs the password field to work.
 *
 * **The name goes in as text, never as markup.** It arrives, ultimately, from a
 * query parameter on a public URL, so it is attacker-controllable. `textContent`
 * is the whole defence and it is not negotiable — this is the one page where an
 * injection would be worth mounting.
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'ips.login.orgCode';

  /**
   * The club code from `redirect_uri`, or the one remembered from a previous
   * render of this same sign-in.
   *
   * Matches the account app's own URL shape: `/account/{orgCode}` , with
   * anything after it ignored — a member returning to a deep link signs in
   * against the club in the path, not the page.
   */
  function orgCode() {
    var remembered = null;
    try {
      remembered = window.sessionStorage.getItem(STORAGE_KEY);
    } catch (error) {
      // Private browsing, or storage disabled. The URL below may still answer.
    }

    var redirect = new URLSearchParams(window.location.search).get('redirect_uri');
    if (!redirect) return remembered;

    var match = /\/account\/([A-Za-z0-9_-]+)/.exec(redirect);
    if (!match) return remembered;

    try {
      window.sessionStorage.setItem(STORAGE_KEY, match[1]);
    } catch (error) {
      // Nothing to do: this render still has the code from the URL.
    }
    return match[1];
  }

  /**
   * Where the API is. Identical reasoning to `posts.js` — same origin
   * everywhere it is deployed, with a development port check and a theme
   * property for a split-host setup.
   */
  function apiBase(root) {
    var configured = root.getAttribute('data-api-base');
    if (configured) return configured.replace(/\/$/, '');
    if (window.location.port === '8080') return 'http://localhost:3000';
    return '';
  }

  function show(root, name) {
    // `textContent`. See the note at the top of this file.
    root.textContent = root.getAttribute('data-template').replace('%organisation%', name);
    root.hidden = false;
  }

  function start() {
    var root = document.getElementById('ips-club');
    if (!root) return;

    var code = orgCode();
    if (!code) return;

    var request = new XMLHttpRequest();
    request.open('GET', apiBase(root) + '/api/public/organisations/' + encodeURIComponent(code), true);
    request.onload = function () {
      try {
        if (request.status !== 200) return;
        var organisation = JSON.parse(request.responseText);
        /*
         * The club's own name, or nothing at all.
         *
         * Not the code as a fallback: "Signing in to mhpc" tells a member less
         * than the silence does, and reads as something having gone wrong.
         */
        if (organisation && organisation.displayName) show(root, organisation.displayName);
      } catch (error) {
        // Leaves the line absent, which is the page as it was.
      }
    };
    request.send();
  }

  try {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start);
    } else {
      start();
    }
  } catch (error) {
    // As above: the form is what matters and it is untouched.
  }
})();
