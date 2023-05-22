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

import test from 'ava';
import crypto from 'crypto';
import webpack from 'webpack';
import MemoryFS from 'memory-fs';
import url from 'url';
import fs from 'fs';
import * as path from 'path';
import * as wbn from 'wbn';
import * as wbnSign from 'wbn-sign';
import { WebBundlePlugin } from '../lib/index.cjs';
import {
  coep,
  coop,
  corp,
  csp,
  iwaHeaderDefaults,
} from '../../shared/lib/iwa-headers.js';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEST_ED25519_PRIVATE_KEY = wbnSign.parsePemKey(
  '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIB8nP5PpWU7HiILHSfh5PYzb5GAcIfHZ+bw6tcd/LZXh\n-----END PRIVATE KEY-----'
);
const TEST_IWA_BASE_URL =
  'isolated-app://4tkrnsmftl4ggvvdkfth3piainqragus2qbhf7rlz2a3wo3rh4wqaaic/';

function run(options) {
  return new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: 'development',
      devtool: false,
      entry: path.join(__dirname, 'fixtures', 'app'),
      bail: true,
      output: {
        path: '/out',
        filename: 'main.js',
      },
      plugins: [new WebBundlePlugin(options)],
    });
    const memfs = new MemoryFS();
    compiler.outputFileSystem = memfs;
    compiler.run((err, stats) => {
      err ? reject(err) : resolve({ stats, memfs });
    });
  });
}

test('basic', async (t) => {
  const primaryURL = 'https://example.com/main.js';
  const { memfs } = await run({
    baseURL: 'https://example.com/',
    primaryURL,
    output: 'example.wbn',
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const js = memfs.readFileSync('/out/main.js');
  const bundle = new wbn.Bundle(memfs.readFileSync('/out/example.wbn'));
  t.is(bundle.primaryURL, primaryURL);
  t.deepEqual(bundle.urls, [primaryURL]);
  const resp = bundle.getResponse(primaryURL);
  t.is(new TextDecoder('utf-8').decode(resp.body), js.toString());
});

test('static', async (t) => {
  const primaryURL = 'https://example.com/';
  const { memfs } = await run({
    baseURL: 'https://example.com/',
    primaryURL,
    static: { dir: path.join(__dirname, 'fixtures', 'static') },
    output: 'example.wbn',
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const html = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'static', 'index.html')
  );
  const bundle = new wbn.Bundle(memfs.readFileSync('/out/example.wbn'));
  t.is(bundle.primaryURL, primaryURL);
  t.deepEqual(bundle.urls.sort(), [
    primaryURL,
    'https://example.com/index.html',
    'https://example.com/main.js',
  ]);
  const resp = bundle.getResponse(primaryURL);
  t.is(new TextDecoder('utf-8').decode(resp.body), html.toString());
});

test('relative', async (t) => {
  const { memfs } = await run({
    static: { dir: path.join(__dirname, 'fixtures', 'static') },
    output: 'example.wbn',
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const html = fs.readFileSync(
    path.join(__dirname, 'fixtures', 'static', 'index.html')
  );
  const js = memfs.readFileSync('/out/main.js');
  const bundle = new wbn.Bundle(memfs.readFileSync('/out/example.wbn'));
  t.deepEqual(bundle.urls.sort(), ['', 'index.html', 'main.js']);
  let resp = bundle.getResponse('');
  t.is(new TextDecoder('utf-8').decode(resp.body), html.toString());
  resp = bundle.getResponse('main.js');
  t.is(new TextDecoder('utf-8').decode(resp.body), js.toString());
});

test('integrityBlockSign', async (t) => {
  const testCases = [
    // With default signer.
    {
      key: TEST_ED25519_PRIVATE_KEY,
    },
    // With signer option specified.
    {
      strategy: new wbnSign.NodeCryptoSigningStrategy(TEST_ED25519_PRIVATE_KEY),
    },
  ];
  for (const testCase of testCases) {
    const { memfs } = await run({
      baseURL: TEST_IWA_BASE_URL,
      output: 'example.swbn',
      integrityBlockSign: testCase,
    });
    t.deepEqual(memfs.readdirSync('/out').sort(), ['example.swbn', 'main.js']);

    const swbnFile = memfs.readFileSync('/out/example.swbn');
    const wbnLength = Number(Buffer.from(swbnFile.slice(-8)).readBigUint64BE());
    t.truthy(wbnLength < swbnFile.length);

    const { signedWebBundle } = await new wbnSign.IntegrityBlockSigner(
      swbnFile.slice(-wbnLength),
      new wbnSign.NodeCryptoSigningStrategy(TEST_ED25519_PRIVATE_KEY)
    ).sign();

    t.deepEqual(swbnFile, Buffer.from(signedWebBundle));
  }
});

test('headerOverride - IWA with good headers', async (t) => {
  const headersTestCases = [
    // These are added manually as they expect more than just `iwaHeaderDefaults`.
    {
      headerOverride: { ...iwaHeaderDefaults, 'X-Csrf-Token': 'hello-world' },
      expectedHeaders: { ...iwaHeaderDefaults, 'x-csrf-token': 'hello-world' },
    },
    {
      headerOverride: () => {
        return { ...iwaHeaderDefaults, 'X-Csrf-Token': 'hello-world' };
      },
      expectedHeaders: { ...iwaHeaderDefaults, 'x-csrf-token': 'hello-world' },
    },
  ];

  const headersThatDefaultToIWADefaults = [
    { ...coop, ...corp, ...csp },
    { ...coep, ...corp, ...csp },
    { ...coep, ...coop, ...csp },
    { ...coep, ...coop, ...corp },
    iwaHeaderDefaults,
    {},
    undefined,
    {
      ...iwaHeaderDefaults,
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  ];

  for (const headers of headersThatDefaultToIWADefaults) {
    // Both functions and objects are ok so let's test with both.
    headersTestCases.push({
      headerOverride: headers,
      expectedHeaders: iwaHeaderDefaults,
    });

    // Not supported as typeof function because that's forced to return `Headers` map.
    if (headers === undefined) continue;
    headersTestCases.push({
      headerOverride: () => headers,
      expectedHeaders: iwaHeaderDefaults,
    });
  }

  for (const headersTestCase of headersTestCases) {
    for (const isIwaTestCase of [undefined, true]) {
      const { memfs } = await run({
        baseURL: TEST_IWA_BASE_URL,
        output: 'example.swbn',
        integrityBlockSign: {
          key: TEST_ED25519_PRIVATE_KEY,
          isIwa: isIwaTestCase,
        },
        headerOverride: headersTestCase.headerOverride,
      });
      t.deepEqual(memfs.readdirSync('/out').sort(), [
        'example.swbn',
        'main.js',
      ]);

      const swbnFile = memfs.readFileSync('/out/example.swbn');
      const wbnLength = Number(
        Buffer.from(swbnFile.slice(-8)).readBigUint64BE()
      );
      t.truthy(wbnLength < swbnFile.length);

      const usignedBundle = new wbn.Bundle(swbnFile.slice(-wbnLength));
      for (const url of usignedBundle.urls) {
        for (const [headerName, headerValue] of Object.entries(
          iwaHeaderDefaults
        )) {
          t.is(usignedBundle.getResponse(url).headers[headerName], headerValue);
        }
      }
    }
  }
});

test("headerOverride - non-IWA doesn't enforce IWA headers", async (t) => {
  // Irrelevant what this would contain.
  const randomNonIwaHeaders = { 'x-csrf-token': 'hello-world' };

  const headersTestCases = [
    {
      // Type `object` is ok.
      headerOverride: randomNonIwaHeaders,
      expectedHeaders: randomNonIwaHeaders,
    },
    {
      // Same but camel case, which gets lower-cased.
      headerOverride: { 'X-Csrf-Token': 'hello-world' },
      expectedHeaders: randomNonIwaHeaders,
    },
    {
      // Type `function` is ok.
      headerOverride: () => randomNonIwaHeaders,
      expectedHeaders: randomNonIwaHeaders,
    },
    {
      // When `integrityBlockSign.isIwa` is false and `headerOverride` is
      // `undefined`, nothing unusual gets added.
      headerOverride: undefined,
      expectedHeaders: {},
    },
  ];

  for (const headersTestCase of headersTestCases) {
    const { memfs } = await run({
      baseURL: TEST_IWA_BASE_URL,
      output: 'example.swbn',
      integrityBlockSign: {
        key: TEST_ED25519_PRIVATE_KEY,
        isIwa: false,
      },
      headerOverride: headersTestCase.headerOverride,
    });
    t.deepEqual(memfs.readdirSync('/out').sort(), ['example.swbn', 'main.js']);

    const swbnFile = memfs.readFileSync('/out/example.swbn');
    const wbnLength = Number(Buffer.from(swbnFile.slice(-8)).readBigUint64BE());
    t.truthy(wbnLength < swbnFile.length);

    const usignedBundle = new wbn.Bundle(swbnFile.slice(-wbnLength));
    for (const url of usignedBundle.urls) {
      // Added the expected headers.
      for (const [headerName, headerValue] of Object.entries(
        headersTestCase.expectedHeaders
      )) {
        t.is(usignedBundle.getResponse(url).headers[headerName], headerValue);
      }
      // Did not add any IWA headers automatically.
      for (const headerName of Object.keys(iwaHeaderDefaults)) {
        t.is(usignedBundle.getResponse(url).headers[headerName], undefined);
      }
    }
  }
});

test("integrityBlockSign with undefined baseURL doesn't fail", async (t) => {
  const { memfs } = await run({
    output: 'example.swbn',
    integrityBlockSign: {
      strategy: new wbnSign.NodeCryptoSigningStrategy(TEST_ED25519_PRIVATE_KEY),
    },
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.swbn', 'main.js']);
});

// The webpack plugin had a bug that it didn't work for actually async code so
// this test will prevent that from occurring again.
test('integrityBlockSign with sleeping CustomSigningStrategy', async (t) => {
  function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  class CustomSigningStrategy {
    async sign(data) {
      await sleep(500);
      return crypto.sign(
        /*algorithm=*/ undefined,
        data,
        TEST_ED25519_PRIVATE_KEY
      );
    }

    async getPublicKey() {
      await sleep(500);
      return crypto.createPublicKey(TEST_ED25519_PRIVATE_KEY);
    }
  }

  const { memfs } = await run({
    output: 'async.swbn',
    integrityBlockSign: {
      strategy: new CustomSigningStrategy(),
    },
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['async.swbn', 'main.js']);
});
