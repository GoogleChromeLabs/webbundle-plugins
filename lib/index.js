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
import { IntegrityBlockSigner, WebBundleId } from 'wbn-sign';

const defaults = {
  output: 'out.wbn',
  baseURL: '',
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

function maybeSignWebBundle(webBundle, opts) {
  if (!opts.integrityBlockSign) {
    return webBundle;
  }

  const { signedWebBundle } = new IntegrityBlockSigner(webBundle, {
    key: opts.integrityBlockSign.key,
  }).sign();

  const consoleLogColor = { green: '\x1b[32m', reset: '\x1b[0m' };
  console.log(
    `${consoleLogColor.green}${new WebBundleId(opts.integrityBlockSign.key)}${
      consoleLogColor.reset
    }\n`
  );
  return signedWebBundle;
}

function validateIWAOptions(opts) {
  if (opts.primaryURL !== undefined) {
    throw new Error('Primary URL is not supported for Isolated Web Apps.');
  }

  if (opts.baseURL !== '') {
    const expectedOrigin = new WebBundleId(
      opts.integrityBlockSign.key
    ).serializeWithIsolatedWebAppOrigin();

    if (opts.baseURL !== expectedOrigin) {
      throw new Error(
        `The provided "baseURL" option (${opts.baseURL}) does not match the expected base URL (${expectedOrigin}), which is derived from the provided private key`
      );
    }
  }
}

function validateOptions(opts) {
  if (opts.baseURL !== '' && !opts.baseURL.endsWith('/')) {
    throw new Error('Non-empty baseURL must end with "/".');
  }
  if (opts.integrityBlockSign) validateIWAOptions(opts);
}

export default function wbnOutputPlugin(opts) {
  opts = Object.assign({}, defaults, opts);
  validateOptions(opts);

  return {
    name: 'wbn-output-plugin',
    enforce: 'post',

    async generateBundle(_, bundle) {
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

      for (let name of Object.keys(bundle)) {
        const item = bundle[name];
        const content = item.type === 'asset' ? item.source : item.code;
        const headers = {
          'Content-Type':
            mime.getType(item.fileName) || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        };

        const filePath = path.parse(item.fileName);
        if (filePath.base === 'index.html') {
          // If the file name is 'index.html', create an entry for baseURL/dir/
          // and another entry for baseURL/dir/index.html which redirects to it.
          // This matches the behavior of gen-bundle.
          builder.addExchange(
            opts.baseURL + filePath.dir,
            200,
            headers,
            content
          );
          builder.addExchange(
            opts.baseURL + item.fileName,
            301,
            { Location: './' },
            ''
          );
        } else {
          builder.addExchange(
            opts.baseURL + item.fileName,
            200,
            headers,
            content
          );
        }
        delete bundle[name];
      }

      const webBundle = maybeSignWebBundle(builder.createBundle(), opts);

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
