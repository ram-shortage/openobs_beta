import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  NodeTypes,
  OnNodesChange,
  OnEdgesChange,
  OnConnect,
  ReactFlowInstance,
  Viewport,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { cn, generateId } from '../../lib/utils';
import { readFile, writeFile } from '../../lib/tauri';
import { TextCardNode, NoteEmbedNode, ImageNode } from './nodes';
import { CanvasToolbar } from './CanvasToolbar';
import {
  CanvasData,
  CanvasNodeData,
  CanvasEdge as CanvasEdgeType,
  CanvasNodeColor,
} from '../../types/canvas';

// Define custom node types
const nodeTypes: NodeTypes = {
  text: TextCardNode,
  note: NoteEmbedNode,
  image: ImageNode,
};

interface CanvasViewProps {
  /** Path to the .canvas file (relative to vault root) */
  filePath?: string;
  /** Callback when opening a note from the canvas */
  onOpenNote?: (path: string) => void;
  /** Class name for the container */
  className?: string;
}

// Convert canvas file format to React Flow nodes
function canvasToReactFlowNodes(
  canvasNodes: CanvasNodeData[],
  callbacks: {
    onContentChange: (id: string, content: string) => void;
    onColorChange: (id: string, color: CanvasNodeColor) => void;
    onOpenNote: (path: string) => void;
  }
): Node[] {
  return canvasNodes.map((node) => {
    const baseNode = {
      id: node.id,
      position: { x: node.x, y: node.y },
      style: { width: node.width, height: node.height },
    };

    switch (node.type) {
      case 'text':
        return {
          ...baseNode,
          type: 'text',
          data: {
            content: node.content,
            color: node.color,
            onContentChange: callbacks.onContentChange,
            onColorChange: callbacks.onColorChange,
          },
        };
      case 'note':
        return {
          ...baseNode,
          type: 'note',
          data: {
            path: node.path,
            onOpenNote: callbacks.onOpenNote,
          },
        };
      case 'image':
        return {
          ...baseNode,
          type: 'image',
          data: {
            path: node.path,
            alt: node.alt,
          },
        };
      case 'group':
        return {
          ...baseNode,
          type: 'group',
          data: {
            label: node.label,
          },
        };
      default:
        // Default fallback - treat as text node
        return {
          ...baseNode,
          type: 'text',
          data: {
            content: '',
            color: 'default',
            onContentChange: callbacks.onContentChange,
            onColorChange: callbacks.onColorChange,
          },
        };
    }
  });
}

// Convert canvas edges to React Flow edges
function canvasToReactFlowEdges(canvasEdges: CanvasEdgeType[]): Edge[] {
  return canvasEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    style: {
      stroke: edge.color,
      strokeDasharray: edge.style === 'dashed' ? '5,5' : edge.style === 'dotted' ? '2,2' : undefined,
    },
  }));
}

// Convert React Flow nodes back to canvas format
function reactFlowToCanvasNodes(nodes: Node[]): CanvasNodeData[] {
  return nodes.map((node) => {
    const baseNode = {
      id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: (node.style?.width as number) || (node.width as number) || 200,
      height: (node.style?.height as number) || (node.height as number) || 100,
      color: node.data?.color as CanvasNodeColor | undefined,
    };

    switch (node.type) {
      case 'text':
        return {
          ...baseNode,
          type: 'text' as const,
          content: node.data?.content || '',
        };
      case 'note':
        return {
          ...baseNode,
          type: 'note' as const,
          path: node.data?.path || '',
        };
      case 'image':
        return {
          ...baseNode,
          type: 'image' as const,
          path: node.data?.path || '',
          alt: node.data?.alt,
        };
      case 'group':
        return {
          ...baseNode,
          type: 'group' as const,
          label: node.data?.label,
        };
      default:
        return {
          ...baseNode,
          type: 'text' as const,
          content: '',
        };
    }
  });
}

// Convert React Flow edges back to canvas format
function reactFlowToCanvasEdges(edges: Edge[]): CanvasEdgeType[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle || undefined,
    targetHandle: edge.targetHandle || undefined,
    label: edge.label as string | undefined,
  }));
}

export function CanvasView({ filePath, onOpenNote, className }: CanvasViewProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [selectedColor, setSelectedColor] = useState<CanvasNodeColor>('default');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });

  // Get selected nodes
  const selectedNodes = useMemo(
    () => nodes.filter((node) => node.selected),
    [nodes]
  );

  // Callbacks for node interactions
  const handleContentChange = useCallback(
    (nodeId: string, content: string) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, content } }
            : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  const handleColorChange = useCallback(
    (nodeId: string, color: CanvasNodeColor) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, color } }
            : node
        )
      );
      setIsDirty(true);
    },
    [setNodes]
  );

  const handleOpenNote = useCallback(
    (path: string) => {
      if (onOpenNote) {
        onOpenNote(path);
      }
    },
    [onOpenNote]
  );

  // Load canvas from file
  const loadCanvas = useCallback(async () => {
    if (!filePath) {
      // Initialize with empty canvas
      setNodes([]);
      setEdges([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const fileContent = await readFile(filePath);
      const canvasData: CanvasData = JSON.parse(fileContent.content);

      const callbacks = {
        onContentChange: handleContentChange,
        onColorChange: handleColorChange,
        onOpenNote: handleOpenNote,
      };

      const flowNodes = canvasToReactFlowNodes(canvasData.nodes, callbacks);
      const flowEdges = canvasToReactFlowEdges(canvasData.edges);

      setNodes(flowNodes);
      setEdges(flowEdges);

      // Restore viewport if available
      if (canvasData.metadata?.viewport) {
        setViewport(canvasData.metadata.viewport);
      }

      setIsDirty(false);
    } catch (err) {
      console.error('Failed to load canvas:', err);
      // If file doesn't exist, start with empty canvas
      setNodes([]);
      setEdges([]);
      setError(null);
    } finally {
      setIsLoading(false);
    }
  }, [filePath, handleContentChange, handleColorChange, handleOpenNote, setNodes, setEdges]);

  // Save canvas to file
  const saveCanvas = useCallback(async () => {
    if (!filePath) return;

    const canvasData: CanvasData = {
      nodes: reactFlowToCanvasNodes(nodes),
      edges: reactFlowToCanvasEdges(edges),
      metadata: {
        modified: Date.now(),
        viewport: viewport,
      },
    };

    try {
      await writeFile(filePath, JSON.stringify(canvasData, null, 2));
      setIsDirty(false);
    } catch (err) {
      console.error('Failed to save canvas:', err);
      setError('Failed to save canvas');
    }
  }, [filePath, nodes, edges, viewport]);

  // Load canvas on mount or when file path changes
  useEffect(() => {
    loadCanvas();
  }, [loadCanvas]);

  // Auto-save when dirty (debounced)
  useEffect(() => {
    if (!isDirty || !filePath) return;

    const timer = setTimeout(() => {
      saveCanvas();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isDirty, filePath, saveCanvas]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save: Cmd/Ctrl + S
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        saveCanvas();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveCanvas]);

  // Handle edge connections
  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, id: generateId() }, eds));
      setIsDirty(true);
    },
    [setEdges]
  );

  // Handle node/edge changes to mark dirty
  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      // Check if changes affect position or dimensions
      const hasPositionOrSizeChange = changes.some(
        (change) =>
          change.type === 'position' ||
          change.type === 'dimensions' ||
          change.type === 'remove'
      );
      if (hasPositionOrSizeChange) {
        setIsDirty(true);
      }
    },
    [onNodesChange]
  );

  const handleEdgesChange: OnEdgesChange = useCallback(
    (changes) => {
      onEdgesChange(changes);
      setIsDirty(true);
    },
    [onEdgesChange]
  );

  // Add a text card node
  const handleAddTextCard = useCallback(() => {
    const center = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
    const newNode: Node = {
      id: generateId(),
      type: 'text',
      position: { x: -center.x / center.zoom + 200, y: -center.y / center.zoom + 200 },
      style: { width: 200, height: 100 },
      data: {
        content: '',
        color: 'default',
        onContentChange: handleContentChange,
        onColorChange: handleColorChange,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setIsDirty(true);
  }, [reactFlowInstance, handleContentChange, handleColorChange, setNodes]);

  // Add a note embed node
  const handleAddNoteEmbed = useCallback(() => {
    // TODO: Open note picker dialog
    const center = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
    const newNode: Node = {
      id: generateId(),
      type: 'note',
      position: { x: -center.x / center.zoom + 200, y: -center.y / center.zoom + 200 },
      style: { width: 300, height: 200 },
      data: {
        path: '', // TODO: Get from note picker
        onOpenNote: handleOpenNote,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setIsDirty(true);
  }, [reactFlowInstance, handleOpenNote, setNodes]);

  // Add an image node
  const handleAddImage = useCallback(() => {
    // TODO: Open file picker for images
    const center = reactFlowInstance?.getViewport() || { x: 0, y: 0, zoom: 1 };
    const newNode: Node = {
      id: generateId(),
      type: 'image',
      position: { x: -center.x / center.zoom + 200, y: -center.y / center.zoom + 200 },
      style: { width: 300, height: 200 },
      data: {
        path: '', // TODO: Get from file picker
        alt: 'Image',
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setIsDirty(true);
  }, [reactFlowInstance, setNodes]);

  // Handle color change for selected nodes
  const handleToolbarColorChange = useCallback(
    (color: CanvasNodeColor) => {
      setSelectedColor(color);
      selectedNodes.forEach((node) => {
        handleColorChange(node.id, color);
      });
    },
    [selectedNodes, handleColorChange]
  );

  // Export canvas as image
  const handleExportImage = useCallback(async () => {
    if (!reactFlowInstance) return;

    try {
      // Use html-to-image or similar library
      // For now, we'll just log a message
      console.log('Export as image - not yet implemented');
      // TODO: Implement using html-to-image or @react-flow/image-export
    } catch (err) {
      console.error('Failed to export image:', err);
    }
  }, [reactFlowInstance]);

  // Handle viewport changes
  const handleMoveEnd = useCallback((_event: unknown, newViewport: Viewport) => {
    setViewport(newViewport);
    setIsDirty(true);
  }, []);

  if (isLoading) {
    return (
      <div className={cn('w-full h-full flex items-center justify-center bg-background-primary', className)}>
        <div className="flex flex-col items-center gap-2 text-text-muted">
          <div className="animate-spin h-8 w-8 border-2 border-interactive-accent border-t-transparent rounded-full" />
          <span>Loading canvas...</span>
        </div>
      </div>
    );
  }

  return (
    <div ref={reactFlowWrapper} className={cn('w-full h-full', className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={onConnect}
        onInit={setReactFlowInstance}
        onMoveEnd={handleMoveEnd}
        nodeTypes={nodeTypes}
        defaultViewport={viewport}
        fitView={!filePath}
        panOnScroll
        selectionOnDrag
        panOnDrag={[1, 2]} // Middle and right mouse buttons
        panActivationKeyCode={null} // Disable space-to-pan so typing works in nodes
        selectNodesOnDrag={false}
        minZoom={0.1}
        maxZoom={4}
        className="bg-background-primary"
        proOptions={{ hideAttribution: true }}
      >
        {/* Toolbar */}
        <CanvasToolbar
          onAddTextCard={handleAddTextCard}
          onAddNoteEmbed={handleAddNoteEmbed}
          onAddImage={handleAddImage}
          onColorChange={handleToolbarColorChange}
          onExportImage={handleExportImage}
          selectedColor={selectedColor}
          hasSelection={selectedNodes.length > 0}
        />

        {/* Controls */}
        <Controls
          className="bg-background-primary border border-background-modifier-border rounded-lg overflow-hidden"
          showInteractive={false}
        />

        {/* Minimap */}
        <MiniMap
          className="bg-background-secondary border border-background-modifier-border rounded-lg overflow-hidden"
          nodeColor={(node) => {
            const color = node.data?.color as CanvasNodeColor | undefined;
            if (color && color !== 'default') {
              const colorMap: Record<string, string> = {
                red: '#ef4444',
                orange: '#f97316',
                yellow: '#eab308',
                green: '#22c55e',
                cyan: '#06b6d4',
                blue: '#3b82f6',
                purple: '#a855f7',
                pink: '#ec4899',
              };
              return colorMap[color] || '#6b7280';
            }
            return '#6b7280';
          }}
          maskColor="rgba(0, 0, 0, 0.2)"
        />

        {/* Background */}
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--background-modifier-border)"
        />

        {/* Status indicator */}
        <Panel position="bottom-left" className="text-xs text-text-muted">
          {isDirty ? 'Unsaved changes' : 'Saved'}
        </Panel>

        {/* Error display */}
        {error && (
          <Panel position="top-right" className="bg-red-500/20 text-red-400 px-3 py-2 rounded-lg border border-red-500">
            {error}
          </Panel>
        )}
      </ReactFlow>
    </div>
  );
}

CanvasView.displayName = 'CanvasView';
