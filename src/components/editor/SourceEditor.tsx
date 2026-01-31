/**
 * CodeMirror 6 source mode editor for markdown editing
 */

import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { EditorState, Extension, Compartment, Prec } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, KeyBinding } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldGutter, foldKeymap, indentOnInput, HighlightStyle } from '@codemirror/language';
import { oneDark } from '@codemirror/theme-one-dark';
import { tags } from '@lezer/highlight';
import { wikilinkExtension } from './extensions/wikilink';
import { tagExtension } from './extensions/tag';
import { wikilinkAutocompleteExtension } from './extensions/wikilinkAutocomplete';
import { cn } from '../../lib/utils';

/**
 * Insert a wikilink at the current cursor position
 * If text is selected, wraps it in [[]]
 * If no text is selected, inserts [[]] and places cursor between brackets
 */
function insertWikilink(view: EditorView): boolean {
  const { from, to } = view.state.selection.main;
  const selectedText = view.state.sliceDoc(from, to);

  if (selectedText) {
    // Wrap selected text in [[]]
    view.dispatch({
      changes: { from, to, insert: `[[${selectedText}]]` },
      selection: { anchor: from + 2, head: from + 2 + selectedText.length },
    });
  } else {
    // Insert [[]] and place cursor between brackets
    view.dispatch({
      changes: { from, to, insert: '[[]]' },
      selection: { anchor: from + 2 },
    });
  }

  return true;
}

/**
 * Wikilink keymap for Ctrl/Cmd+K
 */
const wikilinkKeymap: KeyBinding[] = [
  {
    key: 'Mod-k',
    run: insertWikilink,
  },
];

export interface SourceEditorProps {
  /** Initial content of the editor */
  content: string;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when cursor position changes */
  onCursorChange?: (line: number, column: number) => void;
  /** Whether to show line numbers */
  showLineNumbers?: boolean;
  /** Whether to use dark theme */
  darkMode?: boolean;
  /** Additional class names */
  className?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Placeholder text */
  placeholder?: string;
}

// Compartments for dynamic configuration
const lineNumbersCompartment = new Compartment();
const themeCompartment = new Compartment();
const readOnlyCompartment = new Compartment();

/**
 * Custom highlight style for markdown
 */
const markdownHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, fontWeight: 'bold', fontSize: '1.6em' },
  { tag: tags.heading2, fontWeight: 'bold', fontSize: '1.4em' },
  { tag: tags.heading3, fontWeight: 'bold', fontSize: '1.2em' },
  { tag: tags.heading4, fontWeight: 'bold', fontSize: '1.1em' },
  { tag: tags.heading5, fontWeight: 'bold' },
  { tag: tags.heading6, fontWeight: 'bold' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--text-accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--text-accent)' },
  { tag: tags.monospace, fontFamily: 'var(--font-monospace)', backgroundColor: 'var(--background-modifier-code)' },
  { tag: tags.quote, color: 'var(--text-muted)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--text-accent)' },
  { tag: tags.meta, color: 'var(--text-faint)' },
  { tag: tags.comment, color: 'var(--text-faint)' },
]);

/**
 * Light theme for the editor
 */
const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--background-primary)',
    color: 'var(--text-normal)',
  },
  '.cm-content': {
    caretColor: 'var(--text-normal)',
    fontFamily: 'var(--font-text)',
    padding: '16px',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--text-normal)',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--text-selection)',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--background-modifier-hover)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--background-modifier-hover)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--background-secondary)',
    color: 'var(--text-faint)',
    border: 'none',
    borderRight: '1px solid var(--background-modifier-border)',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 8px 0 16px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px',
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
});

export const SourceEditor = React.memo(function SourceEditor({
  content,
  onChange,
  onCursorChange,
  showLineNumbers = true,
  darkMode = true,
  className,
  readOnly = false,
  placeholder: _placeholder,
}: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);

  // Keep refs updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  // Create update listener
  const updateListener = useMemo(
    () =>
      EditorView.updateListener.of((update) => {
        if (update.docChanged && onChangeRef.current) {
          onChangeRef.current(update.state.doc.toString());
        }
        if (update.selectionSet && onCursorChangeRef.current) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          onCursorChangeRef.current(line.number, pos - line.from + 1);
        }
      }),
    []
  );

  // Base extensions
  const baseExtensions: Extension[] = useMemo(
    () => [
      // History
      history(),
      // Drawing/selection
      drawSelection(),
      dropCursor(),
      rectangularSelection(),
      crosshairCursor(),
      highlightActiveLine(),
      highlightActiveLineGutter(),
      // Brackets
      bracketMatching(),
      // Fold gutter
      foldGutter(),
      // Indent on input
      indentOnInput(),
      // Markdown language support with code block highlighting
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
      }),
      // Syntax highlighting
      syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
      syntaxHighlighting(markdownHighlightStyle),
      // Custom extensions for wikilinks and tags
      wikilinkExtension(),
      tagExtension(),
      // Wikilink autocomplete (triggered by [[)
      wikilinkAutocompleteExtension(),
      // Keymaps
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...foldKeymap,
        indentWithTab,
      ]),
      // Wikilink shortcut (Mod+K) - use Prec.highest to override default browser behavior
      Prec.highest(keymap.of(wikilinkKeymap)),
      // Update listener
      updateListener,
      // Compartments for dynamic configuration
      lineNumbersCompartment.of(showLineNumbers ? [lineNumbers()] : []),
      themeCompartment.of(darkMode ? oneDark : lightTheme),
      readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
    ],
    [updateListener, showLineNumbers, darkMode, readOnly]
  );

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: baseExtensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update content when it changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (view && content !== view.state.doc.toString()) {
      view.dispatch({
        changes: {
          from: 0,
          to: view.state.doc.length,
          insert: content,
        },
      });
    }
  }, [content]);

  // Update line numbers configuration
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: lineNumbersCompartment.reconfigure(
          showLineNumbers ? [lineNumbers()] : []
        ),
      });
    }
  }, [showLineNumbers]);

  // Update theme
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: themeCompartment.reconfigure(darkMode ? oneDark : lightTheme),
      });
    }
  }, [darkMode]);

  // Update read-only state
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.dispatch({
        effects: readOnlyCompartment.reconfigure(
          EditorState.readOnly.of(readOnly)
        ),
      });
    }
  }, [readOnly]);

  // Focus method
  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  // Get current content
  const getContent = useCallback(() => {
    return viewRef.current?.state.doc.toString() ?? '';
  }, []);

  // Insert text at cursor
  const insertText = useCallback((text: string) => {
    const view = viewRef.current;
    if (view) {
      const { from, to } = view.state.selection.main;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
      });
    }
  }, []);

  // Expose methods via ref
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      (container as HTMLDivElement & { editor?: { focus: () => void; getContent: () => string; insertText: (text: string) => void } }).editor = {
        focus,
        getContent,
        insertText,
      };
    }
  }, [focus, getContent, insertText]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'source-editor h-full w-full overflow-hidden',
        className
      )}
    />
  );
});
