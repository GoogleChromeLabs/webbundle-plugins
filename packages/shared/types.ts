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
import { URL } from 'url';
import * as z from 'zod';
// TODO(sonkkeli: b/282899095): This should get fixed whenever we use a more
// modern test framework like Jest.
import { checkAndAddIwaHeaders, iwaHeaderDefaults } from './iwa-headers.js';
import {
  NodeCryptoSigningStrategy,
  ISigningStrategy,
  WebBundleId,
} from 'wbn-sign';

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

const baseIntegrityBlockSignSchema = z.strictObject({
  isIwa: z.boolean().default(true),
});

const keyBasedIntegrityBlockSignSchema = baseIntegrityBlockSignSchema
  .extend({
    // Unfortunately we cannot use `KeyObject` directly within `instanceof()`,
    // because its constructor is private.
    key: z
      .instanceof(Object)
      .refine((key): key is KeyObject => key instanceof KeyObject, {
        message: `Key must be an instance of "KeyObject"`,
      }),
  })

  // Use the default NodeCryptoSigningStrategy strategy instead of key.
  .transform((ibSignOpts) => {
    return {
      isIwa: ibSignOpts.isIwa,
      webBundleId: new WebBundleId(ibSignOpts.key).serialize(),
      strategies: [new NodeCryptoSigningStrategy(ibSignOpts.key)],
    };
  });

const strategyBasedIntegrityBlockSignSchema = baseIntegrityBlockSignSchema
  .extend({
    strategy: z.instanceof(Object).refine(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (strategy: Record<string, any>): strategy is ISigningStrategy => {
        return ['getPublicKey', 'sign'].every(
          (func) => func in strategy && typeof strategy[func] === 'function'
        );
      },
      { message: `Strategy must implement "ISigningStrategy"` }
    ),
  })
  .transform(async (ibSignOpts) => {
    return {
      isIwa: ibSignOpts.isIwa,
      webBundleId: new WebBundleId(
        await ibSignOpts.strategy.getPublicKey()
      ).serialize(),
      strategies: [ibSignOpts.strategy],
    };
  });

const strategiesBasedIntegrityBlockSignSchemaWithWebBundleId =
  baseIntegrityBlockSignSchema.extend({
    strategies: z
      .array(
        z.instanceof(Object).refine(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (strategy: Record<string, any>): strategy is ISigningStrategy => {
            return ['getPublicKey', 'sign'].every(
              (func) => func in strategy && typeof strategy[func] === 'function'
            );
          },
          { message: `Strategy must implement "ISigningStrategy"` }
        )
      )
      .min(1),
    webBundleId: z.string().min(1),
  });

const signingSchema = baseOptionsSchema
  .extend({
    integrityBlockSign: z.union([
      keyBasedIntegrityBlockSignSchema,
      strategyBasedIntegrityBlockSignSchema,
      strategiesBasedIntegrityBlockSignSchemaWithWebBundleId,
    ]),
  })

  // Check that `baseURL` is either not set, or set to the expected origin based
  // on the private key.
  .superRefine((opts, ctx) => {
    const webBundleId = opts.integrityBlockSign.webBundleId;
    if (opts.baseURL !== '' && new URL(opts.baseURL).host !== webBundleId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `The hostname of the provided "baseURL" option (${opts.baseURL}) does not match the expected host (${webBundleId}) derived from the public key.`,
      });
    }
  })

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

export const optionsSchema = z.union([nonSigningSchema, signingSchema]);

export const getValidatedOptionsWithDefaults = optionsSchema.parseAsync;

export type PluginOptions = z.input<typeof optionsSchema>;

export type ValidPluginOptions = z.infer<typeof optionsSchema>;

export type ValidIbSignPluginOptions = z.infer<typeof signingSchema>;
