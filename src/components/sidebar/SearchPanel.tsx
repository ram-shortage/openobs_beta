import React, { useCallback } from 'react';
import { Search, FileText, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useSearch } from '../../hooks/useSearch';
import { useStore } from '../../store';
import { Input } from '../ui/Input';

/**
 * Highlights matching text in a snippet using <mark> tags from the backend
 */
function HighlightedSnippet({ snippet }: { snippet: string }) {
  // The backend wraps matches with <mark></mark> tags
  // We need to safely render this HTML
  const parts: React.ReactNode[] = [];
  let key = 0;

  // Parse <mark>...</mark> tags
  const markRegex = /<mark>(.*?)<\/mark>/g;
  let lastIndex = 0;
  let match;

  while ((match = markRegex.exec(snippet)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(
        <span key={key++}>{snippet.slice(lastIndex, match.index)}</span>
      );
    }

    // Add the highlighted match
    parts.push(
      <mark
        key={key++}
        className="bg-interactive-accent/30 text-text-normal rounded px-0.5"
      >
        {match[1]}
      </mark>
    );

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < snippet.length) {
    parts.push(<span key={key++}>{snippet.slice(lastIndex)}</span>);
  }

  // If no matches found, just return the snippet as-is
  if (parts.length === 0) {
    return <span>{snippet}</span>;
  }

  return <>{parts}</>;
}

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
  return parts.join('/') || '/';
}

export function SearchPanel() {
  const { query, results, total, isLoading, error, search, clearSearch } = useSearch(300);
  const openFile = useStore((state) => state.openFile);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      search(e.target.value);
    },
    [search]
  );

  const handleResultClick = useCallback(
    (path: string) => {
      openFile(path);
    },
    [openFile]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Escape') {
        clearSearch();
        (e.target as HTMLInputElement).blur();
      }
    },
    [clearSearch]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Search input */}
      <div className="p-4 border-b border-background-modifier-border">
        <Input
          placeholder="Search notes..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          leftIcon={
            isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )
          }
          autoFocus
        />
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto">
        {/* Error state */}
        {error && (
          <div className="p-4 text-sm text-red-500">
            {error}
          </div>
        )}

        {/* No query state */}
        {!query && !error && (
          <div className="p-4 text-sm text-text-muted text-center">
            Enter a search query to find notes
          </div>
        )}

        {/* No results state */}
        {query && !isLoading && results.length === 0 && !error && (
          <div className="p-4 text-sm text-text-muted text-center">
            No results found for "{query}"
          </div>
        )}

        {/* Results list */}
        {results.length > 0 && (
          <>
            {/* Result count */}
            <div className="px-4 py-2 text-xs text-text-faint border-b border-background-modifier-border">
              {total} {total === 1 ? 'result' : 'results'} found
            </div>

            {/* Results */}
            <ul className="divide-y divide-background-modifier-border">
              {results.map((result) => (
                <li key={result.path}>
                  <button
                    className={cn(
                      'w-full text-left px-4 py-3',
                      'hover:bg-background-modifier-hover',
                      'focus:outline-none focus:bg-background-modifier-hover',
                      'transition-colors'
                    )}
                    onClick={() => handleResultClick(result.path)}
                  >
                    {/* File name */}
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-text-muted shrink-0" />
                      <span className="font-medium text-text-normal truncate">
                        {result.title || getFileName(result.path)}
                      </span>
                    </div>

                    {/* Path */}
                    <div className="text-xs text-text-faint truncate ml-6 mb-1">
                      {getDirectoryPath(result.path)}
                    </div>

                    {/* Snippet with highlighted matches */}
                    {result.snippet && (
                      <div className="text-sm text-text-muted ml-6 line-clamp-2">
                        <HighlightedSnippet snippet={result.snippet} />
                      </div>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
