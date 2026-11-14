// 每步胜率的映射口径：均势、分差单调、黑白互补、终局收敛。
// 映射精度只在这里钉住；集成用例只看「数字出没出现、两处是否一致」，不看浮点。

import test from 'node:test';
import assert from 'node:assert/strict';
import { EVAL_SCALE, INITIAL_FEN, parseFen, redExpectation } from '../src/shared/index.ts';

/** 红方净一车（900 分）、双方将帅都在底线：只有子力差进分数，位置分与将帅安全分对冲为零。 */
const RED_ROOK_UP = '4k4/9/9/9/9/9/9/9/9/R3K4 w - - 0 1';

/** 上面那局的颜色镜像：黑方净一车。用于「红黑互补」——同一盘棋换个视角，两个数必然相加为 1。 */
const BLACK_ROOK_UP = 'r3k4/9/9/9/9/9/9/9/9/4K4 b - - 0 1';

/** 红方净一马（400 分）；马在角上，位置分为 0，差的就是纯子力。 */
const RED_KNIGHT_UP = '4k4/9/9/9/9/9/9/9/9/N3K4 w - - 0 1';

test('均势局面：两面都读作五五开，与轮到谁走无关', () => {
  const redToMove = parseFen(INITIAL_FEN);
  const blackToMove = parseFen(INITIAL_FEN.replace(' w ', ' b '));
  assert.ok(Math.abs(redExpectation(redToMove) - 0.5) < 0.01, '初始局面应是五五开');
  // 评估出口是行棋方视角，这里换回红方视角：同一盘棋不会因为轮到谁走变成两份判断。
  assert.ok(
    Math.abs(redExpectation(blackToMove) - 0.5) < 0.01,
    '初始局面轮到黑方走，红方期望分仍是五五开',
  );
  assert.equal(redExpectation(redToMove), redExpectation(blackToMove));
});

test('分差越大越接近满值：净一车 ≥ 95%，且高于净一马', () => {
  const rook = redExpectation(parseFen(RED_ROOK_UP));
  const knight = redExpectation(parseFen(RED_KNIGHT_UP));
  assert.ok(rook >= 0.95, `净一车应 ≥ 95%，实际 ${String(rook)}`);
  assert.ok(knight > 0.5 && knight < rook, `净一马的期望分应高于均势、低于净一车，实际 ${String(knight)}`);
  // 标定常数只此一处：400 分差对应 10 ** (400/400) 的让步比，约 91%。
  assert.ok(Math.abs(knight - 1 / (1 + 10 ** (-400 / EVAL_SCALE))) < 1e-9);
});

test('黑白互补：同一盘棋换个视角，两个期望分相加为 1', () => {
  const red = redExpectation(parseFen(RED_ROOK_UP));
  const black = redExpectation(parseFen(BLACK_ROOK_UP));
  assert.ok(Math.abs(red + black - 1) < 1e-9, `互补失败：${String(red)} + ${String(black)}`);
  // 补数落在显示侧：红 x% 与黑 100-x% 合计 100，正是这一条的直接结果。
  assert.ok(red > 0.5 && black < 0.5, '红方占优时红方期望分应过半数');
});

test('终局三分支：红胜 100%、黑胜 0%、和棋 50%，并且压过局面评估', () => {
  // 局面是红方净一车，但结果说黑方赢：结果必须压过棋盘，否则终局后整列记谱都会贴着走。
  const position = parseFen(RED_ROOK_UP);
  assert.equal(redExpectation(position, { type: 'checkmate', winner: 'red' }), 1);
  assert.equal(redExpectation(position, { type: 'resign', winner: 'black' }), 0);
  // 和棋各得半分：三次重复来自判罚而不是棋盘状态，只能从外面传。
  assert.equal(redExpectation(position, { type: 'repetition', winner: null }), 0.5);
});
