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
    path: '/nofication',
    component: lazy(() => import('./pages/nofication')),
  },
  {
    path: '**',
    component: lazy(() => import('./errors/404')),
  },
];
