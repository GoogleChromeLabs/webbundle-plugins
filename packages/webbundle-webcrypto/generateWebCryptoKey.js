import * as fs from "node:fs";
import * as crypto from "node:crypto";
const { webcrypto } = crypto;
const algorithm = { name: "Ed25519" };
const encoder = new TextEncoder();
const cryptoKey = await webcrypto.subtle.generateKey(
  algorithm,
  true, /* extractable */
  ["sign", "verify"],
);
const privateKey = JSON.stringify(
  await webcrypto.subtle.exportKey("jwk", cryptoKey.privateKey),
);
fs.writeFileSync("./privateKey.json", encoder.encode(privateKey));
const publicKey = JSON.stringify(
  await webcrypto.subtle.exportKey("jwk", cryptoKey.publicKey),
);
fs.writeFileSync("./publicKey.json", encoder.encode(publicKey));
