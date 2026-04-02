import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptText, decryptText } from './crypto.js';

test('encrypt/decrypt roundtrip', () => {
  process.env.CREDENTIAL_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  const plain = 'my-secret-value';
  const encrypted = encryptText(plain);
  assert.notEqual(encrypted, plain);
  const decrypted = decryptText(encrypted);
  assert.equal(decrypted, plain);
});
