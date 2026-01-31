import { useStore } from '../store';

// ============================================================================
// Types
// ============================================================================

export type CommandCategory =
  | 'file'
  | 'edit'
  | 'view'
  | 'navigate'
  | 'search'
  | 'settings'
  | 'help';

export interface Command {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  hotkey?: string;
  action: () => void | Promise<void>;
  when?: () => boolean; // Condition for when command is available
}

export interface CommandGroup {
  category: CommandCategory;
  label: string;
  commands: Command[];
}

// ============================================================================
// Platform detection
// ============================================================================

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

export const MOD_KEY = isMac ? 'Cmd' : 'Ctrl';
export const MOD_KEY_SYMBOL = isMac ? '\u2318' : 'Ctrl';
export const ALT_KEY = isMac ? 'Option' : 'Alt';
export const ALT_KEY_SYMBOL = isMac ? '\u2325' : 'Alt';

/**
 * Formats a hotkey for display
 */
export function formatHotkey(hotkey: string): string {
  return hotkey
    .replace(/Mod/g, MOD_KEY_SYMBOL)
    .replace(/Alt/g, ALT_KEY_SYMBOL)
    .replace(/Shift/g, isMac ? '\u21E7' : 'Shift')
    .replace(/\+/g, isMac ? '' : '+');
}

/**
 * Parses a hotkey string into event properties for matching
 */
export function parseHotkey(hotkey: string): {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
} {
  const parts = hotkey.toLowerCase().split('+');
  const key = parts[parts.length - 1];

  const hasCtrl = parts.includes('ctrl');
  const hasMod = parts.includes('mod');
  const hasAlt = parts.includes('alt');
  const hasShift = parts.includes('shift');

  return {
    key: key === 'comma' ? ',' : key,
    ctrlKey: hasCtrl || (!isMac && hasMod),
    metaKey: isMac && hasMod,
    altKey: hasAlt,
    shiftKey: hasShift,
  };
}

/**
 * Checks if a keyboard event matches a hotkey
 */
export function matchesHotkey(event: KeyboardEvent, hotkey: string): boolean {
  const parsed = parseHotkey(hotkey);

  return (
    event.key.toLowerCase() === parsed.key &&
    event.ctrlKey === parsed.ctrlKey &&
    event.metaKey === parsed.metaKey &&
    event.altKey === parsed.altKey &&
    event.shiftKey === parsed.shiftKey
  );
}

// ============================================================================
// Command Registry
// ============================================================================

class CommandRegistry {
  private commands: Map<string, Command> = new Map();
  private recentCommands: string[] = [];
  private maxRecentCommands = 5;

  register(command: Command): void {
    this.commands.set(command.id, command);
  }

  unregister(id: string): void {
    this.commands.delete(id);
  }

  get(id: string): Command | undefined {
    return this.commands.get(id);
  }

  getAll(): Command[] {
    return Array.from(this.commands.values());
  }

  getAvailable(): Command[] {
    return this.getAll().filter((cmd) => !cmd.when || cmd.when());
  }

  getByCategory(category: CommandCategory): Command[] {
    return this.getAvailable().filter((cmd) => cmd.category === category);
  }

  getGrouped(): CommandGroup[] {
    const categories: { category: CommandCategory; label: string }[] = [
      { category: 'file', label: 'File' },
      { category: 'edit', label: 'Edit' },
      { category: 'view', label: 'View' },
      { category: 'navigate', label: 'Navigate' },
      { category: 'search', label: 'Search' },
      { category: 'settings', label: 'Settings' },
      { category: 'help', label: 'Help' },
    ];

    return categories
      .map(({ category, label }) => ({
        category,
        label,
        commands: this.getByCategory(category),
      }))
      .filter((group) => group.commands.length > 0);
  }

  execute(id: string): void {
    const command = this.commands.get(id);
    if (command && (!command.when || command.when())) {
      // Track recent command
      this.recentCommands = [
        id,
        ...this.recentCommands.filter((c) => c !== id),
      ].slice(0, this.maxRecentCommands);

      command.action();
    }
  }

  findByHotkey(event: KeyboardEvent): Command | undefined {
    return this.getAvailable().find(
      (cmd) => cmd.hotkey && matchesHotkey(event, cmd.hotkey)
    );
  }

  getRecentCommands(): Command[] {
    return this.recentCommands
      .map((id) => this.commands.get(id))
      .filter((cmd): cmd is Command => cmd !== undefined && (!cmd.when || cmd.when()));
  }

  search(query: string): Command[] {
    if (!query.trim()) {
      return this.getAvailable();
    }

    const lowerQuery = query.toLowerCase();
    const available = this.getAvailable();

    // Score-based fuzzy search
    const scored = available.map((cmd) => {
      const labelLower = cmd.label.toLowerCase();
      const descLower = (cmd.description || '').toLowerCase();

      let score = 0;

      // Exact match in label
      if (labelLower === lowerQuery) {
        score += 100;
      }
      // Starts with query
      else if (labelLower.startsWith(lowerQuery)) {
        score += 50;
      }
      // Contains query
      else if (labelLower.includes(lowerQuery)) {
        score += 25;
      }
      // Fuzzy match (all characters in order)
      else if (fuzzyMatch(lowerQuery, labelLower)) {
        score += 10;
      }

      // Description match
      if (descLower.includes(lowerQuery)) {
        score += 5;
      }

      // ID match
      if (cmd.id.toLowerCase().includes(lowerQuery)) {
        score += 5;
      }

      return { cmd, score };
    });

    return scored
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ cmd }) => cmd);
  }
}

/**
 * Simple fuzzy matching - checks if all characters in needle appear in order in haystack
 */
function fuzzyMatch(needle: string, haystack: string): boolean {
  let needleIndex = 0;
  for (let i = 0; i < haystack.length && needleIndex < needle.length; i++) {
    if (haystack[i] === needle[needleIndex]) {
      needleIndex++;
    }
  }
  return needleIndex === needle.length;
}

// ============================================================================
// Global Command Registry Instance
// ============================================================================

export const commandRegistry = new CommandRegistry();

// ============================================================================
// Register Default Commands
// ============================================================================

export function registerDefaultCommands(): void {
  const store = useStore.getState;

  // File commands
  commandRegistry.register({
    id: 'file.new-note',
    label: 'New Note',
    description: 'Create a new note',
    category: 'file',
    hotkey: 'Mod+N',
    action: () => {
      // TODO: Implement create new note dialog
      store().addNotification({
        type: 'info',
        message: 'New note (not implemented)',
      });
    },
  });

  commandRegistry.register({
    id: 'file.save',
    label: 'Save',
    description: 'Save the current note',
    category: 'file',
    hotkey: 'Mod+S',
    action: () => {
      // TODO: Implement save
      store().addNotification({
        type: 'info',
        message: 'Save (auto-save is enabled)',
      });
    },
  });

  commandRegistry.register({
    id: 'file.close',
    label: 'Close Current File',
    description: 'Close the active file',
    category: 'file',
    hotkey: 'Mod+W',
    action: () => {
      const { activeFilePath, closeFile } = store();
      if (activeFilePath) {
        closeFile(activeFilePath);
      }
    },
    when: () => store().activeFilePath !== null,
  });

  commandRegistry.register({
    id: 'file.close-all',
    label: 'Close All Files',
    description: 'Close all open files',
    category: 'file',
    action: () => {
      store().closeAllFiles();
    },
    when: () => store().openFiles.length > 0,
  });

  // Navigate commands
  commandRegistry.register({
    id: 'navigate.quick-switcher',
    label: 'Quick Switcher',
    description: 'Quickly switch between open files',
    category: 'navigate',
    hotkey: 'Mod+O',
    action: () => {
      store().openQuickSwitcher();
    },
  });

  commandRegistry.register({
    id: 'navigate.command-palette',
    label: 'Command Palette',
    description: 'Open the command palette',
    category: 'navigate',
    hotkey: 'Mod+P',
    action: () => {
      store().openCommandPalette();
    },
  });

  commandRegistry.register({
    id: 'navigate.graph-view',
    label: 'Open Graph View',
    description: 'Open the graph view panel',
    category: 'navigate',
    hotkey: 'Mod+G',
    action: () => {
      store().setActivePanel('graph');
    },
  });

  // Search commands
  commandRegistry.register({
    id: 'search.find-in-note',
    label: 'Find in Note',
    description: 'Search within the current note',
    category: 'search',
    hotkey: 'Mod+F',
    action: () => {
      // TODO: Implement find in note
      store().addNotification({
        type: 'info',
        message: 'Find in note (not implemented)',
      });
    },
    when: () => store().activeFilePath !== null,
  });

  commandRegistry.register({
    id: 'search.global-search',
    label: 'Global Search',
    description: 'Search across all notes',
    category: 'search',
    hotkey: 'Mod+Shift+F',
    action: () => {
      store().setActivePanel('search');
    },
  });

  // View commands
  commandRegistry.register({
    id: 'view.toggle-sidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    category: 'view',
    hotkey: 'Mod+\\',
    action: () => {
      store().toggleSidebar();
    },
  });

  commandRegistry.register({
    id: 'view.toggle-right-sidebar',
    label: 'Toggle Right Sidebar',
    description: 'Show or hide the right sidebar',
    category: 'view',
    action: () => {
      store().toggleRightSidebar();
    },
  });

  commandRegistry.register({
    id: 'view.toggle-preview',
    label: 'Toggle Preview Mode',
    description: 'Switch between edit and preview modes',
    category: 'view',
    hotkey: 'Mod+E',
    action: () => {
      store().toggleEditorMode();
    },
  });

  commandRegistry.register({
    id: 'view.theme-light',
    label: 'Light Theme',
    description: 'Switch to light theme',
    category: 'view',
    action: () => {
      store().setTheme('light');
    },
  });

  commandRegistry.register({
    id: 'view.theme-dark',
    label: 'Dark Theme',
    description: 'Switch to dark theme',
    category: 'view',
    action: () => {
      store().setTheme('dark');
    },
  });

  commandRegistry.register({
    id: 'view.theme-system',
    label: 'System Theme',
    description: 'Follow system theme preference',
    category: 'view',
    action: () => {
      store().setTheme('system');
    },
  });

  // Settings commands
  commandRegistry.register({
    id: 'settings.open',
    label: 'Open Settings',
    description: 'Open application settings',
    category: 'settings',
    hotkey: 'Mod+Comma',
    action: () => {
      store().openSettings();
    },
  });

  commandRegistry.register({
    id: 'settings.open-vault',
    label: 'Open Vault',
    description: 'Open or switch to another vault',
    category: 'settings',
    action: () => {
      store().openVaultPicker();
    },
  });

  // Edit commands
  commandRegistry.register({
    id: 'edit.undo',
    label: 'Undo',
    description: 'Undo the last action',
    category: 'edit',
    hotkey: 'Mod+Z',
    action: () => {
      document.execCommand('undo');
    },
  });

  commandRegistry.register({
    id: 'edit.redo',
    label: 'Redo',
    description: 'Redo the last undone action',
    category: 'edit',
    hotkey: 'Mod+Shift+Z',
    action: () => {
      document.execCommand('redo');
    },
  });

  commandRegistry.register({
    id: 'edit.insert-wikilink',
    label: 'Insert Wikilink',
    description: 'Insert a wikilink [[]] at cursor position or wrap selected text',
    category: 'edit',
    hotkey: 'Mod+K',
    action: () => {
      // The actual insertion is handled by CodeMirror keymap in SourceEditor
      // This command registration is for the command palette display
      // Focus the editor if not focused and trigger the keymap
      const editorElement = document.querySelector('.source-editor .cm-content');
      if (editorElement instanceof HTMLElement) {
        editorElement.focus();
        // Dispatch a keyboard event to trigger the CodeMirror keymap
        const event = new KeyboardEvent('keydown', {
          key: 'k',
          code: 'KeyK',
          ctrlKey: navigator.platform.indexOf('Mac') === -1,
          metaKey: navigator.platform.indexOf('Mac') !== -1,
          bubbles: true,
        });
        editorElement.dispatchEvent(event);
      }
    },
    when: () => store().activeFilePath !== null,
  });
}

// Types are already exported at the top of the file
