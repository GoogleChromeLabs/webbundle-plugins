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

import { BundleBuilder } from 'wbn';
import { WebBundleId } from 'wbn-sign';
import { Plugin, OutputOptions } from 'rollup';
import { KeyObject } from 'crypto';
import {
  addAsset,
  addFilesRecursively,
  validateOptions,
  maybeSignWebBundle,
} from '../../shared/utils';
import { PluginOptions } from '../../shared/types';

const defaults = {
  output: 'out.wbn',
  baseURL: '',
};

const consoleLogColor = { green: '\x1b[32m', reset: '\x1b[0m' };
function infoLogger(text: string): void {
  console.log(`${consoleLogColor.green}${text}${consoleLogColor.reset}\n`);
}

// TODO(sonkkeli): Probably this depends on the Rollup version. Figure out how
// this should be refactored.
// https://rollupjs.org/plugin-development/#build-hooks
type EnforcedPlugin = Plugin & { enforce: 'post' | 'pre' | null };

export default function wbnOutputPlugin(opts: PluginOptions): EnforcedPlugin {
  opts = Object.assign({}, defaults, opts);
  validateOptions(opts);

  return {
    name: 'wbn-output-plugin',
    enforce: 'post',

    async generateBundle(_: OutputOptions, bundle): Promise<void> {
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

      for (const name of Object.keys(bundle)) {
        const asset = bundle[name];
        const content = asset.type === 'asset' ? asset.source : asset.code;
        addAsset(
          builder,
          opts.baseURL,
          asset.fileName, // This contains the relative path to the base dir already.
          content,
          opts
        );
        delete bundle[name];
      }

      const webBundle = maybeSignWebBundle(
        builder.createBundle(),
        opts,
        (key: KeyObject) => infoLogger(`${new WebBundleId(key)}`)
      );

      this.emitFile({
        fileName: opts.output,
        type: 'asset',
        source: Buffer.from(
          webBundle,
          webBundle.byteOffset,
          webBundle.byteLength
        ),
      });
    },
  };
}
