# webbundle-webpack-plugin

A Webpack plugin which generates
[Web Bundles](https://wicg.github.io/webpackage/draft-yasskin-wpack-bundled-exchanges.html)
output. Currently the spec is still a draft, so this package is also in alpha
until the spec stabilizes.

## Requirements

This plugin requires Node v14.0.0+ and Webpack v4.0.1+.

## Install

Using npm:

```bash
npm install webbundle-webpack-plugin --save-dev
```

## Usage

### General Web Bundle

This example assumes your application entry point is `src/index.js` and static
files (including `index.html`) are located in `static` directory.

```js
/* webpack.config.js */
const path = require('path');
const WebBundlePlugin = require('webbundle-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.js',
  },
  plugins: [
    new WebBundlePlugin({
      baseURL: 'https://example.com/',
      static: { dir: path.resolve(__dirname, 'static') },
      output: 'example.wbn',
    }),
  ],
};
```

A WBN file `dist/example.wbn` should be written.

### [Isolated Web App](https://github.com/WICG/isolated-web-apps/blob/main/README.md) (Signed Web Bundle)

This example assumes your application entry point is `src/index.js`, static
files (including `index.html`) are located in `static` directory and you have a
`.env` file in the root directory with `ED25519KEY` defined in it. The example
also requires installing `dotenv` npm package as a dev dependency.

It is also required to have a
[Web App Manifest](https://developer.mozilla.org/en-US/docs/Web/Manifest) at
`/manifest.webmanifest`, which can be placed e.g. in the `static` directory.

Also as in the below example, `baseURL` must be of format
`isolated-app://${WEB_BUNDLE_ID}` for Isolated Web Apps. It can easily be
generated from the private key with `WebBundleId` helper class from `wbn-sign`
package. See
[Scheme explainer](https://github.com/WICG/isolated-web-apps/blob/main/Scheme.md)
for more details.

```js
/* webpack.config.js */
const path = require('path');
const WebBundlePlugin = require('webbundle-webpack-plugin');
const {
  NodeCryptoSigningStrategy,
  parsePemKey,
  readPassphrase,
  WebBundleId,
} = require('wbn-sign');
require('dotenv').config({ path: './.env' });

module.exports = async () => {
  const key = parsePemKey(process.env.ENC_ED25519KEY, await readPassphrase());

  return {
    entry: './src/index.js',
    output: { path: path.resolve(__dirname, 'dist'), filename: 'app.js' },
    plugins: [
      new WebBundlePlugin({
        baseURL: new WebBundleId(key).serializeWithIsolatedWebAppOrigin(),
        static: { dir: path.resolve(__dirname, 'static') },
        output: 'signed.swbn',
        integrityBlockSign: {
          strategy: new NodeCryptoSigningStrategy(key),
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

Type: `string `  
Default: `''`

Specifies the URL prefix prepended to the file names in the bundle. Non-empty
baseURL must end with `/`.

### `primaryURL`

Type: `string`  
Default: baseURL

Specifies the bundle's main resource URL.

### `static`

Type: `{ dir: String, baseURL?: string }`

If specified, files and subdirectories under `dir` will be added to the bundle.
The `baseURL` field can be omitted and defaults to `Options.baseURL`.

### `output`

Type: `string`  
Default: `out.wbn`

Specifies the file name of the Web Bundle to emit.

### `formatVersion`

Type: `string`  
Default: `b2`

Specifies WebBundle format version.

- version `b2` follows
  [the latest version of the Web Bundles spec](https://datatracker.ietf.org/doc/html/draft-yasskin-wpack-bundled-exchanges-04)
  (default).
- version `b1` follows
  [the previous version of the Web Bundles spec](https://datatracker.ietf.org/doc/html/draft-yasskin-wpack-bundled-exchanges-03).

### `integrityBlockSign`

Type:
`{ key: KeyObject, isIwa?: boolean } | { strategy: ISigningStrategy, isIwa?: boolean } `

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
const key = parsePemKey(process.env.ED25519KEY);

// For an encrypted ed25519 key.
const key = parsePemKey(process.env.ENC_ED25519KEY, await readPassphrase());
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
    strategy: new NodeCryptoSigningStrategy(privateKey),
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

### `headerOverride`

Type: `{ [key: string]: string; }` |
`(filepath: string) => { [key: string]: string; };`

Object of strings specifying overridden headers or a function returning the same
kind of object.

## License

Licensed under the Apache-2.0 license.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) file.

## Disclaimer

This is not an officially supported Google product.

## Release Notes

### v0.1.4

- Updates to style-src and wss CSP values.
- Bumping underlying wbn-sign version to v0.1.1.

### v0.1.3

- BUG: Async `integrityBlockSign.strategy` was not working correctly. Now with
  `tapPromise` instead of `tap` this is fixed.
  \[[#59](https://github.com/GoogleChromeLabs/webbundle-plugins/pull/59/)\]

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

- Add support for overriding headers with `headerOverride` plugin option.

### v0.1.0

- BREAKING CHANGE: Change type of integrityBlockSign.key to be KeyObject instead
  of string.

### v0.0.4

- Support for signing web bundles with
  [integrity block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md)
  added.
