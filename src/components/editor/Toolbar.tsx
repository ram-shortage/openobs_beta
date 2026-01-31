/**
 * Editor toolbar with formatting buttons
 */

import React, { useCallback } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Link,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Table,
  Minus,
  Highlighter,
  Eye,
  Edit3,
  Columns,
  Loader2,
  Check,
  Circle,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import type { EditorMode } from '../../store/editorStore';

export type SaveState = 'saved' | 'dirty' | 'saving';

export interface ToolbarProps {
  /** Current editor mode */
  editorMode: EditorMode;
  /** Callback when editor mode changes */
  onEditorModeChange: (mode: EditorMode) => void;
  /** Callback to insert formatting */
  onFormat: (format: FormatType) => void;
  /** Additional class names */
  className?: string;
  /** Whether the toolbar is disabled */
  disabled?: boolean;
  /** Current save state */
  saveState?: SaveState;
}

export type FormatType =
  | 'bold'
  | 'italic'
  | 'strikethrough'
  | 'highlight'
  | 'code'
  | 'link'
  | 'wikilink'
  | 'image'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bulletList'
  | 'numberedList'
  | 'taskList'
  | 'blockquote'
  | 'codeBlock'
  | 'horizontalRule'
  | 'table';

interface ToolbarButton {
  format: FormatType;
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}

const formatButtons: ToolbarButton[] = [
  { format: 'bold', icon: <Bold size={16} />, label: 'Bold', shortcut: 'Ctrl+B' },
  { format: 'italic', icon: <Italic size={16} />, label: 'Italic', shortcut: 'Ctrl+I' },
  { format: 'strikethrough', icon: <Strikethrough size={16} />, label: 'Strikethrough' },
  { format: 'highlight', icon: <Highlighter size={16} />, label: 'Highlight' },
  { format: 'code', icon: <Code size={16} />, label: 'Inline Code', shortcut: 'Ctrl+`' },
];

const headingButtons: ToolbarButton[] = [
  { format: 'heading1', icon: <Heading1 size={16} />, label: 'Heading 1', shortcut: 'Ctrl+1' },
  { format: 'heading2', icon: <Heading2 size={16} />, label: 'Heading 2', shortcut: 'Ctrl+2' },
  { format: 'heading3', icon: <Heading3 size={16} />, label: 'Heading 3', shortcut: 'Ctrl+3' },
];

const listButtons: ToolbarButton[] = [
  { format: 'bulletList', icon: <List size={16} />, label: 'Bullet List' },
  { format: 'numberedList', icon: <ListOrdered size={16} />, label: 'Numbered List' },
  { format: 'taskList', icon: <CheckSquare size={16} />, label: 'Task List' },
];

const insertButtons: ToolbarButton[] = [
  { format: 'wikilink', icon: <Link size={16} />, label: 'Wikilink', shortcut: 'Ctrl+K' },
  { format: 'image', icon: <Image size={16} />, label: 'Image' },
  { format: 'blockquote', icon: <Quote size={16} />, label: 'Quote' },
  { format: 'codeBlock', icon: <Code size={16} />, label: 'Code Block' },
  { format: 'horizontalRule', icon: <Minus size={16} />, label: 'Horizontal Rule' },
  { format: 'table', icon: <Table size={16} />, label: 'Table' },
];

interface ToolbarGroupProps {
  buttons: ToolbarButton[];
  onFormat: (format: FormatType) => void;
  disabled?: boolean;
}

const ToolbarGroup: React.FC<ToolbarGroupProps> = ({ buttons, onFormat, disabled }) => (
  <div className="flex items-center gap-0.5">
    {buttons.map((button) => (
      <Button
        key={button.format}
        variant="ghost"
        size="icon"
        onClick={() => onFormat(button.format)}
        disabled={disabled}
        title={button.shortcut ? `${button.label} (${button.shortcut})` : button.label}
        className="h-7 w-7 text-text-muted hover:text-text-normal"
      >
        {button.icon}
      </Button>
    ))}
  </div>
);

const Separator: React.FC = () => (
  <div className="w-px h-5 bg-background-modifier-border mx-1" />
);

export const Toolbar = React.memo(function Toolbar({
  editorMode,
  onEditorModeChange,
  onFormat,
  className,
  disabled = false,
  saveState = 'saved',
}: ToolbarProps) {
  const handleModeChange = useCallback(
    (mode: EditorMode) => {
      onEditorModeChange(mode);
    },
    [onEditorModeChange]
  );

  return (
    <div
      className={cn(
        'flex items-center justify-between px-2 py-1',
        'border-b border-background-modifier-border',
        'bg-background-secondary',
        className
      )}
    >
      {/* Left side: Formatting buttons */}
      <div className="flex items-center gap-1">
        <ToolbarGroup buttons={formatButtons} onFormat={onFormat} disabled={disabled} />
        <Separator />
        <ToolbarGroup buttons={headingButtons} onFormat={onFormat} disabled={disabled} />
        <Separator />
        <ToolbarGroup buttons={listButtons} onFormat={onFormat} disabled={disabled} />
        <Separator />
        <ToolbarGroup buttons={insertButtons} onFormat={onFormat} disabled={disabled} />

        {/* Save state indicator */}
        <Separator />
        <div className="flex items-center gap-1 text-xs text-text-muted" title={
          saveState === 'saving' ? 'Saving...' :
          saveState === 'dirty' ? 'Unsaved changes' :
          'All changes saved'
        }>
          {saveState === 'saving' && (
            <>
              <Loader2 size={14} className="animate-spin text-interactive-accent" />
              <span className="hidden sm:inline">Saving...</span>
            </>
          )}
          {saveState === 'dirty' && (
            <>
              <Circle size={14} className="text-orange-400 fill-orange-400" />
              <span className="hidden sm:inline text-orange-400">Unsaved</span>
            </>
          )}
          {saveState === 'saved' && (
            <>
              <Check size={14} className="text-green-500" />
              <span className="hidden sm:inline text-green-500">Saved</span>
            </>
          )}
        </div>
      </div>

      {/* Right side: View mode buttons */}
      <div className="flex items-center gap-0.5 bg-background-primary rounded-md p-0.5">
        <Button
          variant={editorMode === 'edit' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('edit')}
          title="Source mode"
          className={cn(
            'h-7 px-2 gap-1 text-xs',
            editorMode === 'edit'
              ? 'bg-interactive-accent text-white'
              : 'text-text-muted hover:text-text-normal'
          )}
        >
          <Edit3 size={14} />
          <span className="hidden sm:inline">Source</span>
        </Button>
        <Button
          variant={editorMode === 'split' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('split')}
          title="Live preview mode"
          className={cn(
            'h-7 px-2 gap-1 text-xs',
            editorMode === 'split'
              ? 'bg-interactive-accent text-white'
              : 'text-text-muted hover:text-text-normal'
          )}
        >
          <Columns size={14} />
          <span className="hidden sm:inline">Live</span>
        </Button>
        <Button
          variant={editorMode === 'preview' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleModeChange('preview')}
          title="Reading mode"
          className={cn(
            'h-7 px-2 gap-1 text-xs',
            editorMode === 'preview'
              ? 'bg-interactive-accent text-white'
              : 'text-text-muted hover:text-text-normal'
          )}
        >
          <Eye size={14} />
          <span className="hidden sm:inline">Read</span>
        </Button>
      </div>
    </div>
  );
});

/**
 * Get the markdown syntax for a format type
 */
export function getFormatSyntax(format: FormatType): { prefix: string; suffix: string; block?: boolean; placeholder?: string } {
  switch (format) {
    case 'bold':
      return { prefix: '**', suffix: '**', placeholder: 'bold text' };
    case 'italic':
      return { prefix: '*', suffix: '*', placeholder: 'italic text' };
    case 'strikethrough':
      return { prefix: '~~', suffix: '~~', placeholder: 'strikethrough text' };
    case 'highlight':
      return { prefix: '==', suffix: '==', placeholder: 'highlighted text' };
    case 'code':
      return { prefix: '`', suffix: '`', placeholder: 'code' };
    case 'link':
      return { prefix: '[', suffix: '](url)', placeholder: 'link text' };
    case 'wikilink':
      return { prefix: '[[', suffix: ']]', placeholder: 'note name' };
    case 'image':
      return { prefix: '![', suffix: '](url)', placeholder: 'alt text' };
    case 'heading1':
      return { prefix: '# ', suffix: '', block: true, placeholder: 'Heading 1' };
    case 'heading2':
      return { prefix: '## ', suffix: '', block: true, placeholder: 'Heading 2' };
    case 'heading3':
      return { prefix: '### ', suffix: '', block: true, placeholder: 'Heading 3' };
    case 'bulletList':
      return { prefix: '- ', suffix: '', block: true, placeholder: 'List item' };
    case 'numberedList':
      return { prefix: '1. ', suffix: '', block: true, placeholder: 'List item' };
    case 'taskList':
      return { prefix: '- [ ] ', suffix: '', block: true, placeholder: 'Task item' };
    case 'blockquote':
      return { prefix: '> ', suffix: '', block: true, placeholder: 'Quote' };
    case 'codeBlock':
      return { prefix: '```\n', suffix: '\n```', block: true, placeholder: 'code' };
    case 'horizontalRule':
      return { prefix: '\n---\n', suffix: '', block: true };
    case 'table':
      return {
        prefix: '| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |',
        suffix: '',
        block: true,
      };
    default:
      return { prefix: '', suffix: '' };
  }
}
