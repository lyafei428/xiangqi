// 课程目录：按章列课，本次会话看过的课打勾。

import { lessonIndex } from '../learn/content.ts';

export interface LearnPageProps {
  readonly visited: ReadonlySet<string>;
}

export function LearnPage({ visited }: LearnPageProps) {
  const total = lessonIndex.chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  return (
    <div className="page page-learn">
      <div className="learn-inner">
        <h1 className="page-title">课程</h1>
        <p className="page-subtitle">共 {total} 课。每课先读讲解，再在棋盘上看一遍。</p>
        {lessonIndex.chapters.map((chapter) => (
          <section className="chapter" key={chapter.number}>
            <h2 className="chapter-title">{chapter.title}</h2>
            <ol className="lesson-list">
              {chapter.lessons.map((lesson) => (
                <li className="lesson-item" key={lesson.id}>
                  <a className="lesson-link" href={`#/lesson/${lesson.id}`}>
                    <span className="lesson-title">{lesson.title}</span>
                    {visited.has(lesson.id) ? <span className="lesson-visited">已看</span> : null}
                  </a>
                  <p className="lesson-summary">{lesson.summary}</p>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
