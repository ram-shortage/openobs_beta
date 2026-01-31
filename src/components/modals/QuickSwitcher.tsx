import React, { useEffect, useCallback, useRef, useState } from 'react';
import { Search, FileText, Clock, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { useFuzzySearch, type SearchResult } from '../../hooks/useSearch';

/**
 * Extracts filename from a full path
 */
function getFileName(path: string): string {
  const parts = path.split('/');
  return parts[parts.length - 1]?.replace(/\.md$/, '') || path;
}

/**
 * Gets the directory path without the filename
 */
function getDirectoryPath(path: string): string {
  const parts = path.split('/');
  parts.pop(); // Remove filename
  const dir = parts.join('/');
  return dir || '/';
}

interface QuickSwitcherItemProps {
  result: SearchResult;
  isSelected: boolean;
  isRecent?: boolean;
  onClick: () => void;
}

function QuickSwitcherItem({ result, isSelected, isRecent, onClick }: QuickSwitcherItemProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // Scroll into view when selected
  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <button
      ref={ref}
      className={cn(
        'w-full text-left px-4 py-2 flex items-center gap-3',
        'transition-colors',
        isSelected
          ? 'bg-interactive-accent text-white'
          : 'hover:bg-background-modifier-hover'
      )}
      onClick={onClick}
    >
      {isRecent ? (
        <Clock className={cn('h-4 w-4 shrink-0', isSelected ? 'text-white/70' : 'text-text-muted')} />
      ) : (
        <FileText className={cn('h-4 w-4 shrink-0', isSelected ? 'text-white/70' : 'text-text-muted')} />
      )}
      <div className="min-w-0 flex-1">
        <div className={cn('font-medium truncate', isSelected ? 'text-white' : 'text-text-normal')}>
          {result.title || getFileName(result.path)}
        </div>
        <div className={cn('text-xs truncate', isSelected ? 'text-white/60' : 'text-text-faint')}>
          {getDirectoryPath(result.path)}
        </div>
      </div>
    </button>
  );
}

export function QuickSwitcher() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const quickSwitcherOpen = useStore((state) => state.quickSwitcherOpen);
  const closeQuickSwitcher = useStore((state) => state.closeQuickSwitcher);
  const openFiles = useStore((state) => state.openFiles);
  const openFile = useStore((state) => state.openFile);

  const { query, results, isLoading, search, clearSearch } = useFuzzySearch();

  // Build list of items to show
  // When no query, show recent files first
  const recentFiles: SearchResult[] = openFiles
    .filter((f) => f.note)
    .map((f) => ({
      path: f.path,
      title: f.note?.metadata.title || getFileName(f.path),
      snippet: '',
    }));

  const displayItems = query.trim()
    ? results
    : recentFiles.slice(0, 10);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results, query]);

  // Focus input when modal opens
  useEffect(() => {
    if (quickSwitcherOpen) {
      // Small delay to ensure modal is rendered
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    } else {
      clearSearch();
      setSelectedIndex(0);
    }
  }, [quickSwitcherOpen, clearSearch]);

  const handleSelect = useCallback(
    (path: string) => {
      openFile(path);
      closeQuickSwitcher();
    },
    [openFile, closeQuickSwitcher]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < displayItems.length - 1 ? prev + 1 : prev
          );
          break;

        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
          break;

        case 'Enter':
          e.preventDefault();
          if (displayItems[selectedIndex]) {
            handleSelect(displayItems[selectedIndex].path);
          }
          break;

        case 'Escape':
          e.preventDefault();
          closeQuickSwitcher();
          break;

        case 'Tab':
          // Prevent tab from moving focus
          e.preventDefault();
          break;
      }
    },
    [displayItems, selectedIndex, handleSelect, closeQuickSwitcher]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      search(e.target.value);
    },
    [search]
  );

  const handleOverlayClick = useCallback(() => {
    closeQuickSwitcher();
  }, [closeQuickSwitcher]);

  const handleContentClick = useCallback((e: React.MouseEvent) => {
    // Prevent clicks inside the modal from closing it
    e.stopPropagation();
  }, []);

  if (!quickSwitcherOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={handleOverlayClick}
    >
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Modal content */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Quick switcher"
        className={cn(
          'relative z-10 w-full max-w-xl mx-4',
          'bg-background-primary rounded-lg shadow-2xl',
          'border border-background-modifier-border',
          'animate-in fade-in-0 zoom-in-95 duration-150',
          'overflow-hidden'
        )}
        onClick={handleContentClick}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-background-modifier-border">
          {isLoading ? (
            <Loader2 className="h-5 w-5 text-text-muted animate-spin shrink-0" />
          ) : (
            <Search className="h-5 w-5 text-text-muted shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            placeholder="Type to search for notes..."
            value={query}
            onChange={handleInputChange}
            className={cn(
              'flex-1 bg-transparent text-text-normal',
              'placeholder:text-text-faint',
              'outline-none border-none',
              'text-base'
            )}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
        </div>

        {/* Results list */}
        <div className="max-h-[50vh] overflow-y-auto">
          {displayItems.length === 0 && !query && (
            <div className="px-4 py-8 text-center text-text-muted">
              <p>No recent files</p>
              <p className="text-xs mt-1">Start typing to search</p>
            </div>
          )}

          {displayItems.length === 0 && query && !isLoading && (
            <div className="px-4 py-8 text-center text-text-muted">
              No results found for "{query}"
            </div>
          )}

          {displayItems.length > 0 && (
            <div className="py-2">
              {!query && recentFiles.length > 0 && (
                <div className="px-4 py-1 text-xs text-text-faint uppercase tracking-wider">
                  Recent Files
                </div>
              )}
              {displayItems.map((item, index) => (
                <QuickSwitcherItem
                  key={item.path}
                  result={item}
                  isSelected={index === selectedIndex}
                  isRecent={!query && index < recentFiles.length}
                  onClick={() => handleSelect(item.path)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer with keyboard hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-background-modifier-border bg-background-secondary/50">
          <div className="flex items-center gap-1 text-xs text-text-faint">
            <kbd className="px-1.5 py-0.5 rounded bg-background-modifier-border font-mono">
              ↑↓
            </kbd>
            <span>navigate</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-faint">
            <kbd className="px-1.5 py-0.5 rounded bg-background-modifier-border font-mono">
              ↵
            </kbd>
            <span>open</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-text-faint">
            <kbd className="px-1.5 py-0.5 rounded bg-background-modifier-border font-mono">
              esc
            </kbd>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
