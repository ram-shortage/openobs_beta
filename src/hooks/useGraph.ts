import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';

// ============================================================================
// Types matching Rust GraphData response
// ============================================================================

/** Node type for graph nodes */
export type NodeType = 'note' | 'concept';

/** Edge type for graph edges */
export type EdgeType = 'direct' | 'concept';

/** Graph node from Rust backend */
export interface GraphNode {
  id: string;
  label: string;
  path: string;
  connections: number;
  /** Node type: "note" for actual notes, "concept" for shared wikilinks */
  nodeType: NodeType;
}

/** Graph edge from Rust backend */
export interface GraphEdge {
  source: string;
  target: string;
  /** Type of edge: "direct" or "concept" */
  edgeType: EdgeType;
  /** For concept edges, the shared concept name */
  concept?: string;
}

/** Information about a concept (shared wikilink to non-existent page) */
export interface ConceptInfo {
  name: string;
  count: number;
  notes: string[];
}

/** Graph data response from Rust */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** List of all concepts with their referencing notes */
  concepts: ConceptInfo[];
}

// ============================================================================
// D3 compatible types
// ============================================================================

/** D3 compatible node with simulation properties */
export interface D3Node extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
  /** Size based on connection count */
  size: number;
  /** Whether this is the center node (for local graph) */
  isCenter?: boolean;
  /** Folder path for color coding */
  folder: string;
  /** Tags associated with this note (if available) */
  tags?: string[];
}

/** D3 compatible edge */
export interface D3Edge {
  source: string | D3Node;
  target: string | D3Node;
  /** Type of edge: "direct" or "concept" */
  edgeType: EdgeType;
  /** For concept edges, the shared concept name */
  concept?: string;
}

/** Transformed graph data for D3 */
export interface D3GraphData {
  nodes: D3Node[];
  edges: D3Edge[];
  /** Concept information for the graph */
  concepts: ConceptInfo[];
}

// ============================================================================
// Filter options
// ============================================================================

export interface GraphFilterOptions {
  /** Filter to specific folder path */
  folderPath?: string;
  /** Filter to notes with specific tag */
  tag?: string;
  /** Whether to show orphan nodes (nodes with no connections) */
  showOrphans?: boolean;
  /** Whether to show concept links (connections through shared wikilinks) */
  showConceptLinks?: boolean;
}

// ============================================================================
// Color schemes
// ============================================================================

export type ColorScheme = 'folder' | 'connections' | 'default';

export const COLOR_SCHEMES: { id: ColorScheme; label: string }[] = [
  { id: 'default', label: 'Default' },
  { id: 'folder', label: 'By Folder' },
  { id: 'connections', label: 'By Connections' },
];

// ============================================================================
// Hook options
// ============================================================================

interface UseGraphOptions {
  /** Whether to automatically fetch graph data */
  autoFetch?: boolean;
  /** Filter options */
  filters?: GraphFilterOptions;
}

interface UseGraphResult {
  /** Raw graph data from backend */
  rawData: GraphData | null;
  /** Transformed data for D3 */
  graphData: D3GraphData | null;
  /** Whether data is loading */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Refresh the graph data */
  refresh: () => Promise<void>;
  /** Apply filters to existing data */
  applyFilters: (filters: GraphFilterOptions) => void;
  /** Current filters */
  currentFilters: GraphFilterOptions;
}

interface UseLocalGraphOptions extends UseGraphOptions {
  /** Path to center the graph on */
  centerPath: string | null;
  /** Depth of connections to show (1, 2, or 3) */
  depth?: number;
}

interface UseLocalGraphResult extends UseGraphResult {
  /** The center path */
  centerPath: string | null;
  /** Current depth */
  depth: number;
  /** Set the depth */
  setDepth: (depth: number) => void;
}

// ============================================================================
// Graph cache
// ============================================================================

const graphCache = new Map<string, { data: GraphData; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Get folder path from note path
 */
function getFolderPath(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash > 0 ? path.substring(0, lastSlash) : '/';
}

/**
 * Calculate node size based on connection count
 * Returns a value between minSize and maxSize
 */
function calculateNodeSize(connections: number, maxConnections: number): number {
  const minSize = 4;
  const maxSize = 20;

  if (maxConnections === 0) return minSize;

  const ratio = connections / maxConnections;
  return minSize + ratio * (maxSize - minSize);
}

/**
 * Transform raw graph data to D3-compatible format
 */
function transformToD3(
  data: GraphData,
  filters: GraphFilterOptions,
  centerPath?: string
): D3GraphData {
  const { folderPath, showOrphans = true, showConceptLinks = true } = filters;

  // Find max connections for size scaling
  const maxConnections = Math.max(...data.nodes.map(n => n.connections), 1);

  // Filter and transform nodes
  let filteredNodes = data.nodes.filter(node => {
    // Filter by folder path
    if (folderPath && !node.path.startsWith(folderPath)) {
      return false;
    }

    // Filter orphans
    if (!showOrphans && node.connections === 0) {
      return false;
    }

    return true;
  });

  // Create a set of valid node IDs for edge filtering
  const validNodeIds = new Set(filteredNodes.map(n => n.id));

  // Filter edges to only include valid nodes and respect concept link filter
  const filteredEdges = data.edges.filter(edge => {
    // Both nodes must be valid
    if (!validNodeIds.has(edge.source) || !validNodeIds.has(edge.target)) {
      return false;
    }

    // Filter out concept edges if showConceptLinks is false
    if (!showConceptLinks && edge.edgeType === 'concept') {
      return false;
    }

    return true;
  });

  // If filtering orphans, remove nodes that became orphans after edge filtering
  if (!showOrphans) {
    const connectedIds = new Set<string>();
    filteredEdges.forEach(edge => {
      connectedIds.add(edge.source);
      connectedIds.add(edge.target);
    });
    filteredNodes = filteredNodes.filter(n => connectedIds.has(n.id) || n.connections > 0);
  }

  // Transform nodes to D3 format
  const d3Nodes: D3Node[] = filteredNodes.map(node => ({
    ...node,
    size: calculateNodeSize(node.connections, maxConnections),
    isCenter: centerPath ? node.path === centerPath : false,
    folder: getFolderPath(node.path),
  }));

  // Transform edges to D3 format
  const d3Edges: D3Edge[] = filteredEdges.map(edge => ({
    source: edge.source,
    target: edge.target,
    edgeType: edge.edgeType,
    concept: edge.concept,
  }));

  // Filter concepts to only include those with notes in the filtered set
  const filteredConcepts = data.concepts.filter(c =>
    c.notes.some(notePath => validNodeIds.has(notePath))
  );

  return { nodes: d3Nodes, edges: d3Edges, concepts: filteredConcepts };
}

// ============================================================================
// Main hook for full graph
// ============================================================================

export function useGraph(options: UseGraphOptions = {}): UseGraphResult {
  const { autoFetch = true, filters: initialFilters = {} } = options;

  const [rawData, setRawData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<GraphFilterOptions>(initialFilters);

  const fetchInProgressRef = useRef(false);

  const fetchGraph = useCallback(async () => {
    if (fetchInProgressRef.current) return;

    // Check cache first
    const cached = graphCache.get('full');
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setRawData(cached.data);
      setError(null);
      return;
    }

    fetchInProgressRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      const data = await invoke<GraphData>('get_graph_data');
      setRawData(data);

      // Update cache
      graphCache.set('full', {
        data,
        timestamp: Date.now(),
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch graph data';
      setError(errorMessage);
      console.error('Error fetching graph data:', err);
    } finally {
      setIsLoading(false);
      fetchInProgressRef.current = false;
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    if (autoFetch) {
      fetchGraph();
    }
  }, [autoFetch, fetchGraph]);

  // Transform data with current filters
  const graphData = useMemo(() => {
    if (!rawData) return null;
    return transformToD3(rawData, currentFilters);
  }, [rawData, currentFilters]);

  const applyFilters = useCallback((newFilters: GraphFilterOptions) => {
    setCurrentFilters(newFilters);
  }, []);

  const refresh = useCallback(async () => {
    graphCache.delete('full');
    await fetchGraph();
  }, [fetchGraph]);

  return {
    rawData,
    graphData,
    isLoading,
    error,
    refresh,
    applyFilters,
    currentFilters,
  };
}

// ============================================================================
// Hook for local graph
// ============================================================================

export function useLocalGraph(options: UseLocalGraphOptions): UseLocalGraphResult {
  const {
    centerPath,
    depth: initialDepth = 1,
    autoFetch = true,
    filters: initialFilters = {}
  } = options;

  const [rawData, setRawData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentFilters, setCurrentFilters] = useState<GraphFilterOptions>(initialFilters);
  const [depth, setDepth] = useState(initialDepth);

  const currentPathRef = useRef<string | null>(null);

  const fetchLocalGraph = useCallback(async () => {
    if (!centerPath) {
      setRawData(null);
      setError(null);
      return;
    }

    // Check cache
    const cacheKey = `local:${centerPath}:${depth}`;
    const cached = graphCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setRawData(cached.data);
      setError(null);
      return;
    }

    currentPathRef.current = centerPath;
    setIsLoading(true);
    setError(null);

    try {
      const data = await invoke<GraphData>('get_local_graph', {
        path: centerPath,
        depth
      });

      // Only update if still the current path
      if (currentPathRef.current === centerPath) {
        setRawData(data);

        // Update cache
        graphCache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
      }
    } catch (err) {
      if (currentPathRef.current === centerPath) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch local graph';
        setError(errorMessage);
        console.error('Error fetching local graph:', err);
      }
    } finally {
      if (currentPathRef.current === centerPath) {
        setIsLoading(false);
      }
    }
  }, [centerPath, depth]);

  // Fetch when path or depth changes
  useEffect(() => {
    if (autoFetch) {
      fetchLocalGraph();
    }
  }, [autoFetch, fetchLocalGraph]);

  // Transform data with current filters
  const graphData = useMemo(() => {
    if (!rawData) return null;
    return transformToD3(rawData, currentFilters, centerPath ?? undefined);
  }, [rawData, currentFilters, centerPath]);

  const applyFilters = useCallback((newFilters: GraphFilterOptions) => {
    setCurrentFilters(newFilters);
  }, []);

  const refresh = useCallback(async () => {
    if (centerPath) {
      const cacheKey = `local:${centerPath}:${depth}`;
      graphCache.delete(cacheKey);
    }
    await fetchLocalGraph();
  }, [centerPath, depth, fetchLocalGraph]);

  return {
    rawData,
    graphData,
    isLoading,
    error,
    refresh,
    applyFilters,
    currentFilters,
    centerPath,
    depth,
    setDepth,
  };
}

// ============================================================================
// Cache utilities
// ============================================================================

/**
 * Clear the graph cache
 */
export function clearGraphCache(key?: string): void {
  if (key) {
    graphCache.delete(key);
  } else {
    graphCache.clear();
  }
}

/**
 * Get unique folders from graph data (for filtering)
 */
export function getUniqueFolders(data: GraphData | null): string[] {
  if (!data) return [];

  const folders = new Set<string>();
  data.nodes.forEach(node => {
    folders.add(getFolderPath(node.path));
  });

  return Array.from(folders).sort();
}

/**
 * Get unique tags from graph data (for filtering)
 * Note: This requires tag data to be included in GraphNode from backend
 */
export function getUniqueTags(data: D3GraphData | null): string[] {
  if (!data) return [];

  const tags = new Set<string>();
  data.nodes.forEach(node => {
    node.tags?.forEach(tag => tags.add(tag));
  });

  return Array.from(tags).sort();
}
