import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { LessonIndex } from '../src/client/learn/schema.ts';
import { validateLessonContent, validateLessonIndex } from '../src/client/learn/schema.ts';

const LESSONS_DIR = new URL('../content/lessons/', import.meta.url);

function readJson(url: URL): unknown {
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8')) as unknown;
}

const index: LessonIndex = validateLessonIndex(readJson(new URL('index.json', LESSONS_DIR)));
const lessonIds = index.chapters.flatMap((chapter) => chapter.lessons.map((lesson) => lesson.id));
const files = readdirSync(fileURLToPath(LESSONS_DIR))
  .filter((name) => name.endsWith('.json') && name !== 'index.json')
  .map((name) => name.slice(0, -'.json'.length));

test('三章 22 课：课数 8 / 6 / 8，章节号连续', () => {
  assert.deepEqual(
    index.chapters.map((chapter) => chapter.number),
    [1, 2, 3],
  );
  assert.deepEqual(
    index.chapters.map((chapter) => chapter.lessons.length),
    [8, 6, 8],
  );
});

test('课文件与索引一一对应，无孤儿无缺档', () => {
  assert.deepEqual([...files].sort(), [...lessonIds].sort());
});

test('课 id 不重复', () => {
  assert.equal(new Set(lessonIds).size, lessonIds.length);
});

for (const chapter of index.chapters) {
  test(`第 ${chapter.number} 章逐课过 schema 与引擎校验`, () => {
    for (const entry of chapter.lessons) {
      const raw = readJson(new URL(`${entry.id}.json`, LESSONS_DIR));
      const lesson = validateLessonContent(raw, entry.id);
      assert.notEqual(lesson.source.trim(), '', `${entry.id} 缺来源标注`);
      assert.ok(
        lesson.sections.some((section) => section.kind === 'demo'),
        `${entry.id} 缺演示块`,
      );
    }
  });
}
