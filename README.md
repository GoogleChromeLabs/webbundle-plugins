# webbundle-webpack-plugin

A Webpack plugin which generates
[Web Bundles](https://wpack-wg.github.io/bundled-responses/draft-ietf-wpack-bundled-responses.html)
output. Currently the spec is still a draft, so this package is also in alpha
until the spec stabilizes.

## Requirements

This plugin requires Node v12.0.0+ and Webpack v4.0.0+.

## Install

Using npm:

```console
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
const { WebBundleId, parsePemKey } = require('wbn-sign');
require('dotenv').config({ path: './.env' });

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.js',
  },
  plugins: [
    new WebBundlePlugin({
      baseURL: new WebBundleId(
        parsePemKey(process.env.ED25519KEY)
      ).serializeWithIsolatedWebAppOrigin(),
      static: { dir: path.resolve(__dirname, 'static') },
      output: 'signed.wbn',
      integrityBlockSign: {
        key: process.env.ED25519KEY,
      },
    }),
  ],
};
```

A signed web bundle (containing an
[Integrity Block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md))
should be written to `dist/signed.swbn`.

## Options

### `baseURL`

Type: `string  `
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

Type: `{ key: string }`

Object specifying the signing options with
[Integrity Block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md).

### `integrityBlockSign.key` (required if `integrityBlockSign` is in place)

Type: `string`

A PEM-encoded Ed25519 private key as a string, which can be generated with:

```bash
openssl genpkey -algorithm Ed25519 -out ed25519key.pem
```

Note than in order for it to be parsed correctly, it must contain the `BEGIN`
and `END` texts and line breaks (`\n`). Below an example `.env` file:

```bash
ED25519KEY="-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIB8nP5PpWU7HiILHSfh5PYzb5GAcIfHZ+bw6tcd/LZXh\n-----END PRIVATE KEY-----"
```

## License

Licensed under the Apache-2.0 license.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Disclaimer

This is not an officially supported Google product.

## Release Notes

### v0.0.4

- Support for signing web bundles with
  [integrity block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md)
  added.
