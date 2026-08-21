/**
 * `isomorphic-dompurify`, for Jest.
 *
 * This file exists because the real package is ESM and broke the transform;
 * `transformIgnorePatterns` in jest.config.js now lets it and jsdom through, so
 * the real thing is loadable and this simply hands it over.
 *
 * **It used to return its input unchanged**, with the note "in tests, we're not
 * actually testing sanitization". That is true of most suites, which pass HTML
 * through on the way to something else — and catastrophic for the ones where
 * sanitising *is* the behaviour under test. Against an identity function a
 * `<script>` tag survives exactly as it would survive a sanitiser somebody had
 * deleted, so those assertions passed while proving nothing. The XSS middleware
 * and `platform-post.service` both depend on this actually working, and the
 * latter feeds two anonymous login pages, one of which has no sanitiser of its
 * own.
 *
 * `moduleNameMapper` also intercepts `jest.requireActual`, so a single suite
 * cannot opt out of a mock declared there — which is why this had to be fixed
 * here rather than worked around in the one file that noticed.
 */

// eslint-disable-next-line @typescript-eslint/no-var-requires
const DOMPurify = require('dompurify');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');

const purify = DOMPurify(new JSDOM('').window);

module.exports = purify;
module.exports.default = purify;
