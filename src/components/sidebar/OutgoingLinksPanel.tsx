import { ArrowUpRight, FileText, ExternalLink, RefreshCw, AlertCircle } from 'lucide-react';
import { cn, generateId } from '../../lib/utils';
import { useStore } from '../../store';
import { useLinks } from '../../hooks/useLinks';
import { fileExists, createNote } from '../../lib/tauri';
import type { LinkInfo } from '../../types/links';

interface OutgoingLinksPanelProps {
  className?: string;
}

export function OutgoingLinksPanel({ className }: OutgoingLinksPanelProps) {
  const activeFilePath = useStore((state) => state.activeFilePath);
  const openFile = useStore((state) => state.openFile);
  const vaultPath = useStore((state) => state.vaultPath);
  const addNotification = useStore((state) => state.addNotification);
  const addFileTreeItem = useStore((state) => state.addFileTreeItem);

  const { outgoingLinks, isLoading, error, refresh } = useLinks(activeFilePath);

  const handleLinkClick = async (path: string, isResolved: boolean) => {
    // Ensure the path has .md extension for opening
    const filePath = path.endsWith('.md') ? path : `${path}.md`;

    // If link is unresolved, create the note first
    if (!isResolved && vaultPath) {
      const exists = await fileExists(filePath);
      if (!exists) {
        try {
          const title = path.endsWith('.md') ? path.slice(0, -3) : path;
          await createNote('/', title);

          // Add to file tree
          addFileTreeItem(
            {
              id: generateId(),
              name: `${title}.md`,
              path: filePath,
              isFolder: false,
            },
            '/'
          );

          addNotification({
            type: 'info',
            message: `Created new note: ${title}`,
          });
          refresh(); // Refresh links to update resolved status
        } catch (err) {
          console.error('Failed to create note:', err);
          addNotification({
            type: 'error',
            message: `Failed to create note: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
          return;
        }
      }
    }

    // Open file using relative path
    openFile(filePath);
  };

  // Extract filename from path for display
  const getFileName = (path: string): string => {
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.md$/, '');
  };

  // Check if link target exists (has a title that's not just the path)
  const isLinkResolved = (link: LinkInfo): boolean => {
    return link.title !== link.path;
  };

  if (!activeFilePath) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <PanelHeader count={0} onRefresh={refresh} isLoading={isLoading} />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-text-muted text-center">
            Open a note to see its outgoing links
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <PanelHeader count={0} onRefresh={refresh} isLoading={isLoading} />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-red-500 text-center">{error}</p>
        </div>
      </div>
    );
  }

  // Separate resolved and unresolved links
  const resolvedLinks = outgoingLinks.filter(isLinkResolved);
  const unresolvedLinks = outgoingLinks.filter((link) => !isLinkResolved(link));

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <PanelHeader count={outgoingLinks.length} onRefresh={refresh} isLoading={isLoading} />

      <div className="flex-1 overflow-y-auto">
        {isLoading && outgoingLinks.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <RefreshCw className="h-4 w-4 animate-spin text-text-muted" />
          </div>
        ) : outgoingLinks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="p-2 space-y-3">
            {/* Resolved links */}
            {resolvedLinks.length > 0 && (
              <div className="space-y-1">
                {resolvedLinks.map((link, index) => (
                  <OutgoingLinkItem
                    key={`resolved-${link.path}-${index}`}
                    link={link}
                    onClick={() => handleLinkClick(link.path, true)}
                    getFileName={getFileName}
                    isResolved={true}
                  />
                ))}
              </div>
            )}

            {/* Unresolved links section */}
            {unresolvedLinks.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 px-2 py-1 text-xs text-text-faint">
                  <AlertCircle className="h-3 w-3" />
                  <span>Unresolved ({unresolvedLinks.length})</span>
                </div>
                {unresolvedLinks.map((link, index) => (
                  <OutgoingLinkItem
                    key={`unresolved-${link.path}-${index}`}
                    link={link}
                    onClick={() => handleLinkClick(link.path, false)}
                    getFileName={getFileName}
                    isResolved={false}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface PanelHeaderProps {
  count: number;
  onRefresh: () => void;
  isLoading: boolean;
}

function PanelHeader({ count, onRefresh, isLoading }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2 border-b border-background-modifier-border">
      <div className="flex items-center gap-2">
        <ArrowUpRight className="h-4 w-4 text-text-muted" />
        <span className="text-sm font-medium text-text-normal">Outgoing Links</span>
        {count > 0 && (
          <span className="text-xs text-text-muted bg-background-modifier-hover px-1.5 py-0.5 rounded">
            {count}
          </span>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={isLoading}
        className={cn(
          'p-1 rounded hover:bg-background-modifier-hover transition-colors',
          'text-text-muted hover:text-text-normal',
          'disabled:opacity-50'
        )}
        aria-label="Refresh outgoing links"
        title="Refresh"
      >
        <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
      </button>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-6 text-center">
      <ArrowUpRight className="h-10 w-10 text-text-faint mb-3" />
      <p className="text-sm text-text-muted mb-1">No outgoing links</p>
      <p className="text-xs text-text-faint">
        Links to other notes will appear here
      </p>
    </div>
  );
}

interface OutgoingLinkItemProps {
  link: LinkInfo;
  onClick: () => void;
  getFileName: (path: string) => string;
  isResolved: boolean;
}

function OutgoingLinkItem({ link, onClick, getFileName, isResolved }: OutgoingLinkItemProps) {
  const displayName = link.title || getFileName(link.path);

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-2 py-1.5 rounded',
        'hover:bg-background-modifier-hover',
        'focus:outline-none focus:ring-1 focus:ring-interactive-accent',
        'transition-colors group'
      )}
    >
      <div className="flex items-start gap-2">
        <FileText
          className={cn(
            'h-4 w-4 shrink-0 mt-0.5',
            isResolved ? 'text-text-muted' : 'text-text-faint'
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span
              className={cn(
                'text-sm truncate',
                isResolved ? 'text-text-normal' : 'text-text-faint italic'
              )}
            >
              {displayName}
            </span>
            <ExternalLink className="h-3 w-3 text-text-faint opacity-0 group-hover:opacity-100 shrink-0" />
          </div>
          {link.link_text && link.link_text !== displayName && (
            <p className="text-xs text-text-muted truncate mt-0.5">
              displayed as: {link.link_text}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
