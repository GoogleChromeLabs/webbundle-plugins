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

function headerNamesToLowerCase(headers) {
  const lowerCaseHeaders = {};
  for (const key of Object.keys(headers)) {
    lowerCaseHeaders[key.toLowerCase()] = headers[key];
  }
  return lowerCaseHeaders;
}

const ifNotIwaMsg =
  'If you are bundling a non-IWA, set integrityBlockSign { isIwa: false } in your plugins configs.';

// Checks if the IWA headers are strict enough or adds in case missing.
function checkAndAddIwaHeaders(headers) {
  const lowerCaseHeaders = headerNamesToLowerCase(headers);

  // Add missing IWA headers.
  for (const iwaHeaderName of Object.keys(iwaHeaderDefaults)) {
    if (!lowerCaseHeaders[iwaHeaderName]) {
      console.log(
        `For Isolated Web Apps, ${iwaHeaderName} header was automatically set to ${iwaHeaderDefaults[iwaHeaderName]}. ${ifNotIwaMsg}`
      );
      headers[iwaHeaderName] = iwaHeaderDefaults[iwaHeaderName];
    }
  }

  // Check strictness of IWA headers (apart from special case `Content-Security-Policy`).
  for (const iwaHeaderName of Object.keys(invariableIwaHeaders)) {
    if (
      lowerCaseHeaders[iwaHeaderName] && lowerCaseHeaders[iwaHeaderName].toLowerCase() !==
      invariableIwaHeaders[iwaHeaderName]
    ) {
      throw new Error(
        `For Isolated Web Apps ${iwaHeaderName} should be ${invariableIwaHeaders[iwaHeaderName]}. Now it is ${headers[iwaHeaderName]}. ${ifNotIwaMsg}`
      );
    }
  }

  // TODO: Parse and check strictness of `Content-Security-Policy`.
}

module.exports = {
  coep,
  coop,
  corp,
  CSP_HEADER_NAME,
  csp,
  invariableIwaHeaders,
  iwaHeaderDefaults,
  headerNamesToLowerCase,
  checkAndAddIwaHeaders,
};
