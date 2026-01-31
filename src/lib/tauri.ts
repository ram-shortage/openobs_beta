import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import type { FileTreeItem } from '../types';
import { generateId, isMarkdownFile } from './utils';

// ============================================================================
// Types matching Rust command responses
// ============================================================================

/** Response from vault commands (matches Rust VaultInfo) */
export interface VaultInfo {
  name: string;
  path: string;
  note_count: number;
  is_open: boolean;
}

/** Recent vault entry (matches Rust RecentVaultInfo) */
export interface RecentVaultInfo {
  name: string;
  path: string;
  last_opened: string;
}

/** File entry from read_directory (matches Rust FileEntry) */
export interface FileEntry {
  name: string;
  path: string;
  is_directory: boolean;
  extension: string | null;
  size: number;
  created: string | null;
  modified: string | null;
  children: FileEntry[] | null;
}

/** File content response (matches Rust FileContent) */
export interface FileContent {
  path: string;
  content: string;
  modified: string | null;
}

/** File info response (matches Rust FileInfo) */
export interface FileInfo {
  name: string;
  path: string;
  size: number;
  created: string | null;
  modified: string | null;
  is_markdown: boolean;
  word_count: number | null;
  character_count: number | null;
}

// ============================================================================
// Dialog utilities
// ============================================================================

/**
 * Opens a folder picker dialog
 */
export async function openFolderDialog(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select Vault Folder',
  });
  return selected as string | null;
}

// ============================================================================
// Vault commands
// ============================================================================

/**
 * Opens an existing vault
 */
export async function openVault(path: string): Promise<VaultInfo> {
  return await invoke<VaultInfo>('open_vault', { path });
}

/**
 * Creates a new vault at the specified path
 */
export async function createVault(path: string, name: string): Promise<VaultInfo> {
  return await invoke<VaultInfo>('create_vault', { path, name });
}

/**
 * Gets information about the currently open vault
 */
export async function getVaultInfo(): Promise<VaultInfo | null> {
  return await invoke<VaultInfo | null>('get_vault_info');
}

/**
 * Gets list of recently opened vaults
 */
export async function getRecentVaults(): Promise<RecentVaultInfo[]> {
  return await invoke<RecentVaultInfo[]>('get_recent_vaults');
}

// ============================================================================
// File commands
// ============================================================================

/**
 * Reads directory contents from the vault (returns flat list)
 * Path is relative to vault root, empty string or "/" for root
 */
export async function readDirectory(path: string = ''): Promise<FileEntry[]> {
  return await invoke<FileEntry[]>('read_directory', { path });
}

/**
 * Reads a file's contents
 * Path is relative to vault root
 */
export async function readFile(path: string): Promise<FileContent> {
  return await invoke<FileContent>('read_file', { path });
}

/**
 * Writes content to an existing file
 * Path is relative to vault root
 */
export async function writeFile(path: string, content: string): Promise<void> {
  await invoke('write_file', { path, content });
}

/**
 * Creates a new file
 * Path is relative to vault root
 */
export async function createFile(path: string, content: string = ''): Promise<void> {
  await invoke('create_file', { path, content });
}

/**
 * Creates a new folder
 * Path is relative to vault root
 */
export async function createFolder(path: string): Promise<void> {
  await invoke('create_folder', { path });
}

/**
 * Deletes a file
 * Path is relative to vault root
 */
export async function deleteFile(path: string): Promise<void> {
  await invoke('delete_file', { path });
}

/**
 * Deletes a folder and its contents
 * Path is relative to vault root
 */
export async function deleteFolder(path: string): Promise<void> {
  await invoke('delete_folder', { path });
}

/**
 * Renames a file or folder
 * Paths are relative to vault root
 */
export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  await invoke('rename_file', { oldPath, newPath });
}

/**
 * Moves a file to a new directory
 * Returns the new path
 */
export async function moveFile(sourcePath: string, destDir: string): Promise<string> {
  return await invoke<string>('move_file', { sourcePath, destDir });
}

/**
 * Gets detailed file information
 */
export async function getFileInfo(path: string): Promise<FileInfo> {
  return await invoke<FileInfo>('get_file_info', { path });
}

/**
 * Checks if a file exists in the vault
 * Path is relative to vault root
 */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await invoke('get_file_info', { path });
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Tree conversion utilities
// ============================================================================

/**
 * Converts FileEntry array from Rust to FileTreeItem array for the UI
 * Filters to only show markdown files
 */
export function convertToFileTree(entries: FileEntry[]): FileTreeItem[] {
  const items: FileTreeItem[] = [];

  for (const entry of entries) {
    // For files, only include markdown files
    if (!entry.is_directory && !isMarkdownFile(entry.name)) {
      continue;
    }

    const item: FileTreeItem = {
      id: generateId(),
      name: entry.name,
      path: entry.path,
      isFolder: entry.is_directory,
      isExpanded: false,
    };

    // Recursively convert children for directories
    if (entry.is_directory && entry.children) {
      const children = convertToFileTree(entry.children);
      // Only include folders that have markdown files (directly or nested)
      if (children.length > 0 || entry.children.length === 0) {
        item.children = children;
        items.push(item);
      }
    } else if (!entry.is_directory) {
      items.push(item);
    }
  }

  return items;
}

/**
 * Loads the file tree from the vault root
 */
export async function loadFileTree(): Promise<FileTreeItem[]> {
  const entries = await readDirectory('');
  return convertToFileTree(entries);
}

// ============================================================================
// Note utilities
// ============================================================================

/**
 * Creates a new note file
 * Returns the relative path to the new note
 */
export async function createNote(
  folderPath: string,
  title: string
): Promise<string> {
  const fileName = `${title}.md`;
  // Construct the relative path
  const relativePath = folderPath && folderPath !== '/'
    ? `${folderPath.replace(/^\//, '')}/${fileName}`
    : fileName;

  // Create the note with default content
  const content = `# ${title}\n\n`;
  await createFile(relativePath, content);

  return relativePath;
}

/**
 * Creates a new folder in the vault
 * Returns the relative path to the new folder
 */
export async function createVaultFolder(
  parentPath: string,
  name: string
): Promise<string> {
  const relativePath = parentPath && parentPath !== '/'
    ? `${parentPath.replace(/^\//, '')}/${name}`
    : name;

  await createFolder(relativePath);
  return relativePath;
}

// ============================================================================
// Recent vaults persistence (localStorage fallback)
// ============================================================================

/**
 * Saves recent vaults to local storage (fallback when no vault is open)
 */
export function saveRecentVaultsLocal(vaults: Array<{ id: string; name: string; path: string; lastOpened: number }>): void {
  localStorage.setItem('openobs_recent_vaults', JSON.stringify(vaults));
}

/**
 * Loads recent vaults from local storage
 */
export function loadRecentVaultsLocal(): Array<{ id: string; name: string; path: string; lastOpened: number }> {
  const stored = localStorage.getItem('openobs_recent_vaults');
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

// ============================================================================
// Generic invoke wrapper
// ============================================================================

/**
 * Invokes a Tauri command (generic wrapper)
 */
export async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  return await invoke<T>(command, args);
}
