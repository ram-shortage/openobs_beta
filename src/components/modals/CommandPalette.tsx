import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Search, Command as CommandIcon } from 'lucide-react';
import { useStore } from '../../store';
import { commandRegistry, formatHotkey, type Command } from '../../lib/commands';
import { useListNavigation } from '../../hooks/useHotkeys';
import { cn } from '../../lib/utils';

// ============================================================================
// Main Component
// ============================================================================

export function CommandPalette() {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commandPaletteOpen = useStore((state) => state.commandPaletteOpen);
  const closeCommandPalette = useStore((state) => state.closeCommandPalette);

  // Get filtered commands
  const commands = useMemo(() => {
    if (!query.trim()) {
      // Show recent commands first, then all commands
      const recent = commandRegistry.getRecentCommands();
      const all = commandRegistry.getAvailable();
      const recentIds = new Set(recent.map((c) => c.id));
      const nonRecent = all.filter((c) => !recentIds.has(c.id));
      return [...recent, ...nonRecent];
    }
    return commandRegistry.search(query);
  }, [query]);

  // Reset state when opened
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Focus input after a brief delay to ensure modal is rendered
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [commandPaletteOpen]);

  // Reset selection when commands change
  useEffect(() => {
    setSelectedIndex(0);
  }, [commands]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current && commands.length > 0) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex, commands.length]);

  const handleExecute = useCallback(
    (index: number) => {
      const command = commands[index];
      if (command) {
        closeCommandPalette();
        // Execute after a brief delay to allow modal to close
        setTimeout(() => {
          commandRegistry.execute(command.id);
        }, 50);
      }
    },
    [commands, closeCommandPalette]
  );

  const handleClose = useCallback(() => {
    closeCommandPalette();
  }, [closeCommandPalette]);

  // Keyboard navigation
  useListNavigation({
    itemCount: commands.length,
    selectedIndex,
    onSelect: setSelectedIndex,
    onConfirm: handleExecute,
    onCancel: handleClose,
    loop: true,
  });

  if (!commandPaletteOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Palette */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className={cn(
          'relative z-10 w-full max-w-xl',
          'bg-background-primary rounded-lg shadow-2xl',
          'border border-background-modifier-border',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200',
          'overflow-hidden'
        )}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-background-modifier-border">
          <Search className="h-5 w-5 text-text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className={cn(
              'flex-1 bg-transparent text-text-normal',
              'placeholder:text-text-faint',
              'focus:outline-none',
              'text-base'
            )}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <kbd className="px-2 py-0.5 rounded text-xs font-mono bg-background-secondary text-text-muted">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto py-2"
          role="listbox"
        >
          {commands.length === 0 ? (
            <div className="px-4 py-8 text-center text-text-muted">
              <CommandIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No commands found</p>
            </div>
          ) : (
            commands.map((command, index) => (
              <CommandItem
                key={command.id}
                command={command}
                isSelected={index === selectedIndex}
                isRecent={index < commandRegistry.getRecentCommands().length && !query.trim()}
                onClick={() => handleExecute(index)}
                onMouseEnter={() => setSelectedIndex(index)}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-background-modifier-border text-xs text-text-faint">
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background-secondary">
              <span className="text-[10px]">up</span>
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-background-secondary">
              <span className="text-[10px]">down</span>
            </kbd>
            <span className="ml-1">to navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-background-secondary">
              <span className="text-[10px]">enter</span>
            </kbd>
            <span className="ml-1">to select</span>
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Command Item Component
// ============================================================================

interface CommandItemProps {
  command: Command;
  isSelected: boolean;
  isRecent: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
}

function CommandItem({
  command,
  isSelected,
  isRecent,
  onClick,
  onMouseEnter,
}: CommandItemProps) {
  return (
    <div
      role="option"
      aria-selected={isSelected}
      className={cn(
        'flex items-center justify-between px-4 py-2 cursor-pointer',
        'transition-colors',
        isSelected
          ? 'bg-interactive-accent/20 text-text-normal'
          : 'text-text-muted hover:bg-background-modifier-hover'
      )}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
    >
      <div className="flex items-center gap-3 min-w-0">
        <CategoryIcon category={command.category} />
        <div className="min-w-0">
          <div className="text-sm truncate">
            {command.label}
            {isRecent && (
              <span className="ml-2 text-xs text-text-faint">(recent)</span>
            )}
          </div>
          {command.description && (
            <div className="text-xs text-text-faint truncate">
              {command.description}
            </div>
          )}
        </div>
      </div>

      {command.hotkey && (
        <kbd
          className={cn(
            'ml-4 px-2 py-0.5 rounded text-xs font-mono shrink-0',
            'bg-background-secondary text-text-muted',
            'border border-background-modifier-border'
          )}
        >
          {formatHotkey(command.hotkey)}
        </kbd>
      )}
    </div>
  );
}

// ============================================================================
// Category Icon Component
// ============================================================================

interface CategoryIconProps {
  category: Command['category'];
}

function CategoryIcon({ category }: CategoryIconProps) {
  const iconClass = 'h-4 w-4 text-text-faint';

  switch (category) {
    case 'file':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
    case 'edit':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      );
    case 'view':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'navigate':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      );
    case 'search':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
    case 'help':
      return (
        <svg className={iconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return <CommandIcon className={iconClass} />;
  }
}
