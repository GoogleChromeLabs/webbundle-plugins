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

import webpack from 'webpack';
import { RawSource } from 'webpack-sources';
import { BundleBuilder } from 'wbn';
import { WebBundleId } from 'wbn-sign';
import {
  addAsset,
  addFilesRecursively,
  validateOptions,
  maybeSignWebBundle,
} from '../../shared/utils.js';

const PLUGIN_NAME = 'webbundle-webpack-plugin';

const defaults = {
  formatVersion: 'b2',
  output: 'out.wbn',
  baseURL: '',
};

export class WebBundlePlugin {
  constructor(opts) {
    this.opts = Object.assign({}, defaults, opts);
    validateOptions(this.opts);
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
        opts.static.dir,
        opts
      );
    }

    for (const [assetName, assetValue] of Object.entries(compilation.assets)) {
      const assetRawSource = assetValue.source();
      const assetBuffer = Buffer.isBuffer(assetRawSource)
        ? assetRawSource
        : Buffer.from(assetRawSource);

      addAsset(
        builder,
        opts.baseURL,
        assetName, // This contains the relative path to the base dir already.
        assetBuffer,
        opts
      );
    }

    // TODO: Logger is supported v4.37+. Remove once Webpack versions below that
    // are no longer supported.
    const infoLogger =
      typeof compilation.getLogger === 'function'
        ? (str) => compilation.getLogger(PLUGIN_NAME).info(str)
        : (str) => console.log(str);

    const webBundle = maybeSignWebBundle(builder.createBundle(), opts, () =>
      infoLogger(`${new WebBundleId(opts.integrityBlockSign.key)}`)
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
}
