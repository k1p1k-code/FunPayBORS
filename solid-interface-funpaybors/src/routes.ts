import { lazy } from 'solid-js';
import type { RouteDefinition } from '@solidjs/router';

import Home from './pages/nofication';


export const routes: RouteDefinition[] = [
  {
    path: '/',
    component: Home,
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
