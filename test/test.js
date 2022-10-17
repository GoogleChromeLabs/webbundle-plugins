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
const fs = require('fs');
const { join } = require('path');

const WebBundlePlugin = require('..');

function run(options) {
  return new Promise((resolve, reject) => {
    const compiler = webpack({
      mode: 'development',
      devtool: false,
      entry: join(__dirname, 'fixtures', 'app'),
      bail: true,
      output: {
        path: '/out',
        filename: 'main.js'
      },
      plugins: [new WebBundlePlugin(options)]
    });
    const memfs = new MemoryFS();
    compiler.outputFileSystem = memfs;
    compiler.run((err, stats) => {
      err ? reject(err) : resolve({stats, memfs});
    });
  });
}

test('basic', async t => {
  const primaryURL = 'https://example.com/main.js';
  const { stats, memfs } = await run({
    baseURL: 'https://example.com/',
    primaryURL,
    output: 'example.wbn'
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const js = memfs.readFileSync('/out/main.js');
  const bundle = new wbn.Bundle(memfs.readFileSync('/out/example.wbn'));
  t.is(bundle.primaryURL, primaryURL);
  t.deepEqual(bundle.urls, [primaryURL]);
  const resp = bundle.getResponse(primaryURL);
  t.is(new TextDecoder('utf-8').decode(resp.body), js.toString());
});

test('static', async t => {
  const primaryURL = 'https://example.com/';
  const { stats, memfs } = await run({
    baseURL: 'https://example.com/',
    primaryURL,
    static: { dir: join(__dirname, 'fixtures', 'static') },
    output: 'example.wbn'
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const html = fs.readFileSync(join(__dirname, 'fixtures', 'static', 'index.html'));
  const bundle = new wbn.Bundle(memfs.readFileSync('/out/example.wbn'));
  t.is(bundle.primaryURL, primaryURL);
  t.deepEqual(bundle.urls.sort(), [primaryURL, 'https://example.com/index.html', 'https://example.com/main.js']);
  const resp = bundle.getResponse(primaryURL);
  t.is(new TextDecoder('utf-8').decode(resp.body), html.toString());
});

test('relative', async t => {
  const { stats, memfs } = await run({
    static: { dir: join(__dirname, 'fixtures', 'static') },
    output: 'example.wbn'
  });
  t.deepEqual(memfs.readdirSync('/out').sort(), ['example.wbn', 'main.js']);
  const html = fs.readFileSync(join(__dirname, 'fixtures', 'static', 'index.html'));
  const js = memfs.readFileSync('/out/main.js');
  const bundle = new wbn.Bundle(memfs.readFileSync('/out/example.wbn'));
  t.deepEqual(bundle.urls.sort(), ['', 'index.html', 'main.js']);
  let resp = bundle.getResponse('');
  t.is(new TextDecoder('utf-8').decode(resp.body), html.toString());
  resp = bundle.getResponse('main.js');
  t.is(new TextDecoder('utf-8').decode(resp.body), js.toString());
});
