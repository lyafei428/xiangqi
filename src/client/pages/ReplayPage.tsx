// 棋谱页：列表、回放、导入与导出。
// 回放不重算判罚，只按记录里的着法还原局面——判罚已经写在结果里。

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Move, Position } from '../../shared/index.ts';
import { isReplayable, notationsOf, parseRecord, positionAt, recordText } from '../../shared/record.ts';
import type { GameRecord } from '../../shared/record.ts';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { resultLabel } from '../panel/result-text.ts';
import { deleteRecord, findRecord, listRecords, saveRecord } from '../storage/records.ts';
import { routeHash } from '../shell/routes.ts';

function stampText(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface ReplayPageProps {
  /** null 表示列表；数字表示打开某一局。 */
  readonly id: number | null;
}

export function ReplayPage({ id }: ReplayPageProps) {
  const [records, setRecords] = useState<readonly GameRecord[]>(() => listRecords());
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const size = boardSize(stage.width, stage.height, 520);

  // `records` 只作缓存失效触发器：删完/导入后它变了，这里才需要重新 findRecord。
  const record = useMemo(() => (id === null ? null : findRecord(id)), [id, records]);
  const replayable = useMemo(() => (record === null ? false : isReplayable(record)), [record]);

  useEffect(() => {
    setStep(0);
    setNotice(null);
  }, [id, record]);

  const refresh = (): void => {
    setRecords(listRecords());
  };

  const remove = (target: GameRecord): void => {
    if (target.id === null) return;
    const ok = deleteRecord(target.id);
    refresh();
    // 从回放页删除会跳回列表并重挂组件，提示带不过去；只在列表页给回执。
    if (id === null) setNotice(ok ? '已删除该棋谱' : '棋谱没能删除：本地存储不可用');
    if (id !== null) window.location.hash = routeHash({ name: 'replay' });
  };

  const importFile = async (file: File): Promise<void> => {
    const text = await file.text();
    const parsed = parseRecord(text);
    // 结构合法不等于能走完：走法非法的文件同样按导入失败处理。
    if (parsed === null || parsed.result === null || !isReplayable(parsed)) {
      setNotice('文件不是有效的棋谱');
      return;
    }
    const saved = saveRecord({ ...parsed, id: null });
    if (saved === null) {
      setNotice('棋谱没能保存：本地存储不可用');
      return;
    }
    refresh();
    if (saved.id !== null) window.location.hash = routeHash({ name: 'replayOne', id: saved.id });
  };

  const exportRecord = (target: GameRecord): void => {
    const blob = new Blob([recordText(target)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `xiangqi-${String(target.savedAt)}.json`;
    anchor.click();
    // 同一 tick 就撤 URL 会让部分浏览器拿到已失效的 blob，推到下一个宏任务。
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const notations = useMemo(() => {
    if (record === null || !replayable) return [];
    try {
      return notationsOf(record);
    } catch {
      return [];
    }
  }, [record, replayable]);

  let frame: { position: Position; lastMove: Move | null } | null = null;
  if (record !== null && replayable) {
    try {
      frame = {
        position: positionAt(record, step),
        lastMove: step === 0 ? null : (record.moves[step - 1] ?? null),
      };
    } catch {
      frame = null;
    }
  }

  return (
    <div className="page page-replay">
      <main className="replay-main">
        <section className="replay-list" aria-label="棋谱列表">
          <div className="replay-head">
            <h2>我的棋谱</h2>
            <label className="btn file-btn">
              导入
              <input
                type="file"
                accept="application/json,.json"
                aria-label="导入棋谱"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file !== undefined) void importFile(file);
                }}
              />
            </label>
          </div>
          {notice !== null ? (
            <p className="replay-notice" role="status">
              {notice}
            </p>
          ) : null}
          {records.length === 0 ? (
            <p className="replay-empty">还没有棋谱</p>
          ) : (
            <ul className="replay-rows">
              {records.map((item) => (
                <li key={String(item.id)} className="replay-row" data-current={item.id === id ? 'yes' : undefined}>
                  <a className="replay-open" href={routeHash({ name: 'replayOne', id: item.id ?? 0 })}>
                    <span className="replay-time">{stampText(item.savedAt)}</span>
                    <span className="replay-result">
                      {item.result === null ? '未完成' : resultLabel(item.result)}
                    </span>
                    <span className="replay-steps">{item.moves.length} 着</span>
                  </a>
                  <button className="btn btn-quiet" type="button" onClick={() => remove(item)}>
                    删除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="replay-board" aria-label="回放">
          {id === null ? (
            <p className="replay-hint">从左侧选一局棋谱，或导入一个 JSON 文件。</p>
          ) : record === null ? (
            <p className="replay-hint">棋谱不存在</p>
          ) : !replayable || frame === null ? (
            <div className="replay-broken">
              <p>这条棋谱无法回放</p>
              <button className="btn" type="button" onClick={() => remove(record)}>
                删除
              </button>
            </div>
          ) : (
            <div className="replay-stage">
              <div className="board-fit" ref={stageRef}>
                <div className="board-slot">
                  <Board
                    mode={{ kind: 'demo' }}
                    size={size}
                    position={frame.position}
                    lastMove={frame.lastMove}
                  />
                </div>
              </div>
              <div className="replay-controls">
                <button className="btn" type="button" onClick={() => setStep(0)} disabled={step === 0}>
                  首
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setStep((value) => Math.max(0, value - 1))}
                  disabled={step === 0}
                >
                  上一步
                </button>
                <span className="replay-counter" aria-live="polite">
                  第 {step} / {record.moves.length} 着
                </span>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setStep((value) => Math.min(record.moves.length, value + 1))}
                  disabled={step >= record.moves.length}
                >
                  下一步
                </button>
                <button
                  className="btn"
                  type="button"
                  onClick={() => setStep(record.moves.length)}
                  disabled={step >= record.moves.length}
                >
                  末
                </button>
              </div>
              <input
                className="replay-range"
                type="range"
                aria-label="回放步数"
                min={0}
                max={record.moves.length}
                value={step}
                onChange={(event) => setStep(Number(event.target.value))}
              />
              <ol className="replay-moves">
                {notations.map((text, index) => (
                  <li key={`${String(index)}-${text}`}>
                    <button
                      className="replay-move"
                      type="button"
                      aria-current={index + 1 === step ? 'true' : undefined}
                      onClick={() => setStep(index + 1)}
                    >
                      {`${String(index + 1)}. ${text}`}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="replay-actions">
                <button className="btn" type="button" onClick={() => exportRecord(record)}>
                  导出
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
