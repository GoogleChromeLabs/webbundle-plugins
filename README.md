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

## Options

### `baseURL`

Type: `string`

Specifies the URL prefix prepended to the file names in the bundle. This must be
an absolute URL that ends with `/`.

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

## License

Licensed under the Apache-2.0 license.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Disclaimer

This is not an officially supported Google product.
