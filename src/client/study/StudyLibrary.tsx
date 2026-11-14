// 棋谱库分栏：分类筛选与条目列表。回放器在页面里，本组件只管选。
// 筛选值是离散集合，所以用一排按钮而不是输入框：输入框允许拼错且无从校验。

import { useMemo, useState } from 'react';
import type { StudyPhase, StudyRecord } from '../../shared/study.ts';
import type { StudyFilter } from './content.ts';
import { studyRecordsOf } from './content.ts';

const PHASE_LABELS: Readonly<Record<StudyPhase, string>> = {
  opening: '开局',
  middlegame: '中局',
  ending: '终局',
  endgame: '残局',
};

const FILTERS: readonly { readonly value: StudyFilter; readonly label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'opening', label: '开局' },
  { value: 'middlegame', label: '中局' },
  { value: 'ending', label: '终局' },
  { value: 'endgame', label: '残局' },
];

export interface StudyLibraryProps {
  readonly selectedId: string | null;
  readonly onOpen: (record: StudyRecord) => void;
}

export function StudyLibrary({ selectedId, onOpen }: StudyLibraryProps) {
  const [filter, setFilter] = useState<StudyFilter>('all');
  const shown = useMemo(() => studyRecordsOf(filter), [filter]);

  return (
    <section className="replay-list study-library" aria-label="棋谱库">
      <div className="study-filters" role="group" aria-label="按类别筛选">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            className="study-filter"
            type="button"
            aria-pressed={filter === item.value}
            onClick={() => setFilter(item.value)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul className="study-rows">
        {shown.map((record) => (
          <li
            key={record.id}
            className="study-row"
            data-current={record.id === selectedId ? 'yes' : undefined}
          >
            <button className="study-open" type="button" onClick={() => onOpen(record)}>
              <span className="study-title">{record.title}</span>
              <span className="study-meta">
                {PHASE_LABELS[record.phase]} · {record.source} · {record.moves.length} 着
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
