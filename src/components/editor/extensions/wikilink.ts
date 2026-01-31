/**
 * CodeMirror extension for wikilink [[link]] syntax highlighting
 */

import { syntaxTree } from '@codemirror/language';
import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
} from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';

// Regex to match wikilinks: [[link]] or [[link|display]]
const wikilinkRegex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

// Decoration for the wikilink
const wikilinkMark = Decoration.mark({ class: 'cm-wikilink' });
const wikilinkBracketMark = Decoration.mark({ class: 'cm-wikilink-bracket' });

/**
 * Build decorations for wikilinks in the visible range
 */
function buildWikilinkDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);
    let match: RegExpExecArray | null;

    wikilinkRegex.lastIndex = 0;
    while ((match = wikilinkRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;
      // match[1] is target, match[2] is display (unused for decoration)
      void match[1];

      // Check if we're inside a code block using syntax tree
      let inCodeBlock = false;
      syntaxTree(view.state).iterate({
        from: start,
        to: end,
        enter: (node) => {
          if (
            node.name.includes('CodeBlock') ||
            node.name.includes('FencedCode') ||
            node.name.includes('InlineCode')
          ) {
            inCodeBlock = true;
            return false;
          }
        },
      });

      if (!inCodeBlock) {
        // Opening brackets [[
        builder.add(start, start + 2, wikilinkBracketMark);
        // Link content
        builder.add(start + 2, end - 2, wikilinkMark);
        // Closing brackets ]]
        builder.add(end - 2, end, wikilinkBracketMark);
      }
    }
  }

  return builder.finish();
}

/**
 * ViewPlugin for wikilink decorations
 */
export const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildWikilinkDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildWikilinkDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Theme for wikilink styling
 */
export const wikilinkTheme = EditorView.baseTheme({
  '.cm-wikilink': {
    color: 'var(--text-accent)',
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
  '.cm-wikilink-bracket': {
    color: 'var(--text-faint)',
    opacity: '0.7',
  },
  '.cm-wikilink-widget': {
    color: 'var(--text-accent)',
    cursor: 'pointer',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
});

/**
 * Combined wikilink extension
 */
export function wikilinkExtension() {
  return [wikilinkPlugin, wikilinkTheme];
}
