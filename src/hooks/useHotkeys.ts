import { useEffect, useCallback, useRef } from 'react';
import { commandRegistry, matchesHotkey } from '../lib/commands';

// ============================================================================
// Types
// ============================================================================

export interface HotkeyOptions {
  /** Enable or disable the hotkey */
  enabled?: boolean;
  /** Prevent default browser behavior */
  preventDefault?: boolean;
  /** Stop event propagation */
  stopPropagation?: boolean;
  /** Only trigger when these elements are NOT focused */
  ignoreInputs?: boolean;
  /** Scope for the hotkey (for modal contexts) */
  scope?: string;
}

export interface HotkeyBinding {
  hotkey: string;
  callback: (event: KeyboardEvent) => void;
  options?: HotkeyOptions;
}

// ============================================================================
// Utility functions
// ============================================================================

/**
 * Checks if the current focused element is an input-like element
 */
function isInputElement(element: Element | null): boolean {
  if (!element) return false;

  const tagName = element.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) {
    return true;
  }

  // Check for contentEditable
  if ((element as HTMLElement).isContentEditable) {
    return true;
  }

  return false;
}


// ============================================================================
// Global hotkey handler hook
// ============================================================================

/**
 * Sets up global hotkey handling for the command registry
 * Should be used once at the app root level
 */
export function useGlobalHotkeys(): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if target is an input and it's not a global command
      const target = event.target as Element;
      const inInput = isInputElement(target);

      // Find matching command
      const command = commandRegistry.findByHotkey(event);

      if (command) {
        // Some commands should not trigger in inputs
        const globalCommands = [
          'navigate.command-palette',
          'settings.open',
          'file.save',
        ];

        if (inInput && !globalCommands.includes(command.id)) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        commandRegistry.execute(command.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
}

// ============================================================================
// Single hotkey hook
// ============================================================================

const defaultOptions: HotkeyOptions = {
  enabled: true,
  preventDefault: true,
  stopPropagation: false,
  ignoreInputs: true,
};

/**
 * Hook to handle a single hotkey
 */
export function useHotkey(
  hotkey: string,
  callback: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {}
): void {
  const opts = { ...defaultOptions, ...options };
  const callbackRef = useRef(callback);

  // Keep callback reference up to date
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!opts.enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we should ignore this event
      if (opts.ignoreInputs && isInputElement(event.target as Element)) {
        return;
      }

      // Check if hotkey matches
      if (matchesHotkey(event, hotkey)) {
        if (opts.preventDefault) {
          event.preventDefault();
        }
        if (opts.stopPropagation) {
          event.stopPropagation();
        }
        callbackRef.current(event);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hotkey, opts.enabled, opts.preventDefault, opts.stopPropagation, opts.ignoreInputs]);
}

// ============================================================================
// Multiple hotkeys hook
// ============================================================================

/**
 * Hook to handle multiple hotkeys
 */
export function useHotkeys(
  bindings: HotkeyBinding[],
  deps: React.DependencyList = []
): void {
  const bindingsRef = useRef(bindings);

  // Keep bindings reference up to date
  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindingsRef.current) {
        const opts = { ...defaultOptions, ...binding.options };

        if (!opts.enabled) continue;
        if (opts.ignoreInputs && isInputElement(event.target as Element)) continue;

        if (matchesHotkey(event, binding.hotkey)) {
          if (opts.preventDefault) {
            event.preventDefault();
          }
          if (opts.stopPropagation) {
            event.stopPropagation();
          }
          binding.callback(event);
          break; // Only trigger first matching hotkey
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ============================================================================
// Scoped hotkeys hook (for modals)
// ============================================================================

/**
 * Hook for modal-specific hotkeys that take priority
 */
export function useScopedHotkeys(
  scope: string,
  bindings: HotkeyBinding[],
  isActive: boolean
): void {
  const bindingsRef = useRef(bindings);

  useEffect(() => {
    bindingsRef.current = bindings;
  }, [bindings]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const binding of bindingsRef.current) {
        const opts = { ...defaultOptions, ...binding.options };

        if (!opts.enabled) continue;

        if (matchesHotkey(event, binding.hotkey)) {
          if (opts.preventDefault) {
            event.preventDefault();
          }
          if (opts.stopPropagation) {
            event.stopPropagation();
          }
          binding.callback(event);
          break;
        }
      }
    };

    // Use capture phase to intercept before global handlers
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, scope]);
}

// ============================================================================
// Keyboard navigation hook (for lists)
// ============================================================================

interface ListNavigationOptions {
  itemCount: number;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onConfirm?: (index: number) => void;
  onCancel?: () => void;
  loop?: boolean;
}

/**
 * Hook for keyboard navigation in lists (command palette, file picker, etc.)
 */
export function useListNavigation({
  itemCount,
  selectedIndex,
  onSelect,
  onConfirm,
  onCancel,
  loop = true,
}: ListNavigationOptions): void {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (itemCount === 0) return;
          if (loop) {
            onSelect((selectedIndex + 1) % itemCount);
          } else {
            onSelect(Math.min(selectedIndex + 1, itemCount - 1));
          }
          break;

        case 'ArrowUp':
          event.preventDefault();
          if (itemCount === 0) return;
          if (loop) {
            onSelect((selectedIndex - 1 + itemCount) % itemCount);
          } else {
            onSelect(Math.max(selectedIndex - 1, 0));
          }
          break;

        case 'Enter':
          event.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < itemCount && onConfirm) {
            onConfirm(selectedIndex);
          }
          break;

        case 'Escape':
          event.preventDefault();
          if (onCancel) {
            onCancel();
          }
          break;
      }
    },
    [itemCount, selectedIndex, onSelect, onConfirm, onCancel, loop]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
