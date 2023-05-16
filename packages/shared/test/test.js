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
import { getValidatedOptionsWithDefaults } from '../lib/types.js';
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
