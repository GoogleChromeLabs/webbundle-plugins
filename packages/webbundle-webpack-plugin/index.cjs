/**
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

// This is just a CommonJS wrapper for the default export to not to introduce a
// breaking change on how WebBundlePlugin is imported.
// For context, see:
// https://github.com/evanw/esbuild/issues/532#issuecomment-1019392638
// TODO: Get rid of this together with the next other breaking change.
const { WebBundlePlugin } = require('./lib/index.cjs');
module.exports = WebBundlePlugin;
