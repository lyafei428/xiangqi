import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHash, routeHash } from '../src/client/shell/routes.ts';

test('空 hash 与未知路径回落到对弈', () => {
  assert.deepEqual(parseHash(''), { name: 'play' });
  assert.deepEqual(parseHash('#/nope'), { name: 'play' });
});

test('课程与单课路由', () => {
  assert.deepEqual(parseHash('#/learn'), { name: 'learn' });
  assert.deepEqual(parseHash('#/lesson/rook'), { name: 'lesson', id: 'rook' });
});

test('练习路由带种子与题型', () => {
  assert.deepEqual(parseHash('#/drill?seed=7&kind=legality'), {
    name: 'drill',
    seed: 7,
    kind: 'legality',
  });
  assert.deepEqual(parseHash('#/drill'), { name: 'drill' });
  assert.deepEqual(parseHash('#/drill?kind=nope'), { name: 'drill' });
});

test('对弈题路由', () => {
  assert.deepEqual(parseHash('#/missions'), { name: 'missions' });
  assert.deepEqual(parseHash('#/mission/mission-flying-general'), {
    name: 'mission',
    id: 'mission-flying-general',
  });
  assert.deepEqual(parseHash('#/mission/'), { name: 'missions' });
});

test('联机路由', () => {
  assert.deepEqual(parseHash('#/online'), { name: 'online' });
});

test('棋谱路由', () => {
  assert.deepEqual(parseHash('#/replay'), { name: 'replay' });
  assert.deepEqual(parseHash('#/replay/1700000000000'), { name: 'replayOne', id: 1_700_000_000_000 });
  assert.deepEqual(parseHash('#/replay/'), { name: 'replay' });
  assert.deepEqual(parseHash('#/replay/abc'), { name: 'replay' });
  assert.deepEqual(parseHash('#/replay/0'), { name: 'replay' });
  assert.equal(routeHash({ name: 'replay' }), '#/replay');
  assert.equal(routeHash({ name: 'replayOne', id: 12 }), '#/replay/12');
});

test('规则页路由', () => {
  assert.deepEqual(parseHash('#/rules'), { name: 'rules' });
  assert.equal(routeHash({ name: 'rules' }), '#/rules');
});

test('routeHash 与 parseHash 往返一致', () => {
  for (const hash of ['#/play', '#/learn', '#/lesson/horse', '#/drill?seed=3&kind=notation', '#/missions', '#/mission/mission-iron-bolt', '#/online', '#/replay', '#/replay/1700000000000', '#/rules']) {
    assert.equal(routeHash(parseHash(hash)), hash);
  }
});
