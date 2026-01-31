import { StateCreator } from 'zustand';

export type Theme = 'dark' | 'light' | 'system';
export type ActivePanel = 'files' | 'search' | 'graph' | 'tags' | 'daily' | null;

export interface UIState {
  // Sidebar
  sidebarOpen: boolean;
  sidebarWidth: number;

  // Right sidebar
  rightSidebarOpen: boolean;
  rightSidebarWidth: number;

  // Active panels
  activePanel: ActivePanel;
  rightActivePanel: 'backlinks' | 'outgoing' | 'outline' | 'properties' | null;

  // Theme
  theme: Theme;
  resolvedTheme: 'dark' | 'light';

  // Modals
  vaultPickerOpen: boolean;
  settingsOpen: boolean;
  commandPaletteOpen: boolean;
  quickSwitcherOpen: boolean;

  // Status bar
  statusBarVisible: boolean;

  // Notifications
  notifications: Notification[];
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number;
}

export interface UIActions {
  // Sidebar
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;

  // Right sidebar
  toggleRightSidebar: () => void;
  setRightSidebarOpen: (open: boolean) => void;
  setRightSidebarWidth: (width: number) => void;

  // Panels
  setActivePanel: (panel: ActivePanel) => void;
  setRightActivePanel: (panel: 'backlinks' | 'outgoing' | 'outline' | 'properties' | null) => void;

  // Theme
  setTheme: (theme: Theme) => void;

  // Modals
  openVaultPicker: () => void;
  closeVaultPicker: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  openQuickSwitcher: () => void;
  closeQuickSwitcher: () => void;
  closeAllModals: () => void;

  // Status bar
  toggleStatusBar: () => void;
  setStatusBarVisible: (visible: boolean) => void;

  // Notifications
  addNotification: (notification: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
}

export type UISlice = UIState & UIActions;

function getResolvedTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

const initialState: UIState = {
  sidebarOpen: true,
  sidebarWidth: 280,
  rightSidebarOpen: false,
  rightSidebarWidth: 280,
  activePanel: 'files',
  rightActivePanel: null,
  theme: 'dark',
  resolvedTheme: 'dark',
  vaultPickerOpen: false,
  settingsOpen: false,
  commandPaletteOpen: false,
  quickSwitcherOpen: false,
  statusBarVisible: true,
  notifications: [],
};

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set, get) => ({
  ...initialState,

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
  },

  setSidebarWidth: (width) => {
    set({ sidebarWidth: Math.max(200, Math.min(500, width)) });
  },

  toggleRightSidebar: () => {
    set((state) => ({ rightSidebarOpen: !state.rightSidebarOpen }));
  },

  setRightSidebarOpen: (open) => {
    set({ rightSidebarOpen: open });
  },

  setRightSidebarWidth: (width) => {
    set({ rightSidebarWidth: Math.max(200, Math.min(500, width)) });
  },

  setActivePanel: (panel) => {
    const { activePanel, sidebarOpen } = get();

    // If clicking the same panel, toggle sidebar
    if (panel === activePanel && sidebarOpen) {
      set({ sidebarOpen: false });
    } else {
      set({ activePanel: panel, sidebarOpen: true });
    }
  },

  setRightActivePanel: (panel) => {
    const { rightActivePanel, rightSidebarOpen } = get();

    if (panel === rightActivePanel && rightSidebarOpen) {
      set({ rightSidebarOpen: false });
    } else {
      set({ rightActivePanel: panel, rightSidebarOpen: true });
    }
  },

  setTheme: (theme) => {
    const resolvedTheme = getResolvedTheme(theme);

    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(resolvedTheme);

    set({ theme, resolvedTheme });
  },

  openVaultPicker: () => {
    set({ vaultPickerOpen: true });
  },

  closeVaultPicker: () => {
    set({ vaultPickerOpen: false });
  },

  openSettings: () => {
    set({ settingsOpen: true });
  },

  closeSettings: () => {
    set({ settingsOpen: false });
  },

  openCommandPalette: () => {
    set({ commandPaletteOpen: true });
  },

  closeCommandPalette: () => {
    set({ commandPaletteOpen: false });
  },

  openQuickSwitcher: () => {
    set({ quickSwitcherOpen: true });
  },

  closeQuickSwitcher: () => {
    set({ quickSwitcherOpen: false });
  },

  closeAllModals: () => {
    set({
      vaultPickerOpen: false,
      settingsOpen: false,
      commandPaletteOpen: false,
      quickSwitcherOpen: false,
    });
  },

  toggleStatusBar: () => {
    set((state) => ({ statusBarVisible: !state.statusBarVisible }));
  },

  setStatusBarVisible: (visible) => {
    set({ statusBarVisible: visible });
  },

  addNotification: (notification) => {
    const id = `notification-${Date.now()}`;
    const newNotification: Notification = { ...notification, id };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Auto-remove after duration
    if (notification.duration !== 0) {
      const duration = notification.duration || 5000;
      setTimeout(() => {
        get().removeNotification(id);
      }, duration);
    }
  },

  removeNotification: (id) => {
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    }));
  },

  clearNotifications: () => {
    set({ notifications: [] });
  },
});
