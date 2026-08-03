import '@testing-library/jest-dom/vitest';

// jsdom does not implement scrollIntoView; components that call it (e.g. to
// auto-scroll a chat view) would otherwise throw during tests.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
