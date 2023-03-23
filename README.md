# rollup-plugin-webbundle

A Rollup plugin which generates
[Web Bundles](https://wicg.github.io/webpackage/draft-yasskin-wpack-bundled-exchanges.html)
output. Currently the spec is still a draft, so this package is also in alpha
until the spec stabilizes.

## Requirements

This plugin requires Node v14.0.0+ and Rollup v1.21.0+.

## Install

Using npm:

```console
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
`/manifest.webmanifest`, which can be placed e.g. in the `static` directory.

Also as in the below example, `baseURL` must be of format
`isolated-app://${WEB_BUNDLE_ID}` for Isolated Web Apps. It can easily be
generated from the private key with `WebBundleId` helper class from `wbn-sign`
package. See
[Scheme explainer](https://github.com/WICG/isolated-web-apps/blob/main/Scheme.md)
for more details.

```js
/* rollup.config.mjs */
import webbundle from 'rollup-plugin-webbundle';
import * as wbnSign from 'wbn-sign';
import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

const key = wbnSign.parsePemKey(process.env.ED25519KEY);

export default {
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    webbundle({
      baseURL: new wbnSign.WebBundleId(key).serializeWithIsolatedWebAppOrigin(),
      static: { dir: 'public' },
      output: 'signed.swbn',
      integrityBlockSign: { key },
    }),
  ],
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

Type: `{ key: KeyObject }`

Object specifying the signing options with
[Integrity Block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md).

### `integrityBlockSign.key` (required if `integrityBlockSign` is in place)

Type: `KeyObject`

A parsed Ed25519 private key, which can be generated with:

```bash
openssl genpkey -algorithm Ed25519 -out ed25519key.pem
```

And parsed with `wbnSign.parsePemKey(process.env.ED25519KEY)` helper function.

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

### v0.1.1

- Add support for overriding headers.

### v0.1.0

- BREAKING CHANGE: Change type of integrityBlockSign.key to be KeyObject instead of string.
- Upgrade to support Rollup 3.

### v0.0.4

- Support for signing web bundles with
  [integrity block](https://github.com/WICG/webpackage/blob/main/explainers/integrity-signature.md)
  added.
