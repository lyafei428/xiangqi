// 页面壳：导航、hash 路由、对局状态与课程进度。
// 对局状态放在这一层，切到课程或练习再回来不丢。

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { PlayPage } from './pages/PlayPage.tsx';
import { AiPage } from './pages/AiPage.tsx';
import { LearnPage } from './pages/LearnPage.tsx';
import { LessonPage } from './pages/LessonPage.tsx';
import { DrillPage } from './pages/DrillPage.tsx';
import { MissionsPage } from './pages/MissionsPage.tsx';
import { MissionPage } from './pages/MissionPage.tsx';
import { OnlinePage } from './pages/OnlinePage.tsx';
import { ReplayPage } from './pages/ReplayPage.tsx';
import { RulesPage } from './pages/RulesPage.tsx';
import { createSession, restoreSession, sessionReducer } from './game/session.ts';
import type { GameSession } from './game/session.ts';
import { clockFrom, positionAt, remainingOf } from '../shared/index.ts';
import { clearCurrent, loadCurrent, saveCurrent, saveRecord } from './storage/records.ts';
import type { Route } from './shell/routes.ts';
import { routeHash } from './shell/routes.ts';
import { useRoute } from './shell/useRoute.ts';

const NAV: readonly { readonly label: string; readonly route: Route; readonly match: Route['name'][] }[] = [
  { label: '对弈', route: { name: 'play' }, match: ['play'] },
  { label: '人机', route: { name: 'ai' }, match: ['ai'] },
  { label: '联机', route: { name: 'online' }, match: ['online'] },
  { label: '课程', route: { name: 'learn' }, match: ['learn', 'lesson'] },
  { label: '练习', route: { name: 'drill' }, match: ['drill', 'missions', 'mission'] },
  { label: '棋谱', route: { name: 'replay' }, match: ['replay', 'replayOne'] },
  { label: '规则', route: { name: 'rules' }, match: ['rules'] },
];

/** 启动时接上未完成的本地对局：重放局面，时钟按暂停处理（关页期间没有计时器）。 */
function initialSession(): GameSession {
  const current = loadCurrent();
  if (current === null) return createSession();
  try {
    const turn = positionAt(current, current.moves.length).turn;
    const restored = restoreSession(
      current.startFen,
      current.moves,
      clockFrom(current.redMs, current.blackMs, turn, Date.now()),
    );
    if (restored !== null) return restored;
  } catch {
    // 记录被改坏：丢掉它继续开新局，不阻塞启动。
  }
  clearCurrent();
  return createSession();
}

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, initialSession);
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set());
  const route = useRoute();
  const savedRef = useRef<string>('');

  const markVisited = useCallback((id: string): void => {
    setVisited((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

  // 走子即写未完成局；终局转存棋谱并清掉未完成局。tick 不改状态对象，所以不会每秒写盘。
  useEffect(() => {
    const moves = session.history.map((entry) => entry.move);
    const now = Date.now();
    const redMs = remainingOf(session.clock, 'red', now);
    const blackMs = remainingOf(session.clock, 'black', now);
    const result = session.result;
    if (result === null) {
      savedRef.current = '';
      saveCurrent({ id: null, startFen: session.startFen, moves, result: null, redMs, blackMs, savedAt: now });
      return;
    }
    const key = `${session.startFen}:${String(moves.length)}:${result.type}:${String(result.winner)}`;
    if (savedRef.current === key) return;
    savedRef.current = key;
    const saved = saveRecord(
      { id: null, startFen: session.startFen, moves, result, redMs, blackMs, savedAt: now },
    );
    // 写失败就不清 current：否则库里没存上、未完成局也没了，这一局彻底丢掉。
    if (saved !== null) clearCurrent();
  }, [session]);

  // 关页前补一次，把最后一段思考时间也写进去。
  useEffect(() => {
    const flush = (): void => {
      if (session.result !== null) return;
      const now = Date.now();
      saveCurrent({
        id: null,
        startFen: session.startFen,
        moves: session.history.map((entry) => entry.move),
        result: null,
        redMs: remainingOf(session.clock, 'red', now),
        blackMs: remainingOf(session.clock, 'black', now),
        savedAt: now,
      });
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [session]);

  return (
    <div className="app">
      <nav className="app-nav" aria-label="主导航">
        <span className="app-brand">中国象棋</span>
        <span className="app-links">
          {NAV.map((item) => (
            <a
              key={item.label}
              className="nav-link"
              href={routeHash(item.route)}
              aria-current={item.match.includes(route.name) ? 'page' : undefined}
            >
              {item.label}
            </a>
          ))}
        </span>
      </nav>
      <div className="app-main">
        {route.name === 'play' ? <PlayPage session={session} dispatch={dispatch} /> : null}
        {route.name === 'ai' ? <AiPage /> : null}
        {route.name === 'learn' ? <LearnPage visited={visited} /> : null}
        {route.name === 'lesson' ? (
          <LessonPage key={route.id} id={route.id} onVisited={markVisited} />
        ) : null}
        {route.name === 'drill' ? (
          <DrillPage key={`${route.kind ?? 'auto'}-${route.seed ?? 'random'}`} route={route} />
        ) : null}
        {route.name === 'missions' ? <MissionsPage /> : null}
        {route.name === 'mission' ? <MissionPage key={route.id} id={route.id} /> : null}
        {route.name === 'online' ? <OnlinePage /> : null}
        {route.name === 'replay' ? <ReplayPage id={null} /> : null}
        {route.name === 'replayOne' ? <ReplayPage key={route.id} id={route.id} /> : null}
        {route.name === 'rules' ? <RulesPage /> : null}
      </div>
    </div>
  );
}
