// 课程 JSON 的类型与校验。课文件是纯数据，错误在内容测试里先炸，不进界面。

import type { HistoryEntry, Move, Position } from '../../shared/index.ts';
import { applyMove, parseFen, playMove } from '../../shared/index.ts';

export interface LessonIndexEntry {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
}

export interface Chapter {
  readonly number: number;
  readonly title: string;
  readonly lessons: readonly LessonIndexEntry[];
}

export interface LessonIndex {
  readonly chapters: readonly Chapter[];
}

export interface TextSection {
  readonly kind: 'text';
  readonly title?: string;
  readonly body: readonly string[];
}

export interface NoteSection {
  readonly kind: 'note';
  readonly body: readonly string[];
}

export interface DemoStep {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  readonly text: string;
}

export interface DemoSection {
  readonly kind: 'demo';
  readonly title?: string;
  readonly startFen: string;
  readonly steps: readonly DemoStep[];
}

export type LessonSection = TextSection | NoteSection | DemoSection;

export interface LessonContent {
  readonly id: string;
  readonly source: string;
  readonly sections: readonly LessonSection[];
}

export interface DemoFrame {
  readonly position: Position;
  readonly move: Move | null;
  readonly text: string | null;
}

function asRecord(value: unknown, where: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${where} 必须是对象`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, where: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${where} 必须是数组`);
  return value;
}

function asString(value: unknown, where: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${where} 必须是非空字符串`);
  }
  return value;
}

function asStringArray(value: unknown, where: string): string[] {
  return asArray(value, where).map((item, index) => asString(item, `${where}[${index}]`));
}

function asInteger(value: unknown, where: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new Error(`${where} 必须是整数`);
  }
  return value;
}

function asCoordinate(value: unknown, where: string): readonly [number, number] {
  const pair = asArray(value, where);
  if (pair.length !== 2) throw new Error(`${where} 必须是 [x, y]`);
  const x = asInteger(pair[0], `${where}.x`);
  const y = asInteger(pair[1], `${where}.y`);
  if (x < 0 || x > 8 || y < 0 || y > 9) throw new Error(`${where} 越界：${x},${y}`);
  return [x, y];
}

function toSquare(pair: readonly [number, number]): number {
  return pair[1] * 9 + pair[0];
}

/** 逐步走一遍演示，任何一步非法都带课与步号抛错。 */
export function validateDemo(startFen: string, steps: readonly DemoStep[], where: string): void {
  let position: Position;
  try {
    position = parseFen(startFen);
  } catch (error) {
    throw new Error(`${where} 起始 FEN 非法：${String(error)}`);
  }
  let history: HistoryEntry[] = [];
  steps.forEach((step, index) => {
    try {
      const result = playMove(position, history, { from: toSquare(step.from), to: toSquare(step.to) });
      position = result.position;
      history = result.history;
    } catch (error) {
      throw new Error(`${where} 第 ${index + 1} 步不合法：${String(error)}`);
    }
  });
}

/** 演示帧：第 0 帧是起始局面，第 i 帧是走完第 i 步。 */
export function demoFrames(startFen: string, steps: readonly DemoStep[]): DemoFrame[] {
  let position = parseFen(startFen);
  const frames: DemoFrame[] = [{ position, move: null, text: null }];
  for (const step of steps) {
    const move = { from: toSquare(step.from), to: toSquare(step.to) };
    position = applyMove(position, move);
    frames.push({ position, move, text: step.text });
  }
  return frames;
}

export function validateLessonIndex(raw: unknown): LessonIndex {
  const root = asRecord(raw, '课程索引');
  const chaptersRaw = asArray(root.chapters, '课程索引.chapters');
  const ids = new Set<string>();
  const chapters = chaptersRaw.map((chapterRaw, chapterIndex) => {
    const where = `课程索引.chapters[${chapterIndex}]`;
    const chapter = asRecord(chapterRaw, where);
    const number = asInteger(chapter.number, `${where}.number`);
    if (number < 1) throw new Error(`${where}.number 必须从 1 开始`);
    const title = asString(chapter.title, `${where}.title`);
    const lessonsRaw = asArray(chapter.lessons, `${where}.lessons`);
    if (lessonsRaw.length === 0) throw new Error(`${where}.lessons 不能为空`);
    const lessons = lessonsRaw.map((lessonRaw, lessonIndex) => {
      const lessonWhere = `${where}.lessons[${lessonIndex}]`;
      const lesson = asRecord(lessonRaw, lessonWhere);
      const id = asString(lesson.id, `${lessonWhere}.id`);
      if (ids.has(id)) throw new Error(`课程 id 重复：${id}`);
      ids.add(id);
      return {
        id,
        title: asString(lesson.title, `${lessonWhere}.title`),
        summary: asString(lesson.summary, `${lessonWhere}.summary`),
      };
    });
    return { number, title, lessons };
  });
  if (chapters.length === 0) throw new Error('课程索引.chapters 不能为空');
  return { chapters };
}

function validateSections(raw: unknown, where: string): LessonSection[] {
  const sectionsRaw = asArray(raw, where);
  if (sectionsRaw.length === 0) throw new Error(`${where} 不能为空`);
  return sectionsRaw.map((sectionRaw, index) => {
    const sectionWhere = `${where}[${index}]`;
    const section = asRecord(sectionRaw, sectionWhere);
    const kind = section.kind;
    if (kind === 'text') {
      return {
        kind: 'text' as const,
        title: section.title === undefined ? undefined : asString(section.title, `${sectionWhere}.title`),
        body: asStringArray(section.body, `${sectionWhere}.body`),
      };
    }
    if (kind === 'note') {
      return { kind: 'note' as const, body: asStringArray(section.body, `${sectionWhere}.body`) };
    }
    if (kind === 'demo') {
      const startFen = asString(section.startFen, `${sectionWhere}.startFen`);
      const stepsRaw = asArray(section.steps, `${sectionWhere}.steps`);
      if (stepsRaw.length === 0) throw new Error(`${sectionWhere}.steps 不能为空`);
      const steps = stepsRaw.map((stepRaw, stepIndex) => {
        const stepWhere = `${sectionWhere}.steps[${stepIndex}]`;
        const step = asRecord(stepRaw, stepWhere);
        return {
          from: asCoordinate(step.from, `${stepWhere}.from`),
          to: asCoordinate(step.to, `${stepWhere}.to`),
          text: asString(step.text, `${stepWhere}.text`),
        };
      });
      validateDemo(startFen, steps, sectionWhere);
      return {
        kind: 'demo' as const,
        title: section.title === undefined ? undefined : asString(section.title, `${sectionWhere}.title`),
        startFen,
        steps,
      };
    }
    throw new Error(`${sectionWhere}.kind 未知：${String(kind)}`);
  });
}

export function validateLessonContent(raw: unknown, expectedId: string): LessonContent {
  const lesson = asRecord(raw, `课程 ${expectedId}`);
  const id = asString(lesson.id, `课程 ${expectedId}.id`);
  if (id !== expectedId) throw new Error(`课文件 id ${id} 与文件名 ${expectedId} 不一致`);
  return {
    id,
    source: asString(lesson.source, `课程 ${expectedId}.source`),
    sections: validateSections(lesson.sections, `课程 ${expectedId}.sections`),
  };
}
