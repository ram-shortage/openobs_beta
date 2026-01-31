import React, { useCallback, useMemo } from 'react';
import { Filter, Eye, EyeOff, Palette, Layers, Link2, Link2Off } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import type { GraphFilterOptions, ColorScheme, GraphData } from '../../hooks/useGraph';
import { COLOR_SCHEMES, getUniqueFolders } from '../../hooks/useGraph';

// ============================================================================
// Types
// ============================================================================

interface GraphControlsProps {
  /** Current filter options */
  filters: GraphFilterOptions;
  /** Callback when filters change */
  onFiltersChange: (filters: GraphFilterOptions) => void;
  /** Raw graph data for extracting filter options */
  rawData: GraphData | null;
  /** Whether controls are for local graph (shows depth slider) */
  isLocalGraph?: boolean;
  /** Current depth for local graph */
  depth?: number;
  /** Callback when depth changes */
  onDepthChange?: (depth: number) => void;
  /** Current color scheme */
  colorScheme: ColorScheme;
  /** Callback when color scheme changes */
  onColorSchemeChange: (scheme: ColorScheme) => void;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function GraphControls({
  filters,
  onFiltersChange,
  rawData,
  isLocalGraph = false,
  depth = 1,
  onDepthChange,
  colorScheme,
  onColorSchemeChange,
  className,
}: GraphControlsProps) {
  // Extract available folders for filtering
  const folders = useMemo(() => getUniqueFolders(rawData), [rawData]);

  // Handlers
  const handleFolderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFiltersChange({
      ...filters,
      folderPath: value || undefined,
    });
  }, [filters, onFiltersChange]);

  const handleTagChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    onFiltersChange({
      ...filters,
      tag: value || undefined,
    });
  }, [filters, onFiltersChange]);

  const handleToggleOrphans = useCallback(() => {
    onFiltersChange({
      ...filters,
      showOrphans: !filters.showOrphans,
    });
  }, [filters, onFiltersChange]);

  const handleToggleConceptLinks = useCallback(() => {
    onFiltersChange({
      ...filters,
      showConceptLinks: filters.showConceptLinks === false ? true : false,
    });
  }, [filters, onFiltersChange]);

  const handleDepthChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (onDepthChange && value >= 1 && value <= 3) {
      onDepthChange(value);
    }
  }, [onDepthChange]);

  const handleColorSchemeChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    onColorSchemeChange(e.target.value as ColorScheme);
  }, [onColorSchemeChange]);

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      showOrphans: true,
      showConceptLinks: true,
    });
  }, [onFiltersChange]);

  const hasActiveFilters = filters.folderPath || filters.tag || filters.showOrphans === false || filters.showConceptLinks === false;

  return (
    <div
      className={cn(
        'flex flex-col gap-3 p-3',
        'bg-background-secondary',
        'border border-background-modifier-border',
        'rounded-lg shadow-lg',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-text-normal">
          <Filter className="h-4 w-4" />
          <span>Graph Controls</span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Depth slider (for local graph only) */}
      {isLocalGraph && onDepthChange && (
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-2 text-xs text-text-muted">
            <Layers className="h-3.5 w-3.5" />
            <span>Depth: {depth}</span>
          </label>
          <input
            type="range"
            min={1}
            max={3}
            value={depth}
            onChange={handleDepthChange}
            className={cn(
              'w-full h-1.5 rounded-full appearance-none cursor-pointer',
              'bg-background-modifier-border',
              '[&::-webkit-slider-thumb]:appearance-none',
              '[&::-webkit-slider-thumb]:w-3.5',
              '[&::-webkit-slider-thumb]:h-3.5',
              '[&::-webkit-slider-thumb]:rounded-full',
              '[&::-webkit-slider-thumb]:bg-interactive-accent',
              '[&::-webkit-slider-thumb]:cursor-pointer',
              '[&::-webkit-slider-thumb]:transition-transform',
              '[&::-webkit-slider-thumb]:hover:scale-110'
            )}
          />
          <div className="flex justify-between text-[10px] text-text-faint">
            <span>1</span>
            <span>2</span>
            <span>3</span>
          </div>
        </div>
      )}

      {/* Folder filter */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-text-muted">Filter by Folder</label>
        <select
          value={filters.folderPath || ''}
          onChange={handleFolderChange}
          className={cn(
            'w-full h-8 px-2 text-sm rounded-md',
            'bg-background-primary text-text-normal',
            'border border-background-modifier-border',
            'focus:outline-none focus:ring-2 focus:ring-interactive-accent focus:border-transparent',
            'cursor-pointer'
          )}
        >
          <option value="">All folders</option>
          {folders.map(folder => (
            <option key={folder} value={folder}>
              {folder === '/' ? '(root)' : folder}
            </option>
          ))}
        </select>
      </div>

      {/* Tag filter */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-text-muted">Filter by Tag</label>
        <Input
          type="text"
          placeholder="Enter tag..."
          value={filters.tag || ''}
          onChange={handleTagChange}
          className="h-8 text-sm"
        />
      </div>

      {/* Color scheme selector */}
      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-xs text-text-muted">
          <Palette className="h-3.5 w-3.5" />
          <span>Color Scheme</span>
        </label>
        <select
          value={colorScheme}
          onChange={handleColorSchemeChange}
          className={cn(
            'w-full h-8 px-2 text-sm rounded-md',
            'bg-background-primary text-text-normal',
            'border border-background-modifier-border',
            'focus:outline-none focus:ring-2 focus:ring-interactive-accent focus:border-transparent',
            'cursor-pointer'
          )}
        >
          {COLOR_SCHEMES.map(scheme => (
            <option key={scheme.id} value={scheme.id}>
              {scheme.label}
            </option>
          ))}
        </select>
      </div>

      {/* Show/hide orphans toggle */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">Show orphan notes</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleOrphans}
          className={cn(
            'h-7 px-2',
            filters.showOrphans === false && 'text-text-faint'
          )}
        >
          {filters.showOrphans === false ? (
            <>
              <EyeOff className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Hidden</span>
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Visible</span>
            </>
          )}
        </Button>
      </div>

      {/* Show/hide concept links toggle */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <span className="text-xs text-text-muted">Show concept links</span>
          <span className="text-[10px] text-text-faint">Notes sharing [[keywords]]</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleToggleConceptLinks}
          className={cn(
            'h-7 px-2',
            filters.showConceptLinks === false && 'text-text-faint'
          )}
        >
          {filters.showConceptLinks === false ? (
            <>
              <Link2Off className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Hidden</span>
            </>
          ) : (
            <>
              <Link2 className="h-3.5 w-3.5 mr-1" />
              <span className="text-xs">Visible</span>
            </>
          )}
        </Button>
      </div>

      {/* Stats */}
      {rawData && (
        <div className="pt-2 mt-1 border-t border-background-modifier-border">
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-xs text-text-faint">
              <span>Notes: {rawData.nodes.length}</span>
              <span>Links: {rawData.edges.filter(e => e.edgeType === 'direct').length}</span>
            </div>
            <div className="flex justify-between text-xs text-text-faint">
              <span>Concepts: {rawData.concepts?.length || 0}</span>
              <span className="text-emerald-500">Concept links: {rawData.edges.filter(e => e.edgeType === 'concept').length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GraphControls;
