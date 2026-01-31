import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { LinkInfo, LinksResponse } from '../types/links';

interface UseLinksOptions {
  /** Whether to automatically fetch links when the path changes */
  autoFetch?: boolean;
}

interface UseLinksResult {
  /** Backlinks (notes that link to the current note) */
  backlinks: LinkInfo[];
  /** Outgoing links (notes that the current note links to) */
  outgoingLinks: LinkInfo[];
  /** Whether the data is currently being fetched */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Manually refresh the links */
  refresh: () => Promise<void>;
}

// Simple cache for link data
const linksCache = new Map<string, { backlinks: LinkInfo[]; outgoingLinks: LinkInfo[]; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

/**
 * Hook to fetch backlinks and outgoing links for a given note
 */
export function useLinks(path: string | null, options: UseLinksOptions = {}): UseLinksResult {
  const { autoFetch = true } = options;

  const [backlinks, setBacklinks] = useState<LinkInfo[]>([]);
  const [outgoingLinks, setOutgoingLinks] = useState<LinkInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep track of the current path to avoid race conditions
  const currentPathRef = useRef<string | null>(null);

  const fetchLinks = useCallback(async () => {
    if (!path) {
      setBacklinks([]);
      setOutgoingLinks([]);
      setError(null);
      return;
    }

    // Check cache first
    const cached = linksCache.get(path);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setBacklinks(cached.backlinks);
      setOutgoingLinks(cached.outgoingLinks);
      setError(null);
      return;
    }

    currentPathRef.current = path;
    setIsLoading(true);
    setError(null);

    try {
      // Fetch backlinks and outgoing links in parallel
      const [backlinksResponse, outgoingResponse] = await Promise.all([
        invoke<LinksResponse>('get_backlinks', { path }),
        invoke<LinksResponse>('get_outgoing_links', { path }),
      ]);

      // Only update state if this is still the current path
      if (currentPathRef.current === path) {
        const newBacklinks = backlinksResponse.links;
        const newOutgoingLinks = outgoingResponse.links;

        setBacklinks(newBacklinks);
        setOutgoingLinks(newOutgoingLinks);

        // Update cache
        linksCache.set(path, {
          backlinks: newBacklinks,
          outgoingLinks: newOutgoingLinks,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      if (currentPathRef.current === path) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch links';
        setError(errorMessage);
        console.error('Error fetching links:', err);
      }
    } finally {
      if (currentPathRef.current === path) {
        setIsLoading(false);
      }
    }
  }, [path]);

  // Auto-fetch when path changes
  useEffect(() => {
    if (autoFetch) {
      fetchLinks();
    }
  }, [fetchLinks, autoFetch]);

  // Refresh function that clears cache and refetches
  const refresh = useCallback(async () => {
    if (path) {
      linksCache.delete(path);
    }
    await fetchLinks();
  }, [path, fetchLinks]);

  return {
    backlinks,
    outgoingLinks,
    isLoading,
    error,
    refresh,
  };
}

/**
 * Clears the links cache for a specific path or all paths
 */
export function clearLinksCache(path?: string): void {
  if (path) {
    linksCache.delete(path);
  } else {
    linksCache.clear();
  }
}
