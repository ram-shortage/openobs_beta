import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import { createVaultSlice, type VaultSlice } from './vaultStore';
import { createEditorSlice, type EditorSlice } from './editorStore';
import { createUISlice, type UISlice } from './uiStore';

// Combined store type
export type AppStore = VaultSlice & EditorSlice & UISlice;

// Create the combined store
export const useStore = create<AppStore>()(
  devtools(
    persist(
      (...args) => ({
        ...createVaultSlice(...args),
        ...createEditorSlice(...args),
        ...createUISlice(...args),
      }),
      {
        name: 'openobs-storage',
        partialize: (state) => ({
          // Only persist these values
          recentVaults: state.recentVaults,
          theme: state.theme,
          sidebarWidth: state.sidebarWidth,
          rightSidebarWidth: state.rightSidebarWidth,
          editorMode: state.editorMode,
        }),
      }
    ),
    { name: 'OpenObs' }
  )
);

// Selector hooks for common use cases (using shallow comparison to prevent infinite loops)
export const useVault = () =>
  useStore(
    useShallow((state) => ({
      vaultPath: state.vaultPath,
      vaultName: state.vaultName,
      isOpen: state.isOpen,
      config: state.config,
      fileTree: state.fileTree,
      expandedFolders: state.expandedFolders,
      recentVaults: state.recentVaults,
      isLoading: state.isLoading,
      error: state.error,
    }))
  );

export const useVaultActions = () =>
  useStore(
    useShallow((state) => ({
      setVault: state.setVault,
      closeVault: state.closeVault,
      setConfig: state.setConfig,
      setFileTree: state.setFileTree,
      toggleFolder: state.toggleFolder,
      expandFolder: state.expandFolder,
      collapseFolder: state.collapseFolder,
      updateFileTreeItem: state.updateFileTreeItem,
      addFileTreeItem: state.addFileTreeItem,
      removeFileTreeItem: state.removeFileTreeItem,
      addRecentVault: state.addRecentVault,
      removeRecentVault: state.removeRecentVault,
      setRecentVaults: state.setRecentVaults,
      setLoading: state.setLoading,
      setError: state.setError,
    }))
  );

export const useEditor = () =>
  useStore(
    useShallow((state) => ({
      activeFilePath: state.activeFilePath,
      openFiles: state.openFiles,
      editorMode: state.editorMode,
      currentContent: state.currentContent,
      cursorPosition: state.cursorPosition,
      selection: state.selection,
      searchQuery: state.searchQuery,
      searchResults: state.searchResults,
      currentSearchIndex: state.currentSearchIndex,
    }))
  );

export const useEditorActions = () =>
  useStore(
    useShallow((state) => ({
      setActiveFile: state.setActiveFile,
      openFile: state.openFile,
      closeFile: state.closeFile,
      closeAllFiles: state.closeAllFiles,
      closeOtherFiles: state.closeOtherFiles,
      setFileContent: state.setFileContent,
      setFileLoading: state.setFileLoading,
      setFileError: state.setFileError,
      markFileDirty: state.markFileDirty,
      setCurrentContent: state.setCurrentContent,
      setEditorMode: state.setEditorMode,
      toggleEditorMode: state.toggleEditorMode,
      setCursorPosition: state.setCursorPosition,
      setSelection: state.setSelection,
      clearSelection: state.clearSelection,
      setSearchQuery: state.setSearchQuery,
      setSearchResults: state.setSearchResults,
      nextSearchResult: state.nextSearchResult,
      prevSearchResult: state.prevSearchResult,
      clearSearch: state.clearSearch,
    }))
  );

export const useUI = () =>
  useStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      sidebarWidth: state.sidebarWidth,
      rightSidebarOpen: state.rightSidebarOpen,
      rightSidebarWidth: state.rightSidebarWidth,
      activePanel: state.activePanel,
      rightActivePanel: state.rightActivePanel,
      theme: state.theme,
      resolvedTheme: state.resolvedTheme,
      vaultPickerOpen: state.vaultPickerOpen,
      settingsOpen: state.settingsOpen,
      commandPaletteOpen: state.commandPaletteOpen,
      quickSwitcherOpen: state.quickSwitcherOpen,
      statusBarVisible: state.statusBarVisible,
      notifications: state.notifications,
    }))
  );

export const useUIActions = () =>
  useStore(
    useShallow((state) => ({
      toggleSidebar: state.toggleSidebar,
      setSidebarOpen: state.setSidebarOpen,
      setSidebarWidth: state.setSidebarWidth,
      toggleRightSidebar: state.toggleRightSidebar,
      setRightSidebarOpen: state.setRightSidebarOpen,
      setRightSidebarWidth: state.setRightSidebarWidth,
      setActivePanel: state.setActivePanel,
      setRightActivePanel: state.setRightActivePanel,
      setTheme: state.setTheme,
      openVaultPicker: state.openVaultPicker,
      closeVaultPicker: state.closeVaultPicker,
      openSettings: state.openSettings,
      closeSettings: state.closeSettings,
      openCommandPalette: state.openCommandPalette,
      closeCommandPalette: state.closeCommandPalette,
      openQuickSwitcher: state.openQuickSwitcher,
      closeQuickSwitcher: state.closeQuickSwitcher,
      closeAllModals: state.closeAllModals,
      toggleStatusBar: state.toggleStatusBar,
      setStatusBarVisible: state.setStatusBarVisible,
      addNotification: state.addNotification,
      removeNotification: state.removeNotification,
      clearNotifications: state.clearNotifications,
    }))
  );

// Re-export types
export type { VaultSlice, VaultState, VaultActions } from './vaultStore';
export type { EditorSlice, EditorState, EditorActions, EditorMode, OpenFile } from './editorStore';
export type { UISlice, UIState, UIActions, Theme, ActivePanel, Notification } from './uiStore';
