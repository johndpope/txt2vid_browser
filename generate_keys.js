const { webcrypto } = require('crypto');
const { writeFile } = require('fs/promises');
const { resolve } = require('path');

const crypto = webcrypto;

async function generateSampleKeys() {
  const keys = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
    },
    true,
    ['encrypt', 'decrypt']
  );

  const priv = await crypto.subtle.exportKey('jwk', keys.privateKey);
  const pub = await crypto.subtle.exportKey('jwk', keys.publicKey);

  const keysJson = JSON.stringify({ priv, pub }, null, 2);

  const KEYS_PATH = resolve(__dirname, './server/keys.json');
  
  await writeFile(KEYS_PATH, keysJson);
  console.log(`Sample keys have been generated and saved to ${KEYS_PATH}`);
}

generateSampleKeys().catch(console.error);