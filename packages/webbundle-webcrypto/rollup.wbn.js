import * as esbuild from "esbuild";
import * as rollup from "rollup";
import * as wbnSign from "wbn-sign-webcrypto";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
const { webcrypto } = crypto;
const algorithm = { name: "Ed25519" };

fs.writeFileSync("./src/script.js", `resizeTo(400,300); console.log("Signed Web Bundle for Isolated Web App using ${navigator.userAgent}")`);

// https://github.com/tQsW/webcrypto-curve25519/blob/master/explainer.md
const cryptoKey = await webcrypto.subtle.generateKey(
  algorithm.name,
  true, /* extractable */
  ["sign", "verify"],
);

// Deno-specific workaround for dynamic imports. Same path is used twice below.
const dynamicImport = "./wbn-bundle.js";

await esbuild.build({
  entryPoints: ["src/index.ts"],
  platform: "node",
  outfile: dynamicImport,
  format: "esm",
  packages: "external",
  legalComments: "inline",
  sourcemap: true,
  bundle: true,
  keepNames: true,
  allowOverwrite: true
});

// "" + "/path" and "/path" + "": Deno-specific workaround to avoid module not found error
// https://www.reddit.com/r/Deno/comments/18unb03/comment/kfsszsw/
// https://github.com/denoland/deno/issues/20945
// https://github.com/denoland/deno/issues/17697#issuecomment-1486509016
// https://deno.com/blog/v1.33#fewer-permission-checks-for-dynamic-imports
const { default: wbnOutputPlugin } = await import(dynamicImport);

const build = async () => {
  /*
  const key = parsePemKey(
    privateKey,
  );
  */
  // https://github.com/GoogleChromeLabs/webbundle-plugins/blob/d251f6efbdb41cf8d37b9b7c696fd5c795cdc231/packages/rollup-plugin-webbundle/test/test.js#L408
  // wbn-sign/lib/signers/node-crypto-signing-strategy.js
  class CustomSigningStrategy {
    async sign(data) {
      return new Uint8Array(
        await webcrypto.subtle.sign(algorithm, cryptoKey.privateKey, data),
      );
      // crypto.sign(
      // /*algorithm=*/ //undefined,
      // data,
      // key,
      //);
    }
    async getPublicKey() {
      return cryptoKey.publicKey; // crypto.createPublicKey(key);
    }
  }
  const bundle = await rollup.rollup({
    input: "./src/script.js",
    plugins: [
      wbnOutputPlugin({
        baseURL: await new wbnSign.WebBundleId(
          cryptoKey.publicKey,
        ).serializeWithIsolatedWebAppOrigin(),
        static: { dir: "assets" },
        output: "signed.swbn",
        integrityBlockSign: {
          strategy: new CustomSigningStrategy(), // new wbnSign.NodeCryptoSigningStrategy(key),
        },     
        headerOverride: {
          "cross-origin-embedder-policy": "require-corp",
          "cross-origin-opener-policy": "same-origin",
          "cross-origin-resource-policy": "same-origin",
          "content-security-policy":
            "base-uri 'none'; default-src 'self'; object-src 'none'; frame-src 'self' https: blob: data:; connect-src 'self' https: wss:; script-src 'self' 'wasm-unsafe-eval'; img-src 'self' https: blob: data:; media-src 'self' https: blob: data:; font-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; require-trusted-types-for 'script';",
        },       
      }),
    ],
  });

  const { output } = await bundle.generate({ format: "esm" });
  const [{ fileName, source }] = output;
  fs.writeFileSync(fileName, source);
  return `${fileName}, ${source.byteLength} bytes.`;
};

build()
 .then(console.log).catch(console.error);
