import { useEffect, useCallback, useState } from 'react';
import { useStore } from '../store';
import { tauriInvoke } from '../lib/tauri';

// ============================================================================
// Types
// ============================================================================

export interface AppSettings {
  // Editor settings
  editor: {
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
    tabSize: number;
    vimMode: boolean;
    wordWrap: boolean;
    lineNumbers: boolean;
    highlightActiveLine: boolean;
    autoCloseBrackets: boolean;
    spellCheck: boolean;
  };

  // File settings
  files: {
    autoSave: boolean;
    autoSaveDelay: number; // milliseconds
    defaultNoteLocation: string;
    newFileFormat: 'md' | 'markdown';
    trashDeletedFiles: boolean;
  };

  // Appearance settings
  appearance: {
    theme: 'light' | 'dark' | 'system';
    accentColor: string;
    fontSize: 'small' | 'medium' | 'large';
    compactMode: boolean;
    showStatusBar: boolean;
    showTabBar: boolean;
  };

  // Hotkeys (user overrides)
  hotkeys: Record<string, string>;
}

export const DEFAULT_SETTINGS: AppSettings = {
  editor: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontSize: 14,
    lineHeight: 1.6,
    tabSize: 2,
    vimMode: false,
    wordWrap: true,
    lineNumbers: true,
    highlightActiveLine: true,
    autoCloseBrackets: true,
    spellCheck: false,
  },
  files: {
    autoSave: true,
    autoSaveDelay: 2000,
    defaultNoteLocation: '/',
    newFileFormat: 'md',
    trashDeletedFiles: true,
  },
  appearance: {
    theme: 'dark',
    accentColor: '#7c3aed', // Purple
    fontSize: 'medium',
    compactMode: false,
    showStatusBar: true,
    showTabBar: true,
  },
  hotkeys: {},
};

// ============================================================================
// Settings State
// ============================================================================

let settingsCache: AppSettings | null = null;
let settingsListeners: Set<() => void> = new Set();

function notifySettingsChange(): void {
  settingsListeners.forEach((listener) => listener());
}

// ============================================================================
// Settings API
// ============================================================================

/**
 * Load settings from backend
 */
export async function loadSettings(): Promise<AppSettings> {
  try {
    const settings = await tauriInvoke<AppSettings>('get_settings');
    settingsCache = { ...DEFAULT_SETTINGS, ...settings };
    notifySettingsChange();
    return settingsCache;
  } catch (error) {
    console.warn('Failed to load settings from backend, using defaults:', error);
    settingsCache = DEFAULT_SETTINGS;
    notifySettingsChange();
    return settingsCache;
  }
}

/**
 * Save a single setting
 */
export async function setSetting<K extends keyof AppSettings>(
  section: K,
  key: keyof AppSettings[K],
  value: AppSettings[K][keyof AppSettings[K]]
): Promise<void> {
  try {
    await tauriInvoke('set_setting', {
      section,
      key: String(key),
      value: JSON.stringify(value),
    });

    // Update cache
    if (settingsCache) {
      (settingsCache[section] as Record<string, unknown>)[key as string] = value;
      notifySettingsChange();
    }
  } catch (error) {
    console.error('Failed to save setting:', error);
    // Update local cache anyway for immediate UI feedback
    if (settingsCache) {
      (settingsCache[section] as Record<string, unknown>)[key as string] = value;
      notifySettingsChange();
    }
  }
}

/**
 * Save multiple settings at once
 */
export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  try {
    await tauriInvoke('save_settings', { settings: JSON.stringify(settings) });
    settingsCache = { ...DEFAULT_SETTINGS, ...settingsCache, ...settings };
    notifySettingsChange();
  } catch (error) {
    console.error('Failed to save settings:', error);
    // Update local cache anyway
    settingsCache = { ...DEFAULT_SETTINGS, ...settingsCache, ...settings };
    notifySettingsChange();
  }
}

/**
 * Reset settings to defaults
 */
export async function resetSettings(): Promise<void> {
  settingsCache = { ...DEFAULT_SETTINGS };
  notifySettingsChange();
  try {
    await tauriInvoke('reset_settings');
  } catch (error) {
    console.error('Failed to reset settings:', error);
  }
}

/**
 * Get current settings (sync)
 */
export function getSettings(): AppSettings {
  return settingsCache || DEFAULT_SETTINGS;
}

// ============================================================================
// React Hook
// ============================================================================

/**
 * Hook to access and modify settings
 */
export function useSettings(): {
  settings: AppSettings;
  isLoading: boolean;
  error: string | null;
  updateSetting: <K extends keyof AppSettings>(
    section: K,
    key: keyof AppSettings[K],
    value: AppSettings[K][keyof AppSettings[K]]
  ) => Promise<void>;
  resetToDefaults: () => Promise<void>;
} {
  const [settings, setSettings] = useState<AppSettings>(settingsCache || DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(!settingsCache);
  const [error, setError] = useState<string | null>(null);

  const setTheme = useStore((state) => state.setTheme);
  const setStatusBarVisible = useStore((state) => state.setStatusBarVisible);

  // Load settings on mount
  useEffect(() => {
    if (!settingsCache) {
      setIsLoading(true);
      loadSettings()
        .then((loaded) => {
          setSettings(loaded);
          setIsLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Failed to load settings');
          setIsLoading(false);
        });
    }
  }, []);

  // Subscribe to settings changes
  useEffect(() => {
    const handleChange = () => {
      if (settingsCache) {
        setSettings({ ...settingsCache });
      }
    };

    settingsListeners.add(handleChange);
    return () => {
      settingsListeners.delete(handleChange);
    };
  }, []);

  // Update UI store when appearance settings change
  useEffect(() => {
    setTheme(settings.appearance.theme);
    setStatusBarVisible(settings.appearance.showStatusBar);
  }, [settings.appearance.theme, settings.appearance.showStatusBar, setTheme, setStatusBarVisible]);

  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(
      section: K,
      key: keyof AppSettings[K],
      value: AppSettings[K][keyof AppSettings[K]]
    ) => {
      await setSetting(section, key, value);
    },
    []
  );

  const resetToDefaults = useCallback(async () => {
    await resetSettings();
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return {
    settings,
    isLoading,
    error,
    updateSetting,
    resetToDefaults,
  };
}

// ============================================================================
// Specific Settings Hooks
// ============================================================================

/**
 * Hook for editor settings only
 */
export function useEditorSettings(): AppSettings['editor'] {
  const [editorSettings, setEditorSettings] = useState(
    settingsCache?.editor || DEFAULT_SETTINGS.editor
  );

  useEffect(() => {
    const handleChange = () => {
      if (settingsCache) {
        setEditorSettings({ ...settingsCache.editor });
      }
    };

    settingsListeners.add(handleChange);
    return () => {
      settingsListeners.delete(handleChange);
    };
  }, []);

  return editorSettings;
}

/**
 * Hook for appearance settings only
 */
export function useAppearanceSettings(): AppSettings['appearance'] {
  const [appearanceSettings, setAppearanceSettings] = useState(
    settingsCache?.appearance || DEFAULT_SETTINGS.appearance
  );

  useEffect(() => {
    const handleChange = () => {
      if (settingsCache) {
        setAppearanceSettings({ ...settingsCache.appearance });
      }
    };

    settingsListeners.add(handleChange);
    return () => {
      settingsListeners.delete(handleChange);
    };
  }, []);

  return appearanceSettings;
}
