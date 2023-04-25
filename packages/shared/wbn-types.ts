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

// These must match with the types in `wbn`.
// github.com/WICG/webpackage/blob/main/js/bundle/src/constants.ts
const B1 = 'b1';
const B2 = 'b2';
const APPROVED_VERSIONS = [B1, B2] as const;
export type FormatVersion = typeof APPROVED_VERSIONS[number];
