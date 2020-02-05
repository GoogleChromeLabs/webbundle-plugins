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
const {URL} = require('url');
const {BundleBuilder} = require('wbn');
const {RawSource} = require('webpack-sources');

const defaults = {
  output: 'out.wbn'
}

module.exports = class WebBundlePlugin {
  constructor(opts) {
    this.opts = Object.assign({}, defaults, {primaryURL: opts.baseURL}, opts);
  }

  apply(compiler) {
    compiler.hooks.emit.tap(
      'WebBundlePlugin',
      (compilation) => {
        const opts = this.opts;
        const builder = new BundleBuilder(opts.primaryURL || opts.baseURL);
        if (opts.static) {
          builder.addFilesRecursively(opts.static.baseURL || opts.baseURL, opts.static.dir);
        }

        for (const key of Object.keys(compilation.assets)) {
          // 'dir/index.html' is stored as 'dir/' in WBN.
          const url = new URL(key, opts.baseURL).toString().replace(/\/index.html$/, '/');
          const headers = {
            'Content-Type': mime.getType(key) || 'application/octet-stream',
            'Access-Control-Allow-Origin': '*'
          };
          const source = compilation.assets[key].source();
          const buf = Buffer.isBuffer(source) ? source : Buffer.from(source);
          builder.addExchange(url, 200, headers, buf);
        }
        compilation.assets[opts.output] = new RawSource(builder.createBundle());
      }
    );
  }
}
