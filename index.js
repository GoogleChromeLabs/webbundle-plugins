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
const { BundleBuilder, combineHeadersForUrl } = require('wbn');
const { IntegrityBlockSigner, WebBundleId } = require('wbn-sign');
const webpack = require('webpack');
const { RawSource } = require('webpack-sources');
const {
  iwaHeaderDefaults,
  invariableIwaHeaders,
  csp,
} = require('./iwa-header-constants');

const PLUGIN_NAME = 'webbundle-webpack-plugin';

const defaults = {
  formatVersion: 'b2',
  output: 'out.wbn',
  baseURL: '',
};

// If the file name is 'index.html', create an entry for both baseURL/dir/
// and baseURL/dir/index.html which redirects to the aforementioned. Otherwise
// just for the file itself. This matches the behavior of gen-bundle.
function addAsset(
  builder,
  baseURL,
  relativeAssetPath, // Asset's path relative to app's base dir. E.g. sub-dir/helloworld.js
  assetContentBuffer,
  pluginOptions
) {
  const parsedAssetPath = path.parse(relativeAssetPath);
  const isIndexHtmlFile = parsedAssetPath.base === 'index.html';

  // For object type, the IWA headers have already been check in constructor.
  const shouldCheckIwaHeaders =
    typeof pluginOptions.headerOverride === 'function' &&
    pluginOptions.integrityBlockSign &&
    pluginOptions.integrityBlockSign.isIwa;

  if (isIndexHtmlFile) {
    const combinedIndexHeaders = combineHeadersForUrl(
      { Location: './' },
      pluginOptions.headerOverride,
      baseURL + relativeAssetPath
    );
    if (shouldCheckIwaHeaders) checkIwaOverrideHeaders(combinedIndexHeaders);

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
  if (shouldCheckIwaHeaders) checkIwaOverrideHeaders(combinedHeaders);

  builder.addExchange(
    baseURLWithAssetPath,
    200,
    combinedHeaders,
    assetContentBuffer
  );
}

function addFilesRecursively(
  builder,
  baseURL,
  dir,
  pluginOptions,
  recPath = ''
) {
  if (baseURL !== '' && !baseURL.endsWith('/')) {
    throw new Error("Non-empty baseURL must end with '/'.");
  }
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

function maybeSignWebBundle(webBundle, opts, infoLogger) {
  if (!opts.integrityBlockSign) {
    return webBundle;
  }

  const { signedWebBundle } = new IntegrityBlockSigner(webBundle, {
    key: opts.integrityBlockSign.key,
  }).sign();

  infoLogger(`${new WebBundleId(opts.integrityBlockSign.key)}`);
  return signedWebBundle;
}

function checkIwaOverrideHeaders(headers) {
  for (const iwaHeaderName of Object.keys(invariableIwaHeaders)) {
    if (headers[iwaHeaderName] !== invariableIwaHeaders[iwaHeaderName]) {
      throw new Error(
        `For Isolated Web Apps ${iwaHeaderName} should be ${invariableIwaHeaders[iwaHeaderName]}. Now it is ${headers[iwaHeaderName]}. If you are bundling a non-IWA, set integrityBlockSign { isIwa: false } in your plugins configs.`
      );
    }
  }

  // TODO: Parse and check `Content-Security-Policy` value.
  const cspHeaderName = Object.keys(csp)[0];
  if (!headers[cspHeaderName]) {
    throw new Error(
      `For Isolated Web Apps ${cspHeaderName} should not be empty. Default value can be used: ${JSON.stringify(
        csp[cspHeaderName]
      )}. In case you are bundling a non-IWA, set integrityBlockSign { isIwa: false } in your plugins configs.`
    );
  }
}

function maybeSetIwaDefaults(opts) {
  if (
    opts.integrityBlockSign.isIwa !== undefined &&
    !opts.integrityBlockSign.isIwa
  ) {
    return;
  }

  // `isIwa` is defaulting to `true` if not provided as currently there is no
  // other use case for integrityBlockSign outside of IWAs.
  opts.integrityBlockSign.isIwa = true;

  if (opts.headerOverride === undefined) {
    console.info(
      `Setting the empty headerOverrides to IWA defaults. To bundle a non-IWA, set \`integrityBlockSign { isIwa: false }\` in your plugin configs. Defaults are set to:\n ${JSON.stringify(
        iwaHeaderDefaults
      )}`
    );
    opts.headerOverride = Object.assign({}, iwaHeaderDefaults);
  }
}

function validateIntegrityBlockOptions(opts) {
  maybeSetIwaDefaults(opts);

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

  if (
    opts.integrityBlockSign.isIwa === true &&
    typeof opts.headerOverride === 'object'
  ) {
    checkIwaOverrideHeaders(opts.headerOverride);
  }
}

function validateOptions(opts) {
  if (opts.baseURL !== '' && !opts.baseURL.endsWith('/')) {
    throw new Error('Non-empty baseURL must end with "/".');
  }
  if (opts.integrityBlockSign) {
    validateIntegrityBlockOptions(opts);
  }
}

module.exports = class WebBundlePlugin {
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

    for (const assetName of Object.keys(compilation.assets)) {
      const assetRawSource = compilation.assets[assetName].source();
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
