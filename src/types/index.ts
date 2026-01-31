// Note types
export type {
  Note,
  NoteMetadata,
  FileTreeItem,
  SearchResult,
  SearchMatch,
} from './note';

// Vault types
export type {
  Vault,
  VaultConfig,
  RecentVault,
} from './vault';

export { DEFAULT_VAULT_CONFIG } from './vault';

// Link types
export type { LinkInfo, LinksResponse } from './links';

// Canvas types
export type {
  CanvasData,
  CanvasNodeData,
  CanvasNodeBase,
  TextCardNodeData,
  NoteEmbedNodeData,
  ImageNodeData,
  GroupNodeData,
  CanvasEdge,
  CanvasNodeColor,
  CanvasState,
  TextCardNodeProps,
  NoteEmbedNodeProps,
  ImageNodeProps,
} from './canvas';

export { NODE_COLORS, DEFAULT_CANVAS_DATA } from './canvas';
