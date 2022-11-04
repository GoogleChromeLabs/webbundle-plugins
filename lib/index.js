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

import * as fs from 'fs';
import mime from 'mime';
import * as path from 'path';
import { BundleBuilder } from 'wbn';

const defaults = {
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

export default function wbnOutputPlugin(opts) {
  opts = Object.assign({}, defaults, { primaryURL: opts.baseURL }, opts);

  if (!opts.baseURL.endsWith('/')) {
    throw new Error("baseURL must end with '/'.");
  }
  return {
    name: 'wbn-output-plugin',

    async generateBundle(_, bundle) {
      const builder = new BundleBuilder(opts.formatVersion);
      builder.setPrimaryURL(opts.primaryURL || opts.baseURL);
      if (opts.static) {
        addFilesRecursively(
          builder,
          opts.static.baseURL || opts.baseURL,
          opts.static.dir
        );
      }

      for (let name of Object.keys(bundle)) {
        const item = bundle[name];
        const content = item.type === 'asset' ? item.source : item.code;
        const headers = {
          'Content-Type':
            mime.getType(item.fileName) || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        };
        const url = new URL(item.fileName, opts.baseURL)
          .toString()
          .replace(/\/index.html$/, '/');
        builder.addExchange(url, 200, headers, content);
        delete bundle[name];
      }

      const buf = builder.createBundle();
      this.emitFile({
        fileName: opts.output,
        type: 'asset',
        source: Buffer.from(buf, buf.byteOffset, buf.byteLength),
      });
    },
  };
}
