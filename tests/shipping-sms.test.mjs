import assert from 'node:assert/strict';
import test from 'node:test';
import { buildShippedSms } from '../src/lib/shipping-sms.ts';

test('shipping text identifies the order, promises a call, and stays in one GSM-7 segment', () => {
  const message = buildShippedSms({ id: 12345 });
  assert.match(message, /Order RD-12345 has shipped/);
  assert.match(message, /expect a call from our delivery team to arrange delivery/);
  assert.match(message, /track-order\?ref=RD-12345/);
  assert.match(message, /^[\x20-\x7E]+$/);
  assert.ok(message.length <= 160);
});
