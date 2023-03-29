const coep = Object.freeze({ 'cross-origin-embedder-policy': 'require-corp' });
const coop = Object.freeze({ 'cross-origin-opener-policy': 'same-origin' });
const corp = Object.freeze({ 'cross-origin-resource-policy': 'same-origin' });

const CSP_HEADER_NAME = 'content-security-policy';
const csp = Object.freeze({
  [CSP_HEADER_NAME]:
    "base-uri 'none'; default-src 'self'; object-src 'none'; frame-src 'self' https:; connect-src 'self' https:; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' https: blob: data:; media-src 'self' https: blob: data:; font-src 'self' blob: data:; require-trusted-types-for 'script'; frame-ancestors 'self';",
});

// These headers must have these exact values for Isolated Web Apps, whereas the
// CSP header can also be more strict.
const invariableIwaHeaders = Object.freeze({ ...coep, ...coop, ...corp });

const iwaHeaderDefaults = Object.freeze({
  ...csp,
  ...invariableIwaHeaders,
});

module.exports = {
  coep,
  coop,
  corp,
  CSP_HEADER_NAME,
  csp,
  invariableIwaHeaders,
  iwaHeaderDefaults,
};
