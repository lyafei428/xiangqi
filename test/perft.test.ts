import test from 'node:test';
import assert from 'node:assert/strict';
import { initialPosition, perft } from '../src/shared/index.ts';

test('perft 自初始局面与公开基准逐位一致', { timeout: 120_000 }, () => {
  assert.equal(perft(initialPosition, 0), 1);
  assert.equal(perft(initialPosition, 1), 44);
  assert.equal(perft(initialPosition, 2), 1920);
  assert.equal(perft(initialPosition, 3), 79666);
  assert.equal(perft(initialPosition, 4), 3290240);
});
