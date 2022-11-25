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

import test from 'ava';
import * as path from 'path';
import * as rollup from 'rollup';
import url from 'url';
import * as wbn from 'wbn';
import * as wbnSign from 'wbn-sign';

import webbundle from '../lib/index.js';

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
  const testPrivateKey =
    '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIB8nP5PpWU7HiILHSfh5PYzb5GAcIfHZ+bw6tcd/LZXh\n-----END PRIVATE KEY-----';
  const fileName = 'out.wbn';

  const bundle = await rollup.rollup({
    input: 'fixtures/index.js',
    plugins: [
      webbundle({
        baseURL:
          'isolated-app://4tkrnsmftl4ggvvdkfth3piainqragus2qbhf7rlz2a3wo3rh4wqaaic/',
        output: fileName,
        integrityBlockSign: {
          key: testPrivateKey,
        },
      }),
    ],
  });
  const { output } = await bundle.generate({ format: 'esm' });
  const keys = Object.keys(output);
  t.is(keys.length, 1);
  t.is(output[keys[0]].fileName, fileName);

  const swbnFile = output[keys[0]].source;
  const wbnLength = Number(Buffer.from(swbnFile.slice(-8)).readBigUint64BE());
  t.truthy(wbnLength < swbnFile.length);
  const { signedWebBundle } = new wbnSign.IntegrityBlockSigner(
    swbnFile.slice(-wbnLength),
    { key: wbnSign.parsePemKey(testPrivateKey) }
  ).sign();

  t.deepEqual(swbnFile, Buffer.from(signedWebBundle));
});
