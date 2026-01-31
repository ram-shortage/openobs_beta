/**
 * Represents the metadata for a note file
 */
export interface NoteMetadata {
  /** Unique identifier for the note */
  id: string;
  /** Title of the note (usually derived from filename) */
  title: string;
  /** Relative path from vault root */
  path: string;
  /** File extension (e.g., 'md') */
  extension: string;
  /** Creation timestamp */
  created: number;
  /** Last modified timestamp */
  modified: number;
  /** File size in bytes */
  size: number;
  /** Parent folder path */
  parent: string;
  /** Tags extracted from the note content */
  tags: string[];
  /** Aliases for the note */
  aliases: string[];
  /** Outgoing links to other notes */
  links: string[];
  /** Notes that link to this note */
  backlinks: string[];
}

/**
 * Represents a note file with its content
 */
export interface Note {
  /** Metadata for the note */
  metadata: NoteMetadata;
  /** Raw markdown content */
  content: string;
  /** Whether the note has unsaved changes */
  isDirty: boolean;
}

/**
 * Represents a file or folder in the vault
 */
export interface FileTreeItem {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Relative path from vault root */
  path: string;
  /** Whether this is a folder */
  isFolder: boolean;
  /** Child items (for folders) */
  children?: FileTreeItem[];
  /** Whether the folder is expanded in the UI */
  isExpanded?: boolean;
}

/**
 * Represents search results
 */
export interface SearchResult {
  /** The note metadata */
  note: NoteMetadata;
  /** Matched content snippets */
  matches: SearchMatch[];
  /** Relevance score */
  score: number;
}

/**
 * Represents a single search match within a note
 */
export interface SearchMatch {
  /** The matched text */
  text: string;
  /** Line number where match was found */
  line: number;
  /** Start position of match */
  start: number;
  /** End position of match */
  end: number;
}
