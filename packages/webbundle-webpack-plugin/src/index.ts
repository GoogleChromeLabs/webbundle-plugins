/*!
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

import webpack, { Compiler, Compilation, WebpackPluginInstance } from 'webpack';
import { BundleBuilder } from 'wbn';
import {
  addAsset,
  addFilesRecursively,
  getSignedWebBundle,
} from '../../shared/utils';
import {
  getValidatedOptionsWithDefaults,
  PluginOptions,
} from '../../shared/types';

const PLUGIN_NAME = 'webbundle-webpack-plugin';

// Returns if the semantic version number of Webpack is 4.
function isWebpackMajorV4(): boolean {
  return webpack.version.startsWith('4.');
}

export class WebBundlePlugin implements WebpackPluginInstance {
  constructor(private rawOpts: PluginOptions) {}

  process = async (compilation: Compilation) => {
    const opts = await getValidatedOptionsWithDefaults(this.rawOpts);

    const builder = new BundleBuilder(opts.formatVersion);
    if ('primaryURL' in opts && opts.primaryURL) {
      builder.setPrimaryURL(opts.primaryURL);
    }
    if (opts.static) {
      addFilesRecursively(
        builder,
        opts.static.baseURL ?? opts.baseURL,
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
        ? (str: string) => compilation.getLogger(PLUGIN_NAME).info(str)
        : (str: string) => console.log(str);

    let webBundle = builder.createBundle();
    if ('integrityBlockSign' in opts) {
      webBundle = await getSignedWebBundle(webBundle, opts, infoLogger);
    }

    if (isWebpackMajorV4()) {
      // @ts-expect-error Missing properties don't exist on webpack v4.
      compilation.assets[opts.output] = {
        source: () => Buffer.from(webBundle),
        size: () => webBundle.length,
      };
    } else {
      compilation.assets[opts.output] = new webpack.sources.RawSource(
        Buffer.from(webBundle),
        /*convertToString=*/ false
      );
    }
  };

  apply = (compiler: Compiler) => {
    if (isWebpackMajorV4()) {
      compiler.hooks.emit.tapPromise(
        this.constructor.name,
        (compilation: Compilation) => this.process(compilation)
      );
    } else {
      compiler.hooks.thisCompilation.tap(
        this.constructor.name,
        (compilation: Compilation) => {
          compilation.hooks.processAssets.tapPromise(
            {
              name: this.constructor.name,
              stage: webpack.Compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER,
            },
            () => this.process(compilation)
          );
        }
      );
    }
  };
}
