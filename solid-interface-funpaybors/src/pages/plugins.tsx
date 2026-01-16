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
  error: null | string;
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

const parseServerResponse = async (response: Response): Promise<ResponseCallbackPlugin> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
  }

  const responseText = await response.text();
  
  try {
    const result = JSON.parse(responseText);
    
    if (typeof result !== 'object' || result === null) {
      return {
        message: responseText,
        status: "success"
      };
    }
    
    return {
      message: result.message ?? null,
      status: result.status ?? "success"
    };
  } catch {
    return {
      message: responseText,
      status: "error"
    };
  }
};

export default function Plugins() {
  const [plugins, setPlugins] = createSignal<Plugin[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [executing, setExecuting] = createSignal<Record<number, boolean>>({});
  const [callbackResult, setCallbackResult] = createSignal<ResponseCallbackPlugin | null>(null);
  const [inputValues, setInputValues] = createSignal<Record<number, string>>({});
  const [reloading, setReloading] = createSignal(false);
  const [installing, setInstalling] = createSignal(false);
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [fileInputRef, setFileInputRef] = createSignal<HTMLInputElement>();
  const [deleting, setDeleting] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [pluginToDelete, setPluginToDelete] = createSignal<string | null>(null);

  // const API_BASE = 'http://127.0.0.1:58899';
  const API_BASE = '';
  const api = createApiSession();

  const fetchPlugins = async () => {
    setLoading(true);
    setError(null);
    setCallbackResult(null);
    
    try {
      const response = await api.get(`${API_BASE}/plugins/list`);
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

  const handleFileSelect = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      const file = input.files[0];
      setSelectedFile(file);
      
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setCallbackResult({
          status: "error",
          message: "Please select a valid ZIP archive file"
        });
        setSelectedFile(null);
        input.value = '';
      }
    }
  };

  const handleInstallPlugin = async () => {
    const file = selectedFile();
    if (!file) {
      setCallbackResult({
        status: "error",
        message: "Please select a ZIP file first"
      });
      return;
    }

    setInstalling(true);
    setCallbackResult(null);
    
    try {
      const formData = new FormData();
      formData.append('plugin', file);
      formData.append('original_filename', file.name);
      
      const response = await api.upload(`${API_BASE}/plugins/installation`, formData);
      const result = await parseServerResponse(response);
      
      const normalizedResult = {
        ...result,
        status: result.status.toLowerCase().trim()
      };
      
      setCallbackResult(normalizedResult);
      
      if (normalizedResult.status.includes("success")) {
        setSelectedFile(null);
        fileInputRef() && (fileInputRef()!.value = '');
        setTimeout(fetchPlugins, 1000);
      }
    } catch (error) {
      console.error('Installation error:', error);
      setCallbackResult({
        status: "error",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setInstalling(false);
    }
  };

  const handleReloadPlugins = async () => {
    setReloading(true);
    setCallbackResult(null);
    
    try {
      const response = await api.post(`${API_BASE}/plugins/reload`, {});
      const result = await parseServerResponse(response);
      
      const normalizedResult = {
        ...result,
        status: result.status.toLowerCase().trim()
      };
      
      setCallbackResult(normalizedResult);
      
      if (normalizedResult.status.includes("successfully")) {
        fetchPlugins();
      }
    } catch (error) {
      console.error('Reload error:', error);
      setCallbackResult({
        status: "error",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setReloading(false);
    }
  };

  const executeCallback = async (requestData: ButtonCallbackRequest | InputCallbackRequest, callbackId: number) => {
    try {
      setExecuting(prev => ({ ...prev, [callbackId]: true }));
      
      const response = await api.post(`${API_BASE}/plugins/callback`, requestData);
      const result = await parseServerResponse(response);
      
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
      setCallbackResult({
        status: "error",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setTimeout(() => setExecuting(prev => ({ ...prev, [callbackId]: false })), 300);
    }
  };

  const handleButtonClick = async (button: Button, pluginName: string) => {
    setCallbackResult(null);
    await executeCallback({
      name: pluginName,
      callback_id: button.callback_id,
      callback_type: "button"
    }, button.callback_id);
  };

  const handleInputButtonClick = async (input: Input, pluginName: string) => {
    setCallbackResult(null);
    await executeCallback({
      name: pluginName,
      callback_id: input.callback_id,
      callback_type: "input",
      data: inputValues()[input.callback_id] || ''
    }, input.callback_id);
  };

  const handleInputChange = (callbackId: number, value: string) => {
    setInputValues(prev => ({ ...prev, [callbackId]: value }));
  };

  const handleDeleteClick = (pluginName: string) => {
    setPluginToDelete(pluginName);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    const pluginName = pluginToDelete();
    if (!pluginName) return;

    setDeleting(true);
    
    try {
      const response = await api.post(`${API_BASE}/plugins/delete`, { name: pluginName });
      const result = await parseServerResponse(response);
      
      const normalizedResult = {
        ...result,
        status: result.status.toLowerCase().trim()
      };
      
      setCallbackResult(normalizedResult);
      
      if (normalizedResult.status.includes("success")) {
        fetchPlugins();
      }
    } catch (error) {
      console.error('Delete error:', error);
      setCallbackResult({
        status: "error",
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setPluginToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setPluginToDelete(null);
  };

  onMount(fetchPlugins);

  const getStatusStyles = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("error")) return 'bg-red-100 border border-red-400 text-red-700';
    if (statusLower.includes("warning") || statusLower.includes("warn")) return 'bg-yellow-100 border border-yellow-400 text-yellow-700';
    if (statusLower.includes("successfully") || statusLower === "ok") return 'bg-green-100 border border-green-400 text-green-700';
    return 'bg-gray-100 border border-gray-400 text-gray-700';
  };

  const getFormattedMessage = (result: ResponseCallbackPlugin) => {
    const statusLower = result.status.toLowerCase();
    if (statusLower.includes("error")) return result.message || 'An error occurred';
    if (statusLower.includes("warning") || statusLower.includes("warn")) return result.message || 'Warning';
    if (statusLower.includes("successfully") || statusLower === "ok") return result.message || 'Successfully completed';
    return result.message || 'Action completed';
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("error")) {
      return (
        <svg class="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
        </svg>
      );
    }
    if (statusLower.includes("warning") || statusLower.includes("warn")) {
      return (
        <svg class="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
        </svg>
      );
    }
    if (statusLower.includes("successfully") || statusLower === "ok") {
      return (
        <svg class="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
        </svg>
      );
    }
    return (
      <svg class="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clip-rule="evenodd" />
      </svg>
    );
  };

  return (
    <div class="p-5 max-w-4xl mx-auto font-sans">
      <Show when={showDeleteConfirm()}>
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={handleCancelDelete}
            ></div>
            <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 class="text-lg font-medium leading-6 text-gray-900">
                    Delete Plugin
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Are you sure you want to delete plugin "<span class="font-semibold">{pluginToDelete()}</span>"? This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  disabled={deleting()}
                  class="inline-flex w-full justify-center rounded-md border border-transparent bg-red-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting() ? (
                    <>
                      <div class="inline-block w-4 h-4 border-2 border-t-white border-gray-300 rounded-full animate-spin mr-2"></div>
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelDelete}
                  disabled={deleting()}
                  class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>

      <div class="flex justify-between items-center mb-5">
        <h1 class="text-2xl font-bold text-gray-800">Plugins Manager</h1>
        <div class="flex gap-2">
          <button 
            onClick={handleReloadPlugins}
            disabled={reloading() || loading() || installing() || deleting()}
            class="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity font-medium flex items-center gap-2"
          >
            {reloading() ? (
              <>
                <div class="inline-block w-4 h-4 border-2 border-t-white border-gray-300 rounded-full animate-spin"></div>
                Reloading...
              </>
            ) : (
              <>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload Plugins
              </>
            )}
          </button>
          <button 
            onClick={fetchPlugins}
            disabled={loading() || reloading() || installing() || deleting()}
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity font-medium flex items-center gap-2"
          >
            {loading() ? (
              <>
                <div class="inline-block w-4 h-4 border-2 border-t-white border-gray-300 rounded-full animate-spin"></div>
                Refreshing...
              </>
            ) : (
              <>
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh List
              </>
            )}
          </button>
        </div>
      </div>

      <div class="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div class="flex-grow">
            <label class="block text-sm font-medium text-gray-700 mb-1">
              Install Plugin from ZIP Archive
            </label>
            <div class="flex items-center gap-2">
              <input
                type="file"
                accept=".zip,application/zip,application/x-zip-compressed"
                onChange={handleFileSelect}
                ref={setFileInputRef}
                class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              <button
                onClick={handleInstallPlugin}
                disabled={installing() || !selectedFile() || loading() || reloading() || deleting()}
                class="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-medium flex items-center gap-2 whitespace-nowrap"
              >
                {installing() ? (
                  <>
                    <div class="inline-block w-4 h-4 border-2 border-t-white border-gray-300 rounded-full animate-spin"></div>
                    Installing...
                  </>
                ) : (
                  <>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Install Plugin
                  </>
                )}
              </button>
            </div>
            <div class="mt-2 text-xs text-gray-500">
              {selectedFile() ? (
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Selected: {selectedFile()!.name} ({(selectedFile()!.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <span>Select a ZIP archive containing the plugin files</span>
              )}
            </div>
          </div>
        </div>
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
                const hasError = plugin.error && plugin.error.trim() !== '';
                
                return (
                  <div class={`rounded-lg border shadow-sm p-5 ${
                    hasError 
                      ? 'bg-red-50 border-red-200' 
                      : 'bg-white border-gray-200'
                  }`}>
                    <div class="flex justify-between items-start mb-4">
                      <div class="flex-1">
                        <div class="flex items-start justify-between">
                          <h3 class={`text-lg font-semibold ${
                            hasError ? 'text-red-800' : 'text-gray-800'
                          }`}>
                            {plugin.name}
                          </h3>
                          <button
                            onClick={() => handleDeleteClick(plugin.name)}
                            disabled={deleting() || loading() || reloading() || installing()}
                            title="Delete plugin"
                            class="ml-2 p-1 text-gray-400 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                        
                        <Show when={hasError}>
                          <div class="mt-2 p-2 bg-red-100 border border-red-300 rounded text-red-700 text-sm">
                            <div class="flex items-start">
                              <svg class="h-4 w-4 text-red-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                              </svg>
                              <span>{plugin.error}</span>
                            </div>
                          </div>
                        </Show>
                      </div>
                      
                      <div class="flex gap-2">
                        <Show when={buttonCount > 0}>
                          <span class={`text-xs px-2 py-1 rounded-full font-medium ${
                            hasError 
                              ? 'bg-red-200 text-red-700' 
                              : 'bg-blue-100 text-blue-600'
                          }`}>
                            {buttonCount} button{buttonCount !== 1 ? 's' : ''}
                          </span>
                        </Show>
                        <Show when={inputCount > 0}>
                          <span class={`text-xs px-2 py-1 rounded-full font-medium ${
                            hasError 
                              ? 'bg-red-200 text-red-700' 
                              : 'bg-purple-100 text-purple-600'
                          }`}>
                            {inputCount} input{inputCount !== 1 ? 's' : ''}
                          </span>
                        </Show>
                      </div>
                    </div>
                    
                    <Show when={plugin.texts?.length > 0}>
                      <div class={`mb-4 p-3 rounded ${
                        hasError ? 'bg-red-100' : 'bg-gray-50'
                      }`}>
                        <For each={plugin.texts}>
                          {(text) => (
                            <p class={`my-2 leading-relaxed ${
                              hasError ? 'text-red-800' : 'text-gray-700'
                            }`}>
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
                                  class={`flex-grow px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:border-transparent disabled:opacity-60 disabled:bg-gray-100 ${
                                    hasError
                                      ? 'border-red-300 focus:ring-red-500'
                                      : 'border-gray-300 focus:ring-blue-500'
                                  }`}
                                />
                                <button
                                  onClick={() => handleInputButtonClick(input, plugin.name)}
                                  disabled={isExecuting}
                                  title={`Callback ID: ${input.callback_id}`}
                                  class={`px-4 py-2 rounded font-medium transition-all min-w-[100px] relative ${
                                    isExecuting
                                      ? 'bg-gray-600 cursor-not-allowed opacity-80'
                                      : hasError
                                        ? 'bg-red-500 hover:bg-red-600'
                                        : 'bg-purple-500 hover:bg-purple-600'
                                  } text-white`}
                                >
                                  {isExecuting ? (
                                    <>
                                      <span class="inline-block mr-2 animate-pulse">⏳</span>
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
                      <div class={`pt-4 ${inputCount > 0 ? 'border-t' : ''} ${
                        hasError ? 'border-red-200' : 'border-gray-200'
                      }`}>
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
                                      : hasError
                                        ? 'bg-red-500 hover:bg-red-600'
                                        : 'bg-green-500 hover:bg-green-600'
                                  } text-white`}
                                >
                                  {isExecuting ? (
                                    <>
                                      <span class="inline-block mr-2 animate-pulse">⏳</span>
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