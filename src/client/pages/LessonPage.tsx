// 单课页：讲解 + 演示步进。课文件按需加载，加载后先过 schema。

import { useEffect, useMemo, useRef, useState } from 'react';
import { Board } from '../board/Board.tsx';
import { boardSize } from '../board/geometry.ts';
import { useStageSize } from '../board/useStageSize.ts';
import { lessonIndex, loadLesson } from '../learn/content.ts';
import { missionsByLesson } from '../missions/content.ts';
import type { DemoSection, LessonContent, NoteSection, TextSection } from '../learn/schema.ts';
import { demoFrames } from '../learn/schema.ts';

export interface LessonPageProps {
  readonly id: string;
  readonly onVisited: (id: string) => void;
}

function DemoBlock({ section }: { readonly section: DemoSection }) {
  const frames = useMemo(() => demoFrames(section.startFen, section.steps), [section]);
  const [step, setStep] = useState(-1);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stage = useStageSize(stageRef);
  const size = boardSize(stage.width, stage.height, 520);
  const frame = frames[step + 1] ?? frames[0];
  if (frame === undefined) return null;
  const currentText = step >= 0 ? (section.steps[step]?.text ?? '') : '起始局面';

  return (
    <div className="demo">
      <div className="demo-board" ref={stageRef}>
        <div className="board-slot">
          <Board
            mode={{ kind: 'demo' }}
            size={size}
            position={frame.position}
            lastMove={frame.move}
          />
        </div>
      </div>
      <p className="demo-text" aria-live="polite">
        {currentText}
      </p>
      <div className="demo-controls">
        <button className="btn" type="button" onClick={() => setStep((value) => Math.max(-1, value - 1))} disabled={step < 0}>
          上一步
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => setStep((value) => Math.min(section.steps.length - 1, value + 1))}
          disabled={step >= section.steps.length - 1}
        >
          下一步
        </button>
        <button className="btn" type="button" onClick={() => setStep(-1)} disabled={step < 0}>
          重播
        </button>
      </div>
    </div>
  );
}

export function LessonPage({ id, onVisited }: LessonPageProps) {
  const [content, setContent] = useState<LessonContent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onVisited(id);
    let alive = true;
    setContent(null);
    setError(null);
    loadLesson(id)
      .then((loaded) => {
        if (alive) setContent(loaded);
      })
      .catch((reason: unknown) => {
        if (alive) setError(String(reason));
      });
    return () => {
      alive = false;
    };
  }, [id, onVisited]);

  const entry = useMemo(() => {
    for (const chapter of lessonIndex.chapters) {
      const found = chapter.lessons.find((lesson) => lesson.id === id);
      if (found !== undefined) return { ...found, chapter: chapter.number };
    }
    return null;
  }, [id]);

  if (error !== null) {
    return (
      <div className="page page-lesson">
        <p role="alert">{error}</p>
        <a className="back-link" href="#/learn">
          ← 返回课程
        </a>
      </div>
    );
  }

  if (content === null) {
    return (
      <div className="page page-lesson">
        <p>加载课程…</p>
      </div>
    );
  }

  const demos = content.sections.filter((section): section is DemoSection => section.kind === 'demo');
  const texts = content.sections.filter(
    (section): section is TextSection | NoteSection => section.kind !== 'demo',
  );
  const mission = missionsByLesson.get(id);

  return (
    <div className="page page-lesson">
      <div className="lesson-layout">
        <article className="lesson-text">
          <a className="back-link" href="#/learn">
            ← 课程
          </a>
          <h1 className="page-title">{entry?.title ?? id}</h1>
          <p className="lesson-meta">
            第 {entry?.chapter ?? '?'} 章 · 来源：{content.source}
          </p>
          {texts.map((section, index) =>
            section.kind === 'note' ? (
              <aside className="lesson-note" key={`note-${index}`}>
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </aside>
            ) : (
              <section className="lesson-section" key={`text-${index}`}>
                {section.title === undefined ? null : <h2>{section.title}</h2>}
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </section>
            ),
          )}
        </article>
        <aside className="lesson-demo">
          {demos.map((demo, index) => (
            <DemoBlock key={`demo-${index}`} section={demo} />
          ))}
          {mission === undefined ? null : (
            <a className="btn drill-link" href={`#/mission/${mission.id}`}>
              做这课的杀法题
            </a>
          )}
          <a className="btn drill-link" href="#/drill">
            去练习
          </a>
        </aside>
      </div>
    </div>
  );
}
