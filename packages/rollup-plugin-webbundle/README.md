# rollup-plugin-webbundle

A Rollup plugin which generates
[Web Bundles](https://wpack-wg.github.io/bundled-responses/draft-ietf-wpack-bundled-responses.html)
output. Currently the spec is still a draft, so this package is also in alpha
until the spec stabilizes.

## Requirements

This plugin requires Node v14.0.0+ and Rollup v1.21.0+.

## Install

Using npm:

```bash
npm install rollup-plugin-webbundle --save-dev
```

## Usage

### General Web Bundle

This example assumes your application entry point is `src/index.js` and static
files (including `index.html`) are located in `static` directory.

```js
/* rollup.config.mjs */
import webbundle from 'rollup-plugin-webbundle';

export default {
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    webbundle({
      baseURL: 'https://example.com/',
      static: { dir: 'static' },
    }),
  ],
};
```

A WBN file `dist/out.wbn` should be written.

### [Isolated Web App](https://github.com/WICG/isolated-web-apps/blob/main/README.md) (Signed Web Bundle)

This example assumes your application entry point is `src/index.js`, static
files (including `index.html`) are located in `static` directory and you have a
`.env` file in the root directory with `ED25519KEY` defined in it. The example
also requires installing `dotenv` npm package as a dev dependency.

It is also required to have a
[Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) at
`/.well-known/manifest.webmanifest`, which can be placed e.g. in the `static`
directory.

Also as in the below example, `baseURL` must be of format
`isolated-app://${WEB_BUNDLE_ID}` for Isolated Web Apps. It can easily be
generated from the private key with `WebBundleId` helper class from `wbn-sign`
package. See
[Scheme explainer](https://github.com/WICG/isolated-web-apps/blob/main/Scheme.md)
for more details. Also note that providing `headerOverride` is optional.

```js
/* rollup.config.mjs */
import webbundle from 'rollup-plugin-webbundle';
import * as wbnSign from 'wbn-sign';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

export default async () => {
  const key = wbnSign.parsePemKey(
    process.env.ENC_ED25519KEY,
    await wbnSign.readPassphrase()
  );

  return {
    input: 'src/index.js',
    output: { dir: 'dist', format: 'esm' },
    plugins: [
      webbundle({
        baseURL: new wbnSign.WebBundleId(
          key
        ).serializeWithIsolatedWebAppOrigin(),
        static: { dir: 'public' },
        output: 'signed.swbn',
        integrityBlockSign: {
          strategy: new wbnSign.NodeCryptoSigningStrategy(key),
        },
        headerOverride: {
          'cross-origin-embedder-policy': 'require-corp',
          'cross-origin-opener-policy': 'same-origin',
          'cross-origin-resource-policy': 'same-origin',
          'content-security-policy':
            "base-uri 'none'; default-src 'self'; object-src 'none'; frame-src 'self' https: blob: data:; connect-src 'self' https: wss:; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' https: blob: data:; media-src 'self' https: blob: data:; font-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; require-trusted-types-for 'script';",
        },
      }),
    ],
  };
};
```

A signed web bundle (containing an
[Integrity Block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md))
should be written to `dist/signed.swbn`.

## Options

### `baseURL`

Type: `string`  
Default: `''`

Specifies the URL prefix prepended to the file names in the bundle. Non-empty
baseURL must end with `/`.

### `formatVersion`

Type: `string`  
Default: `b2`

Specifies WebBundle format version.

### `primaryURL`

Type: `string`  
Default: baseURL

Specifies the bundle's main resource URL. If omitted, the value of the `baseURL`
option is used.

### `static`

Type: `{ dir: String, baseURL?: string }`

If specified, files and subdirectories under `dir` will be added to the bundle.
`baseURL` can be omitted and defaults to `Options.baseURL`.

### `output`

Type: `string`  
Default: `out.wbn`

Specifies the file name of the Web Bundle to emit.

### `integrityBlockSign`

Type:
`{ key: KeyObject, isIwa?: boolean } | { strategy: ISigningStrategy, isIwa?: boolean }`

Object specifying the signing options with
[Integrity Block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md).

### `integrityBlockSign.key`

Note: Either this or `integrityBlockSign.strategy` is required when
`integrityBlockSign` is in place.

Type: `KeyObject`

An unencrypted ed25519 private key can be generated with:

```bash
openssl genpkey -algorithm Ed25519 -out ed25519key.pem
```

For better security, one should prefer using passphrase-encrypted ed25519
private keys. To encrypt an unencrypted private key, run:

```bash
# encrypt the key (will ask for a passphrase, make sure to use a strong one)
openssl pkcs8 -in ed25519key.pem -topk8 -out encrypted_ed25519key.pem

# delete the unencrypted key
rm ed25519key.pem
```

It can be parsed with an imported helper function `parsePemKey(...)` from
`wbn-sign` npm package. For an encrypted private key there's also an async
helper function (`readPassphrase()`) to prompt the user for the passphrase the
key was encrypted with.

```js
// For an unencrypted ed25519 key.
const key = wbnSign.parsePemKey(process.env.ED25519KEY);

// For an encrypted ed25519 key.
const key = wbnSign.parsePemKey(
  process.env.ENC_ED25519KEY,
  await wbnSign.readPassphrase()
);
```

Note that in order for the key to be parsed correctly, it must contain the
`BEGIN` and `END` headers and line breaks (`\n`). Below an example `.env` file:

```bash
ED25519KEY="-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIB8nP5PpWU7HiILHSfh5PYzb5GAcIfHZ+bw6tcd/LZXh\n-----END PRIVATE KEY-----"
```

### `integrityBlockSign.strategy`

Note: Either this or `integrityBlockSign.key` is required when
`integrityBlockSign` is in place.

Type: `ISigningStrategy`

Example web bundle plugin options using a signing strategy:

```js
const pluginOptionsWithPredefinedSigningStrategy = {
  // ...other plugin options here...
  integrityBlockSign: {
    strategy: new wbnSign.NodeCryptoSigningStrategy(privateKey),
  },
};

const pluginOptionsWithCustomSigningStrategy = {
  // ...other plugin options here...
  integrityBlockSign: {
    strategy: new (class /* implements ISigningStrategy */ {
      async sign(data) {
        /** E.g. connect to one's external signing service that signs the
         * payload. */
      }
      async getPublicKey() {
        /** E.g. connect to one's external signing service that returns the
         * public key. */
      }
    })(),
  },
};
```

### `integrityBlockSign.isIwa` (optional)

Type: `boolean`  
Default: `true`

If `undefined` or `true`, enforces certain
[Isolated Web App](https://github.com/WICG/isolated-web-apps) -related checks
for the headers. Also adds default IWA headers if completely missing. If set to
`false`, skips validation checks and doesn't tamper with the headers.

### `headerOverride` (optional)

Type: `{ [key: string]: string; }` |
`(filepath: string) => { [key: string]: string; };`

Object of strings specifying overridden headers or a function returning the same
kind of object.

## Discuss & Help

For discussions related to this repository's content, the Web Bundle plugins for
webpack and rollup, please use
[GitHub Issues](https://github.com/GoogleChromeLabs/webbundle-plugins/issues).

If you'd like to discuss the Web Packaging proposal itself, consider opening an
issue in its incubation repository at https://github.com/WICG/webpackage.

For discussions related to Isolated Web Apps in general, or Chromium-specific
implementation and development questions, please use the
[iwa-dev@chromium.org](https://groups.google.com/a/chromium.org/g/iwa-dev)
mailing list.

If you'd like to discuss the Isolated Web Apps proposal, which builds on top of
Web Bundles, consider opening an issue in the incubation repository at
https://github.com/WICG/isolated-web-apps.

## Release Notes

### v0.1.4

- Add support for ECDSA P-256 SHA-256 signing algorithm
- Bumping underlying wbn-sign version to v0.1.3.

### v0.1.3

- Updates to style-src and wss CSP values.
- Bumping underlying wbn-sign version to v0.1.1.

### v0.1.2

- Add support for `integrityBlockSign.strategy` plugin option which can be used
  to pass one of the predefined strategies or one's own implementation class for
  ISigningStrategy. One can also use the old `integrityBlockSign.key` option,
  which defaults to the predefined `NodeCryptoSigningStrategy` strategy.
- Refactor plugin to be in TypeScript.
- Combine the Webpack and Rollup web bundle plugins to live in the same
  repository and share some duplicated code. Taking advantage of
  [npm workspaces](https://docs.npmjs.com/cli/v7/using-npm/workspaces).

### v0.1.1

- Add support for overriding headers with an optional `headerOverride` plugin
  option.

### v0.1.0

- BREAKING CHANGE: Change type of integrityBlockSign.key to be KeyObject instead
  of string.
- Upgrade to support Rollup 3.

### v0.0.4

- Support for signing web bundles with
  [integrity block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md)
  added.

## License

Licensed under the Apache-2.0 license.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) file.

## Disclaimer

This is not an officially supported Google product.
