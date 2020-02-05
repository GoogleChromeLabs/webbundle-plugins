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

const defaults = {
  output: 'out.wbn'
}

module.exports = function wbnOutputPlugin(opts) {
  opts = Object.assign({}, defaults, {primaryURL: opts.baseURL}, opts);

  if (!opts.baseURL.endsWith('/')) {
    throw new Error("baseURL must end with '/'.");
  }
  return {
    name: "wbn-output-plugin",

    async generateBundle(_, bundle) {
      const [major, minor] = this.meta.rollupVersion.split('.').map(Number);
      const oldAssetsAPI = (major < 1 || (major == 1 && minor < 21));
      const isAsset = oldAssetsAPI ? (item => item.isAsset) : (item => item.type === 'asset');

      const builder = new BundleBuilder(opts.primaryURL || opts.baseURL);
      if (opts.static) {
        builder.addFilesRecursively(opts.static.baseURL || opts.baseURL, opts.static.dir);
      }

      for (let name of Object.keys(bundle)) {
        const item = bundle[name];
        const content = isAsset(item) ? item.source : item.code;
        const headers = {
          'Content-Type': mime.getType(item.fileName) || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        };
        const url = new URL(item.fileName, opts.baseURL).toString().replace(/\/index.html$/, '/');
        builder.addExchange(url, 200, headers, content);
        delete bundle[name];
      }

      if (oldAssetsAPI) {
        // this.emitAsset(opts.output, builder.createBundle());
        bundle[opts.output] = {
          fileName: opts.output,
          isAsset: true,
          source: builder.createBundle()
        };
      } else {
        this.emitFile({
          fileName: opts.output,
          type: 'asset',
          source: builder.createBundle()
        });
      }
    }
  };
}
