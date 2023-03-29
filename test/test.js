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

const test = require('ava');
const webpack = require('webpack');
const MemoryFS = require('memory-fs');
const wbn = require('wbn');
const wbnSign = require('wbn-sign');
const fs = require('fs');
const { join } = require('path');

const WebBundlePlugin = require('..');
const {
  coep,
  coop,
  corp,
  csp,
  iwaHeaderDefaults,
} = require('../iwa-header-constants');

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
      entry: join(__dirname, 'fixtures', 'app'),
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
  const { stats, memfs } = await run({
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
  const { stats, memfs } = await run({
    baseURL: 'https://example.com/',
    primaryURL,
    static: { dir: join(__dirname, 'fixtures', 'static') },
    output: 'example.wbn',
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const html = fs.readFileSync(
    join(__dirname, 'fixtures', 'static', 'index.html')
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
  const { stats, memfs } = await run({
    static: { dir: join(__dirname, 'fixtures', 'static') },
    output: 'example.wbn',
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const html = fs.readFileSync(
    join(__dirname, 'fixtures', 'static', 'index.html')
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
  const signed = (
    await run({
      baseURL: TEST_IWA_BASE_URL,
      output: 'example.swbn',
      integrityBlockSign: {
        key: TEST_ED25519_PRIVATE_KEY,
      },
    })
  ).memfs;
  t.deepEqual(signed.readdirSync('/out').sort(), ['example.swbn', 'main.js']);

  const swbnFile = signed.readFileSync('/out/example.swbn');
  const wbnLength = Number(Buffer.from(swbnFile.slice(-8)).readBigUint64BE());
  t.truthy(wbnLength < swbnFile.length);

  const { signedWebBundle } = new wbnSign.IntegrityBlockSigner(
    swbnFile.slice(-wbnLength),
    { key: TEST_ED25519_PRIVATE_KEY }
  ).sign();
  t.deepEqual(swbnFile, Buffer.from(signedWebBundle));
});

test('headerOverride - IWA with good headers', async (t) => {
  const goodHeadersTestCases = [
    {
      headerOverride: iwaHeaderDefaults,
      expectedHeaders: iwaHeaderDefaults,
    },
    {
      headerOverride: () => iwaHeaderDefaults,
      expectedHeaders: iwaHeaderDefaults,
    },
    {
      // When `integrityBlockSign.isIwa` and `headerOverride` are undefined, `iwaHeaderDefaults` will be added to each resource.
      headerOverride: undefined,
      expectedHeaders: iwaHeaderDefaults,
    },
    {
      headerOverride: { ...iwaHeaderDefaults, 'X-Csrf-Token': 'hello-world' },
      expectedHeaders: { ...iwaHeaderDefaults, 'X-Csrf-Token': 'hello-world' },
    },
  ];

  for (const testCase of goodHeadersTestCases) {
    const signed = (
      await run({
        baseURL: TEST_IWA_BASE_URL,
        output: 'example.swbn',
        integrityBlockSign: {
          key: TEST_ED25519_PRIVATE_KEY,
          isIwa: undefined, // Could also be empty, but highlighting it like this.
        },
        headerOverride: testCase.headerOverride,
      })
    ).memfs;
    t.deepEqual(signed.readdirSync('/out').sort(), ['example.swbn', 'main.js']);

    const swbnFile = signed.readFileSync('/out/example.swbn');
    const wbnLength = Number(Buffer.from(swbnFile.slice(-8)).readBigUint64BE());
    t.truthy(wbnLength < swbnFile.length);

    const usignedBundle = new wbn.Bundle(swbnFile.slice(-wbnLength));
    for (const url of usignedBundle.urls) {
      for (const headerName of Object.keys(testCase.expectedHeaders)) {
        t.is(
          usignedBundle.getResponse(url).headers[headerName],
          iwaHeaderDefaults[headerName]
        );
      }
    }
  }
});

test('headerOverride - IWA with bad headers', async (t) => {
  const badHeadersTestCases = [];
  for (const badHeaders of [
    { ...coop, ...corp, ...csp },
    { ...coep, ...corp, ...csp },
    { ...coep, ...coop, ...csp },
    { ...coep, ...coop, ...corp },
  ]) {
    badHeadersTestCases.push(badHeaders);
    badHeadersTestCases.push(() => badHeaders);
  }

  for (const badHeaders of badHeadersTestCases) {
    await t.throwsAsync(
      async () => {
        await run({
          baseURL: TEST_IWA_BASE_URL,
          output: 'example.swbn',
          integrityBlockSign: {
            key: TEST_ED25519_PRIVATE_KEY,
          },
          headerOverride: badHeaders,
        });
      },
      { instanceOf: Error }
    );
  }
});
