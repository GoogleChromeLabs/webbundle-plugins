/*!
 * Copyright 2023 Google LLC
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
import * as path from 'path';
import mime from 'mime';
import { combineHeadersForUrl, BundleBuilder } from 'wbn';
import { IntegrityBlockSigner } from 'wbn-sign';
import { checkAndAddIwaHeaders } from './iwa-headers';
import { ValidIbSignPluginOptions, ValidPluginOptions } from './types';

// If the file name is 'index.html', create an entry for both baseURL/dir/ and
// baseURL/dir/index.html which redirects to the aforementioned. Otherwise just
// for the asset itself. This matches the behavior of gen-bundle.
export function addAsset(
  builder: BundleBuilder,
  baseURL: string,
  relativeAssetPath: string, // Asset's path relative to app's base dir. E.g. sub-dir/helloworld.js
  assetContentBuffer: Uint8Array | string,
  pluginOptions: ValidPluginOptions
) {
  const parsedAssetPath = path.parse(relativeAssetPath);
  const isIndexHtmlFile = parsedAssetPath.base === 'index.html';

  // For object type, the IWA headers have already been check in constructor.
  const shouldCheckIwaHeaders =
    typeof pluginOptions.headerOverride === 'function' &&
    'integrityBlockSign' in pluginOptions &&
    pluginOptions.integrityBlockSign.isIwa;

  if (isIndexHtmlFile) {
    const combinedIndexHeaders = combineHeadersForUrl(
      { Location: './' },
      pluginOptions.headerOverride,
      baseURL + relativeAssetPath
    );
    if (shouldCheckIwaHeaders) checkAndAddIwaHeaders(combinedIndexHeaders);

    builder.addExchange(
      baseURL + relativeAssetPath,
      301,
      combinedIndexHeaders,
      '' // Empty content.
    );
  }

  const baseURLWithAssetPath =
    baseURL + (isIndexHtmlFile ? parsedAssetPath.dir : relativeAssetPath);
  const combinedHeaders = combineHeadersForUrl(
    {
      'Content-Type':
        mime.getType(relativeAssetPath) || 'application/octet-stream',
    },
    pluginOptions.headerOverride,
    baseURLWithAssetPath
  );
  if (shouldCheckIwaHeaders) checkAndAddIwaHeaders(combinedHeaders);

  builder.addExchange(
    baseURLWithAssetPath,
    200,
    combinedHeaders,
    assetContentBuffer
  );
}

export function addFilesRecursively(
  builder: BundleBuilder,
  baseURL: string,
  dir: string,
  pluginOptions: ValidPluginOptions,
  recPath = ''
) {
  const files = fs.readdirSync(dir);
  files.sort(); // Sort entries for reproducibility.

  for (const fileName of files) {
    const filePath = path.join(dir, fileName);

    if (fs.statSync(filePath).isDirectory()) {
      addFilesRecursively(
        builder,
        baseURL,
        filePath,
        pluginOptions,
        recPath + fileName + '/'
      );
    } else {
      const fileContent = fs.readFileSync(filePath);
      // `fileName` contains the directory as this is done recursively for every
      // directory so it gets added to the baseURL.
      addAsset(
        builder,
        baseURL,
        recPath + fileName,
        fileContent,
        pluginOptions
      );
    }
  }
}

export async function getSignedWebBundle(
  webBundle: Uint8Array,
  opts: ValidIbSignPluginOptions,
  infoLogger: (str: string) => void
): Promise<Uint8Array> {
  const { signedWebBundle } = await new IntegrityBlockSigner(
    /*is_v2=*/ true,
    webBundle,
    opts.integrityBlockSign.webBundleId,
    opts.integrityBlockSign.strategies
  ).sign();

  infoLogger(opts.integrityBlockSign.webBundleId);
  return signedWebBundle;
}
