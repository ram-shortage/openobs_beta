/**
 * Canvas types for the infinite canvas view
 */

// ============================================================================
// Node Types
// ============================================================================

/** Base canvas node properties */
export interface CanvasNodeBase {
  /** Unique identifier for the node */
  id: string;
  /** X position on the canvas */
  x: number;
  /** Y position on the canvas */
  y: number;
  /** Width of the node */
  width: number;
  /** Height of the node */
  height: number;
  /** Optional color for the node */
  color?: CanvasNodeColor;
}

/** Text card node - simple text content */
export interface TextCardNodeData extends CanvasNodeBase {
  type: 'text';
  /** Text content of the card */
  content: string;
}

/** Note embed node - embeds an existing note */
export interface NoteEmbedNodeData extends CanvasNodeBase {
  type: 'note';
  /** Path to the note file relative to vault root */
  path: string;
}

/** Image node - displays an image */
export interface ImageNodeData extends CanvasNodeBase {
  type: 'image';
  /** Path to the image file relative to vault root */
  path: string;
  /** Alt text for accessibility */
  alt?: string;
}

/** Group node - groups other nodes together */
export interface GroupNodeData extends CanvasNodeBase {
  type: 'group';
  /** Label for the group */
  label?: string;
  /** Background color for the group */
  background?: string;
}

/** Union of all node data types */
export type CanvasNodeData =
  | TextCardNodeData
  | NoteEmbedNodeData
  | ImageNodeData
  | GroupNodeData;

/** Available node colors */
export type CanvasNodeColor =
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'pink';

/** Color definitions for nodes */
export const NODE_COLORS: Record<CanvasNodeColor, { bg: string; border: string; text: string }> = {
  default: { bg: 'bg-background-primary', border: 'border-background-modifier-border', text: 'text-text-normal' },
  red: { bg: 'bg-red-500/20', border: 'border-red-500', text: 'text-red-100' },
  orange: { bg: 'bg-orange-500/20', border: 'border-orange-500', text: 'text-orange-100' },
  yellow: { bg: 'bg-yellow-500/20', border: 'border-yellow-500', text: 'text-yellow-100' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500', text: 'text-green-100' },
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500', text: 'text-cyan-100' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500', text: 'text-blue-100' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500', text: 'text-purple-100' },
  pink: { bg: 'bg-pink-500/20', border: 'border-pink-500', text: 'text-pink-100' },
};

// ============================================================================
// Edge Types
// ============================================================================

/** Canvas edge connecting two nodes */
export interface CanvasEdge {
  /** Unique identifier for the edge */
  id: string;
  /** Source node ID */
  source: string;
  /** Target node ID */
  target: string;
  /** Optional source handle ID */
  sourceHandle?: string;
  /** Optional target handle ID */
  targetHandle?: string;
  /** Edge label */
  label?: string;
  /** Edge color */
  color?: string;
  /** Edge style */
  style?: 'solid' | 'dashed' | 'dotted';
}

// ============================================================================
// Canvas Data
// ============================================================================

/** Complete canvas file data structure */
export interface CanvasData {
  /** All nodes on the canvas */
  nodes: CanvasNodeData[];
  /** All edges connecting nodes */
  edges: CanvasEdge[];
  /** Canvas metadata */
  metadata?: {
    /** Canvas creation timestamp */
    created?: number;
    /** Canvas last modified timestamp */
    modified?: number;
    /** Default viewport position */
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
}

// ============================================================================
// React Flow Adapter Types
// ============================================================================

/** Props passed to custom React Flow nodes */
export interface TextCardNodeProps {
  id: string;
  data: {
    content: string;
    color?: CanvasNodeColor;
    onContentChange?: (id: string, content: string) => void;
    onColorChange?: (id: string, color: CanvasNodeColor) => void;
  };
  selected: boolean;
}

export interface NoteEmbedNodeProps {
  id: string;
  data: {
    path: string;
    title?: string;
    preview?: string;
    onOpenNote?: (path: string) => void;
  };
  selected: boolean;
}

export interface ImageNodeProps {
  id: string;
  data: {
    path: string;
    alt?: string;
    imageUrl?: string;
  };
  selected: boolean;
}

// ============================================================================
// Canvas State
// ============================================================================

/** Canvas view state */
export interface CanvasState {
  /** Path to the current canvas file */
  filePath: string | null;
  /** Canvas data */
  data: CanvasData;
  /** Whether the canvas has unsaved changes */
  isDirty: boolean;
  /** Currently selected node IDs */
  selectedNodes: string[];
  /** Currently selected edge IDs */
  selectedEdges: string[];
  /** Current viewport */
  viewport: {
    x: number;
    y: number;
    zoom: number;
  };
}

/** Default empty canvas data */
export const DEFAULT_CANVAS_DATA: CanvasData = {
  nodes: [],
  edges: [],
  metadata: {
    created: Date.now(),
    modified: Date.now(),
  },
};
