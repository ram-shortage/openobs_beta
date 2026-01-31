/**
 * Represents a vault (a folder containing notes)
 */
export interface Vault {
  /** Unique identifier for the vault */
  id: string;
  /** Display name of the vault */
  name: string;
  /** Absolute path to the vault root directory */
  path: string;
  /** When the vault was last opened */
  lastOpened: number;
  /** Vault configuration */
  config: VaultConfig;
}

/**
 * Configuration settings for a vault
 */
export interface VaultConfig {
  /** Default folder for new notes */
  defaultNoteLocation: string;
  /** Default folder for attachments */
  attachmentFolder: string;
  /** Files/folders to ignore (glob patterns) */
  ignoredFiles: string[];
  /** Whether to use strict link matching */
  strictLineBreaks: boolean;
  /** Whether to auto-save notes */
  autoSave: boolean;
  /** Auto-save delay in milliseconds */
  autoSaveDelay: number;
  /** Whether to show line numbers in editor */
  showLineNumbers: boolean;
  /** Whether to use vim keybindings */
  vimMode: boolean;
  /** Spell check language */
  spellCheckLanguage: string | null;
  /** Custom CSS snippet paths */
  cssSnippets: string[];
  /** Enabled community plugins */
  enabledPlugins: string[];
}

/**
 * Default vault configuration
 */
export const DEFAULT_VAULT_CONFIG: VaultConfig = {
  defaultNoteLocation: '/',
  attachmentFolder: 'attachments',
  ignoredFiles: ['.git', '.obsidian', 'node_modules', '.DS_Store'],
  strictLineBreaks: false,
  autoSave: true,
  autoSaveDelay: 2000,
  showLineNumbers: false,
  vimMode: false,
  spellCheckLanguage: null,
  cssSnippets: [],
  enabledPlugins: [],
};

/**
 * Recent vault entry for quick access
 */
export interface RecentVault {
  /** Vault ID */
  id: string;
  /** Vault display name */
  name: string;
  /** Absolute path to vault */
  path: string;
  /** When the vault was last opened */
  lastOpened: number;
}
