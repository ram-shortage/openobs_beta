import React, { useCallback, useState } from 'react';
import {
  Files,
  Search,
  GitBranch,
  Tags,
  Settings,
  Plus,
  FolderOpen,
  Calendar,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useStore } from '../../store';
import { FileTree } from './FileTree';
import { SearchPanel } from './SearchPanel';
import { TagsPanel } from './TagsPanel';
import { DailyNotesPanel } from './DailyNotesPanel';
import { GraphView } from '../graph/GraphView';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Modal, ModalFooter } from '../ui/Modal';
import {
  createNote,
  createVaultFolder,
  deleteFile,
  deleteFolder,
  renameFile,
  loadFileTree,
} from '../../lib/tauri';
import { generateId, getFileName, getParentPath } from '../../lib/utils';
import type { ActivePanel } from '../../store/uiStore';

export function Sidebar() {
  // Select individual values to avoid new object reference on each render
  const sidebarOpen = useStore((state) => state.sidebarOpen);
  const sidebarWidth = useStore((state) => state.sidebarWidth);
  const activePanel = useStore((state) => state.activePanel);
  const setActivePanel = useStore((state) => state.setActivePanel);
  const openVaultPicker = useStore((state) => state.openVaultPicker);
  const openSettings = useStore((state) => state.openSettings);

  const vaultName = useStore((state) => state.vaultName);
  const vaultIsOpen = useStore((state) => state.isOpen);
  const fileTree = useStore((state) => state.fileTree);
  const expandedFolders = useStore((state) => state.expandedFolders);
  const setFileTree = useStore((state) => state.setFileTree);
  const addFileTreeItem = useStore((state) => state.addFileTreeItem);
  const removeFileTreeItem = useStore((state) => state.removeFileTreeItem);

  const activeFilePath = useStore((state) => state.activeFilePath);
  const openFile = useStore((state) => state.openFile);
  const closeFile = useStore((state) => state.closeFile);
  const addNotification = useStore((state) => state.addNotification);

  const toggleFolder = useStore((state) => state.toggleFolder);
  const expandFolder = useStore((state) => state.expandFolder);

  // Modal states
  const [showNewNoteModal, setShowNewNoteModal] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentFolderPath, setCurrentFolderPath] = useState('/');
  const [currentItemPath, setCurrentItemPath] = useState('');
  const [currentItemIsFolder, setCurrentItemIsFolder] = useState(false);
  const [newName, setNewName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSelectFile = useCallback(
    (path: string) => {
      openFile(path);
    },
    [openFile]
  );

  const handleCreateNote = useCallback((folderPath: string) => {
    setCurrentFolderPath(folderPath);
    setNewName('');
    setShowNewNoteModal(true);
  }, []);

  const handleCreateFolder = useCallback((folderPath: string) => {
    setCurrentFolderPath(folderPath);
    setNewName('');
    setShowNewFolderModal(true);
  }, []);

  const handleRename = useCallback((path: string) => {
    setCurrentItemPath(path);
    // Find if it's a folder
    const findItem = (items: typeof fileTree, searchPath: string): boolean => {
      for (const item of items) {
        if (item.path === searchPath) return item.isFolder;
        if (item.children) {
          const found = findItem(item.children, searchPath);
          if (found !== undefined) return found;
        }
      }
      return false;
    };
    setCurrentItemIsFolder(findItem(fileTree, path));
    setNewName(getFileName(path).replace(/\.md$/, ''));
    setShowRenameModal(true);
  }, [fileTree]);

  const handleDelete = useCallback((path: string) => {
    setCurrentItemPath(path);
    // Find if it's a folder
    const findItem = (items: typeof fileTree, searchPath: string): boolean => {
      for (const item of items) {
        if (item.path === searchPath) return item.isFolder;
        if (item.children) {
          const found = findItem(item.children, searchPath);
          if (found !== undefined) return found;
        }
      }
      return false;
    };
    setCurrentItemIsFolder(findItem(fileTree, path));
    setShowDeleteModal(true);
  }, [fileTree]);

  const confirmCreateNote = useCallback(async () => {
    if (!newName.trim()) return;
    setIsProcessing(true);

    try {
      const path = await createNote(currentFolderPath, newName.trim());

      // Add to file tree
      addFileTreeItem(
        {
          id: generateId(),
          name: `${newName.trim()}.md`,
          path,
          isFolder: false,
        },
        currentFolderPath
      );

      // Expand parent folder
      if (currentFolderPath && currentFolderPath !== '/') {
        expandFolder(currentFolderPath);
      }

      // Open the new file
      openFile(path);

      addNotification({
        type: 'success',
        message: `Created note: ${newName}`,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        message: `Failed to create note: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsProcessing(false);
      setShowNewNoteModal(false);
    }
  }, [newName, currentFolderPath, addFileTreeItem, expandFolder, openFile, addNotification]);

  const confirmCreateFolder = useCallback(async () => {
    if (!newName.trim()) return;
    setIsProcessing(true);

    try {
      const path = await createVaultFolder(currentFolderPath, newName.trim());

      // Add to file tree
      addFileTreeItem(
        {
          id: generateId(),
          name: newName.trim(),
          path,
          isFolder: true,
          children: [],
        },
        currentFolderPath
      );

      // Expand parent folder
      if (currentFolderPath && currentFolderPath !== '/') {
        expandFolder(currentFolderPath);
      }

      addNotification({
        type: 'success',
        message: `Created folder: ${newName}`,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        message: `Failed to create folder: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsProcessing(false);
      setShowNewFolderModal(false);
    }
  }, [newName, currentFolderPath, addFileTreeItem, expandFolder, addNotification]);

  const confirmRename = useCallback(async () => {
    if (!newName.trim()) return;
    setIsProcessing(true);

    try {
      const parentPath = getParentPath(currentItemPath);
      const extension = currentItemIsFolder ? '' : '.md';
      const newPath = parentPath === '/' || parentPath === ''
        ? `${newName.trim()}${extension}`
        : `${parentPath}/${newName.trim()}${extension}`;

      await renameFile(currentItemPath, newPath);

      // Reload file tree to get updated state
      const tree = await loadFileTree();
      setFileTree(tree);

      // If the renamed file was open, close it and open new path
      if (activeFilePath === currentItemPath) {
        closeFile(currentItemPath);
        if (!currentItemIsFolder) {
          openFile(newPath);
        }
      }

      addNotification({
        type: 'success',
        message: `Renamed to: ${newName}${extension}`,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        message: `Failed to rename: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsProcessing(false);
      setShowRenameModal(false);
    }
  }, [newName, currentItemPath, currentItemIsFolder, setFileTree, activeFilePath, closeFile, openFile, addNotification]);

  const confirmDelete = useCallback(async () => {
    setIsProcessing(true);

    try {
      if (currentItemIsFolder) {
        await deleteFolder(currentItemPath);
      } else {
        await deleteFile(currentItemPath);
      }

      // Remove from file tree
      removeFileTreeItem(currentItemPath);

      // If the deleted file was open, close it
      if (activeFilePath === currentItemPath) {
        closeFile(currentItemPath);
      }

      addNotification({
        type: 'success',
        message: `Deleted: ${getFileName(currentItemPath)}`,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        message: `Failed to delete: ${err instanceof Error ? err.message : String(err)}`,
      });
    } finally {
      setIsProcessing(false);
      setShowDeleteModal(false);
    }
  }, [currentItemPath, currentItemIsFolder, removeFileTreeItem, activeFilePath, closeFile, addNotification]);

  if (!sidebarOpen) {
    return (
      <SidebarRail
        activePanel={activePanel}
        onPanelChange={setActivePanel}
        onOpenVault={openVaultPicker}
        onOpenSettings={openSettings}
      />
    );
  }

  return (
    <>
      <div className="flex h-full">
        {/* Icon rail */}
        <SidebarRail
          activePanel={activePanel}
          onPanelChange={setActivePanel}
          onOpenVault={openVaultPicker}
          onOpenSettings={openSettings}
        />

        {/* Main sidebar content */}
        <div
          className={cn(
            'flex flex-col h-full',
            'bg-background-secondary',
            'border-r border-background-modifier-border'
          )}
          style={{ width: sidebarWidth }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-background-modifier-border">
            <h2 className="text-sm font-semibold text-text-normal truncate">
              {vaultName || 'No vault open'}
            </h2>
            {vaultIsOpen && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="New note"
                onClick={() => handleCreateNote('/')}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Panel content */}
          <div className="flex-1 overflow-y-auto">
            {activePanel === 'files' && (
              <FilesPanel
                vaultIsOpen={vaultIsOpen}
                fileTree={fileTree}
                expandedFolders={expandedFolders}
                selectedPath={activeFilePath}
                onSelectFile={handleSelectFile}
                onToggleFolder={toggleFolder}
                onOpenVault={openVaultPicker}
                onCreateNote={handleCreateNote}
                onCreateFolder={handleCreateFolder}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            )}
            {activePanel === 'search' && <SearchPanel />}
            {activePanel === 'graph' && (
              <GraphPanel
                vaultIsOpen={vaultIsOpen}
                onOpenVault={openVaultPicker}
                onNodeClick={handleSelectFile}
              />
            )}
            {activePanel === 'tags' && <TagsPanel />}
            {activePanel === 'daily' && <DailyNotesPanel />}
          </div>
        </div>
      </div>

      {/* New Note Modal */}
      <Modal
        isOpen={showNewNoteModal}
        onClose={() => setShowNewNoteModal(false)}
        title="New Note"
        size="sm"
      >
        <Input
          label="Note name"
          placeholder="My Note"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && confirmCreateNote()}
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowNewNoteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmCreateNote}
            disabled={!newName.trim() || isProcessing}
          >
            {isProcessing ? 'Creating...' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* New Folder Modal */}
      <Modal
        isOpen={showNewFolderModal}
        onClose={() => setShowNewFolderModal(false)}
        title="New Folder"
        size="sm"
      >
        <Input
          label="Folder name"
          placeholder="My Folder"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && confirmCreateFolder()}
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowNewFolderModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmCreateFolder}
            disabled={!newName.trim() || isProcessing}
          >
            {isProcessing ? 'Creating...' : 'Create'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Rename Modal */}
      <Modal
        isOpen={showRenameModal}
        onClose={() => setShowRenameModal(false)}
        title={`Rename ${currentItemIsFolder ? 'Folder' : 'Note'}`}
        size="sm"
      >
        <Input
          label="New name"
          placeholder={currentItemIsFolder ? 'Folder name' : 'Note name'}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && confirmRename()}
        />
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowRenameModal(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={confirmRename}
            disabled={!newName.trim() || isProcessing}
          >
            {isProcessing ? 'Renaming...' : 'Rename'}
          </Button>
        </ModalFooter>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title={`Delete ${currentItemIsFolder ? 'Folder' : 'Note'}`}
        size="sm"
      >
        <p className="text-sm text-text-normal">
          Are you sure you want to delete{' '}
          <strong>{getFileName(currentItemPath)}</strong>?
          {currentItemIsFolder && ' This will delete all files inside.'}
        </p>
        <p className="text-xs text-text-muted mt-2">
          This action cannot be undone.
        </p>
        <ModalFooter>
          <Button variant="ghost" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={confirmDelete}
            disabled={isProcessing}
          >
            {isProcessing ? 'Deleting...' : 'Delete'}
          </Button>
        </ModalFooter>
      </Modal>
    </>
  );
}

interface SidebarRailProps {
  activePanel: ActivePanel;
  onPanelChange: (panel: ActivePanel) => void;
  onOpenVault: () => void;
  onOpenSettings: () => void;
}

function SidebarRail({ activePanel, onPanelChange, onOpenVault, onOpenSettings }: SidebarRailProps) {
  const panels: { id: ActivePanel; icon: React.ReactNode; label: string }[] = [
    { id: 'files', icon: <Files className="h-5 w-5" />, label: 'Files' },
    { id: 'search', icon: <Search className="h-5 w-5" />, label: 'Search' },
    { id: 'daily', icon: <Calendar className="h-5 w-5" />, label: 'Daily Notes' },
    { id: 'graph', icon: <GitBranch className="h-5 w-5" />, label: 'Graph' },
    { id: 'tags', icon: <Tags className="h-5 w-5" />, label: 'Tags' },
  ];

  return (
    <div
      className={cn(
        'flex flex-col items-center py-2 gap-1',
        'bg-background-primary',
        'border-r border-background-modifier-border'
      )}
    >
      {panels.map((panel) => (
        <button
          key={panel.id}
          className={cn(
            'p-2 rounded-md transition-colors',
            'hover:bg-background-modifier-hover',
            activePanel === panel.id
              ? 'text-interactive-accent bg-background-modifier-active'
              : 'text-text-muted'
          )}
          onClick={() => onPanelChange(panel.id)}
          aria-label={panel.label}
          title={panel.label}
        >
          {panel.icon}
        </button>
      ))}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Settings button */}
      <button
        className={cn(
          'p-2 rounded-md transition-colors',
          'hover:bg-background-modifier-hover',
          'text-text-muted'
        )}
        onClick={onOpenVault}
        aria-label="Open vault"
        title="Open vault"
      >
        <FolderOpen className="h-5 w-5" />
      </button>

      <button
        className={cn(
          'p-2 rounded-md transition-colors',
          'hover:bg-background-modifier-hover',
          'text-text-muted'
        )}
        onClick={onOpenSettings}
        aria-label="Settings"
        title="Settings"
      >
        <Settings className="h-5 w-5" />
      </button>
    </div>
  );
}

interface FilesPanelProps {
  vaultIsOpen: boolean;
  fileTree: import('../../types').FileTreeItem[];
  expandedFolders: Set<string>;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onToggleFolder: (path: string) => void;
  onOpenVault: () => void;
  onCreateNote: (folderPath: string) => void;
  onCreateFolder: (folderPath: string) => void;
  onRename: (path: string) => void;
  onDelete: (path: string) => void;
}

function FilesPanel({
  vaultIsOpen,
  fileTree,
  expandedFolders,
  selectedPath,
  onSelectFile,
  onToggleFolder,
  onOpenVault,
  onCreateNote,
  onCreateFolder,
  onRename,
  onDelete,
}: FilesPanelProps) {
  if (!vaultIsOpen) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <FolderOpen className="h-12 w-12 text-text-muted mb-4" />
        <p className="text-sm text-text-muted mb-4">No vault is currently open</p>
        <Button variant="primary" onClick={onOpenVault} leftIcon={<FolderOpen className="h-4 w-4" />}>
          Open Vault
        </Button>
      </div>
    );
  }

  if (fileTree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <Files className="h-12 w-12 text-text-muted mb-4" />
        <p className="text-sm text-text-muted mb-2">This vault is empty</p>
        <p className="text-xs text-text-faint">Create your first note to get started</p>
      </div>
    );
  }

  return (
    <div className="py-2" role="tree">
      <FileTree
        items={fileTree}
        expandedFolders={expandedFolders}
        selectedPath={selectedPath}
        onSelectFile={onSelectFile}
        onToggleFolder={onToggleFolder}
        onCreateNote={onCreateNote}
        onCreateFolder={onCreateFolder}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  );
}

interface GraphPanelProps {
  vaultIsOpen: boolean;
  onOpenVault: () => void;
  onNodeClick: (path: string) => void;
}

function GraphPanel({ vaultIsOpen, onOpenVault, onNodeClick }: GraphPanelProps) {
  if (!vaultIsOpen) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <GitBranch className="h-12 w-12 text-text-muted mb-4" />
        <p className="text-sm text-text-muted mb-4">No vault is currently open</p>
        <Button variant="primary" onClick={onOpenVault} leftIcon={<FolderOpen className="h-4 w-4" />}>
          Open Vault
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[400px]">
      <GraphView onNodeClick={onNodeClick} />
    </div>
  );
}

// TagsPanel is now imported from './TagsPanel'
// DailyNotesPanel is now imported from './DailyNotesPanel'
