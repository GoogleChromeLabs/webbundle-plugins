/**
 * Copyright 2020 Google LLC
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

const mime = require('mime');
const {BundleBuilder} = require('wbn');
const webpack = require('webpack');
const {RawSource} = require('webpack-sources');
const path = require('path');

const defaults = {
  output: 'out.wbn'
}

module.exports = class WebBundlePlugin {
  constructor(opts) {
    this.opts = Object.assign({}, defaults, {baseURL: ''}, opts);
    if (this.opts.baseURL !== '' && !this.opts.baseURL.endsWith('/')) {
      throw new Error('Non-empty base URL must end with "/".');
    }
  }

  process(compilation) {
    const opts = this.opts;
    const builder = new BundleBuilder(opts.formatVersion || 'b2');
    if (opts.primaryURL) {
      builder.setPrimaryURL(opts.primaryURL);
    }
    if (opts.static) {
      builder.addFilesRecursively(opts.static.baseURL || opts.baseURL, opts.static.dir);
    }

    for (const key of Object.keys(compilation.assets)) {
      const headers = {
        'Content-Type': mime.getType(key) || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      };
      const source = compilation.assets[key].source();
      const buf = Buffer.isBuffer(source) ? source : Buffer.from(source);

      const filePath = path.parse(key);
      if (filePath.base === 'index.html') {
        // If the file name is 'index.html', create an entry for baseURL/dir/
        // and another entry for baseURL/dir/index.html which redirects to it.
        // This matches the behavior of gen-bundle.
        builder.addExchange(opts.baseURL + filePath.dir, 200, headers, buf);
        builder.addExchange(opts.baseURL + key, 301, {Location: './'}, '');
      } else {
        builder.addExchange(opts.baseURL + key, 200, headers, buf);
      }
    }
    compilation.assets[opts.output] = new RawSource(builder.createBundle());
  }

  apply(compiler) {
    if (webpack.version.startsWith('4.')) {
      compiler.hooks.emit.tap('WebBundlePlugin', this.process.bind(this));
    } else {
      compiler.hooks.thisCompilation.tap('WebBundlePlugin',
        (compilation) => {
          compilation.hooks.processAssets.tap(
            {
              name: 'WebBundlePlugin',
              stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER
            },
            () => this.process(compilation)
          );
        }
      );
    }
  }
}
