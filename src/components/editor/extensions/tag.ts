/**
 * CodeMirror extension for #tag syntax highlighting
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

// Regex to match tags: #tag or #nested/tag
// Must start with # followed by word characters, can contain / for nested tags
const tagRegex = /#[\w][\w/-]*/g;

// Decoration for tags
const tagMark = Decoration.mark({ class: 'cm-tag' });
const tagHashMark = Decoration.mark({ class: 'cm-tag-hash' });

/**
 * Build decorations for tags in the visible range
 */
function buildTagDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (const { from, to } of view.visibleRanges) {
    const text = doc.sliceString(from, to);
    let match: RegExpExecArray | null;

    tagRegex.lastIndex = 0;
    while ((match = tagRegex.exec(text)) !== null) {
      const start = from + match.index;
      const end = start + match[0].length;

      // Check if we're inside a code block or inside a wikilink using syntax tree
      let inCodeOrLink = false;
      syntaxTree(view.state).iterate({
        from: start,
        to: end,
        enter: (node) => {
          if (
            node.name.includes('CodeBlock') ||
            node.name.includes('FencedCode') ||
            node.name.includes('InlineCode') ||
            node.name.includes('Link') ||
            node.name.includes('URL')
          ) {
            inCodeOrLink = true;
            return false;
          }
        },
      });

      // Also check if it's part of a URL or heading (# at start of line)
      const lineStart = doc.lineAt(start).from;
      const textBeforeTag = doc.sliceString(lineStart, start);
      const isHeading = /^\s*$/.test(textBeforeTag) && start === from + match.index;
      const isInUrl = /https?:\/\/[^\s]*$/.test(textBeforeTag);

      if (!inCodeOrLink && !isHeading && !isInUrl) {
        // Check character before to ensure it's a word boundary
        const charBefore = start > 0 ? doc.sliceString(start - 1, start) : ' ';
        if (/[\s\[\](){},.:;!?'"]/.test(charBefore) || start === 0 || start === lineStart) {
          // Hash mark #
          builder.add(start, start + 1, tagHashMark);
          // Tag content
          builder.add(start + 1, end, tagMark);
        }
      }
    }
  }

  return builder.finish();
}

/**
 * ViewPlugin for tag decorations
 */
export const tagPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildTagDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildTagDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
);

/**
 * Theme for tag styling
 */
export const tagTheme = EditorView.baseTheme({
  '.cm-tag': {
    color: 'var(--text-accent)',
    backgroundColor: 'var(--background-modifier-tag)',
    borderRadius: '3px',
    padding: '0 2px',
  },
  '.cm-tag-hash': {
    color: 'var(--text-accent)',
    opacity: '0.7',
  },
});

/**
 * Combined tag extension
 */
export function tagExtension() {
  return [tagPlugin, tagTheme];
}
