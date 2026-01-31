import React, { useCallback } from 'react';
import { Tags, ChevronRight, ChevronDown, FileText, X, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTags, type TagTreeNode } from '../../hooks/useTags';
import { useStore } from '../../store';
import { Spinner } from '../ui/Spinner';
import { Button } from '../ui/Button';

export function TagsPanel() {
  const {
    tagTree,
    total,
    isLoading,
    error,
    selectedTag,
    filteredNotes,
    selectTag,
    toggleTagExpansion,
    clearSelection,
    refresh,
  } = useTags();

  const openFile = useStore((state) => state.openFile);

  const handleNoteClick = useCallback((path: string) => {
    openFile(path);
  }, [openFile]);

  if (isLoading && tagTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <Spinner size="md" label="Loading tags..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Tags className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-sm text-red-500 mb-2">Failed to load tags</p>
        <p className="text-xs text-text-faint mb-4">{error}</p>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (tagTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Tags className="h-12 w-12 text-text-muted mb-4" />
        <p className="text-sm text-text-muted">No tags yet</p>
        <p className="text-xs text-text-faint mt-1">Tags from your notes will appear here</p>
      </div>
    );
  }

  // Show filtered notes view when a tag is selected
  // Defensive check: ensure filteredNotes is an array
  const safeFilteredNotes = Array.isArray(filteredNotes) ? filteredNotes : [];

  if (selectedTag) {
    return (
      <div className="flex flex-col h-full">
        {/* Header with back button */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-background-modifier-border">
          <button
            onClick={clearSelection}
            className="p-1 rounded hover:bg-background-modifier-hover text-text-muted"
            aria-label="Back to tags"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-normal truncate">#{selectedTag}</p>
            <p className="text-xs text-text-faint">
              {safeFilteredNotes.length} {safeFilteredNotes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
        </div>

        {/* Filtered notes list */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : safeFilteredNotes.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-4">No notes found</p>
          ) : (
            <div className="space-y-0.5">
              {safeFilteredNotes.map((note) => (
                <button
                  key={note.path}
                  onClick={() => handleNoteClick(note.path)}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-1.5 text-left',
                    'hover:bg-background-modifier-hover',
                    'text-sm text-text-normal',
                    'transition-colors'
                  )}
                >
                  <FileText className="h-4 w-4 text-text-muted shrink-0" />
                  <span className="truncate">{note.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-background-modifier-border">
        <p className="text-xs text-text-faint">
          {total} {total === 1 ? 'tag' : 'tags'}
        </p>
        <button
          onClick={refresh}
          className={cn(
            'p-1 rounded hover:bg-background-modifier-hover text-text-muted',
            isLoading && 'animate-spin'
          )}
          aria-label="Refresh tags"
          disabled={isLoading}
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Tag tree */}
      <div className="flex-1 overflow-y-auto py-2" role="tree">
        {tagTree.map((node) => (
          <TagTreeItem
            key={node.fullPath}
            node={node}
            depth={0}
            onSelect={selectTag}
            onToggle={toggleTagExpansion}
          />
        ))}
      </div>
    </div>
  );
}

interface TagTreeItemProps {
  node: TagTreeNode;
  depth: number;
  onSelect: (tag: string) => void;
  onToggle: (tagPath: string) => void;
}

function TagTreeItem({ node, depth, onSelect, onToggle }: TagTreeItemProps) {
  const hasChildren = node.children.length > 0;
  const paddingLeft = 12 + depth * 16;

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.fullPath);
  }, [node.fullPath, onSelect]);

  const handleToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.fullPath);
  }, [node.fullPath, onToggle]);

  return (
    <div role="treeitem" aria-expanded={hasChildren ? node.isExpanded : undefined}>
      <div
        className={cn(
          'flex items-center gap-1 py-1 pr-2 cursor-pointer',
          'hover:bg-background-modifier-hover',
          'text-sm text-text-normal',
          'transition-colors'
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            onClick={handleToggle}
            className="p-0.5 rounded hover:bg-background-modifier-active text-text-muted"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-4" /> // Spacer for alignment
        )}

        {/* Tag icon */}
        <Tags className="h-3.5 w-3.5 text-interactive-accent shrink-0" />

        {/* Tag name */}
        <span className="flex-1 truncate">{node.name}</span>

        {/* Count badge */}
        {node.count > 0 && (
          <span className="text-xs text-text-faint bg-background-modifier-active px-1.5 py-0.5 rounded">
            {node.count}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && node.isExpanded && (
        <div role="group">
          {node.children.map((child) => (
            <TagTreeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
