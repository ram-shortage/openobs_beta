import { useState, useCallback, useRef, useEffect } from 'react';
import { NodeProps, NodeResizer } from 'reactflow';
import { cn } from '../../../lib/utils';
import { NODE_COLORS, type CanvasNodeColor } from '../../../types/canvas';

interface TextCardNodeData {
  content: string;
  color?: CanvasNodeColor;
  onContentChange?: (id: string, content: string) => void;
  onColorChange?: (id: string, color: CanvasNodeColor) => void;
}

export function TextCardNode({ id, data, selected }: NodeProps<TextCardNodeData>) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(data.content || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const color = data.color || 'default';
  const colorStyles = NODE_COLORS[color];

  useEffect(() => {
    setContent(data.content || '');
  }, [data.content]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(() => {
    setIsEditing(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsEditing(false);
    if (data.onContentChange && content !== data.content) {
      data.onContentChange(id, content);
    }
  }, [id, content, data]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setContent(data.content || '');
        setIsEditing(false);
      } else if (e.key === 'Enter' && e.metaKey) {
        handleBlur();
      }
      // Prevent React Flow from handling these keys
      e.stopPropagation();
    },
    [data.content, handleBlur]
  );

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value);
  }, []);

  return (
    <>
      <NodeResizer
        minWidth={100}
        minHeight={50}
        isVisible={selected}
        lineClassName="border-interactive-accent"
        handleClassName="h-3 w-3 bg-interactive-accent rounded-sm border-2 border-white"
      />
      <div
        className={cn(
          'w-full h-full rounded-lg border-2 p-3 overflow-hidden',
          'transition-shadow duration-200',
          colorStyles.bg,
          colorStyles.border,
          selected && 'shadow-lg ring-2 ring-interactive-accent ring-opacity-50'
        )}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full h-full resize-none bg-transparent outline-none',
              colorStyles.text,
              'text-sm leading-relaxed'
            )}
            placeholder="Enter text..."
          />
        ) : (
          <div
            className={cn(
              'w-full h-full overflow-auto',
              colorStyles.text,
              'text-sm leading-relaxed whitespace-pre-wrap break-words'
            )}
          >
            {content || (
              <span className="text-text-muted italic">Double-click to edit...</span>
            )}
          </div>
        )}
      </div>
    </>
  );
}

TextCardNode.displayName = 'TextCardNode';
