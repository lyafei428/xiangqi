import { useEffect, useState } from 'react';
import type { Route } from './routes.ts';
import { parseHash } from './routes.ts';

/** 订阅 hashchange；路由变化只换页面，不动 App 级状态。 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const update = (): void => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);

  return route;
}
