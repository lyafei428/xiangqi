import test from 'node:test';
import assert from 'node:assert/strict';
import type { DrillConfig, DrillKind } from '../src/client/drills/generator.ts';
import { generateDrill } from '../src/client/drills/generator.ts';
import type { DrillChoiceAnswer } from '../src/client/drills/generator.ts';
import { createDrillSession, drillReducer } from '../src/client/drills/session.ts';
import {
  generateLegalMoves,
  isInCheck,
  isLegal,
  parseFen,
  toChineseNotation,
} from '../src/shared/index.ts';

const CONFIG: DrillConfig = {
  kinds: ['move-pattern', 'legality', 'position', 'notation'],
  plies: { min: 6, max: 24 },
  attempts: { hint: 2, reveal: 3 },
};

const KINDS: readonly DrillKind[] = ['move-pattern', 'legality', 'position', 'notation'];

for (const kind of KINDS) {
  test(`${kind}：40 个种子的答案都能用引擎回算`, () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const drill = generateDrill(kind, seed, CONFIG);
      const position = parseFen(drill.fen);
      assert.equal(drill.kind, kind);

      const answer = drill.answer;
      if (answer.kind === 'targets') {
        assert.ok(drill.markedSquare !== null, '走法题必须标记起点');
        const expected = generateLegalMoves(position)
          .filter((move) => move.from === drill.markedSquare)
          .map((move) => move.to)
          .sort((a, b) => a - b);
        assert.deepEqual([...answer.targets].sort((a, b) => a - b), expected);
        continue;
      }

      const option = drill.options.find((candidate) => candidate.id === answer.optionId);
      assert.ok(option !== undefined, '答案选项必须在选项列表里');

      if (kind === 'legality') {
        assert.ok(drill.highlight !== null);
        assert.equal(option.label, isLegal(position, drill.highlight) ? '合法' : '不合法');
      } else if (kind === 'position') {
        const color = drill.variant === 'red-check' ? 'red' : 'black';
        assert.equal(option.label, isInCheck(position, color) ? '被将军' : '没被将军');
      } else {
        assert.ok(drill.highlight !== null);
        assert.equal(option.label, toChineseNotation(position, drill.highlight));
        assert.equal(new Set(drill.options.map((item) => item.label)).size, 4);
      }
    }
  });
}

test('练习会话：错两次提示，错三次揭晓答案', () => {
  const drill = generateDrill('legality', 7, CONFIG);
  const answer = drill.answer;
  if (answer.kind !== 'choice') throw new Error('合法性题必须是选择题');
  const wrong = drill.options.find((option) => option.id !== answer.optionId);
  if (wrong === undefined) throw new Error('没有错误选项');

  let session = createDrillSession(drill, CONFIG.attempts);
  session = drillReducer(session, { type: 'choose', optionId: wrong.id });
  session = drillReducer(session, { type: 'submit' });
  assert.equal(session.wrongAttempts, 1);
  assert.equal(session.hintShown, false);
  assert.equal(session.status, 'answering');

  session = drillReducer(session, { type: 'submit' });
  assert.equal(session.wrongAttempts, 2);
  assert.equal(session.hintShown, true);
  assert.equal(session.status, 'answering');

  session = drillReducer(session, { type: 'submit' });
  assert.equal(session.wrongAttempts, 3);
  assert.equal(session.status, 'revealed');
});

test('练习会话：答对即结束', () => {
  const drill = generateDrill('legality', 9, CONFIG);
  const answer = drill.answer as DrillChoiceAnswer;
  let session = createDrillSession(drill, CONFIG.attempts);
  session = drillReducer(session, { type: 'choose', optionId: answer.optionId });
  session = drillReducer(session, { type: 'submit' });
  assert.equal(session.status, 'correct');
});

test('走法题：集合相等判分，顺序无关', () => {
  const drill = generateDrill('move-pattern', 3, CONFIG);
  if (drill.answer.kind !== 'targets') throw new Error('走法题答案类型错误');
  let session = createDrillSession(drill, CONFIG.attempts);
  for (const square of [...drill.answer.targets].reverse()) {
    session = drillReducer(session, { type: 'toggle', square });
  }
  session = drillReducer(session, { type: 'submit' });
  assert.equal(session.status, 'correct');
});

test('走法题：漏选算错并累计次数', () => {
  const drill = generateDrill('move-pattern', 5, CONFIG);
  if (drill.answer.kind !== 'targets') throw new Error('走法题答案类型错误');
  const first = drill.answer.targets[0];
  if (first === undefined) throw new Error('答案为空');
  let session = createDrillSession(drill, CONFIG.attempts);
  session = drillReducer(session, { type: 'toggle', square: first });
  session = drillReducer(session, { type: 'submit' });
  assert.equal(session.wrongAttempts, 1);
});
