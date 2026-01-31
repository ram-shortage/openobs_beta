import { useState, useRef, useCallback } from 'react';
import {
  Type,
  FileText,
  Image,
  Palette,
  Download,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { NODE_COLORS, type CanvasNodeColor } from '../../types/canvas';

interface CanvasToolbarProps {
  onAddTextCard: () => void;
  onAddNoteEmbed: () => void;
  onAddImage: () => void;
  onColorChange: (color: CanvasNodeColor) => void;
  onExportImage: () => void;
  selectedColor: CanvasNodeColor;
  hasSelection: boolean;
}

export function CanvasToolbar({
  onAddTextCard,
  onAddNoteEmbed,
  onAddImage,
  onColorChange,
  onExportImage,
  selectedColor,
  hasSelection,
}: CanvasToolbarProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);

  const handleColorSelect = useCallback(
    (color: CanvasNodeColor) => {
      onColorChange(color);
      setShowColorPicker(false);
    },
    [onColorChange]
  );

  const colorOptions: CanvasNodeColor[] = [
    'default',
    'red',
    'orange',
    'yellow',
    'green',
    'cyan',
    'blue',
    'purple',
    'pink',
  ];

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-background-primary border border-background-modifier-border rounded-lg shadow-lg">
        {/* Add Text Card */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddTextCard}
          title="Add text card"
          className="h-8 w-8"
        >
          <Type className="h-4 w-4" />
        </Button>

        {/* Add Note Embed */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddNoteEmbed}
          title="Add note embed"
          className="h-8 w-8"
        >
          <FileText className="h-4 w-4" />
        </Button>

        {/* Add Image */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onAddImage}
          title="Add image"
          className="h-8 w-8"
        >
          <Image className="h-4 w-4" />
        </Button>

        {/* Divider */}
        <div className="w-px h-5 bg-background-modifier-border mx-1" />

        {/* Color Picker */}
        <div className="relative" ref={colorPickerRef}>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="Set color"
            className={cn('h-8 w-8', !hasSelection && 'opacity-50')}
            disabled={!hasSelection}
          >
            <Palette className="h-4 w-4" />
          </Button>

          {showColorPicker && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 p-2 bg-background-primary border border-background-modifier-border rounded-lg shadow-lg">
              <div className="grid grid-cols-3 gap-1">
                {colorOptions.map((color) => {
                  const colorDef = NODE_COLORS[color];
                  return (
                    <button
                      key={color}
                      onClick={() => handleColorSelect(color)}
                      className={cn(
                        'w-6 h-6 rounded border-2 transition-transform hover:scale-110',
                        colorDef.bg,
                        colorDef.border,
                        selectedColor === color && 'ring-2 ring-interactive-accent ring-offset-1 ring-offset-background-primary'
                      )}
                      title={color.charAt(0).toUpperCase() + color.slice(1)}
                    />
                  );
                })}
              </div>
              <button
                onClick={() => setShowColorPicker(false)}
                className="absolute -top-1 -right-1 p-0.5 bg-background-secondary rounded-full border border-background-modifier-border hover:bg-background-modifier-hover"
              >
                <X className="h-3 w-3 text-text-muted" />
              </button>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-background-modifier-border mx-1" />

        {/* Export Image */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onExportImage}
          title="Export as image"
          className="h-8 w-8"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

CanvasToolbar.displayName = 'CanvasToolbar';
