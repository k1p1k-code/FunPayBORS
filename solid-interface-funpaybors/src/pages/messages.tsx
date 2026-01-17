import { createSignal, onMount, Show, For, createEffect } from 'solid-js';
import { createApiSession } from '../app';

interface StrategyText {
  key_word: string[] | null;
  equals: string | null;
}

interface StrategyMessage {
  strategy_text: StrategyText;
  answer: string;
}

interface UpdateAutoReply {
  strategy_message: StrategyMessage;
  id: number;
}

interface DeleteRequest {
  update: number;
}

// Компонент для отображения тегов
function KeywordTags(props: { 
  keywords: string[]; 
  onRemove: (index: number) => void 
}) {
  return (
    <div class="flex flex-wrap gap-2 mb-2">
      <For each={props.keywords}>
        {(keyword, index) => (
          <div class="bg-blue-100 text-blue-800 px-3 py-1 rounded-full flex items-center gap-2">
            <span>{keyword}</span>
            <button
              type="button"
              onClick={() => props.onRemove(index())}
              class="text-blue-600 hover:text-blue-800 text-lg font-bold"
            >
              ×
            </button>
          </div>
        )}
      </For>
    </div>
  );
}

export default function AutoReplies() {
  const [strategies, setStrategies] = createSignal<StrategyMessage[]>([]);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [deleting, setDeleting] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [strategyToDelete, setStrategyToDelete] = createSignal<StrategyMessage | null>(null);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [editingStrategy, setEditingStrategy] = createSignal<StrategyMessage | null>(null);
  const [newStrategy, setNewStrategy] = createSignal<StrategyMessage | null>(null);
  const [originalStrategy, setOriginalStrategy] = createSignal<StrategyMessage | null>(null);
  const [saveLoading, setSaveLoading] = createSignal(false);
  const [addLoading, setAddLoading] = createSignal(false);
  const [refreshing, setRefreshing] = createSignal(false);
  const [currentKeywordInput, setCurrentKeywordInput] = createSignal('');
  const [currentNewKeywordInput, setCurrentNewKeywordInput] = createSignal('');

  // const API_BASE = 'http://127.0.0.1:58899';
  const API_BASE = '';
  const api = createApiSession();

  const validateLettersOnly = (value: string): string => {
    return value.replace(/[^a-zA-Zа-яА-ЯёЁ\s]/g, '');
  };

  const fetchStrategies = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await api.get(`${API_BASE}/messages/list`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const data: StrategyMessage[] = await response.json();
      setStrategies(data);
    } catch (error) {
      console.error('Error fetching strategies:', error);
      setError(error instanceof Error ? error.message : 'Failed to load auto-replies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchStrategies();
  };

  const handleDeleteClick = (index: number) => {
    const strategy = strategies()[index];
    setStrategyToDelete(strategy);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    const strategy = strategyToDelete();
    if (!strategy) return;

    setDeleting(true);
    setError(null);
    
    try {
      // Сначала получаем актуальный список стратегий
      const listResponse = await api.get(`${API_BASE}/messages/list`);
      
      if (!listResponse.ok) {
        throw new Error(`Failed to fetch strategies list: HTTP ${listResponse.status}`);
      }
      
      const currentStrategies: StrategyMessage[] = await listResponse.json();
      
      const currentIndex = findStrategyIndex(strategy, currentStrategies);
      
      if (currentIndex === -1) {
        throw new Error('Strategy not found in the current list. It may have been already deleted.');
      }
      
      const deleteRequest: DeleteRequest = {
        update: currentIndex
      };
      
      const deleteResponse = await api.post(`${API_BASE}/messages/delete`, deleteRequest);
      
      if (!deleteResponse.ok) {
        throw new Error(`HTTP ${deleteResponse.status}: ${deleteResponse.statusText}`);
      }
      
      const result = await deleteResponse.json();
      
      if (result.status && result.status.toLowerCase().includes("success")) {
        const updatedStrategies = currentStrategies.filter((_, i) => i !== currentIndex);
        setStrategies(updatedStrategies);
      } else {
        setError(result.message || 'Failed to delete strategy');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
      setStrategyToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setStrategyToDelete(null);
  };

  const handleAddClick = () => {
    setNewStrategy({
      strategy_text: {
        key_word: null,
        equals: null
      },
      answer: ''
    });
    setCurrentNewKeywordInput('');
    setShowAddModal(true);
  };

  const handleCancelAdd = () => {
    setShowAddModal(false);
    setNewStrategy(null);
    setCurrentNewKeywordInput('');
  };

  const handleEditClick = (index: number) => {
    const strategy = strategies()[index];
    const strategyCopy = {
      strategy_text: {
        key_word: strategy.strategy_text.key_word ? [...strategy.strategy_text.key_word] : null,
        equals: strategy.strategy_text.equals
      },
      answer: strategy.answer
    };
    setEditingStrategy(strategyCopy);
    setOriginalStrategy(strategyCopy);
    setCurrentKeywordInput('');
    setShowEditModal(true);
  };

  const handleCancelEdit = () => {
    setShowEditModal(false);
    setEditingStrategy(null);
    setOriginalStrategy(null);
    setCurrentKeywordInput('');
  };

  const areStrategiesEqual = (a: StrategyMessage, b: StrategyMessage): boolean => {
    if (a.answer !== b.answer) return false;
    
    if (a.strategy_text.equals !== b.strategy_text.equals) return false;
    
    const aKeywords = a.strategy_text.key_word || [];
    const bKeywords = b.strategy_text.key_word || [];
    
    if (aKeywords.length !== bKeywords.length) return false;
    
    const sortedA = [...aKeywords].sort();
    const sortedB = [...bKeywords].sort();
    
    return sortedA.every((keyword, index) => keyword === sortedB[index]);
  };

  const findStrategyIndex = (strategy: StrategyMessage, strategiesList: StrategyMessage[]): number => {
    return strategiesList.findIndex(s => areStrategiesEqual(s, strategy));
  };

  const isStrategyValid = (strategy: StrategyMessage | null): boolean => {
    if (!strategy) return false;
    
    const hasKeywords = !!strategy.strategy_text.key_word?.length;
    const hasEquals = !!strategy.strategy_text.equals?.trim();
    const hasAnswer = !!strategy.answer?.trim();
    
    return (hasKeywords || hasEquals) && hasAnswer;
  };

  const handleSaveEdit = async () => {
    const strategy = editingStrategy();
    const original = originalStrategy();
    
    if (!strategy || !original) return;

    if (!isStrategyValid(strategy)) {
      setError('Please fill in at least one trigger (Keywords or Exact Match) and provide a Reply Message.');
      return;
    }

    setSaveLoading(true);
    setError(null);
    
    try {
      const listResponse = await api.get(`${API_BASE}/messages/list`);
      
      if (!listResponse.ok) {
        throw new Error(`Failed to fetch strategies list: HTTP ${listResponse.status}`);
      }
      
      const currentStrategies: StrategyMessage[] = await listResponse.json();
      
      const currentIndex = findStrategyIndex(original, currentStrategies);
      
      if (currentIndex === -1) {
        throw new Error('Strategy not found in the current list. It may have been deleted or modified by another user.');
      }
      
      const updateData: UpdateAutoReply = {
        strategy_message: strategy,
        id: currentIndex
      };

      const updateResponse = await api.post(`${API_BASE}/messages/update`, updateData);
      
      if (!updateResponse.ok) {
        throw new Error(`HTTP ${updateResponse.status}: ${updateResponse.statusText}`);
      }
      
      const result = await updateResponse.json();
      
      if (result.status && result.status.toLowerCase().includes("success")) {
        const updatedStrategies = [...currentStrategies];
        updatedStrategies[currentIndex] = strategy;
        setStrategies(updatedStrategies);
        
        setShowEditModal(false);
        setEditingStrategy(null);
        setOriginalStrategy(null);
        setCurrentKeywordInput('');
      } else {
        setError(result.message || 'Failed to update strategy');
      }
    } catch (error) {
      console.error('Update error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveNew = async () => {
    const strategy = newStrategy();
    
    if (!strategy) return;

    if (!isStrategyValid(strategy)) {
      setError('Please fill in at least one trigger (Keywords or Exact Match) and provide a Reply Message.');
      return;
    }

    setAddLoading(true);
    setError(null);
    
    try {
      const response = await api.post(`${API_BASE}/messages/add`, strategy);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (result.status && result.status.toLowerCase().includes("success")) {
        await fetchStrategies();
        
        setShowAddModal(false);
        setNewStrategy(null);
        setCurrentNewKeywordInput('');
      } else {
        setError(result.message || 'Failed to add new strategy');
      }
    } catch (error) {
      console.error('Add error:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setAddLoading(false);
    }
  };

  const handleFieldChange = (field: 'key_word' | 'equals' | 'answer', value: any, isNew: boolean = false) => {
    if (isNew) {
      const current = newStrategy();
      if (!current) return;

      if (field === 'answer') {
        setNewStrategy({
          ...current,
          answer: value
        });
      } else {
        setNewStrategy({
          ...current,
          strategy_text: {
            ...current.strategy_text,
            [field]: value
          }
        });
      }
    } else {
      const current = editingStrategy();
      if (!current) return;

      if (field === 'answer') {
        setEditingStrategy({
          ...current,
          answer: value
        });
      } else {
        setEditingStrategy({
          ...current,
          strategy_text: {
            ...current.strategy_text,
            [field]: value
          }
        });
      }
    }
  };

  const addKeyword = (keyword: string, isNew: boolean = false) => {
    const trimmedKeyword = keyword.trim();
    if (!trimmedKeyword) return;
    
    if (isNew) {
      const current = newStrategy();
      if (!current) return;
      
      const currentKeywords = current.strategy_text.key_word || [];
      if (currentKeywords.includes(trimmedKeyword)) return; 
      
      setNewStrategy({
        ...current,
        strategy_text: {
          ...current.strategy_text,
          key_word: [...currentKeywords, trimmedKeyword]
        }
      });
    } else {
      const current = editingStrategy();
      if (!current) return;
      
      const currentKeywords = current.strategy_text.key_word || [];
      if (currentKeywords.includes(trimmedKeyword)) return; 
      
      setEditingStrategy({
        ...current,
        strategy_text: {
          ...current.strategy_text,
          key_word: [...currentKeywords, trimmedKeyword]
        }
      });
    }
  };

  const removeKeyword = (index: number, isNew: boolean = false) => {
    if (isNew) {
      const current = newStrategy();
      if (!current) return;
      
      const currentKeywords = current.strategy_text.key_word || [];
      const newKeywords = [...currentKeywords];
      newKeywords.splice(index, 1);
      
      setNewStrategy({
        ...current,
        strategy_text: {
          ...current.strategy_text,
          key_word: newKeywords.length > 0 ? newKeywords : null
        }
      });
    } else {
      const current = editingStrategy();
      if (!current) return;
      
      const currentKeywords = current.strategy_text.key_word || [];
      const newKeywords = [...currentKeywords];
      newKeywords.splice(index, 1);
      
      setEditingStrategy({
        ...current,
        strategy_text: {
          ...current.strategy_text,
          key_word: newKeywords.length > 0 ? newKeywords : null
        }
      });
    }
  };

  const handleKeywordInput = (e: KeyboardEvent, isNew: boolean = false) => {
    if (e.key === ';' || e.key === 'Enter') {
      e.preventDefault();
      const keyword = isNew ? currentNewKeywordInput().trim() : currentKeywordInput().trim();
      if (keyword) {
        addKeyword(keyword, isNew);
        if (isNew) {
          setCurrentNewKeywordInput('');
        } else {
          setCurrentKeywordInput('');
        }
      }
    }
  };

  const handleAddKeywordButton = (isNew: boolean = false) => {
    const keyword = isNew ? currentNewKeywordInput().trim() : currentKeywordInput().trim();
    if (keyword) {
      addKeyword(keyword, isNew);
      if (isNew) {
        setCurrentNewKeywordInput('');
      } else {
        setCurrentKeywordInput('');
      }
    }
  };

  createEffect(() => {
    if (showEditModal()) {
      setCurrentKeywordInput('');
    }
    if (showAddModal()) {
      setCurrentNewKeywordInput('');
    }
  });

  onMount(fetchStrategies);

  const getStatusStyles = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("error")) return 'bg-red-100 border border-red-400 text-red-700';
    if (statusLower.includes("warning") || statusLower.includes("warn")) return 'bg-yellow-100 border border-yellow-400 text-yellow-700';
    if (statusLower.includes("successfully") || statusLower === "ok" || statusLower === "success") return 'bg-green-100 border border-green-400 text-green-700';
    return 'bg-gray-100 border border-gray-400 text-gray-700';
  };

  return (
    <div class="p-5 max-w-6xl mx-auto font-sans">
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
                    Delete Auto-Reply
                  </h3>
                  <div class="mt-2">
                    <p class="text-sm text-gray-500">
                      Are you sure you want to delete this auto-reply? This action cannot be undone.
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
      <Show when={showEditModal()}>
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={handleCancelEdit}
            ></div>
            <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 class="text-lg font-medium leading-6 text-gray-900">
                    Edit Auto-Reply
                  </h3>
                  <div class="mt-4 space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        Keywords
                      </label>
                      
                      <Show when={editingStrategy()?.strategy_text.key_word && editingStrategy()!.strategy_text.key_word!.length > 0}>
                        <KeywordTags 
                          keywords={editingStrategy()!.strategy_text.key_word!} 
                          onRemove={(index) => removeKeyword(index, false)}
                        />
                      </Show>
                      <div class="flex gap-2">
                        <input
                          type="text"
                          value={currentKeywordInput()}
                          onInput={(e) => {
                            const inputValue = e.currentTarget.value.toLowerCase();
                            const cleanedValue = validateLettersOnly(inputValue);
                            setCurrentKeywordInput(cleanedValue);
                          }}
                          onKeyDown={(e) => handleKeywordInput(e, false)}
                          class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Type keyword and press Enter or ;"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddKeywordButton(false)}
                          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">
                        Type keyword and press Enter or ; to add. Keywords can only contain letters and spaces.
                      </p>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        Exact Match
                      </label>
                      <input
                        type="text"
                        value={editingStrategy()?.strategy_text.equals || ''}
                        onInput={(e) => {
                          const inputValue = e.currentTarget.value;
                          const cleanedValue = validateLettersOnly(inputValue);
                          e.currentTarget.value = cleanedValue;
                          handleFieldChange('equals', cleanedValue || null, false);
                        }}
                        onKeyPress={(e) => {
                          const char = String.fromCharCode(e.charCode || e.keyCode);
                          if (!/[a-zA-Zа-яА-ЯёЁ\s]/.test(char) && e.key !== 'Backspace' && e.key !== 'Delete' && !e.key.includes('Arrow')) {
                            e.preventDefault();
                          }
                        }}
                        class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Exact message text"
                      />
                      <p class="text-xs text-gray-500 mt-1">
                        Only letters and spaces allowed
                      </p>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        Reply Message *
                      </label>
                      <textarea
                        value={editingStrategy()?.answer || ''}
                        onInput={(e) => handleFieldChange('answer', e.currentTarget.value, false)}
                        class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Auto-reply message"
                      />
                    </div>

                    <div class="text-xs text-gray-500">
                      * At least one of the fields (Keywords or Exact Match) must be filled in, and Reply Message is required.
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saveLoading() || !isStrategyValid(editingStrategy())}
                  class="inline-flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saveLoading() ? (
                    <>
                      <div class="inline-block w-4 h-4 border-2 border-t-white border-gray-300 rounded-full animate-spin mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={saveLoading()}
                  class="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </Show>
      <Show when={showAddModal()}>
        <div class="fixed inset-0 z-50 overflow-y-auto">
          <div class="flex min-h-screen items-center justify-center px-4 pt-4 pb-20 text-center sm:p-0">
            <div 
              class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={handleCancelAdd}
            ></div>
            <div class="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="sm:flex sm:items-start">
                <div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div class="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                  <h3 class="text-lg font-medium leading-6 text-gray-900">
                    Add New Auto-Reply
                  </h3>
                  <div class="mt-4 space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        Keywords
                      </label>
                      
                      <Show when={newStrategy()?.strategy_text.key_word && newStrategy()!.strategy_text.key_word!.length > 0}>
                        <KeywordTags 
                          keywords={newStrategy()!.strategy_text.key_word!} 
                          onRemove={(index) => removeKeyword(index, true)}
                        />
                      </Show>
                      <div class="flex gap-2">
                        <input
                          type="text"
                          value={currentNewKeywordInput()}
                          onInput={(e) => {
                            const inputValue = e.currentTarget.value.toLowerCase();
                            const cleanedValue = validateLettersOnly(inputValue);
                            setCurrentNewKeywordInput(cleanedValue);
                          }}
                          onKeyDown={(e) => handleKeywordInput(e, true)}
                          class="flex-1 px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Type keyword and press Enter or ;"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddKeywordButton(true)}
                          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          Add
                        </button>
                      </div>
                      <p class="text-xs text-gray-500 mt-1">
                        Type keyword and press Enter or ; to add. Keywords can only contain letters and spaces.
                      </p>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        Exact Match
                      </label>
                      <input
                        type="text"
                        value={newStrategy()?.strategy_text.equals || ''}
                        onInput={(e) => {
                          const inputValue = e.currentTarget.value;
                          const cleanedValue = validateLettersOnly(inputValue);
                          e.currentTarget.value = cleanedValue;
                          handleFieldChange('equals', cleanedValue || null, true);
                        }}
                        onKeyPress={(e) => {
                          const char = String.fromCharCode(e.charCode || e.keyCode);
                          if (!/[a-zA-Zа-яА-ЯёЁ\s]/.test(char) && e.key !== 'Backspace' && e.key !== 'Delete' && !e.key.includes('Arrow')) {
                            e.preventDefault();
                          }
                        }}
                        class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Exact message text"
                      />
                      <p class="text-xs text-gray-500 mt-1">
                        Only letters and spaces allowed
                      </p>
                    </div>
                    
                    <div>
                      <label class="block text-sm font-medium text-gray-700 mb-1">
                        Reply Message *
                      </label>
                      <textarea
                        value={newStrategy()?.answer || ''}
                        onInput={(e) => handleFieldChange('answer', e.currentTarget.value, true)}
                        class="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        rows={3}
                        placeholder="Auto-reply message"
                      />
                    </div>

                    <div class="text-xs text-gray-500">
                      * At least one of the fields (Keywords or Exact Match) must be filled in, and Reply Message is required.
                    </div>
                  </div>
                </div>
              </div>
              <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveNew}
                  disabled={addLoading() || !isStrategyValid(newStrategy())}
                  class="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addLoading() ? (
                    <>
                      <div class="inline-block w-4 h-4 border-2 border-t-white border-gray-300 rounded-full animate-spin mr-2"></div>
                      Adding...
                    </>
                  ) : (
                    'Add Auto-Reply'
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleCancelAdd}
                  disabled={addLoading()}
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
        <h1 class="text-2xl font-bold text-gray-800">Auto-Replies Manager</h1>
        <div class="flex gap-2">
          <button 
            onClick={handleAddClick}
            disabled={refreshing() || loading() || deleting() || saveLoading() || addLoading()}
            class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity font-medium flex items-center gap-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            Add New
          </button>
          <button 
            onClick={handleRefresh}
            disabled={refreshing() || loading() || deleting() || saveLoading() || addLoading()}
            class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-opacity font-medium flex items-center gap-2"
          >
            {refreshing() ? (
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

      <Show when={error()}>
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong class="font-bold">Error:</strong>
          <span class="block sm:inline ml-1">{error()}</span>
        </div>
      </Show>
      
      <Show 
        when={!loading()}
        fallback={
          <div class="text-center py-10">
            <div class="inline-block w-10 h-10 border-4 border-t-blue-500 border-gray-200 rounded-full animate-spin"></div>
            <p class="mt-4 text-gray-600">Loading auto-replies...</p>
          </div>
        }
      >
        <Show 
          when={strategies().length > 0}
          fallback={
            <div class="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
              <svg class="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p class="text-gray-600 mb-3">No auto-replies found</p>
              <button 
                onClick={fetchStrategies}
                class="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          }
        >
          <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Keywords
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Exact Match
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Reply
                    </th>
                    <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  <For each={strategies()}>
                    {(strategy, index) => (
                      <tr class="hover:bg-gray-50 transition-colors">
                        <td class="px-6 py-4">
                          <div class="flex flex-wrap gap-1">
                            <For each={strategy.strategy_text.key_word || []}>
                              {(keyword) => (
                                <span class="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                                  {keyword}
                                </span>
                              )}
                            </For>
                            <Show when={!strategy.strategy_text.key_word || strategy.strategy_text.key_word.length === 0}>
                              <span class="text-gray-500 text-sm">-</span>
                            </Show>
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap">
                          <div class="text-sm text-gray-900">
                            {strategy.strategy_text.equals || '-'}
                          </div>
                        </td>
                        <td class="px-6 py-4">
                          <div class="text-sm text-gray-900 max-w-xs truncate" title={strategy.answer}>
                            {strategy.answer}
                          </div>
                        </td>
                        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div class="flex items-center gap-2">
                            <button
                              onClick={() => handleEditClick(index())}
                              disabled={deleting() || saveLoading() || addLoading()}
                              class="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteClick(index())}
                              disabled={deleting() || saveLoading() || addLoading()}
                              class="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1"
                            >
                              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </For>
                </tbody>
              </table>
            </div>
            <div class="bg-gray-50 px-6 py-3 border-t border-gray-200">
              <div class="flex justify-between items-center">
                <div class="text-sm text-gray-600">
                  Showing {strategies().length} auto-repl{strategies().length === 1 ? 'y' : 'ies'}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={refreshing()}
                  class="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1"
                >
                  {refreshing() ? (
                    <>
                      <div class="inline-block w-3 h-3 border-2 border-t-gray-600 border-gray-300 rounded-full animate-spin"></div>
                      Refreshing...
                    </>
                  ) : (
                    'Refresh'
                  )}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </Show>
    </div>
  );
}