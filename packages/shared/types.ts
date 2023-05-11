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
import * as z from 'zod';
import { checkAndAddIwaHeaders, iwaHeaderDefaults } from './iwa-headers';
import { WebBundleId } from 'wbn-sign';

const headersSchema = z.record(z.string());

export type Headers = z.infer<typeof headersSchema>;

const baseOptionsSchema = z.strictObject({
  static: z
    .strictObject({
      dir: z.string(),
      baseURL: z.string().optional(),
    })
    .optional(),
  baseURL: z.string().default(''),
  output: z.string().default('out.wbn'),
  formatVersion: z.enum(['b1', 'b2']).default('b2'),
  headerOverride: z
    .union([z.function().returns(headersSchema), headersSchema])
    .optional(),
});

const nonSigningSchema = baseOptionsSchema.extend({
  primaryURL: z.string().optional(),
});

const signingSchema = baseOptionsSchema
  .extend({
    integrityBlockSign: z.strictObject({
      // Unfortunately we cannot use `KeyObject` directly within `instanceof()`,
      // because its constructor is private.
      key: z
        .instanceof(Object)
        .refine((key): key is KeyObject => key instanceof KeyObject, {
          message: `Key must be an instance of "KeyObject"`,
        }),
      isIwa: z.boolean().default(true),
    }),
  })

  // Check that `baseURL` is either not set, or set to the expected origin based
  // on the private key.
  .refine(
    (opts) => {
      const expectedOrigin = new WebBundleId(
        opts.integrityBlockSign.key
      ).serializeWithIsolatedWebAppOrigin();

      return opts.baseURL === '' || opts.baseURL === expectedOrigin;
    },

    (opts) => {
      const expectedOrigin = new WebBundleId(
        opts.integrityBlockSign.key
      ).serializeWithIsolatedWebAppOrigin();

      return {
        message: `The provided "baseURL" option (${opts.baseURL}) does not match the expected base URL (${expectedOrigin}), which is derived from the provided private key`,
      };
    }
  )

  // Set and validate the `headerOverride` option.
  .transform((opts, ctx) => {
    if (!opts.integrityBlockSign.isIwa) {
      return opts;
    }

    if (opts.headerOverride === undefined) {
      console.info(
        `Setting the empty headerOverrides to IWA defaults. To bundle a non-IWA, set \`integrityBlockSign { isIwa: false }\` in your plugin configs. Defaults are set to:\n ${JSON.stringify(
          iwaHeaderDefaults
        )}`
      );
      opts.headerOverride = iwaHeaderDefaults;
    } else if (typeof opts.headerOverride === 'object') {
      try {
        checkAndAddIwaHeaders(opts.headerOverride);
      } catch (err) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: String(err),
        });
      }
    }
    return opts;
  });

const optionsSchema = z.union([nonSigningSchema, signingSchema]);

export const getValidatedOptionsWithDefaults = optionsSchema.parse;

export type PluginOptions = z.input<typeof optionsSchema>;

export type ValidPluginOptions = z.infer<typeof optionsSchema>;

export type ValidIbSignPluginOptions = z.infer<typeof signingSchema>;
