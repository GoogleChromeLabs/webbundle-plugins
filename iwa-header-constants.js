const coep = { 'cross-origin-embedder-policy': 'require-corp' };
const coop = { 'cross-origin-opener-policy': 'same-origin' };
const corp = { 'cross-origin-resource-policy': 'same-origin' };

// TODO(sonkkeli): What about: frame-ancestors 'self'?
const csp = {
  'content-security-policy':
    "base-uri 'none'; default-src 'self'; object-src 'none'; frame-src 'self' https:; connect-src 'self' https:; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' https: blob: data:; media-src 'self' https: blob: data:; font-src 'self' blob: data:; require-trusted-types-for 'script';",
};

const invariableIwaHeaders = { ...coep, ...coop, ...corp };

const iwaHeaderDefaults = {
  ...csp,
  ...invariableIwaHeaders,
};

module.exports = {
  coep,
  coop,
  corp,
  csp,
  invariableIwaHeaders,
  iwaHeaderDefaults,
};
