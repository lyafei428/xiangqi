// 页面壳：导航、hash 路由、对局状态与课程进度。
// 对局状态放在这一层，切到课程或练习再回来不丢。

import { useCallback, useReducer, useState } from 'react';
import { PlayPage } from './pages/PlayPage.tsx';
import { LearnPage } from './pages/LearnPage.tsx';
import { LessonPage } from './pages/LessonPage.tsx';
import { DrillPage } from './pages/DrillPage.tsx';
import { MissionsPage } from './pages/MissionsPage.tsx';
import { MissionPage } from './pages/MissionPage.tsx';
import { OnlinePage } from './pages/OnlinePage.tsx';
import { createSession, sessionReducer } from './game/session.ts';
import type { Route } from './shell/routes.ts';
import { routeHash } from './shell/routes.ts';
import { useRoute } from './shell/useRoute.ts';

const NAV: readonly { readonly label: string; readonly route: Route; readonly match: Route['name'][] }[] = [
  { label: '对弈', route: { name: 'play' }, match: ['play'] },
  { label: '联机', route: { name: 'online' }, match: ['online'] },
  { label: '课程', route: { name: 'learn' }, match: ['learn', 'lesson'] },
  { label: '练习', route: { name: 'drill' }, match: ['drill', 'missions', 'mission'] },
];

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, undefined, () => createSession());
  const [visited, setVisited] = useState<ReadonlySet<string>>(() => new Set());
  const route = useRoute();

  const markVisited = useCallback((id: string): void => {
    setVisited((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous);
      next.add(id);
      return next;
    });
  }, []);

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
      </div>
    </div>
  );
}
