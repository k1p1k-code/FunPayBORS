import { lazy } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';



export const routes: RouteDefinition[] = [
  {
    path: '/',
    component: lazy(() => import('./pages/plugins')),
  },
  {
    path: '/plugins',
    component: lazy(() => import('./pages/plugins')),
  },
  {
    path: '/messages',
    component: lazy(() => import('./pages/messages')),
  },
  {
    path: '**',
    component: lazy(() => import('./errors/404')),
  },
];
