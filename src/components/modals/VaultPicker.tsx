import React, { useState, useCallback, useEffect } from 'react';
import { FolderOpen, Plus, Trash2, Clock } from 'lucide-react';
import { Modal, ModalFooter } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { useStore } from '../../store';
import {
  openFolderDialog,
  openVault,
  createVault,
  loadFileTree,
  loadRecentVaultsLocal,
  saveRecentVaultsLocal,
} from '../../lib/tauri';
import { formatRelativeTime } from '../../lib/utils';
import { cn } from '../../lib/utils';
import type { RecentVault } from '../../types';

type Tab = 'open' | 'create';

export function VaultPicker() {
  const [activeTab, setActiveTab] = useState<Tab>('open');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create vault state
  const [newVaultName, setNewVaultName] = useState('');
  const [newVaultPath, setNewVaultPath] = useState('');

  const vaultPickerOpen = useStore((state) => state.vaultPickerOpen);
  const closeVaultPicker = useStore((state) => state.closeVaultPicker);
  const recentVaults = useStore((state) => state.recentVaults);
  const setVault = useStore((state) => state.setVault);
  const removeRecentVault = useStore((state) => state.removeRecentVault);
  const setRecentVaults = useStore((state) => state.setRecentVaults);
  const addNotification = useStore((state) => state.addNotification);

  // Load recent vaults from localStorage on mount
  useEffect(() => {
    if (vaultPickerOpen && recentVaults.length === 0) {
      const stored = loadRecentVaultsLocal();
      if (stored.length > 0) {
        setRecentVaults(stored);
      }
    }
  }, [vaultPickerOpen, recentVaults.length, setRecentVaults]);

  const handleOpenVault = useCallback(async (path?: string) => {
    setIsLoading(true);
    setError(null);

    try {
      let vaultPath = path;

      if (!vaultPath) {
        const selected = await openFolderDialog();
        if (!selected) {
          setIsLoading(false);
          return;
        }
        vaultPath = selected;
      }

      // Call Rust backend to open vault
      const vaultInfo = await openVault(vaultPath);

      // Load file tree from Rust backend
      const tree = await loadFileTree();

      // Set vault in store
      setVault(vaultInfo.path, vaultInfo.name, tree);

      // Save to localStorage for persistence
      const now = Date.now();
      const updated = [
        { id: `vault-${now}`, name: vaultInfo.name, path: vaultInfo.path, lastOpened: now },
        ...recentVaults.filter(v => v.path !== vaultInfo.path)
      ].slice(0, 10);
      saveRecentVaultsLocal(updated);

      closeVaultPicker();
      addNotification({
        type: 'success',
        message: `Opened vault: ${vaultInfo.name}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addNotification({
        type: 'error',
        message: `Failed to open vault: ${message}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [setVault, closeVaultPicker, addNotification, recentVaults]);

  const handleCreateVault = useCallback(async () => {
    if (!newVaultName.trim()) {
      setError('Please enter a vault name');
      return;
    }

    if (!newVaultPath) {
      setError('Please select a location');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call Rust backend to create vault
      // The Rust command takes (path, name) and creates vault at path/name
      const vaultInfo = await createVault(newVaultPath, newVaultName);

      // Load file tree from Rust backend
      const tree = await loadFileTree();

      // Set vault in store
      setVault(vaultInfo.path, vaultInfo.name, tree);

      // Save to localStorage for persistence
      const now = Date.now();
      const updated = [
        { id: `vault-${now}`, name: vaultInfo.name, path: vaultInfo.path, lastOpened: now },
        ...recentVaults.filter(v => v.path !== vaultInfo.path)
      ].slice(0, 10);
      saveRecentVaultsLocal(updated);

      closeVaultPicker();
      addNotification({
        type: 'success',
        message: `Created vault: ${vaultInfo.name}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      addNotification({
        type: 'error',
        message: `Failed to create vault: ${message}`,
      });
    } finally {
      setIsLoading(false);
    }
  }, [newVaultName, newVaultPath, setVault, closeVaultPicker, addNotification, recentVaults]);

  const handleSelectLocation = useCallback(async () => {
    const selected = await openFolderDialog();
    if (selected) {
      setNewVaultPath(selected);
    }
  }, []);

  const handleRemoveRecent = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      removeRecentVault(id);
      // Also update localStorage
      const updated = recentVaults.filter(v => v.id !== id);
      saveRecentVaultsLocal(updated);
    },
    [removeRecentVault, recentVaults]
  );

  const handleClose = useCallback(() => {
    setError(null);
    setNewVaultName('');
    setNewVaultPath('');
    setActiveTab('open');
    closeVaultPicker();
  }, [closeVaultPicker]);

  return (
    <Modal
      isOpen={vaultPickerOpen}
      onClose={handleClose}
      title="Open Vault"
      size="lg"
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-4 -mt-2">
        <TabButton
          active={activeTab === 'open'}
          onClick={() => setActiveTab('open')}
        >
          Open existing
        </TabButton>
        <TabButton
          active={activeTab === 'create'}
          onClick={() => setActiveTab('create')}
        >
          Create new
        </TabButton>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          {error}
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'open' ? (
        <OpenVaultTab
          recentVaults={recentVaults}
          isLoading={isLoading}
          onOpenVault={handleOpenVault}
          onRemoveRecent={handleRemoveRecent}
        />
      ) : (
        <CreateVaultTab
          name={newVaultName}
          path={newVaultPath}
          isLoading={isLoading}
          onNameChange={setNewVaultName}
          onSelectLocation={handleSelectLocation}
          onCreate={handleCreateVault}
        />
      )}
    </Modal>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      className={cn(
        'px-4 py-2 text-sm font-medium rounded-md transition-colors',
        active
          ? 'bg-background-modifier-active text-text-normal'
          : 'text-text-muted hover:text-text-normal hover:bg-background-modifier-hover'
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

interface OpenVaultTabProps {
  recentVaults: RecentVault[];
  isLoading: boolean;
  onOpenVault: (path?: string) => void;
  onRemoveRecent: (e: React.MouseEvent, id: string) => void;
}

function OpenVaultTab({
  recentVaults,
  isLoading,
  onOpenVault,
  onRemoveRecent,
}: OpenVaultTabProps) {
  if (isLoading) {
    return (
      <div className="py-8">
        <Spinner label="Opening vault..." />
      </div>
    );
  }

  return (
    <div>
      {/* Open folder button */}
      <Button
        variant="secondary"
        className="w-full justify-start mb-4"
        leftIcon={<FolderOpen className="h-4 w-4" />}
        onClick={() => onOpenVault()}
      >
        Open folder as vault
      </Button>

      {/* Recent vaults */}
      {recentVaults.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wider mb-2">
            Recent Vaults
          </h3>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {recentVaults.map((vault) => (
              <RecentVaultItem
                key={vault.id}
                vault={vault}
                onOpen={() => onOpenVault(vault.path)}
                onRemove={(e) => onRemoveRecent(e, vault.id)}
              />
            ))}
          </div>
        </div>
      )}

      {recentVaults.length === 0 && (
        <div className="text-center py-8 text-text-muted">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">No recent vaults</p>
          <p className="text-xs mt-1 text-text-faint">
            Open a folder to get started
          </p>
        </div>
      )}
    </div>
  );
}

interface RecentVaultItemProps {
  vault: RecentVault;
  onOpen: () => void;
  onRemove: (e: React.MouseEvent) => void;
}

function RecentVaultItem({ vault, onOpen, onRemove }: RecentVaultItemProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer group',
        'hover:bg-background-modifier-hover',
        'transition-colors'
      )}
      onClick={onOpen}
    >
      <FolderOpen className="h-5 w-5 text-text-muted shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-normal truncate">
          {vault.name}
        </p>
        <p className="text-xs text-text-faint truncate">{vault.path}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-text-faint flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatRelativeTime(vault.lastOpened)}
        </span>
        <button
          className={cn(
            'p-1 rounded opacity-0 group-hover:opacity-100',
            'hover:bg-background-modifier-active',
            'text-text-muted hover:text-red-500',
            'transition-all'
          )}
          onClick={onRemove}
          aria-label="Remove from recent"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

interface CreateVaultTabProps {
  name: string;
  path: string;
  isLoading: boolean;
  onNameChange: (name: string) => void;
  onSelectLocation: () => void;
  onCreate: () => void;
}

function CreateVaultTab({
  name,
  path,
  isLoading,
  onNameChange,
  onSelectLocation,
  onCreate,
}: CreateVaultTabProps) {
  if (isLoading) {
    return (
      <div className="py-8">
        <Spinner label="Creating vault..." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Input
        label="Vault name"
        placeholder="My Notes"
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        autoFocus
      />

      <div>
        <label className="text-sm font-medium text-text-normal block mb-1.5">
          Location
        </label>
        <div className="flex gap-2">
          <div
            className={cn(
              'flex-1 h-9 px-3 flex items-center rounded-md text-sm',
              'bg-background-primary border border-background-modifier-border',
              'text-text-muted truncate'
            )}
          >
            {path || 'No location selected'}
          </div>
          <Button variant="secondary" onClick={onSelectLocation}>
            Browse
          </Button>
        </div>
        {path && (
          <p className="text-xs text-text-faint mt-1.5">
            Vault will be created at: {path}/{name || '[vault name]'}
          </p>
        )}
      </div>

      <ModalFooter>
        <Button
          variant="primary"
          onClick={onCreate}
          disabled={!name.trim() || !path}
          leftIcon={<Plus className="h-4 w-4" />}
        >
          Create Vault
        </Button>
      </ModalFooter>
    </div>
  );
}
