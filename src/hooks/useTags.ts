import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

/**
 * Tag info from the Rust backend
 */
export interface TagInfo {
  name: string;
  count: number;
  notes: string[];
}

/**
 * Response from get_all_tags command
 */
export interface TagListResponse {
  tags: TagInfo[];
  total: number;
}

/**
 * Response from get_notes_by_tag command
 */
export interface NotesByTagResponse {
  tag: string;
  notes: Array<{
    path: string;
    title: string;
  }>;
  count: number;
}

/**
 * Tag tree node for nested tag display
 */
export interface TagTreeNode {
  name: string;
  fullPath: string;
  count: number;
  children: TagTreeNode[];
  isExpanded: boolean;
}

/**
 * Hook state for tags
 */
export interface TagsState {
  tags: TagInfo[];
  tagTree: TagTreeNode[];
  total: number;
  isLoading: boolean;
  error: string | null;
  selectedTag: string | null;
  filteredNotes: Array<{ path: string; title: string }>;
  expandedTags: Set<string>;
}

/**
 * Builds a tree structure from flat tag list
 * Tags with "/" are treated as nested (e.g., "parent/child")
 */
function buildTagTree(tags: TagInfo[], expandedTags: Set<string>): TagTreeNode[] {
  const root: Map<string, TagTreeNode> = new Map();

  for (const tag of tags) {
    const parts = tag.name.split('/');
    let currentLevel = root;
    let currentPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (!currentLevel.has(part)) {
        const node: TagTreeNode = {
          name: part,
          fullPath: currentPath,
          count: i === parts.length - 1 ? tag.count : 0,
          children: [],
          isExpanded: expandedTags.has(currentPath),
        };
        currentLevel.set(part, node);
      } else if (i === parts.length - 1) {
        // Update count for existing node
        const existingNode = currentLevel.get(part)!;
        existingNode.count += tag.count;
      }

      const node = currentLevel.get(part)!;

      // Move to next level
      if (i < parts.length - 1) {
        // Convert children array to map for easier lookup
        const childMap = new Map(node.children.map(c => [c.name, c]));
        currentLevel = childMap;
        // Update children back
        node.children = Array.from(childMap.values());
      }
    }
  }

  // Convert root map to sorted array
  const result = Array.from(root.values());
  sortTagTree(result);
  return result;
}

/**
 * Sorts tag tree alphabetically
 */
function sortTagTree(nodes: TagTreeNode[]): void {
  nodes.sort((a, b) => a.name.localeCompare(b.name));
  for (const node of nodes) {
    if (node.children.length > 0) {
      sortTagTree(node.children);
    }
  }
}

/**
 * Hook for fetching and managing tags
 */
export function useTags() {
  const [state, setState] = useState<TagsState>({
    tags: [],
    tagTree: [],
    total: 0,
    isLoading: false,
    error: null,
    selectedTag: null,
    filteredNotes: [],
    expandedTags: new Set(),
  });

  const fetchTags = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await invoke<TagListResponse>('get_all_tags');

      // Defensive check: ensure response.tags is an array
      const tags = Array.isArray(response?.tags) ? response.tags : [];
      const total = typeof response?.total === 'number' ? response.total : tags.length;

      setState((prev) => {
        const tagTree = buildTagTree(tags, prev.expandedTags);
        return {
          ...prev,
          tags,
          tagTree,
          total,
          isLoading: false,
          error: null,
        };
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch tags',
      }));
    }
  }, []);

  const selectTag = useCallback(async (tag: string | null) => {
    if (!tag) {
      setState((prev) => ({
        ...prev,
        selectedTag: null,
        filteredNotes: [],
      }));
      return;
    }

    setState((prev) => ({ ...prev, selectedTag: tag, isLoading: true }));

    try {
      const response = await invoke<NotesByTagResponse>('get_notes_by_tag', { tag });

      // Defensive check: ensure response.notes is an array
      const notes = Array.isArray(response?.notes) ? response.notes : [];

      setState((prev) => ({
        ...prev,
        selectedTag: tag,
        filteredNotes: notes,
        isLoading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to fetch notes for tag',
      }));
    }
  }, []);

  const toggleTagExpansion = useCallback((tagPath: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedTags);
      if (newExpanded.has(tagPath)) {
        newExpanded.delete(tagPath);
      } else {
        newExpanded.add(tagPath);
      }

      const tagTree = buildTagTree(prev.tags, newExpanded);

      return {
        ...prev,
        expandedTags: newExpanded,
        tagTree,
      };
    });
  }, []);

  const clearSelection = useCallback(() => {
    setState((prev) => ({
      ...prev,
      selectedTag: null,
      filteredNotes: [],
    }));
  }, []);

  const refresh = useCallback(() => {
    fetchTags();
  }, [fetchTags]);

  // Fetch tags on mount
  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  return {
    ...state,
    fetchTags,
    selectTag,
    toggleTagExpansion,
    clearSelection,
    refresh,
  };
}
