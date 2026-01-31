import { Link2, FileText, ExternalLink, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { useLinks } from '../../hooks/useLinks';
import type { LinkInfo } from '../../types/links';

interface BacklinksPanelProps {
  className?: string;
}

export function BacklinksPanel({ className }: BacklinksPanelProps) {
  const activeFilePath = useStore((state) => state.activeFilePath);
  const openFile = useStore((state) => state.openFile);

  const { backlinks, isLoading, error, refresh } = useLinks(activeFilePath);

  const handleLinkClick = (path: string) => {
    // Ensure the path has .md extension for opening
    const filePath = path.endsWith('.md') ? path : `${path}.md`;
    openFile(filePath);
  };

  // Extract filename from path for display
  const getFileName = (path: string): string => {
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.md$/, '');
  };

  if (!activeFilePath) {
    return (
      <div className={cn('flex flex-col h-full', className)}>
        <PanelHeader count={0} onRefresh={refresh} isLoading={isLoading} />
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-sm text-text-muted text-center">
            Open a note to see its backlinks
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

  return (
    <div className={cn('flex flex-col h-full', className)}>
      <PanelHeader count={backlinks.length} onRefresh={refresh} isLoading={isLoading} />

      <div className="flex-1 overflow-y-auto">
        {isLoading && backlinks.length === 0 ? (
          <div className="flex items-center justify-center p-4">
            <RefreshCw className="h-4 w-4 animate-spin text-text-muted" />
          </div>
        ) : backlinks.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="p-2 space-y-1">
            {backlinks.map((link, index) => (
              <BacklinkItem
                key={`${link.path}-${index}`}
                link={link}
                onClick={() => handleLinkClick(link.path)}
                getFileName={getFileName}
              />
            ))}
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
        <Link2 className="h-4 w-4 text-text-muted" />
        <span className="text-sm font-medium text-text-normal">Backlinks</span>
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
        aria-label="Refresh backlinks"
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
      <Link2 className="h-10 w-10 text-text-faint mb-3" />
      <p className="text-sm text-text-muted mb-1">No backlinks</p>
      <p className="text-xs text-text-faint">
        Other notes that link to this one will appear here
      </p>
    </div>
  );
}

interface BacklinkItemProps {
  link: LinkInfo;
  onClick: () => void;
  getFileName: (path: string) => string;
}

function BacklinkItem({ link, onClick, getFileName }: BacklinkItemProps) {
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
        <FileText className="h-4 w-4 text-text-muted shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm text-text-normal truncate">{displayName}</span>
            <ExternalLink className="h-3 w-3 text-text-faint opacity-0 group-hover:opacity-100 shrink-0" />
          </div>
          {link.link_text && link.link_text !== displayName && (
            <p className="text-xs text-text-muted truncate mt-0.5">
              via: {link.link_text}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}
