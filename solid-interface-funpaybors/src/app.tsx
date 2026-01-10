import { Suspense, type Component, Show, createEffect, onCleanup } from 'solid-js';
import { A, useLocation } from '@solidjs/router';
import { createSignal } from 'solid-js';

let apiKey = '';

async function checkAuth(key: string): Promise<boolean> {
  try {
    const response = await fetch('http://127.0.0.1:58899/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Panel-Key': key
      },
      body: JSON.stringify({})
    });

    if (response.ok) {
      apiKey = key;
      localStorage.setItem('panel-key', key);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Auth error:', error);
    return false;
  }
}

export function createApiSession() {
  const session = {
    get: async (url: string, options: RequestInit = {}): Promise<Response> => {
      return fetchWithKey(url, { ...options, method: 'GET' });
    },
    post: async (url: string, data: any = {}, options: RequestInit = {}): Promise<Response> => {
      return fetchWithKey(url, {
        ...options,
        method: 'POST',
        body: JSON.stringify(data)
      });
    },
    put: async (url: string, data: any = {}, options: RequestInit = {}): Promise<Response> => {
      return fetchWithKey(url, {
        ...options,
        method: 'PUT',
        body: JSON.stringify(data)
      });
    },
    delete: async (url: string, options: RequestInit = {}): Promise<Response> => {
      return fetchWithKey(url, { ...options, method: 'DELETE' });
    },
    patch: async (url: string, data: any = {}, options: RequestInit = {}): Promise<Response> => {
      return fetchWithKey(url, {
        ...options,
        method: 'PATCH',
        body: JSON.stringify(data)
      });
    }
  };

  return session;
}

async function fetchWithKey(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (apiKey) {
    headers['X-Panel-Key'] = apiKey;
  }

  return fetch(url, {
    ...options,
    headers
  });
}

interface LoginFormProps {
  onLogin: () => void;
}

function LoginForm(props: LoginFormProps) {
  const [key, setKey] = createSignal('');
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [error, setError] = createSignal('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      const isValid = await checkAuth(key());
      if (isValid) {
        props.onLogin();
      } else {
        setError('Invalid API key');
      }
    } catch (err) {
      setError('Server connection error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div class="max-w-md w-full space-y-8">
        <div>
          <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Admin Panel
          </h2>
          <p class="mt-2 text-center text-sm text-gray-600">
            Enter your API key for access
          </p>
        </div>
        
        <form class="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div>
            <label for="api-key" class="sr-only">
              API Key
            </label>
            <input
              id="api-key"
              name="key"
              type="password"
              required
              class="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
              placeholder="Enter the API key"
              value={key()}
              onInput={(e) => setKey(e.currentTarget.value)}
              disabled={isSubmitting()}
            />
          </div>

          {error() && (
            <div class="text-red-600 text-sm text-center">
              {error()}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isSubmitting() || !key().trim()}
              class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting() ? 'Login...' : 'Login'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const App: Component<{ children: Element }> = (props) => {
  const location = useLocation();
  
  const [loggedIn, setLoggedIn] = createSignal(false);
  const [checking, setChecking] = createSignal(false);
  
  const checkKey = async (key: string): Promise<boolean> => {
    try {
      const response = await fetch('http://127.0.0.1:58899/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Panel-Key': key
        },
        body: JSON.stringify({})
      });
      return response.ok;
    } catch (error) {
      console.error('Check key error:', error);
      return false;
    }
  };
  
  const startCheckInterval = () => {
    const interval = setInterval(async () => {
      const savedKey = localStorage.getItem('panel-key');
      if (savedKey) {
        setChecking(true);
        const isValid = await checkKey(savedKey);
        setChecking(false);
        if (!isValid) {
          localStorage.removeItem('panel-key');
          apiKey = '';
          setLoggedIn(false);
          clearInterval(interval);
        }
      }
    }, 10000);
    
    onCleanup(() => {
      clearInterval(interval);
    });
  };
  
  createEffect(async () => {
    const savedKey = localStorage.getItem('panel-key');
    if (savedKey) {
      setChecking(true);
      const isValid = await checkKey(savedKey);
      setChecking(false);
      if (isValid) {
        apiKey = savedKey;
        setLoggedIn(true);
        startCheckInterval();
      } else {
        localStorage.removeItem('panel-key');
        apiKey = '';
        setLoggedIn(false);
      }
    }
  });

  const handleLogin = () => {
    const savedKey = localStorage.getItem('panel-key');
    if (savedKey) {
      apiKey = savedKey;
      setLoggedIn(true);
      startCheckInterval();
    }
  };

  return (
    <Show when={!checking() && loggedIn()} fallback={<LoginForm onLogin={handleLogin} />}>
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
    </Show>
  );
};

export default App;