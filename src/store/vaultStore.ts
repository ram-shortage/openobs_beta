import { StateCreator } from 'zustand';
import type { FileTreeItem, RecentVault, VaultConfig } from '../types';
import { DEFAULT_VAULT_CONFIG } from '../types';

export interface VaultState {
  // Vault info
  vaultPath: string | null;
  vaultName: string | null;
  isOpen: boolean;
  config: VaultConfig;

  // File tree
  fileTree: FileTreeItem[];
  expandedFolders: Set<string>;

  // Recent vaults
  recentVaults: RecentVault[];

  // Loading state
  isLoading: boolean;
  error: string | null;
}

export interface VaultActions {
  // Vault operations
  setVault: (path: string, name: string, tree: FileTreeItem[]) => void;
  closeVault: () => void;
  setConfig: (config: Partial<VaultConfig>) => void;

  // File tree operations
  setFileTree: (tree: FileTreeItem[]) => void;
  toggleFolder: (path: string) => void;
  expandFolder: (path: string) => void;
  collapseFolder: (path: string) => void;
  updateFileTreeItem: (path: string, updates: Partial<FileTreeItem>) => void;
  addFileTreeItem: (item: FileTreeItem, parentPath: string) => void;
  removeFileTreeItem: (path: string) => void;

  // Recent vaults
  addRecentVault: (vault: RecentVault) => void;
  removeRecentVault: (id: string) => void;
  setRecentVaults: (vaults: RecentVault[]) => void;

  // Loading state
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export type VaultSlice = VaultState & VaultActions;

const initialState: VaultState = {
  vaultPath: null,
  vaultName: null,
  isOpen: false,
  config: DEFAULT_VAULT_CONFIG,
  fileTree: [],
  expandedFolders: new Set(),
  recentVaults: [],
  isLoading: false,
  error: null,
};

export const createVaultSlice: StateCreator<VaultSlice, [], [], VaultSlice> = (set, get) => ({
  ...initialState,

  setVault: (path, name, tree) => {
    const { recentVaults } = get();
    const now = Date.now();

    // Update recent vaults
    const existingIndex = recentVaults.findIndex(v => v.path === path);
    let updatedRecent = [...recentVaults];

    if (existingIndex >= 0) {
      updatedRecent[existingIndex] = { ...updatedRecent[existingIndex], lastOpened: now };
    } else {
      updatedRecent.unshift({
        id: `vault-${now}`,
        name,
        path,
        lastOpened: now,
      });
    }

    // Keep only last 10 recent vaults
    updatedRecent = updatedRecent
      .sort((a, b) => b.lastOpened - a.lastOpened)
      .slice(0, 10);

    set({
      vaultPath: path,
      vaultName: name,
      isOpen: true,
      fileTree: tree,
      recentVaults: updatedRecent,
      error: null,
    });
  },

  closeVault: () => {
    set({
      vaultPath: null,
      vaultName: null,
      isOpen: false,
      fileTree: [],
      expandedFolders: new Set(),
    });
  },

  setConfig: (config) => {
    set((state) => ({
      config: { ...state.config, ...config },
    }));
  },

  setFileTree: (tree) => {
    set({ fileTree: tree });
  },

  toggleFolder: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedFolders: newExpanded };
    });
  },

  expandFolder: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      newExpanded.add(path);
      return { expandedFolders: newExpanded };
    });
  },

  collapseFolder: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedFolders);
      newExpanded.delete(path);
      return { expandedFolders: newExpanded };
    });
  },

  updateFileTreeItem: (path, updates) => {
    const updateTree = (items: FileTreeItem[]): FileTreeItem[] => {
      return items.map((item) => {
        if (item.path === path) {
          return { ...item, ...updates };
        }
        if (item.children) {
          return { ...item, children: updateTree(item.children) };
        }
        return item;
      });
    };

    set((state) => ({
      fileTree: updateTree(state.fileTree),
    }));
  },

  addFileTreeItem: (item, parentPath) => {
    const addToTree = (items: FileTreeItem[]): FileTreeItem[] => {
      if (parentPath === '/' || parentPath === '') {
        // Add to root
        return [...items, item].sort((a, b) => {
          if (a.isFolder && !b.isFolder) return -1;
          if (!a.isFolder && b.isFolder) return 1;
          return a.name.localeCompare(b.name);
        });
      }

      return items.map((treeItem) => {
        if (treeItem.path === parentPath && treeItem.isFolder) {
          const children = [...(treeItem.children || []), item].sort((a, b) => {
            if (a.isFolder && !b.isFolder) return -1;
            if (!a.isFolder && b.isFolder) return 1;
            return a.name.localeCompare(b.name);
          });
          return { ...treeItem, children };
        }
        if (treeItem.children) {
          return { ...treeItem, children: addToTree(treeItem.children) };
        }
        return treeItem;
      });
    };

    set((state) => ({
      fileTree: addToTree(state.fileTree),
    }));
  },

  removeFileTreeItem: (path) => {
    const removeFromTree = (items: FileTreeItem[]): FileTreeItem[] => {
      return items
        .filter((item) => item.path !== path)
        .map((item) => {
          if (item.children) {
            return { ...item, children: removeFromTree(item.children) };
          }
          return item;
        });
    };

    set((state) => ({
      fileTree: removeFromTree(state.fileTree),
    }));
  },

  addRecentVault: (vault) => {
    set((state) => {
      const filtered = state.recentVaults.filter((v) => v.path !== vault.path);
      return {
        recentVaults: [vault, ...filtered].slice(0, 10),
      };
    });
  },

  removeRecentVault: (id) => {
    set((state) => ({
      recentVaults: state.recentVaults.filter((v) => v.id !== id),
    }));
  },

  setRecentVaults: (vaults) => {
    set({ recentVaults: vaults });
  },

  setLoading: (loading) => {
    set({ isLoading: loading });
  },

  setError: (error) => {
    set({ error });
  },
});
