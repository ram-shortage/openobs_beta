import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Maximize2, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { GraphControls } from './GraphControls';
import { useLocalGraph, type D3Node, type D3Edge, type ColorScheme, type GraphFilterOptions } from '../../hooks/useGraph';

// ============================================================================
// Types
// ============================================================================

interface LocalGraphProps {
  /** Path of the note to center the graph on */
  centerPath: string | null;
  /** Initial depth of connections to show (1, 2, or 3) */
  initialDepth?: number;
  /** Callback when a node is clicked */
  onNodeClick?: (path: string) => void;
  /** Initial filter options */
  initialFilters?: GraphFilterOptions;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Color palettes
// ============================================================================

const FOLDER_COLORS = d3.schemeTableau10;
const CONNECTION_COLOR_SCALE = d3.scaleSequential(d3.interpolateViridis);

const DEFAULT_NODE_COLOR = '#8b5cf6';
const CENTER_NODE_COLOR = '#ef4444'; // Red for center node
const HIGHLIGHTED_NODE_COLOR = '#f59e0b';
const EDGE_COLOR = '#4b5563';
const HIGHLIGHTED_EDGE_COLOR = '#8b5cf6';

// ============================================================================
// Component
// ============================================================================

export function LocalGraph({
  centerPath,
  initialDepth = 1,
  onNodeClick,
  initialFilters = { showOrphans: true },
  className,
}: LocalGraphProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);

  // State
  const [showControls, setShowControls] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  // Graph data
  const {
    rawData,
    graphData,
    isLoading,
    error,
    refresh,
    applyFilters,
    currentFilters,
    depth,
    setDepth,
  } = useLocalGraph({
    centerPath,
    depth: initialDepth,
    filters: initialFilters,
  });

  // Create folder color map
  const folderColorMap = useMemo(() => {
    if (!graphData) return new Map<string, string>();

    const folders = [...new Set(graphData.nodes.map(n => n.folder))].sort();
    const map = new Map<string, string>();
    folders.forEach((folder, i) => {
      map.set(folder, FOLDER_COLORS[i % FOLDER_COLORS.length]);
    });
    return map;
  }, [graphData]);

  // Get node color based on scheme
  const getNodeColor = useCallback((node: D3Node): string => {
    // Center node is always red
    if (node.isCenter) {
      return CENTER_NODE_COLOR;
    }

    if (hoveredNodeId === node.id) {
      return HIGHLIGHTED_NODE_COLOR;
    }

    switch (colorScheme) {
      case 'folder':
        return folderColorMap.get(node.folder) || DEFAULT_NODE_COLOR;
      case 'connections': {
        const maxConnections = graphData
          ? Math.max(...graphData.nodes.map(n => n.connections), 1)
          : 1;
        CONNECTION_COLOR_SCALE.domain([0, maxConnections]);
        return CONNECTION_COLOR_SCALE(node.connections);
      }
      default:
        return DEFAULT_NODE_COLOR;
    }
  }, [colorScheme, folderColorMap, graphData, hoveredNodeId]);

  // Handle resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({
        width: rect.width || 400,
        height: rect.height || 300,
      });
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, []);

  // Initialize and update D3 graph
  useEffect(() => {
    if (!svgRef.current || !graphData || graphData.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;

    // Clear previous content
    svg.selectAll('*').remove();

    // Create main group for zoom/pan
    const g = svg.append('g');

    // Setup zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Double-click to reset zoom
    svg.on('dblclick.zoom', () => {
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(0.9)
      );
    });

    // Create a map for quick node lookup
    const nodeMap = new Map<string, D3Node>();
    graphData.nodes.forEach(node => nodeMap.set(node.id, node));

    // Find center node and position it
    const centerNode = graphData.nodes.find(n => n.isCenter);
    if (centerNode) {
      centerNode.fx = width / 2;
      centerNode.fy = height / 2;
    }

    // Resolve edge references to actual node objects
    const links: { source: D3Node; target: D3Node }[] = graphData.edges
      .map(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        const source = nodeMap.get(sourceId);
        const target = nodeMap.get(targetId);
        if (source && target) {
          return { source, target };
        }
        return null;
      })
      .filter((link): link is { source: D3Node; target: D3Node } => link !== null);

    // Create simulation with stronger centering for local graph
    const simulation = d3.forceSimulation<D3Node>(graphData.nodes)
      .force('link', d3.forceLink<D3Node, { source: D3Node; target: D3Node }>(links)
        .id(d => d.id)
        .distance(60)
        .strength(0.7))
      .force('charge', d3.forceManyBody().strength(-150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<D3Node>().radius(d => d.size + 4))
      .force('x', d3.forceX(width / 2).strength(0.1))
      .force('y', d3.forceY(height / 2).strength(0.1));

    simulationRef.current = simulation as d3.Simulation<D3Node, D3Edge>;

    // Create arrow marker
    svg.append('defs').append('marker')
      .attr('id', 'local-arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', EDGE_COLOR);

    // Create edges
    const edgeElements = g.append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', EDGE_COLOR)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1)
      .attr('marker-end', 'url(#local-arrowhead)');

    // Create node groups
    const nodeGroups = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, D3Node>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            // Keep center node fixed
            if (!d.isCenter) {
              d.fx = null;
              d.fy = null;
            }
          })
      );

    // Add circles to nodes
    nodeGroups.append('circle')
      .attr('r', d => d.isCenter ? d.size + 2 : d.size)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', d => d.isCenter ? '#ffffff' : '#ffffff')
      .attr('stroke-width', d => d.isCenter ? 2 : 1.5)
      .attr('stroke-opacity', 0.8);

    // Add labels to nodes
    nodeGroups.append('text')
      .text(d => d.label)
      .attr('x', d => (d.isCenter ? d.size + 4 : d.size + 3))
      .attr('y', 3)
      .attr('font-size', d => d.isCenter ? '11px' : '9px')
      .attr('font-weight', d => d.isCenter ? 'bold' : 'normal')
      .attr('fill', '#9ca3af')
      .attr('pointer-events', 'none');

    // Node interactions
    nodeGroups
      .on('click', (_event, d) => {
        if (onNodeClick) {
          onNodeClick(d.path);
        }
      })
      .on('mouseenter', (_event, d) => {
        setHoveredNodeId(d.id);

        // Find connected nodes
        const connectedIds = new Set<string>();
        connectedIds.add(d.id);
        links.forEach(link => {
          if (link.source.id === d.id) connectedIds.add(link.target.id);
          if (link.target.id === d.id) connectedIds.add(link.source.id);
        });

        // Highlight connected nodes
        nodeGroups.selectAll('circle')
          .attr('opacity', (n: unknown) => connectedIds.has((n as D3Node).id) ? 1 : 0.3);
        nodeGroups.selectAll('text')
          .attr('opacity', (n: unknown) => connectedIds.has((n as D3Node).id) ? 1 : 0.3);

        // Highlight connected edges
        edgeElements
          .attr('stroke', link => {
            if (link.source.id === d.id || link.target.id === d.id) {
              return HIGHLIGHTED_EDGE_COLOR;
            }
            return EDGE_COLOR;
          })
          .attr('stroke-opacity', link => {
            if (link.source.id === d.id || link.target.id === d.id) {
              return 1;
            }
            return 0.1;
          })
          .attr('stroke-width', link => {
            if (link.source.id === d.id || link.target.id === d.id) {
              return 2;
            }
            return 1;
          });

        // Update hovered node color (unless it's center)
        if (!d.isCenter) {
          d3.select(_event.currentTarget)
            .select('circle')
            .attr('fill', HIGHLIGHTED_NODE_COLOR);
        }
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);

        // Reset all nodes
        nodeGroups.selectAll('circle')
          .attr('opacity', 1)
          .attr('fill', (d: unknown) => getNodeColor(d as D3Node));
        nodeGroups.selectAll('text')
          .attr('opacity', 1);

        // Reset all edges
        edgeElements
          .attr('stroke', EDGE_COLOR)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', 1);
      });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      edgeElements
        .attr('x1', d => d.source.x ?? 0)
        .attr('y1', d => d.source.y ?? 0)
        .attr('x2', d => d.target.x ?? 0)
        .attr('y2', d => d.target.y ?? 0);

      nodeGroups.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graphData, dimensions, getNodeColor, onNodeClick]);

  // Update node colors when color scheme changes
  useEffect(() => {
    if (!svgRef.current || !graphData) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('.nodes circle')
      .attr('fill', (d: unknown) => getNodeColor(d as D3Node));
  }, [colorScheme, graphData, getNodeColor]);

  // Handle reset view
  const handleResetView = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.2, 4]);

    svg.transition().duration(500).call(
      zoom.transform,
      d3.zoomIdentity.translate(dimensions.width / 2, dimensions.height / 2).scale(0.9).translate(-dimensions.width / 2, -dimensions.height / 2)
    );
  }, [dimensions]);

  // Render
  if (!centerPath) {
    return (
      <div
        className={cn(
          'flex items-center justify-center h-full',
          'bg-background-primary text-text-muted text-sm',
          className
        )}
      >
        Select a note to see its local graph
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full min-h-[200px]',
        'bg-background-primary',
        className
      )}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-primary/80 z-10">
          <Spinner size="md" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
          <p className="text-text-muted text-xs">{error}</p>
          <Button variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && graphData && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <p className="text-text-muted text-xs">No linked notes</p>
        </div>
      )}

      {/* Graph SVG */}
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />

      {/* Toolbar */}
      <div className="absolute top-2 right-2 flex items-center gap-1 z-20">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={handleResetView}
          title="Reset view"
        >
          <Maximize2 className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={refresh}
          title="Refresh"
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button
          variant={showControls ? 'primary' : 'ghost'}
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowControls(!showControls)}
          title="Controls"
        >
          <Settings className="h-3 w-3" />
        </Button>
      </div>

      {/* Depth indicator */}
      <div className="absolute top-2 left-2 z-20">
        <span className="text-[10px] text-text-faint bg-background-secondary/80 px-1.5 py-0.5 rounded">
          Depth: {depth}
        </span>
      </div>

      {/* Controls panel */}
      {showControls && (
        <div className="absolute top-10 right-2 w-56 z-20">
          <GraphControls
            filters={currentFilters}
            onFiltersChange={applyFilters}
            rawData={rawData}
            isLocalGraph={true}
            depth={depth}
            onDepthChange={setDepth}
            colorScheme={colorScheme}
            onColorSchemeChange={setColorScheme}
            className="text-xs"
          />
        </div>
      )}

      {/* Center node indicator */}
      {graphData && graphData.nodes.length > 0 && (
        <div className="absolute bottom-2 left-2 z-20">
          <div className="flex items-center gap-1.5 text-[10px] text-text-faint bg-background-secondary/80 px-1.5 py-0.5 rounded">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: CENTER_NODE_COLOR }} />
            <span>Current note</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default LocalGraph;
