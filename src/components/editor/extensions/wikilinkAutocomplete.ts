/**
 * CodeMirror extension for wikilink [[]] autocomplete
 *
 * Provides suggestions for note names when user types [[ in the editor.
 */

import {
  autocompletion,
  CompletionContext,
  CompletionResult,
  Completion,
  startCompletion,
  closeCompletion,
} from '@codemirror/autocomplete';
import { EditorView, keymap } from '@codemirror/view';
import { Extension } from '@codemirror/state';
import type { FileTreeItem } from '../../../types';
import { useStore } from '../../../store';

/**
 * Extract all note names from the file tree (recursively)
 */
function extractNoteNames(items: FileTreeItem[]): string[] {
  const notes: string[] = [];

  function traverse(items: FileTreeItem[]) {
    for (const item of items) {
      if (item.isFolder) {
        if (item.children) {
          traverse(item.children);
        }
      } else {
        // Check if it's a markdown file
        if (item.name.endsWith('.md')) {
          // Remove the .md extension for the note name
          notes.push(item.name.slice(0, -3));
        }
      }
    }
  }

  traverse(items);
  return notes;
}

/**
 * Check if the cursor is inside a wikilink context [[...
 * Returns the position where [[ starts, or null if not in a wikilink context
 */
function findWikilinkStart(text: string, pos: number): { start: number; query: string } | null {
  // Look backwards from cursor position to find [[
  let searchStart = Math.max(0, pos - 100); // Limit search to last 100 chars
  const searchText = text.slice(searchStart, pos);

  // Find the last [[ that doesn't have a closing ]]
  let bracketStart = -1;
  let i = searchText.length - 1;

  while (i >= 1) {
    // Check for closing ]]
    if (searchText[i] === ']' && searchText[i - 1] === ']') {
      // Reset - we found a complete wikilink
      bracketStart = -1;
      i -= 2;
      continue;
    }
    // Check for opening [[
    if (searchText[i] === '[' && searchText[i - 1] === '[') {
      bracketStart = searchStart + i - 1;
      break;
    }
    i--;
  }

  if (bracketStart === -1) {
    return null;
  }

  // Extract the query (text after [[)
  const query = text.slice(bracketStart + 2, pos);

  // Don't trigger if query contains newlines or pipes (alias separator)
  if (query.includes('\n') || query.includes('|')) {
    return null;
  }

  return { start: bracketStart, query };
}

/**
 * Wikilink completion source
 */
function wikilinkCompletionSource(context: CompletionContext): CompletionResult | null {
  const { state, pos } = context;
  const fullText = state.doc.sliceString(0, pos);

  // Check if we're in a wikilink context
  const wikilinkContext = findWikilinkStart(fullText, pos);

  if (!wikilinkContext) {
    return null;
  }

  const { start, query } = wikilinkContext;

  // Get note names from the store
  const fileTree = useStore.getState().fileTree;
  const noteNames = extractNoteNames(fileTree);

  // Filter and create completions
  const queryLower = query.toLowerCase();
  const completions: Completion[] = noteNames
    .filter(name => name.toLowerCase().includes(queryLower))
    .sort((a, b) => {
      // Prioritize names that start with the query
      const aStarts = a.toLowerCase().startsWith(queryLower);
      const bStarts = b.toLowerCase().startsWith(queryLower);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      // Then sort alphabetically
      return a.localeCompare(b);
    })
    .slice(0, 20) // Limit to 20 suggestions
    .map(name => ({
      label: name,
      type: 'text',
      detail: 'Note',
      apply: (view: EditorView, _completion: Completion, _from: number, _to: number) => {
        // Insert the note name and closing brackets
        const insertText = name + ']]';
        view.dispatch({
          changes: { from: start + 2, to: pos, insert: insertText },
          selection: { anchor: start + 2 + insertText.length },
        });
      },
    }));

  if (completions.length === 0) {
    return null;
  }

  return {
    from: start + 2, // Position after [[
    to: pos,
    options: completions,
    filter: false, // We already filtered
  };
}

/**
 * Input handler to trigger autocomplete when [[ is typed
 */
const triggerOnBrackets = EditorView.inputHandler.of((view, from, _to, text) => {
  // Check if we just typed [
  if (text === '[') {
    const doc = view.state.doc;
    // Check if the character before cursor is also [
    if (from > 0 && doc.sliceString(from - 1, from) === '[') {
      // We just typed [[, trigger autocomplete after a small delay
      setTimeout(() => {
        startCompletion(view);
      }, 10);
    }
  }
  return false; // Let the default handler process the input
});

/**
 * Key handler for Escape to close the autocomplete
 */
const wikilinkKeymap = keymap.of([
  {
    key: 'Escape',
    run: (view) => {
      closeCompletion(view);
      return false; // Allow other handlers to process Escape too
    },
  },
]);

/**
 * Input handler to close autocomplete when ]] is typed
 */
const closeOnClosingBrackets = EditorView.inputHandler.of((view, from, _to, text) => {
  if (text === ']') {
    const doc = view.state.doc;
    // Check if the character before cursor is also ]
    if (from > 0 && doc.sliceString(from - 1, from) === ']') {
      // We just typed ]], close autocomplete
      closeCompletion(view);
    }
  }
  return false;
});

/**
 * Theme for autocomplete styling
 */
const wikilinkAutocompleteTheme = EditorView.baseTheme({
  '.cm-tooltip-autocomplete': {
    backgroundColor: 'var(--background-primary)',
    border: '1px solid var(--background-modifier-border)',
    borderRadius: '6px',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
  },
  '.cm-tooltip-autocomplete ul': {
    maxHeight: '200px',
  },
  '.cm-tooltip-autocomplete li': {
    padding: '4px 8px',
    color: 'var(--text-normal)',
  },
  '.cm-tooltip-autocomplete li[aria-selected]': {
    backgroundColor: 'var(--background-modifier-hover)',
    color: 'var(--text-normal)',
  },
  '.cm-completionLabel': {
    fontFamily: 'var(--font-text)',
  },
  '.cm-completionDetail': {
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    marginLeft: '8px',
  },
});

/**
 * Combined wikilink autocomplete extension
 */
export function wikilinkAutocompleteExtension(): Extension {
  return [
    autocompletion({
      override: [wikilinkCompletionSource],
      closeOnBlur: true,
      activateOnTyping: false, // We trigger manually on [[
      icons: false,
    }),
    triggerOnBrackets,
    closeOnClosingBrackets,
    wikilinkKeymap,
    wikilinkAutocompleteTheme,
  ];
}
