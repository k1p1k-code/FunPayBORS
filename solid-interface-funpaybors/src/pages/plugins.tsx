import { createSignal, onMount, Show, For } from 'solid-js';
import { createApiSession } from '../app';

interface Button {
  value: string;
  callback_id: number;
}

interface Input {
  value_placeholder: string;
  value_button: string;
  callback_id: number;
}

interface Plugin {
  name: string;
  texts: string[];
  buttons: Button[];
  inputs: Input[];
}

interface ButtonCallbackRequest {
  name: string;
  callback_id: number;
  callback_type: "button";
}

interface InputCallbackRequest {
  name: string;
  callback_id: number;
  callback_type: "input";
  data: string;
}

interface ResponseCallbackPlugin {
  message: string | null;
  status: string;
}

export default function Plugins() {
  const [plugins, setPlugins] = createSignal<Plugin[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [executing, setExecuting] = createSignal<Record<number, boolean>>({});
  const [callbackResult, setCallbackResult] = createSignal<ResponseCallbackPlugin | null>(null);
  const [inputValues, setInputValues] = createSignal<Record<number, string>>({});

  const API_BASE = 'http://127.0.0.1:58899';
  const api = createApiSession();

  const fetchPlugins = async () => {
    setLoading(true);
    setError(null);
    setCallbackResult(null);
    
    try {
      const response = await api.get(`${API_BASE}/plugins/list`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data: Plugin[] = await response.json();
      setPlugins(data);
      
      const initialInputValues: Record<number, string> = {};
      data.forEach(plugin => {
        plugin.inputs?.forEach(input => {
          initialInputValues[input.callback_id] = '';
        });
      });
      setInputValues(initialInputValues);
    } catch (error) {
      console.error('Error fetching plugins:', error);
      setError(error instanceof Error ? error.message : 'Failed to load plugins');
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = async (button: Button, pluginName: string) => {
    setCallbackResult(null);
    
    const requestData: ButtonCallbackRequest = {
      name: pluginName,
      callback_id: button.callback_id,
      callback_type: "button"
    };

    await executeCallback(requestData, button.callback_id);
  };

  const handleInputButtonClick = async (input: Input, pluginName: string) => {
    setCallbackResult(null);
    
    const inputValue = inputValues()[input.callback_id] || '';
    
    const requestData: InputCallbackRequest = {
      name: pluginName,
      callback_id: input.callback_id,
      callback_type: "input",
      data: inputValue
    };

    await executeCallback(requestData, input.callback_id);
  };

  const executeCallback = async (requestData: ButtonCallbackRequest | InputCallbackRequest, callbackId: number) => {
    try {
      setExecuting(prev => ({ ...prev, [callbackId]: true }));
      
      console.log('Sending request:', requestData);
      
      const response = await api.post(`${API_BASE}/plugins/callback`, requestData);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      const responseText = await response.text();
      console.log('Raw response:', responseText);
      
      let result: ResponseCallbackPlugin;
      
      try {
        result = JSON.parse(responseText);
        
        if (typeof result !== 'object' || result === null) {
          result = {
            message: responseText,
            status: "success"
          };
        }
        
        if (result.message === undefined) {
          result.message = null;
        }
        if (result.status === undefined) {
          result.status = "success";
        }
      } catch (jsonError) {
        console.error('JSON parse error:', jsonError, 'Response text:', responseText);
        result = {
          message: responseText,
          status: "error"
        };
      }
      
      console.log('Parsed result:', result);
      
      const normalizedResult = {
        ...result,
        status: result.status.toLowerCase().trim()
      };
      
      setCallbackResult(normalizedResult);
      
      if (normalizedResult.status.includes("success")) {
        if (requestData.callback_type === "input") {
          setInputValues(prev => ({ ...prev, [callbackId]: '' }));
        }
      }
      
    } catch (error) {
      console.error('Callback error:', error);
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      setCallbackResult({
        status: "error",
        message: errorMsg
      });
    } finally {
      setTimeout(() => {
        setExecuting(prev => ({ ...prev, [callbackId]: false }));
      }, 300);
    }
  };

  const handleInputChange = (callbackId: number, value: string) => {
    setInputValues(prev => ({ ...prev, [callbackId]: value }));
  };

  onMount(() => {
    fetchPlugins();
  });


  const getStatusStyles = (status: string) => {
    const statusLower = status.toLowerCase();
    

    if (statusLower.includes("error")) {
      return 'bg-red-100 border border-red-400 text-red-700';
    } else if (statusLower.includes("warning") || statusLower.includes("warn")) {
      return 'bg-yellow-100 border border-yellow-400 text-yellow-700';
    } else if (statusLower.includes("success") || statusLower === "ok") {
      return 'bg-green-100 border border-green-400 text-green-700';
    } else {
      return 'bg-gray-100 border border-gray-400 text-gray-700';
    }
  };


  const getFormattedMessage = (result: ResponseCallbackPlugin) => {
    const statusLower = result.status.toLowerCase();
    

    if (statusLower.includes("error")) {
      return result.message || 'An error occurred';
    } else if (statusLower.includes("warning") || statusLower.includes("warn")) {
      return result.message || 'Warning';
    } else if (statusLower.includes("success") || statusLower === "ok") {
      return result.message || 'Successfully completed';
    } else {
      return result.message || 'Action completed';
    }
  };


  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes("error")) {
      return (
        <svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
      );
    } else if (statusLower.includes("warning") || statusLower.includes("warn")) {
      return (
        <svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      );
    } else if (statusLower.includes("success") || statusLower === "ok") {
      return (
        <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
      );
    } else {
      return (
        <svg class="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
        </svg>
      );
    }
  };

  return (
    <div class="p-5 max-w-4xl mx-auto font-sans">
      <div class="flex justify-between items-center mb-5">
        <h1 class="text-2xl font-bold text-gray-800">Plugins Manager</h1>
        <button 
          onClick={fetchPlugins}
          disabled={loading()}
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity font-medium"
        >
          {loading() ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      
      <Show when={error()}>
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong class="font-bold">Error:</strong>
          <span class="block sm:inline ml-1">{error()}</span>
        </div>
      </Show>
      
      <Show when={callbackResult()}>
        {(result) => {
          const status = result().status;
          const message = getFormattedMessage(result());
          const styles = getStatusStyles(status);
          
          return (
            <div class={`px-4 py-3 rounded mb-4 ${styles}`}>
              <div class="flex items-start">
                <div class="flex-shrink-0 mr-3">
                  {getStatusIcon(status)}
                </div>
                <div>
                  {message}
                </div>
              </div>
            </div>
          );
        }}
      </Show>
      
      <Show 
        when={!loading()}
        fallback={
          <div class="text-center py-10">
            <div class="inline-block w-10 h-10 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
            <p class="mt-4 text-gray-600">Loading plugins...</p>
          </div>
        }
      >
        <Show 
          when={plugins().length > 0}
          fallback={
            <div class="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <p class="text-gray-600 mb-3">No plugins found</p>
              <button 
                onClick={fetchPlugins}
                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          }
        >
          <div class="space-y-4">
            <For each={plugins()}>
              {(plugin) => {
                const buttonCount = plugin.buttons?.length || 0;
                const inputCount = plugin.inputs?.length || 0;
                const totalActions = buttonCount + inputCount;
                
                return (
                  <div class="bg-white rounded-lg border border-gray-200 shadow-sm p-5">
                    <div class="flex justify-between items-start mb-4">
                      <h3 class="text-lg font-semibold text-gray-800">
                        {plugin.name}
                      </h3>
                      <div class="flex gap-2">
                        <Show when={buttonCount > 0}>
                          <span class="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full font-medium">
                            {buttonCount} button{buttonCount !== 1 ? 's' : ''}
                          </span>
                        </Show>
                        <Show when={inputCount > 0}>
                          <span class="text-xs text-purple-600 bg-purple-100 px-2 py-1 rounded-full font-medium">
                            {inputCount} input{inputCount !== 1 ? 's' : ''}
                          </span>
                        </Show>
                      </div>
                    </div>
                    
                    <Show when={plugin.texts?.length > 0}>
                      <div class="mb-4 p-3 bg-gray-50 rounded">
                        <For each={plugin.texts}>
                          {(text, index) => (
                            <p class="my-2 text-gray-700 leading-relaxed">
                              {text}
                            </p>
                          )}
                        </For>
                      </div>
                    </Show>
                    
                    <Show when={inputCount > 0}>
                      <div class="space-y-3 mb-4">
                        <For each={plugin.inputs}>
                          {(input) => {
                            const isExecuting = executing()[input.callback_id];
                            const currentValue = inputValues()[input.callback_id] || '';
                            
                            return (
                              <div class="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                                <input
                                  type="text"
                                  value={currentValue}
                                  onInput={(e) => handleInputChange(input.callback_id, e.currentTarget.value)}
                                  placeholder={input.value_placeholder}
                                  disabled={isExecuting}
                                  class="flex-grow px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100"
                                />
                                <button
                                  onClick={() => handleInputButtonClick(input, plugin.name)}
                                  disabled={isExecuting}
                                  title={`Callback ID: ${input.callback_id}`}
                                  class={`px-4 py-2 rounded font-medium transition-all min-w-[100px] relative ${
                                    isExecuting
                                      ? 'bg-gray-600 cursor-not-allowed opacity-80'
                                      : 'bg-purple-500 hover:bg-purple-600'
                                  } text-white`}
                                >
                                  {isExecuting ? (
                                    <>
                                      <span class="inline-block mr-2 animate-pulse">
                                        ⏳
                                      </span>
                                      Sending...
                                    </>
                                  ) : (
                                    input.value_button
                                  )}
                                </button>
                              </div>
                            );
                          }}
                        </For>
                      </div>
                    </Show>
                    
                    <Show when={buttonCount > 0}>
                      <div class={`pt-4 ${inputCount > 0 ? 'border-t border-gray-200' : ''}`}>
                        <div class="flex flex-wrap gap-2">
                          <For each={plugin.buttons}>
                            {(button) => {
                              const isExecuting = executing()[button.callback_id];
                              
                              return (
                                <button
                                  onClick={() => handleButtonClick(button, plugin.name)}
                                  disabled={isExecuting}
                                  title={`Callback ID: ${button.callback_id}`}
                                  class={`px-4 py-2 rounded font-medium transition-all min-w-[100px] relative ${
                                    isExecuting
                                      ? 'bg-gray-600 cursor-not-allowed opacity-80'
                                      : 'bg-green-500 hover:bg-green-600'
                                  } text-white`}
                                >
                                  {isExecuting ? (
                                    <>
                                      <span class="inline-block mr-2 animate-pulse">
                                        ⏳
                                      </span>
                                      Processing...
                                    </>
                                  ) : (
                                    button.value
                                  )}
                                </button>
                              );
                            }}
                          </For>
                        </div>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
            
            <div class="text-center text-gray-600 text-sm py-3 mt-2">
              Showing {plugins().length} plugin{plugins().length !== 1 ? 's' : ''}
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}