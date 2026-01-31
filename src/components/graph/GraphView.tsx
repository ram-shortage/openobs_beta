import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { RefreshCw, Maximize2, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { GraphControls } from './GraphControls';
import { useGraph, type D3Node, type D3Edge, type ColorScheme, type GraphFilterOptions } from '../../hooks/useGraph';

// ============================================================================
// Types
// ============================================================================

interface GraphViewProps {
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

// Folder-based color palette (categorical)
const FOLDER_COLORS = d3.schemeTableau10;

// Connection-based color scale (sequential)
const CONNECTION_COLOR_SCALE = d3.scaleSequential(d3.interpolateViridis);

// Default node color
const DEFAULT_NODE_COLOR = '#8b5cf6'; // Purple/violet
const HIGHLIGHTED_NODE_COLOR = '#f59e0b'; // Amber for highlighted
const EDGE_COLOR = '#4b5563'; // Gray
const CONCEPT_EDGE_COLOR = '#10b981'; // Emerald/green for concept edges
const HIGHLIGHTED_EDGE_COLOR = '#8b5cf6'; // Purple for highlighted edges
const HIGHLIGHTED_CONCEPT_EDGE_COLOR = '#10b981'; // Green for highlighted concept edges

// ============================================================================
// Component
// ============================================================================

export function GraphView({
  onNodeClick,
  initialFilters = { showOrphans: true, showConceptLinks: true },
  className,
}: GraphViewProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simulationRef = useRef<d3.Simulation<D3Node, D3Edge> | null>(null);

  // State
  const [showControls, setShowControls] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>('default');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Graph data
  const {
    rawData,
    graphData,
    isLoading,
    error,
    refresh,
    applyFilters,
    currentFilters,
  } = useGraph({ filters: initialFilters });

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
        width: rect.width || 800,
        height: rect.height || 600,
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
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Double-click to reset zoom
    svg.on('dblclick.zoom', () => {
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8)
      );
    });

    // Create a map for quick node lookup
    const nodeMap = new Map<string, D3Node>();
    graphData.nodes.forEach(node => nodeMap.set(node.id, node));

    // Link type with proper typing
    type GraphLink = { source: D3Node; target: D3Node; edgeType: string; concept?: string };

    // Resolve edge references to actual node objects
    const links: GraphLink[] = graphData.edges
      .map(edge => {
        const sourceId = typeof edge.source === 'string' ? edge.source : edge.source.id;
        const targetId = typeof edge.target === 'string' ? edge.target : edge.target.id;
        const source = nodeMap.get(sourceId);
        const target = nodeMap.get(targetId);
        if (source && target) {
          return {
            source,
            target,
            edgeType: edge.edgeType as string,
            concept: edge.concept
          } as GraphLink;
        }
        return null;
      })
      .filter((link): link is GraphLink => link !== null);

    // Create simulation
    const simulation = d3.forceSimulation<D3Node>(graphData.nodes)
      .force('link', d3.forceLink<D3Node, { source: D3Node; target: D3Node; edgeType: string }>(links)
        .id(d => d.id)
        .distance(d => d.edgeType === 'concept' ? 120 : 80) // Concept links are longer
        .strength(d => d.edgeType === 'concept' ? 0.3 : 0.5)) // Concept links are weaker
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<D3Node>().radius(d => d.size + 5));

    simulationRef.current = simulation as d3.Simulation<D3Node, D3Edge>;

    // Create arrow markers for directed edges
    const defs = svg.append('defs');

    // Direct edge arrow
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', EDGE_COLOR);

    // Concept edge arrow (no arrow, just for consistency)
    defs.append('marker')
      .attr('id', 'arrowhead-concept')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('fill', CONCEPT_EDGE_COLOR);

    // Create edges
    const edgeElements = g.append('g')
      .attr('class', 'edges')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => d.edgeType === 'concept' ? CONCEPT_EDGE_COLOR : EDGE_COLOR)
      .attr('stroke-opacity', d => d.edgeType === 'concept' ? 0.4 : 0.6)
      .attr('stroke-width', d => d.edgeType === 'concept' ? 1.5 : 1)
      .attr('stroke-dasharray', d => d.edgeType === 'concept' ? '4,4' : 'none')
      .attr('marker-end', d => d.edgeType === 'concept' ? 'none' : 'url(#arrowhead)');

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
            d.fx = null;
            d.fy = null;
          })
      );

    // Add circles to nodes
    nodeGroups.append('circle')
      .attr('r', d => d.size)
      .attr('fill', d => getNodeColor(d))
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.8);

    // Add labels to nodes
    nodeGroups.append('text')
      .text(d => d.label)
      .attr('x', d => d.size + 4)
      .attr('y', 3)
      .attr('font-size', '10px')
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
              return link.edgeType === 'concept' ? HIGHLIGHTED_CONCEPT_EDGE_COLOR : HIGHLIGHTED_EDGE_COLOR;
            }
            return link.edgeType === 'concept' ? CONCEPT_EDGE_COLOR : EDGE_COLOR;
          })
          .attr('stroke-opacity', link => {
            if (link.source.id === d.id || link.target.id === d.id) {
              return 1;
            }
            return 0.1;
          })
          .attr('stroke-width', link => {
            if (link.source.id === d.id || link.target.id === d.id) {
              return link.edgeType === 'concept' ? 2.5 : 2;
            }
            return link.edgeType === 'concept' ? 1.5 : 1;
          });

        // Update hovered node color
        d3.select(_event.currentTarget)
          .select('circle')
          .attr('fill', HIGHLIGHTED_NODE_COLOR);
      })
      .on('mouseleave', () => {
        setHoveredNodeId(null);

        // Reset all nodes
        nodeGroups.selectAll('circle')
          .attr('opacity', 1)
          .attr('fill', (d: unknown) => getNodeColor(d as D3Node));
        nodeGroups.selectAll('text')
          .attr('opacity', 1);

        // Reset all edges with proper colors based on edge type
        edgeElements
          .attr('stroke', (d: { edgeType: string }) => d.edgeType === 'concept' ? CONCEPT_EDGE_COLOR : EDGE_COLOR)
          .attr('stroke-opacity', (d: { edgeType: string }) => d.edgeType === 'concept' ? 0.4 : 0.6)
          .attr('stroke-width', (d: { edgeType: string }) => d.edgeType === 'concept' ? 1.5 : 1);
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

    // Initial zoom to fit
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(width / 2, height / 2).scale(0.8).translate(-width / 2, -height / 2)
    );

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
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]);

    svg.transition().duration(500).call(
      zoom.transform,
      d3.zoomIdentity
        .translate(dimensions.width / 2, dimensions.height / 2)
        .scale(0.8)
        .translate(-dimensions.width / 2, -dimensions.height / 2)
    );
  }, [dimensions]);

  // Render
  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full',
        'bg-background-primary',
        className
      )}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background-primary/80 z-10">
          <Spinner size="lg" />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
          <p className="text-text-muted text-sm">{error}</p>
          <Button variant="secondary" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && graphData && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
          <p className="text-text-muted text-sm">No notes to display</p>
          <p className="text-text-faint text-xs">Create some notes to see them here</p>
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
      <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
        <Button
          variant="secondary"
          size="icon"
          onClick={handleResetView}
          title="Reset view"
        >
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={refresh}
          title="Refresh graph"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button
          variant={showControls ? 'primary' : 'secondary'}
          size="icon"
          onClick={() => setShowControls(!showControls)}
          title="Graph controls"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Controls panel */}
      {showControls && (
        <div className="absolute top-14 right-3 w-64 z-20">
          <GraphControls
            filters={currentFilters}
            onFiltersChange={applyFilters}
            rawData={rawData}
            colorScheme={colorScheme}
            onColorSchemeChange={setColorScheme}
          />
        </div>
      )}

      {/* Legend */}
      {graphData && graphData.nodes.length > 0 && (
        <div className="absolute bottom-3 left-3 p-2 bg-background-secondary/90 rounded-lg border border-background-modifier-border z-20">
          {/* Edge type legend - always show when there are concept links */}
          {graphData.edges.some(e => e.edgeType === 'concept') && (
            <div className="mb-2">
              <div className="text-xs text-text-muted mb-1">Link Types</div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs">
                  <div className="w-6 h-0.5" style={{ backgroundColor: EDGE_COLOR }} />
                  <span className="text-text-faint">Direct link</span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <div
                    className="w-6 h-0.5"
                    style={{
                      backgroundColor: CONCEPT_EDGE_COLOR,
                      backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, #1e293b 2px, #1e293b 4px)'
                    }}
                  />
                  <span className="text-text-faint">Shared concept</span>
                </div>
              </div>
            </div>
          )}

          {/* Color scheme legend */}
          {colorScheme !== 'default' && (
            <>
              <div className="text-xs text-text-muted mb-1">
                {colorScheme === 'folder' ? 'Folders' : 'Connections'}
              </div>
              {colorScheme === 'folder' && (
                <div className="flex flex-col gap-1 max-h-32 overflow-y-auto">
                  {[...folderColorMap.entries()].slice(0, 8).map(([folder, color]) => (
                    <div key={folder} className="flex items-center gap-2 text-xs">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-text-faint truncate max-w-[120px]">
                        {folder === '/' ? '(root)' : folder}
                      </span>
                    </div>
                  ))}
                  {folderColorMap.size > 8 && (
                    <span className="text-text-faint text-[10px]">
                      +{folderColorMap.size - 8} more
                    </span>
                  )}
                </div>
              )}
              {colorScheme === 'connections' && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-faint">Few</span>
                  <div
                    className="w-20 h-2 rounded"
                    style={{
                      background: `linear-gradient(to right, ${CONNECTION_COLOR_SCALE(0)}, ${CONNECTION_COLOR_SCALE(0.5)}, ${CONNECTION_COLOR_SCALE(1)})`
                    }}
                  />
                  <span className="text-[10px] text-text-faint">Many</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default GraphView;
