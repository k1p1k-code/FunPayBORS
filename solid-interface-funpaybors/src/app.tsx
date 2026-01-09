import { Suspense, type Component } from 'solid-js';
import { A, useLocation } from '@solidjs/router';

const App: Component<{ children: Element }> = (props) => {
  const location = useLocation();

  return (
    <>
      <nav class="bg-gray-200 text-gray-900 px-4">
        <ul class="flex items-center">
          <li class="py-2 px-4">
            <A href="/plugins" class="no-underline hover:underline">
              Plugins
            </A>
          </li>
          <li class="py-2 px-4">
            <A href="/nofication" class="no-underline hover:underline">
              Nofication
            </A>
          </li>
          <li class="py-2 px-4">
            <A href="/error" class="no-underline hover:underline">
              Error
            </A>
          </li>
        </ul>
      </nav>

      <main>
        <Suspense>{props.children}</Suspense>
      </main>
    </>
  );
};

export default App;
