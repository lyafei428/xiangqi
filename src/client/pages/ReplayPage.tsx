// 棋谱页：分栏（我的棋谱 / 棋谱库）、列表、回放、导入与导出。
// 回放不重算判罚，只按记录里的着法还原局面——判罚已经写在结果里。

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HistoryEntry, Move, Position } from '../../shared/index.ts';
import {
  isReplayable,
  notationsOf,
  parseRecord,
  positionAt,
  positionAtMoves,
  recordText,
} from '../../shared/record.ts';
import type { GameRecord } from '../../shared/record.ts';
import type { StudyRecord } from '../../shared/study.ts';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { replayHistory } from '../online/history.ts';
import { EvalBar, percentText } from '../panel/EvalBar.tsx';
import { useEvalEnabled, useEvalPoint, useMoveEvals } from '../panel/useEval.ts';
import { resultLabel } from '../panel/result-text.ts';
import { deleteRecord, findRecord, listRecords, saveRecord } from '../storage/records.ts';
import { StudyLibrary } from '../study/StudyLibrary.tsx';
import { routeHash } from '../shell/routes.ts';

type ReplayTab = 'mine' | 'library';

/** 没有打开棋谱时的空序列：常量让 hook 的依赖身份稳定。 */
const EMPTY_HISTORY: readonly HistoryEntry[] = [];

function stampText(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 棋谱库的记谱：直接复用 notationsOf（入参只要求 startFen + moves，不需要 GameRecord 的时间与结果）。 */

interface StepControlsProps {
  readonly step: number;
  readonly total: number;
  readonly notations: readonly string[];
  readonly onStep: (step: number) => void;
  /** 每步胜率：不传表示这一份场景拿不到走势（没有可回放的记录 / 开关关掉）。 */
  readonly evalView?: { readonly moves: readonly number[]; readonly current: number };
}

/** 步进条与记谱列表：本地存局与棋谱库共用，两路的操作手感一致。 */
function StepControls({ step, total, notations, onStep, evalView }: StepControlsProps) {
  return (
    <>
      <div className="replay-controls">
        <button className="btn" type="button" onClick={() => onStep(0)} disabled={step === 0}>
          首
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => onStep(Math.max(0, step - 1))}
          disabled={step === 0}
        >
          上一步
        </button>
        <span className="replay-counter" aria-live="polite">
          第 {step} / {total} 着
        </span>
        <button
          className="btn"
          type="button"
          onClick={() => onStep(Math.min(total, step + 1))}
          disabled={step >= total}
        >
          下一步
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => onStep(total)}
          disabled={step >= total}
        >
          末
        </button>
      </div>
      <input
        className="replay-range"
        type="range"
        aria-label="回放步数"
        min={0}
        max={total}
        value={step}
        onChange={(event) => onStep(Number(event.target.value))}
      />
      {evalView === undefined ? null : <EvalBar red={evalView.current} />}
      <ol className="replay-moves">
        {notations.map((text, index) => {
          const value = evalView?.moves[index];
          return (
            <li key={`${String(index)}-${text}`}>
              <button
                className="replay-move"
                type="button"
                aria-current={index + 1 === step ? 'true' : undefined}
                onClick={() => onStep(index + 1)}
              >
                {`${String(index + 1)}. ${text}`}
                {value === undefined ? null : (
                  <span className="move-eval">{percentText(value)}</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </>
  );
}

export interface ReplayPageProps {
  /** null 表示列表；数字表示打开某一局。 */
  readonly id: number | null;
}

interface StudyReplayProps {
  readonly record: StudyRecord;
}

/** 库内回放：独立挂载，棋盘尺寸的观察点与棋盘同一次挂载出现（页内切换不会丢尺寸）。 */
function StudyReplay({ record }: StudyReplayProps) {
  const [step, setStep] = useState(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const size = boardSize(stage.width, stage.height, 520);
  const notations = useMemo(() => notationsOf(record), [record]);
  const frame = useMemo(
    () => ({
      position: positionAtMoves(record.startFen, record.moves, step),
      lastMove: step === 0 ? null : (record.moves[step - 1] ?? null),
    }),
    [record, step],
  );
  const note = record.notes.find((item) => item.step === step) ?? null;

  // 每步胜率：与「我的棋谱」同一条路——库内棋谱同样带着起始局面、着法与结果。
  const showEval = useEvalEnabled();
  const evalHistory = useMemo(() => replayHistory(record.startFen, record.moves), [record]);
  const evals = useMoveEvals(evalHistory, record.result);
  const cursorResult = step === record.moves.length ? record.result : null;
  const currentEval = useEvalPoint(frame.position, cursorResult);
  const evalView =
    showEval && currentEval !== null ? { moves: evals, current: currentEval } : undefined;

  return (
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
      <StepControls
        step={step}
        total={record.moves.length}
        notations={notations}
        evalView={evalView}
        onStep={setStep}
      />
      {note !== null ? <p className="study-note">{note.text}</p> : null}
      <p className="study-source">来源：{record.source}</p>
    </div>
  );
}

export function ReplayPage({ id }: ReplayPageProps) {
  const [tab, setTab] = useState<ReplayTab>('mine');
  const [records, setRecords] = useState<readonly GameRecord[]>(() => listRecords());
  const [notice, setNotice] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [study, setStudy] = useState<StudyRecord | null>(null);
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

  // 库内回放是页内状态：不新增地址，切分栏或重进页面回到列表。
  const switchTab = (next: ReplayTab): void => {
    setTab(next);
    if (next === 'library') setStudy(null);
  };

  const openStudy = (target: StudyRecord): void => {
    setStudy(target);
  };

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

  // 每步胜率：着法序列与联机页同一个重放函数，不另起 playMove 循环。
  // 逐格数字取整局的末格按结果收敛；条跟游标走，游标停在终局那一着时才传结果。
  const showEval = useEvalEnabled();
  const evalHistory = useMemo(
    () => (record === null ? EMPTY_HISTORY : replayHistory(record.startFen, record.moves)),
    [record],
  );
  const evals = useMoveEvals(evalHistory, record?.result ?? null);
  const cursorResult = record !== null && step === record.moves.length ? record.result : null;
  const currentEval = useEvalPoint(frame?.position ?? null, cursorResult);
  const evalView =
    showEval && currentEval !== null ? { moves: evals, current: currentEval } : undefined;

  return (
    <div className="page page-replay">
      <div className="replay-tabs" role="group" aria-label="棋谱分栏">
        <button
          className="btn replay-tab"
          type="button"
          aria-pressed={tab === 'mine'}
          onClick={() => switchTab('mine')}
        >
          我的棋谱
        </button>
        <button
          className="btn replay-tab"
          type="button"
          aria-pressed={tab === 'library'}
          onClick={() => switchTab('library')}
        >
          棋谱库
        </button>
      </div>
      <main className="replay-main">
        {tab === 'mine' ? (
          <>
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
                    <li
                      key={String(item.id)}
                      className="replay-row"
                      data-current={item.id === id ? 'yes' : undefined}
                    >
                      <a
                        className="replay-open"
                        href={routeHash({ name: 'replayOne', id: item.id ?? 0 })}
                      >
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
                  <StepControls
                    step={step}
                    total={record.moves.length}
                    notations={notations}
                    evalView={evalView}
                    onStep={setStep}
                  />
                  <div className="replay-actions">
                    <button className="btn" type="button" onClick={() => exportRecord(record)}>
                      导出
                    </button>
                  </div>
                </div>
              )}
            </section>
          </>
        ) : (
          <>
            <StudyLibrary selectedId={study?.id ?? null} onOpen={openStudy} />
            <section className="replay-board" aria-label="棋谱库回放">
              {study === null ? (
                <p className="replay-hint">从左侧选一条棋谱。</p>
              ) : (
                <StudyReplay key={study.id} record={study} />
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
