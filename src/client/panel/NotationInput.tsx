// 记谱输入：把「炮二平五」这样一句话变成一步棋。
// 解析交给 shared：与生成侧共用同一份记谱文法，这里不认棋子也不认走法。

import { useEffect, useRef, useState } from 'react';
import type { Move, Position } from '../../shared/index.ts';
import { parseChineseNotation } from '../../shared/index.ts';

const HINT_TEXT = '这步走不了：检查棋子、纵线和方向';
const HINT_EXAMPLE = '如：炮二平五';

export interface NotationInputProps {
  readonly position: Position;
  readonly disabled: boolean;
  /** 值每变一次就把焦点交回输入框：`/` 快捷键与面板展开后都靠它。 */
  readonly focusSignal?: number;
  readonly onPlay: (move: Move) => void;
}

export function NotationInput({ position, disabled, focusSignal = 0, onPlay }: NotationInputProps) {
  const [text, setText] = useState('');
  const [failed, setFailed] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (focusSignal === 0) return;
    inputRef.current?.focus();
  }, [focusSignal]);

  // 局面变了，上一次的「走不了」就不再指向眼前这个局面：提示让位，但原文留着，
  // 用户可能正打到一半（人机局里 AI 回子不该清掉玩家的输入）。
  useEffect(() => {
    setFailed(false);
  }, [position]);

  const submit = (): void => {
    // 纯空白按回车是误按，不是走子指令：不提交、不提示，原文原样留着。
    if (text.trim() === '') return;
    const move = parseChineseNotation(position, text);
    if (move === null) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setText('');
    onPlay(move);
  };

  return (
    <div className="notation">
      <input
        ref={inputRef}
        type="text"
        className="notation-input"
        aria-label="记谱输入"
        placeholder={HINT_EXAMPLE}
        value={text}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="go"
        onChange={(event) => {
          setText(event.target.value);
          // 提示属于上一次提交：改了字就该让位，别拿旧文案说新输入。
          setFailed(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          // 中文输入法用 Enter 上屏候选：合成态的 Enter 不是提交意图，
          // 而且 preventDefault 会抢掉候选提交，用户连字都打不上去。
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          submit();
        }}
      />
      {failed ? (
        <p className="notation-error" role="status" aria-live="polite">
          {HINT_TEXT}
          <span className="notation-example">{HINT_EXAMPLE}</span>
        </p>
      ) : null}
    </div>
  );
}
