import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Search result from the Rust backend
 */
export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
}

/**
 * Search response from the Rust backend
 */
export interface SearchResponse {
  results: SearchResult[];
  query: string;
  total: number;
}

/**
 * Search state
 */
export interface SearchState {
  query: string;
  results: SearchResult[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for searching notes with debounce
 */
export function useSearch(debounceMs: number = 300) {
  const [state, setState] = useState<SearchState>({
    query: '',
    results: [],
    total: 0,
    isLoading: false,
    error: null,
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutRef = useRef<number | null>(null);

  const search = useCallback(async (query: string) => {
    // Clear previous timeout
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Update query immediately
    setState((prev) => ({ ...prev, query }));

    // If query is empty, clear results
    if (!query.trim()) {
      setState((prev) => ({
        ...prev,
        results: [],
        total: 0,
        isLoading: false,
        error: null,
      }));
      return;
    }

    // Set loading state
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    // Create new abort controller
    abortControllerRef.current = new AbortController();

    // Debounce the actual search
    timeoutRef.current = window.setTimeout(async () => {
      try {
        const response = await invoke<SearchResponse>('search_notes', {
          query: query.trim(),
          limit: 50,
        });

        setState((prev) => ({
          ...prev,
          results: response.results,
          total: response.total,
          isLoading: false,
          error: null,
        }));
      } catch (error) {
        // Don't update state if request was aborted
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        setState((prev) => ({
          ...prev,
          results: [],
          total: 0,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Search failed',
        }));
      }
    }, debounceMs);
  }, [debounceMs]);

  const clearSearch = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setState({
      query: '',
      results: [],
      total: 0,
      isLoading: false,
      error: null,
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    search,
    clearSearch,
  };
}

/**
 * Hook for fuzzy file search (for quick switcher)
 */
export function useFuzzySearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const search = useCallback(async (searchQuery: string) => {
    setQuery(searchQuery);

    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsLoading(true);

    try {
      // Use the same search_notes command but with a smaller limit for quick switcher
      const response = await invoke<SearchResponse>('search_notes', {
        query: searchQuery.trim(),
        limit: 20,
      });

      setResults(response.results);
    } catch (error) {
      console.error('Fuzzy search failed:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return {
    query,
    results,
    isLoading,
    search,
    clearSearch,
  };
}
