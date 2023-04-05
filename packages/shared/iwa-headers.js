/**
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export const coep = Object.freeze({
  'cross-origin-embedder-policy': 'require-corp',
});
export const coop = Object.freeze({
  'cross-origin-opener-policy': 'same-origin',
});
export const corp = Object.freeze({
  'cross-origin-resource-policy': 'same-origin',
});

export const CSP_HEADER_NAME = 'content-security-policy';
export const csp = Object.freeze({
  [CSP_HEADER_NAME]:
    "base-uri 'none'; default-src 'self'; object-src 'none'; frame-src 'self' https:; connect-src 'self' https:; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' https: blob: data:; media-src 'self' https: blob: data:; font-src 'self' blob: data:; require-trusted-types-for 'script'; frame-ancestors 'self';",
});

// These headers must have these exact values for Isolated Web Apps, whereas the
// CSP header can also be more strict.
const invariableIwaHeaders = Object.freeze({
  ...coep,
  ...coop,
  ...corp,
});

export const iwaHeaderDefaults = Object.freeze({
  ...csp,
  ...invariableIwaHeaders,
});

function headerNamesToLowerCase(headers) {
  const lowerCaseHeaders = {};
  for (const [headerName, headerValue] of Object.entries(headers)) {
    lowerCaseHeaders[headerName.toLowerCase()] = headerValue;
  }
  return lowerCaseHeaders;
}

const ifNotIwaMsg =
  "If you are bundling a non-IWA, set `integrityBlockSign: { isIwa: false }` in the plugin's configuration.";

// Checks if the IWA headers are strict enough or adds in case missing.
export function checkAndAddIwaHeaders(headers) {
  const lowerCaseHeaders = headerNamesToLowerCase(headers);

  // Add missing IWA headers.
  for (const [iwaHeaderName, iwaHeaderValue] of Object.entries(
    iwaHeaderDefaults
  )) {
    if (!lowerCaseHeaders[iwaHeaderName]) {
      console.log(
        `For Isolated Web Apps, ${iwaHeaderName} header was automatically set to ${iwaHeaderValue}. ${ifNotIwaMsg}`
      );
      headers[iwaHeaderName] = iwaHeaderValue;
    }
  }

  // Check strictness of IWA headers (apart from special case `Content-Security-Policy`).
  for (const [iwaHeaderName, iwaHeaderValue] of Object.entries(
    invariableIwaHeaders
  )) {
    if (
      lowerCaseHeaders[iwaHeaderName] &&
      lowerCaseHeaders[iwaHeaderName].toLowerCase() !== iwaHeaderValue
    ) {
      throw new Error(
        `For Isolated Web Apps ${iwaHeaderName} should be ${iwaHeaderValue}. Now it is ${headers[iwaHeaderName]}. ${ifNotIwaMsg}`
      );
    }
  }

  // TODO: Parse and check strictness of `Content-Security-Policy`.
}

export function maybeSetIwaDefaults(opts) {
  // Note that `undefined` is ignored on purpose.
  if (opts.integrityBlockSign.isIwa === false) {
    return;
  }

  // `isIwa` is defaulting to `true` if not provided as currently there is no
  // other use case for integrityBlockSign outside of IWAs.
  opts.integrityBlockSign.isIwa = true;

  if (opts.headerOverride === undefined) {
    console.info(
      `Setting the empty headerOverrides to IWA defaults. To bundle a non-IWA, set \`integrityBlockSign { isIwa: false }\` in your plugin configs. Defaults are set to:\n ${JSON.stringify(
        iwaHeaderDefaults
      )}`
    );
    opts.headerOverride = iwaHeaderDefaults;
  }
}
