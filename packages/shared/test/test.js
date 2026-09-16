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

import test from 'ava';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BundleBuilder } from 'wbn';
import { getValidatedOptionsWithDefaults } from '../lib/types.js';
import {
  addAsset,
  addFilesRecursively,
  assertExchangeUrlOrigin,
} from '../lib/utils.js';
import * as wbnSign from 'wbn-sign';

const TEST_ED25519_PRIVATE_KEY = wbnSign.parsePemKey(
  '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIB8nP5PpWU7HiILHSfh5PYzb5GAcIfHZ+bw6tcd/LZXh\n-----END PRIVATE KEY-----'
);
const TEST_IWA_BASE_URL =
  'isolated-app://4tkrnsmftl4ggvvdkfth3piainqragus2qbhf7rlz2a3wo3rh4wqaaic/';

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
          await getValidatedOptionsWithDefaults({
            baseURL: TEST_IWA_BASE_URL,
            output: 'example.swbn',
            integrityBlockSign: {
              key: TEST_ED25519_PRIVATE_KEY,
              isIwa: isIwaTestCase,
            },
            headerOverride: badHeaders,
          });
        },
        { instanceOf: Error }
      );
    }
  }
});

test('addFilesRecursively - refuses symbolic link to file', (t) => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wbn-test-symlink-file-')
  );
  try {
    const targetFile = path.join(tmpDir, 'target.txt');
    fs.writeFileSync(targetFile, 'sensitive data');
    const symlinkFile = path.join(tmpDir, 'symlink.txt');
    fs.symlinkSync(targetFile, symlinkFile);

    const builder = new BundleBuilder();
    const error = t.throws(
      () => {
        addFilesRecursively(builder, 'https://example.com/', tmpDir, {
          baseURL: 'https://example.com/',
          output: 'out.wbn',
        });
      },
      { instanceOf: Error }
    );
    t.is(
      error.message,
      `Refusing to bundle symbolic link at ${symlinkFile}. Replace it with a regular file or directory.`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('addFilesRecursively - refuses symbolic link to directory', (t) => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wbn-test-symlink-dir-')
  );
  try {
    const targetDir = path.join(tmpDir, 'target-dir');
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'inner.txt'), 'sensitive data');
    const symlinkDir = path.join(tmpDir, 'symlink-dir');
    fs.symlinkSync(targetDir, symlinkDir);

    const builder = new BundleBuilder();
    const error = t.throws(
      () => {
        addFilesRecursively(builder, 'https://example.com/', tmpDir, {
          baseURL: 'https://example.com/',
          output: 'out.wbn',
        });
      },
      { instanceOf: Error }
    );
    t.is(
      error.message,
      `Refusing to bundle symbolic link at ${symlinkDir}. Replace it with a regular file or directory.`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('addFilesRecursively - refuses root directory being a symbolic link', (t) => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wbn-test-root-symlink-')
  );
  try {
    const targetDir = path.join(tmpDir, 'target-dir');
    fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'inner.txt'), 'some data');
    const symlinkDir = path.join(tmpDir, 'symlink-root');
    fs.symlinkSync(targetDir, symlinkDir);

    const builder = new BundleBuilder();
    const error = t.throws(
      () => {
        addFilesRecursively(builder, 'https://example.com/', symlinkDir, {
          baseURL: 'https://example.com/',
          output: 'out.wbn',
        });
      },
      { instanceOf: Error }
    );
    t.is(
      error.message,
      `Refusing to bundle symbolic link at ${symlinkDir}. Replace it with a regular file or directory.`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('addFilesRecursively - refuses directory-symlink loop (prevents ELOOP)', (t) => {
  const tmpDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'wbn-test-symlink-loop-')
  );
  try {
    const loopLink = path.join(tmpDir, 'loop');
    fs.symlinkSync('.', loopLink);

    const builder = new BundleBuilder();
    const error = t.throws(
      () => {
        addFilesRecursively(builder, 'https://example.com/', tmpDir, {
          baseURL: 'https://example.com/',
          output: 'out.wbn',
        });
      },
      { instanceOf: Error }
    );
    t.is(
      error.message,
      `Refusing to bundle symbolic link at ${loopLink}. Replace it with a regular file or directory.`
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('addAsset - refuses absolute exchange URL when baseURL is empty', (t) => {
  const builder = new BundleBuilder();
  const error = t.throws(
    () => {
      addAsset(
        builder,
        '',
        'https:/attacker.test/p.js',
        'console.log("evil");',
        { output: 'out.wbn' }
      );
    },
    { instanceOf: Error }
  );
  t.is(
    error.message,
    'Refusing to add exchange with unexpected origin: https:/attacker.test/p.js'
  );
});

test('assertExchangeUrlOrigin - throws when origins differ', (t) => {
  const errorHttps = t.throws(
    () => {
      assertExchangeUrlOrigin(
        'https://attacker.test/p.js',
        'https://example.com/'
      );
    },
    { instanceOf: Error }
  );
  t.is(
    errorHttps.message,
    'Refusing to add exchange with unexpected origin: https://attacker.test/p.js'
  );

  const errorIwa = t.throws(
    () => {
      assertExchangeUrlOrigin(
        'isolated-app://attacker/p.js',
        'isolated-app://legit/'
      );
    },
    { instanceOf: Error }
  );
  t.is(
    errorIwa.message,
    'Refusing to add exchange with unexpected origin: isolated-app://attacker/p.js'
  );
});

test('addAsset - allows same origin exchange URL', (t) => {
  const builder = new BundleBuilder();
  t.notThrows(() => {
    addAsset(
      builder,
      'https://example.com/',
      'script.js',
      'console.log("ok");',
      { baseURL: 'https://example.com/', output: 'out.wbn' }
    );
  });
});

test('addAsset - allows relative exchange URL when baseURL is empty or relative', (t) => {
  const builder = new BundleBuilder();
  t.notThrows(() => {
    addAsset(builder, '', 'script.js', 'console.log("ok");', {
      output: 'out.wbn',
    });
    addAsset(builder, '/', 'script.js', 'console.log("ok");', {
      baseURL: '/',
      output: 'out.wbn',
    });
  });
});
