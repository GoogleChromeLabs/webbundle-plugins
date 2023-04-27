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

import { KeyObject } from 'crypto';
import { FormatVersion } from './wbn-types.js';

export interface Headers {
  [key: string]: string;
}

interface IntegrityBlockSignOptions {
  key: KeyObject;
  isIwa?: boolean;
}

export interface PluginOptions {
  baseURL: string;
  primaryURL?: string;
  static: { dir: string; baseURL?: string };
  output: string;
  formatVersion: FormatVersion;
  integrityBlockSign?: IntegrityBlockSignOptions;
  headerOverride?: (() => Headers) | Headers;
}
