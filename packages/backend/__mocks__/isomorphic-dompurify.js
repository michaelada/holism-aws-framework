/**
 * Mock for isomorphic-dompurify
 * Used in tests to avoid ES module import issues
 */

const DOMPurify = {
  sanitize: (dirty) => {
    // Simple mock that just returns the input
    // In tests, we're not actually testing sanitization
    return dirty;
  },
  setConfig: () => {},
  clearConfig: () => {},
  isSupported: true,
  removed: [],
  version: '2.0.0'
};

module.exports = DOMPurify;
module.exports.default = DOMPurify;
