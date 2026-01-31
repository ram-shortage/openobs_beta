import { useEffect, useState, useCallback } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { cn, getFileNameWithoutExtension } from '../../../lib/utils';
import { readFile } from '../../../lib/tauri';

interface NoteEmbedNodeData {
  path: string;
  title?: string;
  preview?: string;
  onOpenNote?: (path: string) => void;
}

export function NoteEmbedNode({ data, selected }: NodeProps<NoteEmbedNodeData>) {
  const [title, setTitle] = useState(data.title || getFileNameWithoutExtension(data.path));
  const [preview, setPreview] = useState(data.preview || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load note content
  const loadNoteContent = useCallback(async () => {
    if (!data.path) return;

    setIsLoading(true);
    setError(null);

    try {
      const fileContent = await readFile(data.path);
      const content = fileContent.content;

      // Extract title from first heading or use filename
      const headingMatch = content.match(/^#\s+(.+)$/m);
      if (headingMatch) {
        setTitle(headingMatch[1]);
      }

      // Create preview (first 200 characters, excluding frontmatter and heading)
      let previewText = content
        .replace(/^---[\s\S]*?---\n?/, '') // Remove frontmatter
        .replace(/^#\s+.+\n?/, '') // Remove first heading
        .trim()
        .substring(0, 200);

      if (content.length > 200) {
        previewText += '...';
      }

      setPreview(previewText);
    } catch (err) {
      setError('Failed to load note');
      console.error('Failed to load note:', err);
    } finally {
      setIsLoading(false);
    }
  }, [data.path]);

  useEffect(() => {
    loadNoteContent();
  }, [loadNoteContent]);

  const handleClick = useCallback(() => {
    if (data.onOpenNote) {
      data.onOpenNote(data.path);
    }
  }, [data]);

  const handleRefresh = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    loadNoteContent();
  }, [loadNoteContent]);

  return (
    <>
      <NodeResizer
        minWidth={200}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-interactive-accent"
        handleClassName="h-3 w-3 bg-interactive-accent rounded-sm border-2 border-white"
      />
      <div
        className={cn(
          'w-full h-full rounded-lg border-2 overflow-hidden',
          'bg-background-primary border-background-modifier-border',
          'transition-shadow duration-200 cursor-pointer',
          'hover:border-interactive-accent hover:shadow-md',
          selected && 'shadow-lg ring-2 ring-interactive-accent ring-opacity-50'
        )}
        onClick={handleClick}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-background-modifier-border bg-background-secondary">
          <FileText className="h-4 w-4 text-text-muted shrink-0" />
          <span className="text-sm font-medium text-text-normal truncate flex-1">
            {title}
          </span>
          <button
            onClick={handleRefresh}
            className="p-1 rounded hover:bg-background-modifier-hover transition-colors"
            title="Refresh content"
          >
            <RefreshCw className={cn(
              'h-3 w-3 text-text-muted',
              isLoading && 'animate-spin'
            )} />
          </button>
          <ExternalLink className="h-3 w-3 text-text-muted shrink-0" />
        </div>

        {/* Content */}
        <div className="p-3 h-[calc(100%-40px)] overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw className="h-5 w-5 text-text-muted animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : (
            <div className="text-sm text-text-muted leading-relaxed whitespace-pre-wrap break-words">
              {preview || (
                <span className="italic">Empty note</span>
              )}
            </div>
          )}
        </div>

        {/* Footer with path */}
        <div className="absolute bottom-0 left-0 right-0 px-3 py-1 bg-background-secondary/80 backdrop-blur-sm border-t border-background-modifier-border">
          <span className="text-xs text-text-faint truncate block">
            {data.path}
          </span>
        </div>
      </div>
    </>
  );
}

NoteEmbedNode.displayName = 'NoteEmbedNode';
