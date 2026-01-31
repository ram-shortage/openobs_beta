import React from 'react';
import { PanelLeftClose, PanelLeftOpen, Link2, ArrowUpRight, List, FileText, PanelRightClose } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store';
import { Sidebar } from './sidebar/Sidebar';
import { BacklinksPanel } from './sidebar/BacklinksPanel';
import { OutgoingLinksPanel } from './sidebar/OutgoingLinksPanel';
import { Button } from './ui/Button';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  // Select individual values to avoid new object reference on each render
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const toggleSidebar = useStore((state) => state.toggleSidebar);
  const rightSidebarOpen = useStore((state) => state.rightSidebarOpen);
  const rightSidebarWidth = useStore((state) => state.rightSidebarWidth);
  const statusBarVisible = useStore((state) => state.statusBarVisible);
  const activeFilePath = useStore((state) => state.activeFilePath);
  const openFiles = useStore((state) => state.openFiles);
  const cursorPosition = useStore((state) => state.cursorPosition);

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  return (
    <div className="flex h-screen bg-background-primary text-text-normal overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Top bar / Tabs */}
        <TopBar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          activeFilePath={activeFilePath}
          openFiles={openFiles}
        />

        {/* Editor / Content */}
        <main className="flex-1 overflow-hidden">
          {children}
        </main>

        {/* Status bar */}
        {statusBarVisible && (
          <StatusBar
            activeFile={activeFile}
            cursorPosition={cursorPosition}
          />
        )}
      </div>

      {/* Right sidebar (for backlinks, outline, etc.) */}
      {rightSidebarOpen && (
        <div
          className={cn(
            'h-full',
            'bg-background-secondary',
            'border-l border-background-modifier-border'
          )}
          style={{ width: rightSidebarWidth }}
        >
          <RightSidebar />
        </div>
      )}
    </div>
  );
}

interface TopBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  activeFilePath: string | null;
  openFiles: Array<{ path: string; note: any; isLoading: boolean }>;
}

function TopBar({
  sidebarOpen,
  onToggleSidebar,
  activeFilePath,
  openFiles,
}: TopBarProps) {
  const setActiveFile = useStore((state) => state.setActiveFile);
  const closeFile = useStore((state) => state.closeFile);

  return (
    <div
      className={cn(
        'flex items-center h-10',
        'bg-background-secondary',
        'border-b border-background-modifier-border',
        'select-none'
      )}
    >
      {/* Sidebar toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        className="h-10 w-10 rounded-none shrink-0"
        aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
      >
        {sidebarOpen ? (
          <PanelLeftClose className="h-4 w-4" />
        ) : (
          <PanelLeftOpen className="h-4 w-4" />
        )}
      </Button>

      {/* Tabs */}
      <div className="flex-1 flex items-center overflow-x-auto no-scrollbar">
        {openFiles.map((file) => (
          <Tab
            key={file.path}
            path={file.path}
            isActive={file.path === activeFilePath}
            isDirty={file.note?.isDirty || false}
            onClick={() => setActiveFile(file.path)}
            onClose={() => closeFile(file.path)}
          />
        ))}
      </div>
    </div>
  );
}

interface TabProps {
  path: string;
  isActive: boolean;
  isDirty: boolean;
  onClick: () => void;
  onClose: () => void;
}

function Tab({ path, isActive, isDirty, onClick, onClose }: TabProps) {
  // Extract filename from path
  const fileName = path.split('/').pop()?.replace(/\.md$/, '') || path;

  return (
    <div
      className={cn(
        'flex items-center gap-1 px-3 h-full cursor-pointer group',
        'text-sm border-r border-background-modifier-border',
        'transition-colors',
        isActive
          ? 'bg-background-primary text-text-normal'
          : 'bg-background-secondary text-text-muted hover:bg-background-modifier-hover'
      )}
      onClick={onClick}
    >
      <span className="truncate max-w-[120px]">{fileName}</span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full bg-interactive-accent" />
      )}
      <button
        className={cn(
          'ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100',
          'hover:bg-background-modifier-hover',
          'transition-opacity'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Close tab"
      >
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}

interface StatusBarProps {
  activeFile: { path: string; note: any } | undefined;
  cursorPosition: { line: number; column: number };
}

function StatusBar({ activeFile, cursorPosition }: StatusBarProps) {
  const editorMode = useStore((state) => state.editorMode);
  const toggleEditorMode = useStore((state) => state.toggleEditorMode);

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 h-6',
        'bg-background-secondary',
        'border-t border-background-modifier-border',
        'text-xs text-text-muted'
      )}
    >
      <div className="flex items-center gap-4">
        {activeFile && (
          <>
            <span>
              Ln {cursorPosition.line}, Col {cursorPosition.column}
            </span>
            {activeFile.note?.isDirty && (
              <span className="text-interactive-accent">Modified</span>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4">
        <button
          className="hover:text-text-normal transition-colors"
          onClick={toggleEditorMode}
        >
          {editorMode === 'edit' && 'Editing'}
          {editorMode === 'preview' && 'Reading'}
          {editorMode === 'split' && 'Live Preview'}
        </button>
      </div>
    </div>
  );
}

type RightPanelType = 'backlinks' | 'outgoing' | 'outline' | 'properties' | null;

function RightSidebar() {
  const rightActivePanel = useStore((state) => state.rightActivePanel);
  const setRightActivePanel = useStore((state) => state.setRightActivePanel);
  const toggleRightSidebar = useStore((state) => state.toggleRightSidebar);

  // Default to backlinks if no panel is selected
  const activePanel = rightActivePanel || 'backlinks';

  const panels: { id: RightPanelType; icon: React.ReactNode; label: string }[] = [
    { id: 'backlinks', icon: <Link2 className="h-4 w-4" />, label: 'Backlinks' },
    { id: 'outgoing', icon: <ArrowUpRight className="h-4 w-4" />, label: 'Outgoing Links' },
    { id: 'outline', icon: <List className="h-4 w-4" />, label: 'Outline' },
    { id: 'properties', icon: <FileText className="h-4 w-4" />, label: 'Properties' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar */}
      <div className="flex items-center border-b border-background-modifier-border">
        <div className="flex-1 flex items-center overflow-x-auto no-scrollbar">
          {panels.map((panel) => (
            <button
              key={panel.id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                'hover:bg-background-modifier-hover',
                'focus:outline-none focus-visible:ring-1 focus-visible:ring-interactive-accent',
                activePanel === panel.id
                  ? 'text-text-normal border-b-2 border-interactive-accent -mb-px'
                  : 'text-text-muted'
              )}
              onClick={() => setRightActivePanel(panel.id)}
              title={panel.label}
            >
              {panel.icon}
              <span className="hidden sm:inline">{panel.label}</span>
            </button>
          ))}
        </div>
        <button
          className={cn(
            'p-2 hover:bg-background-modifier-hover transition-colors',
            'text-text-muted hover:text-text-normal'
          )}
          onClick={toggleRightSidebar}
          aria-label="Close right sidebar"
          title="Close sidebar"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {activePanel === 'backlinks' && <BacklinksPanel />}
        {activePanel === 'outgoing' && <OutgoingLinksPanel />}
        {activePanel === 'outline' && <OutlinePanel />}
        {activePanel === 'properties' && <PropertiesPanel />}
      </div>
    </div>
  );
}

function OutlinePanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <List className="h-10 w-10 text-text-faint mb-3" />
      <p className="text-sm text-text-muted">Document outline</p>
      <p className="text-xs text-text-faint mt-1">Headings will appear here</p>
    </div>
  );
}

function PropertiesPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-4 text-center">
      <FileText className="h-10 w-10 text-text-faint mb-3" />
      <p className="text-sm text-text-muted">Note properties</p>
      <p className="text-xs text-text-faint mt-1">Frontmatter and metadata will appear here</p>
    </div>
  );
}
