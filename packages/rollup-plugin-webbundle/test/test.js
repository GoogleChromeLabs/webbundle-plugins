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
import * as path from 'path';
import * as rollup from 'rollup';
import url from 'url';
import * as wbn from 'wbn';
import * as wbnSign from 'wbn-sign';

import webbundle from '../../lib-for-tests/rollup-plugin-webbundle/src/index.js';
import {
  coep,
  coop,
  corp,
  csp,
  iwaHeaderDefaults,
} from '../../lib-for-tests/shared/iwa-headers.js';

const TEST_ED25519_PRIVATE_KEY = wbnSign.parsePemKey(
  '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIB8nP5PpWU7HiILHSfh5PYzb5GAcIfHZ+bw6tcd/LZXh\n-----END PRIVATE KEY-----'
);
const TEST_IWA_BASE_URL =
  'isolated-app://4tkrnsmftl4ggvvdkfth3piainqragus2qbhf7rlz2a3wo3rh4wqaaic/';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
process.chdir(__dirname);

function parseWebBundle(buf) {
  const bundle = new wbn.Bundle(buf);
  const exchanges = {};
  for (const url of bundle.urls) {
    const resp = bundle.getResponse(url);
    let body = new TextDecoder('utf-8').decode(resp.body);

    // Our test snapshots are generated with Rollup 2, but Rollup 1 uses
    // different syntax for default export.
    if (rollup.VERSION.startsWith('1.')) {
      body = body.replace(
        'export default index',
        'export { index as default }'
      );
    }

    exchanges[url] = {
      status: resp.status,
      headers: resp.headers,
      body: body,
    };
  }
  return {
    version: bundle.version,
    primaryURL: bundle.primaryURL,
    exchanges,
  };
}

test('simple', async (t) => {
  const bundle = await rollup.rollup({
    input: 'fixtures/index.js',
    plugins: [
      webbundle({
        baseURL: 'https://wbn.example.com/',
        primaryURL: 'https://wbn.example.com/index.js',
        output: 'out.wbn',
      }),
    ],
  });
  const { output } = await bundle.generate({ format: 'esm' });
  const keys = Object.keys(output);
  t.is(keys.length, 1);
  if (output[keys[0]].type) t.is(output[keys[0]].type, 'asset');
  else t.true(output[keys[0]].isAsset);
  t.is(output[keys[0]].fileName, 'out.wbn');

  t.snapshot(parseWebBundle(output[keys[0]].source));
});

test('asset', async (t) => {
  const bundle = await rollup.rollup({
    input: 'fixtures/index.js',
    plugins: [
      {
        name: 'add-asset',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            name: 'hello.txt',
            source: 'Hello',
          });
        },
      },
      webbundle({
        formatVersion: 'b1',
        baseURL: 'https://wbn.example.com/',
        primaryURL: 'https://wbn.example.com/assets/hello.txt',
        output: 'out.wbn',
      }),
    ],
  });
  const { output } = await bundle.generate({
    format: 'esm',
    assetFileNames: 'assets/[name][extname]',
  });
  const keys = Object.keys(output);
  t.is(keys.length, 1);
  if (output[keys[0]].type) t.is(output[keys[0]].type, 'asset');
  else t.true(output[keys[0]].isAsset);
  t.is(output[keys[0]].fileName, 'out.wbn');

  t.snapshot(parseWebBundle(output[keys[0]].source));
});

test('static', async (t) => {
  const bundle = await rollup.rollup({
    input: 'fixtures/index.js',
    plugins: [
      webbundle({
        baseURL: 'https://wbn.example.com/',
        primaryURL: 'https://wbn.example.com/',
        output: 'out.wbn',
        static: { dir: 'fixtures/static' },
      }),
    ],
  });
  const { output } = await bundle.generate({ format: 'esm' });
  const keys = Object.keys(output);
  t.is(keys.length, 1);
  if (output[keys[0]].type) t.is(output[keys[0]].type, 'asset');
  else t.true(output[keys[0]].isAsset);
  t.is(output[keys[0]].fileName, 'out.wbn');

  t.snapshot(parseWebBundle(output[keys[0]].source));
});

test('relative', async (t) => {
  const bundle = await rollup.rollup({
    input: 'fixtures/index.js',
    plugins: [
      webbundle({
        baseURL: '/',
        output: 'out.wbn',
        static: { dir: 'fixtures/static' },
      }),
    ],
  });
  const { output } = await bundle.generate({ format: 'esm' });
  const keys = Object.keys(output);
  t.is(keys.length, 1);
  if (output[keys[0]].type) t.is(output[keys[0]].type, 'asset');
  else t.true(output[keys[0]].isAsset);
  t.is(output[keys[0]].fileName, 'out.wbn');

  t.snapshot(parseWebBundle(output[keys[0]].source));
});

test('integrityBlockSign', async (t) => {
  const outputFileName = 'out.swbn';

  const bundle = await rollup.rollup({
    input: 'fixtures/index.js',
    plugins: [
      webbundle({
        baseURL: TEST_IWA_BASE_URL,
        output: outputFileName,
        integrityBlockSign: {
          key: TEST_ED25519_PRIVATE_KEY,
        },
      }),
    ],
  });
  const { output } = await bundle.generate({ format: 'esm' });
  const keys = Object.keys(output);
  t.is(keys.length, 1);
  t.is(output[keys[0]].fileName, outputFileName);

  const swbnFile = output[keys[0]].source;
  const wbnLength = Number(Buffer.from(swbnFile.slice(-8)).readBigUint64BE());
  t.truthy(wbnLength < swbnFile.length);
  const { signedWebBundle } = new wbnSign.IntegrityBlockSigner(
    swbnFile.slice(-wbnLength),
    { key: TEST_ED25519_PRIVATE_KEY }
  ).sign();

  t.deepEqual(swbnFile, Buffer.from(signedWebBundle));
});

test('headerOverride - IWA with good headers', async (t) => {
  const headersTestCases = [
    // These are added manually as they expect more than just `iwaHeaderDefaults`.
    {
      headerOverride: {
        ...iwaHeaderDefaults,
        'X-Csrf-Token': 'hello-world',
      },
      expectedHeaders: {
        ...iwaHeaderDefaults,
        'x-csrf-token': 'hello-world',
      },
    },
    {
      headerOverride: () => {
        return {
          ...iwaHeaderDefaults,
          'X-Csrf-Token': 'hello-world',
        };
      },
      expectedHeaders: {
        ...iwaHeaderDefaults,
        'x-csrf-token': 'hello-world',
      },
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

  const outputFileName = 'out.swbn';
  for (const headersTestCase of headersTestCases) {
    for (const isIwaTestCase of [undefined, true]) {
      const bundle = await rollup.rollup({
        input: 'fixtures/index.js',
        plugins: [
          webbundle({
            baseURL: TEST_IWA_BASE_URL,
            output: outputFileName,
            integrityBlockSign: {
              key: TEST_ED25519_PRIVATE_KEY,
              isIwa: isIwaTestCase,
            },
            headerOverride: headersTestCase.headerOverride,
          }),
        ],
      });
      const { output } = await bundle.generate({ format: 'esm' });
      const keys = Object.keys(output);
      t.is(keys.length, 1);
      t.is(output[keys[0]].fileName, outputFileName);

      const swbnFile = output[keys[0]].source;
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

test('headerOverride - IWA with bad headers', async (t) => {
  const badHeadersTestCase = [
    { 'cross-origin-embedder-policy': 'unsafe-none' },
    { 'cross-origin-opener-policy': 'unsafe-none' },
    { 'cross-origin-resource-policy': 'cross-origin' },
  ];

  for (const badHeaders of badHeadersTestCase) {
    for (const isIwaTestCase of [undefined, true]) {
      await t.throwsAsync(
        async () => {
          await rollup.rollup({
            input: 'fixtures/index.js',
            plugins: [
              webbundle({
                baseURL: TEST_IWA_BASE_URL,
                output: 'example.swbn',
                integrityBlockSign: {
                  key: TEST_ED25519_PRIVATE_KEY,
                  isIwa: isIwaTestCase,
                },
                headerOverride: badHeaders,
              }),
            ],
          });
        },
        { instanceOf: Error }
      );
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

  const outputFileName = 'out.swbn';
  for (const headersTestCase of headersTestCases) {
    const bundle = await rollup.rollup({
      input: 'fixtures/index.js',
      plugins: [
        webbundle({
          baseURL: TEST_IWA_BASE_URL,
          output: outputFileName,
          integrityBlockSign: {
            key: TEST_ED25519_PRIVATE_KEY,
            isIwa: false,
          },
          headerOverride: headersTestCase.headerOverride,
        }),
      ],
    });

    const { output } = await bundle.generate({ format: 'esm' });
    const keys = Object.keys(output);
    t.is(keys.length, 1);
    t.is(output[keys[0]].fileName, outputFileName);
    const swbnFile = output[keys[0]].source;

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
