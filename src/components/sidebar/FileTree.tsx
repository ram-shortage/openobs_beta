import React, { useState, useCallback } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
  MoreHorizontal,
  FilePlus,
  FolderPlus,
  Trash2,
  Pencil,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { FileTreeItem } from '../../types';

export interface FileTreeProps {
  items: FileTreeItem[];
  expandedFolders: Set<string>;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
  onCreateNote?: (folderPath: string) => void;
  onCreateFolder?: (folderPath: string) => void;
  onRename?: (path: string) => void;
  onDelete?: (path: string) => void;
  level?: number;
}

export function FileTree({
  items,
  expandedFolders,
  selectedPath,
  onSelectFile,
  onToggleFolder,
  onCreateNote,
  onCreateFolder,
  onRename,
  onDelete,
  level = 0,
}: FileTreeProps) {
  return (
    <div className="select-none">
      {items.map((item) => (
        <FileTreeNode
          key={item.id}
          item={item}
          expandedFolders={expandedFolders}
          selectedPath={selectedPath}
          onSelectFile={onSelectFile}
          onToggleFolder={onToggleFolder}
          onCreateNote={onCreateNote}
          onCreateFolder={onCreateFolder}
          onRename={onRename}
          onDelete={onDelete}
          level={level}
        />
      ))}
    </div>
  );
}

interface FileTreeNodeProps extends Omit<FileTreeProps, 'items'> {
  item: FileTreeItem;
}

function FileTreeNode({
  item,
  expandedFolders,
  selectedPath,
  onSelectFile,
  onToggleFolder,
  onCreateNote,
  onCreateFolder,
  onRename,
  onDelete,
  level = 0,
}: FileTreeNodeProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });

  const isExpanded = expandedFolders.has(item.path);
  const isSelected = selectedPath === item.path;

  const handleClick = useCallback(() => {
    if (item.isFolder) {
      onToggleFolder(item.path);
    } else {
      onSelectFile(item.path);
    }
  }, [item, onSelectFile, onToggleFolder]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  const handleContextMenuAction = useCallback(
    (action: string) => {
      setShowContextMenu(false);
      switch (action) {
        case 'new-note':
          onCreateNote?.(item.isFolder ? item.path : '/');
          break;
        case 'new-folder':
          onCreateFolder?.(item.isFolder ? item.path : '/');
          break;
        case 'rename':
          onRename?.(item.path);
          break;
        case 'delete':
          onDelete?.(item.path);
          break;
      }
    },
    [item, onCreateNote, onCreateFolder, onRename, onDelete]
  );

  // Close context menu on outside click
  React.useEffect(() => {
    const handleClickOutside = () => setShowContextMenu(false);
    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  const paddingLeft = level * 16 + 8;

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 py-1 px-2 cursor-pointer group',
          'text-sm text-text-normal',
          'hover:bg-background-modifier-hover',
          'transition-colors duration-100',
          isSelected && 'bg-background-modifier-active text-text-accent'
        )}
        style={{ paddingLeft }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        role="treeitem"
        aria-selected={isSelected}
        aria-expanded={item.isFolder ? isExpanded : undefined}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {/* Expand/collapse icon for folders */}
        {item.isFolder ? (
          <span className="shrink-0 w-4 h-4 flex items-center justify-center text-text-muted">
            {isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        {/* File/folder icon */}
        <span className="shrink-0 text-text-muted">
          {item.isFolder ? (
            isExpanded ? (
              <FolderOpen className="h-4 w-4" />
            ) : (
              <Folder className="h-4 w-4" />
            )
          ) : (
            <File className="h-4 w-4" />
          )}
        </span>

        {/* Name */}
        <span className="truncate flex-1">{item.name.replace(/\.md$/, '')}</span>

        {/* Context menu trigger */}
        <button
          className={cn(
            'shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100',
            'hover:bg-background-modifier-hover',
            'focus:opacity-100 focus:outline-none'
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleContextMenu(e);
          }}
          aria-label="More options"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-text-muted" />
        </button>
      </div>

      {/* Children (for folders) */}
      {item.isFolder && isExpanded && item.children && (
        <div role="group">
          <FileTree
            items={item.children}
            expandedFolders={expandedFolders}
            selectedPath={selectedPath}
            onSelectFile={onSelectFile}
            onToggleFolder={onToggleFolder}
            onCreateNote={onCreateNote}
            onCreateFolder={onCreateFolder}
            onRename={onRename}
            onDelete={onDelete}
            level={level + 1}
          />
        </div>
      )}

      {/* Context menu */}
      {showContextMenu && (
        <ContextMenu
          position={contextMenuPosition}
          isFolder={item.isFolder}
          onAction={handleContextMenuAction}
        />
      )}
    </div>
  );
}

interface ContextMenuProps {
  position: { x: number; y: number };
  isFolder: boolean;
  onAction: (action: string) => void;
}

function ContextMenu({ position, isFolder, onAction }: ContextMenuProps) {
  return (
    <div
      className={cn(
        'fixed z-50 min-w-[160px]',
        'bg-background-primary border border-background-modifier-border',
        'rounded-md shadow-lg py-1',
        'animate-in fade-in-0 zoom-in-95 duration-100'
      )}
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      {isFolder && (
        <>
          <ContextMenuItem
            icon={<FilePlus className="h-4 w-4" />}
            label="New note"
            onClick={() => onAction('new-note')}
          />
          <ContextMenuItem
            icon={<FolderPlus className="h-4 w-4" />}
            label="New folder"
            onClick={() => onAction('new-folder')}
          />
          <div className="h-px bg-background-modifier-border my-1" />
        </>
      )}
      <ContextMenuItem
        icon={<Pencil className="h-4 w-4" />}
        label="Rename"
        onClick={() => onAction('rename')}
      />
      <ContextMenuItem
        icon={<Trash2 className="h-4 w-4" />}
        label="Delete"
        onClick={() => onAction('delete')}
        destructive
      />
    </div>
  );
}

interface ContextMenuItemProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function ContextMenuItem({
  icon,
  label,
  onClick,
  destructive,
}: ContextMenuItemProps) {
  return (
    <button
      className={cn(
        'w-full flex items-center gap-2 px-3 py-1.5 text-sm',
        'hover:bg-background-modifier-hover',
        'transition-colors duration-100',
        destructive ? 'text-red-500' : 'text-text-normal'
      )}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}
