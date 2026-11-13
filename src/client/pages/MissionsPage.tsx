// 对弈题列表：按题型分组，指向单题与相关课。

import { lessonIndex } from '../learn/content.ts';
import { missions } from '../missions/content.ts';
import type { MissionType } from '../missions/types.ts';

const TYPE_LABEL: Readonly<Record<MissionType, string>> = {
  'find-mate': '找杀',
  attack: '攻杀',
  defense: '防守',
};

const TYPE_ORDER: readonly MissionType[] = ['find-mate', 'attack', 'defense'];

function lessonTitle(id: string): string {
  for (const chapter of lessonIndex.chapters) {
    const found = chapter.lessons.find((lesson) => lesson.id === id);
    if (found !== undefined) return found.title;
  }
  return id;
}

export function MissionsPage() {
  return (
    <div className="page page-missions">
      <div className="missions-inner">
        <h1 className="page-title">对弈题</h1>
        <p className="page-subtitle">在棋盘上走子：找杀、攻杀、防守。目标由引擎判定。</p>
        {TYPE_ORDER.map((type) => {
          const group = missions.filter((mission) => mission.type === type);
          if (group.length === 0) return null;
          return (
            <section className="mission-group" key={type}>
              <h2 className="chapter-title">{TYPE_LABEL[type]}</h2>
              <ul className="mission-list">
                {group.map((mission) => (
                  <li className="mission-item" key={mission.id}>
                    <a className="mission-link" href={`#/mission/${mission.id}`}>
                      <span>{mission.title}</span>
                      <span className="mission-type">{TYPE_LABEL[mission.type]}</span>
                    </a>
                    <p className="mission-summary">{lessonTitle(mission.lesson)}</p>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
