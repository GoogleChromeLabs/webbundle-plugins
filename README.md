# webbundle-webpack-plugin

A Webpack plugin which generates [Web Bundles](https://wicg.github.io/webpackage/draft-yasskin-wpack-bundled-exchanges.html) output. Currently the spec is still a draft, so this package is also in alpha until the spec stabilizes.

## Requirements

This plugin requires Node v10.0.0+ and Webpack v4.0.0+.

## Install

Using npm:

```console
npm install webbundle-webpack-plugin --save-dev
```

## Usage
This example assumes your application entry point is `src/index.js` and static files (including `index.html`) are located in `static` directory.
```js
/* webpack.config.js */
const path = require('path');
const WebBundlePlugin = require('webbundle-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.js'
  },
  plugins: [
    new WebBundlePlugin({
      baseURL: 'https://example.com/',
      static: { dir: path.resolve(__dirname, 'static') },
      output: 'example.wbn'
    })
  ]
};
```

A WBN file `dist/example.wbn` should be written.

## Options
### `baseURL` (required)
Type: `string`

Specifies the URL prefix prepended to the file names in the bundle. This must be an absolute URL that ends with `/`.

### `primaryURL`
Type: `string`<br>
Default: baseURL

Specifies the bundle's main resource URL. If omitted, the value of the `baseURL` option is used.

### `static`
Type: `{ dir: String, baseURL?: string }`

If specified, files and subdirectories under `dir` will be added to the bundle. The `baseURL` field can be omitted and defaults to `Options.baseURL`.

### `output`
Type: `string`<br>
Default: `out.wbn`

Specifies the file name of the Web Bundle to emit.

## License
Licensed under the Apache-2.0 license.

## Contributing
See [CONTRIBUTING.md](CONTRIBUTING.md) file.

## Disclaimer
This is not an officially supported Google product.
