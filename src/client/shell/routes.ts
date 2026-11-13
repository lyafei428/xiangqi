// hash 路由：只做解析与拼装，不依赖浏览器 API，测试可直接调。

import type { DrillKind } from '../drills/generator.ts';

export type Route =
  | { readonly name: 'play' }
  | { readonly name: 'learn' }
  | { readonly name: 'lesson'; readonly id: string }
  | { readonly name: 'drill'; readonly seed?: number; readonly kind?: DrillKind }
  | { readonly name: 'missions' }
  | { readonly name: 'mission'; readonly id: string }
  | { readonly name: 'online' }
  | { readonly name: 'replay' }
  | { readonly name: 'replayOne'; readonly id: number };

const DRILL_KINDS: readonly DrillKind[] = ['move-pattern', 'legality', 'position', 'notation'];

function asDrillKind(value: string | null): DrillKind | undefined {
  return DRILL_KINDS.find((kind) => kind === value);
}

export function parseHash(hash: string): Route {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const [path = '', query = ''] = raw.split('?');
  if (path === '/learn') return { name: 'learn' };
  if (path.startsWith('/lesson/')) {
    const id = decodeURIComponent(path.slice('/lesson/'.length));
    return id === '' ? { name: 'learn' } : { name: 'lesson', id };
  }
  if (path === '/drill') {
    const params = new URLSearchParams(query);
    const seedRaw = params.get('seed');
    const seed = seedRaw === null ? undefined : Number(seedRaw);
    const kind = asDrillKind(params.get('kind'));
    return {
      name: 'drill',
      ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
      ...(kind === undefined ? {} : { kind }),
    };
  }
  if (path === '/missions') return { name: 'missions' };
  if (path === '/online') return { name: 'online' };
  if (path === '/replay') return { name: 'replay' };
  if (path.startsWith('/replay/')) {
    const id = Number(decodeURIComponent(path.slice('/replay/'.length)));
    return Number.isInteger(id) && id > 0 ? { name: 'replayOne', id } : { name: 'replay' };
  }
  if (path.startsWith('/mission/')) {
    const id = decodeURIComponent(path.slice('/mission/'.length));
    return id === '' ? { name: 'missions' } : { name: 'mission', id };
  }
  return { name: 'play' };
}

export function routeHash(route: Route): string {
  switch (route.name) {
    case 'play':
      return '#/play';
    case 'learn':
      return '#/learn';
    case 'lesson':
      return `#/lesson/${encodeURIComponent(route.id)}`;
    case 'drill': {
      const params = new URLSearchParams();
      if (route.seed !== undefined) params.set('seed', String(route.seed));
      if (route.kind !== undefined) params.set('kind', route.kind);
      const query = params.toString();
      return query === '' ? '#/drill' : `#/drill?${query}`;
    }
    case 'missions':
      return '#/missions';
    case 'mission':
      return `#/mission/${encodeURIComponent(route.id)}`;
    case 'online':
      return '#/online';
    case 'replay':
      return '#/replay';
    case 'replayOne':
      return `#/replay/${String(route.id)}`;
  }
}
