import test from 'node:test';
import assert from 'node:assert/strict';
import { redactUnknown } from './redact.js';

test('redacts secret-like keys recursively', () => {
  const data = {
    apiKey: 'abc123456789',
    nested: {
      authorization: 'Bearer very-long-token',
      ok: 'hello',
    },
  };
  const redacted = redactUnknown(data) as Record<string, unknown>;
  assert.equal(redacted.apiKey, 'abc***89');
  assert.deepEqual(redacted.nested, { authorization: 'Bea***en', ok: 'hello' });
});
