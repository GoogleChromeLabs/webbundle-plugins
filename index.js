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

const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { BundleBuilder } = require('wbn');
const { IntegrityBlockSigner, WebBundleId, parsePemKey } = require('wbn-sign');
const webpack = require('webpack');
const { RawSource } = require('webpack-sources');

const PLUGIN_NAME = 'webbundle-webpack-plugin';

const defaults = {
  formatVersion: 'b2',
  output: 'out.wbn',
};

function addFile(builder, url, file) {
  const headers = {
    'Content-Type': mime.getType(file) || 'application/octet-stream',
  };
  builder.addExchange(url, 200, headers, fs.readFileSync(file));
}

function addFilesRecursively(builder, baseURL, dir) {
  if (baseURL !== '' && !baseURL.endsWith('/')) {
    throw new Error("Non-empty baseURL must end with '/'.");
  }
  const files = fs.readdirSync(dir);
  files.sort(); // Sort entries for reproducibility.
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      addFilesRecursively(builder, baseURL + file + '/', filePath);
    } else if (file === 'index.html') {
      // If the file name is 'index.html', create an entry for baseURL itself
      // and another entry for baseURL/index.html which redirects to baseURL.
      // This matches the behavior of gen-bundle.
      addFile(builder, baseURL, filePath);
      builder.addExchange(baseURL + file, 301, { Location: './' }, '');
    } else {
      addFile(builder, baseURL + file, filePath);
    }
  }
}

function maybeSignWebBundle(webBundle, opts, infoLogger) {
  if (!opts.integrityBlockSign) {
    return webBundle;
  }

  const parsedPrivateKey = parsePemKey(opts.integrityBlockSign.key);
  const { signedWebBundle } = new IntegrityBlockSigner(webBundle, {
    key: parsedPrivateKey,
  }).sign();

  infoLogger(`${new WebBundleId(parsedPrivateKey)}`);
  return signedWebBundle;
}

module.exports = class WebBundlePlugin {
  constructor(opts) {
    this.opts = Object.assign({}, defaults, { baseURL: '' }, opts);
    if (this.opts.baseURL !== '' && !this.opts.baseURL.endsWith('/')) {
      throw new Error('Non-empty base URL must end with "/".');
    }
  }

  process(compilation) {
    const opts = this.opts;
    const builder = new BundleBuilder(opts.formatVersion);
    if (opts.primaryURL) {
      builder.setPrimaryURL(opts.primaryURL);
    }
    if (opts.static) {
      addFilesRecursively(
        builder,
        opts.static.baseURL || opts.baseURL,
        opts.static.dir
      );
    }

    for (const key of Object.keys(compilation.assets)) {
      const headers = {
        'Content-Type': mime.getType(key) || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
      };
      const source = compilation.assets[key].source();
      const buf = Buffer.isBuffer(source) ? source : Buffer.from(source);

      const filePath = path.parse(key);
      if (filePath.base === 'index.html') {
        // If the file name is 'index.html', create an entry for baseURL/dir/
        // and another entry for baseURL/dir/index.html which redirects to it.
        // This matches the behavior of gen-bundle.
        builder.addExchange(opts.baseURL + filePath.dir, 200, headers, buf);
        builder.addExchange(opts.baseURL + key, 301, { Location: './' }, '');
      } else {
        builder.addExchange(opts.baseURL + key, 200, headers, buf);
      }
    }

    // TODO: Logger is supported v4.37+. Remove once Webpack versions below that
    // are no longer supported.
    const infoLogger =
      typeof compilation.getLogger === 'function'
        ? (str) => compilation.getLogger(PLUGIN_NAME).info(str)
        : (str) => console.log(str);

    const webBundle = maybeSignWebBundle(
      builder.createBundle(),
      opts,
      infoLogger
    );
    compilation.assets[opts.output] = new RawSource(webBundle);
  }

  apply(compiler) {
    if (webpack.version.startsWith('4.')) {
      compiler.hooks.emit.tap('WebBundlePlugin', this.process.bind(this));
    } else {
      compiler.hooks.thisCompilation.tap('WebBundlePlugin', (compilation) => {
        compilation.hooks.processAssets.tap(
          {
            name: 'WebBundlePlugin',
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
          },
          () => this.process(compilation)
        );
      });
    }
  }
};
