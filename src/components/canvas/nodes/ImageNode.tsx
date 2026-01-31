import { useState, useEffect, useMemo } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { Image as ImageIcon, AlertCircle } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useStore } from '../../../store';

interface ImageNodeData {
  path: string;
  alt?: string;
  imageUrl?: string;
}

export function ImageNode({ data, selected }: NodeProps<ImageNodeData>) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const vaultPath = useStore((state) => state.vaultPath);

  // Build the full image URL
  const imageUrl = useMemo(() => {
    if (data.imageUrl) return data.imageUrl;
    if (!data.path) return null;

    // Handle different path formats
    if (data.path.startsWith('http://') || data.path.startsWith('https://')) {
      return data.path;
    }

    // For local files, construct the file URL
    if (vaultPath) {
      // Use Tauri's asset protocol or file URL
      const fullPath = `${vaultPath}/${data.path}`.replace(/\/+/g, '/');
      return `file://${fullPath}`;
    }

    return data.path;
  }, [data.path, data.imageUrl, vaultPath]);

  const handleLoad = () => {
    setIsLoading(false);
    setError(null);
  };

  const handleError = () => {
    setIsLoading(false);
    setError('Failed to load image');
  };

  useEffect(() => {
    setIsLoading(true);
    setError(null);
  }, [imageUrl]);

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={100}
        isVisible={selected}
        lineClassName="border-interactive-accent"
        handleClassName="h-3 w-3 bg-interactive-accent rounded-sm border-2 border-white"
        keepAspectRatio={true}
      />
      <div
        className={cn(
          'w-full h-full rounded-lg border-2 overflow-hidden',
          'bg-background-primary border-background-modifier-border',
          'transition-shadow duration-200',
          selected && 'shadow-lg ring-2 ring-interactive-accent ring-opacity-50'
        )}
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background-secondary">
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <ImageIcon className="h-8 w-8 animate-pulse" />
              <span className="text-xs">Loading...</span>
            </div>
          </div>
        )}

        {error ? (
          <div className="w-full h-full flex items-center justify-center bg-background-secondary">
            <div className="flex flex-col items-center gap-2 text-red-400">
              <AlertCircle className="h-8 w-8" />
              <span className="text-xs">{error}</span>
              <span className="text-xs text-text-muted truncate max-w-[90%]">
                {data.path}
              </span>
            </div>
          </div>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={data.alt || data.path}
            className={cn(
              'w-full h-full object-contain',
              isLoading && 'invisible'
            )}
            onLoad={handleLoad}
            onError={handleError}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-background-secondary">
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">No image path</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

ImageNode.displayName = 'ImageNode';
