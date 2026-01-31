/**
 * ProseMirror live preview editor with inline markdown rendering
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { EditorState, Plugin, PluginKey, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser, Node as ProsemirrorNode } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-markdown';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { history, undo, redo } from 'prosemirror-history';
import { cn } from '../../lib/utils';

export interface LivePreviewProps {
  /** Initial content (markdown) */
  content: string;
  /** Callback when content changes */
  onChange?: (content: string) => void;
  /** Callback when a wikilink is clicked */
  onWikilinkClick?: (target: string) => void;
  /** Additional class names */
  className?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
}

// Plugin key for tracking document changes
const docChangePluginKey = new PluginKey('docChange');

/**
 * Extended schema with support for wikilinks, tags, and checkboxes
 */
const extendedSchema = new Schema({
  nodes: {
    doc: basicSchema.spec.nodes.get('doc')!,
    paragraph: basicSchema.spec.nodes.get('paragraph')!,
    blockquote: basicSchema.spec.nodes.get('blockquote')!,
    horizontal_rule: basicSchema.spec.nodes.get('horizontal_rule')!,
    heading: basicSchema.spec.nodes.get('heading')!,
    code_block: basicSchema.spec.nodes.get('code_block')!,
    text: basicSchema.spec.nodes.get('text')!,
    image: basicSchema.spec.nodes.get('image')!,
    hard_break: basicSchema.spec.nodes.get('hard_break')!,
    ordered_list: basicSchema.spec.nodes.get('ordered_list')!,
    bullet_list: basicSchema.spec.nodes.get('bullet_list')!,
    list_item: basicSchema.spec.nodes.get('list_item')!,
    // Checkbox list item
    checkbox_item: {
      content: 'paragraph block*',
      defining: true,
      attrs: { checked: { default: false } },
      parseDOM: [
        {
          tag: 'li[data-type="checkbox"]',
          getAttrs: (dom) => ({
            checked: (dom as HTMLElement).getAttribute('data-checked') === 'true',
          }),
        },
      ],
      toDOM(node) {
        return [
          'li',
          {
            'data-type': 'checkbox',
            'data-checked': node.attrs.checked ? 'true' : 'false',
            class: node.attrs.checked ? 'checked' : '',
          },
          ['input', { type: 'checkbox', checked: node.attrs.checked ? 'checked' : undefined }],
          ['div', { class: 'checkbox-content' }, 0],
        ];
      },
    },
  },
  marks: {
    link: basicSchema.spec.marks.get('link')!,
    em: basicSchema.spec.marks.get('em')!,
    strong: basicSchema.spec.marks.get('strong')!,
    code: basicSchema.spec.marks.get('code')!,
    // Wikilink mark
    wikilink: {
      attrs: { target: { default: '' }, display: { default: '' } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'span[data-wikilink]',
          getAttrs: (dom) => ({
            target: (dom as HTMLElement).getAttribute('data-target'),
            display: (dom as HTMLElement).textContent,
          }),
        },
      ],
      toDOM(mark) {
        return [
          'span',
          {
            class: 'wikilink',
            'data-wikilink': 'true',
            'data-target': mark.attrs.target,
          },
          0,
        ];
      },
    },
    // Tag mark
    tag: {
      attrs: { name: { default: '' } },
      inclusive: false,
      parseDOM: [
        {
          tag: 'span[data-tag]',
          getAttrs: (dom) => ({
            name: (dom as HTMLElement).getAttribute('data-tag'),
          }),
        },
      ],
      toDOM(mark) {
        return [
          'span',
          {
            class: 'tag',
            'data-tag': mark.attrs.name,
          },
          0,
        ];
      },
    },
    // Strikethrough mark
    strikethrough: {
      parseDOM: [
        { tag: 's' },
        { tag: 'strike' },
        { tag: 'del' },
        {
          style: 'text-decoration',
          getAttrs: (value) =>
            (value as string).includes('line-through') ? {} : false,
        },
      ],
      toDOM() {
        return ['s', 0];
      },
    },
    // Highlight mark
    highlight: {
      parseDOM: [{ tag: 'mark' }],
      toDOM() {
        return ['mark', 0];
      },
    },
  },
});

/**
 * Strip YAML/TOML frontmatter from markdown content
 */
function stripFrontmatter(content: string): string {
  // Match YAML frontmatter (--- delimited) or TOML frontmatter (+++ delimited)
  const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n?|^\+\+\+\r?\n[\s\S]*?\r?\n\+\+\+\r?\n?/;
  return content.replace(frontmatterRegex, '');
}

/**
 * Parse markdown content with wikilinks and tags
 */
function parseMarkdownContent(content: string): HTMLElement {
  const container = document.createElement('div');

  // Strip frontmatter before processing
  const contentWithoutFrontmatter = stripFrontmatter(content);

  // Very basic markdown to HTML conversion for live preview
  // This handles common patterns inline while preserving editability
  let html = contentWithoutFrontmatter
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Checkboxes
    .replace(
      /^- \[x\] (.+)$/gm,
      '<li data-type="checkbox" data-checked="true"><input type="checkbox" checked><div class="checkbox-content">$1</div></li>'
    )
    .replace(
      /^- \[ \] (.+)$/gm,
      '<li data-type="checkbox" data-checked="false"><input type="checkbox"><div class="checkbox-content">$1</div></li>'
    )
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<s>$1</s>')
    // Highlight
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    // Code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Wikilinks
    .replace(
      /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
      '<span class="wikilink" data-wikilink="true" data-target="$1">$2</span>'
    )
    .replace(
      /\[\[([^\]]+)\]\]/g,
      '<span class="wikilink" data-wikilink="true" data-target="$1">$1</span>'
    )
    // Tags
    .replace(
      /(^|\s)#([\w/-]+)/g,
      '$1<span class="tag" data-tag="$2">#$2</span>'
    )
    // Links
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2">$1</a>'
    )
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    .replace(/^\*\*\*$/gm, '<hr>')
    // Line breaks to paragraphs
    .split(/\n\n+/)
    .map((para) => {
      if (
        para.startsWith('<h') ||
        para.startsWith('<blockquote') ||
        para.startsWith('<hr') ||
        para.startsWith('<li')
      ) {
        return para;
      }
      return `<p>${para.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  // Wrap checkbox items in a list
  html = html.replace(
    /(<li data-type="checkbox"[^>]*>.*?<\/li>)+/g,
    '<ul class="checkbox-list">$&</ul>'
  );

  container.innerHTML = html;
  return container;
}

/**
 * Serialize ProseMirror document back to markdown
 */
function serializeToMarkdown(doc: ProsemirrorNode): string {
  const lines: string[] = [];

  doc.forEach((node) => {
    if (node.type.name === 'heading') {
      const level = node.attrs.level || 1;
      lines.push(`${'#'.repeat(level)} ${serializeInline(node)}`);
    } else if (node.type.name === 'paragraph') {
      lines.push(serializeInline(node));
    } else if (node.type.name === 'blockquote') {
      node.forEach((child) => {
        lines.push(`> ${serializeInline(child)}`);
      });
    } else if (node.type.name === 'code_block') {
      lines.push('```');
      lines.push(node.textContent);
      lines.push('```');
    } else if (node.type.name === 'horizontal_rule') {
      lines.push('---');
    } else if (node.type.name === 'bullet_list' || node.type.name === 'ordered_list') {
      let index = 1;
      node.forEach((item) => {
        const prefix = node.type.name === 'ordered_list' ? `${index++}.` : '-';
        if (item.type.name === 'checkbox_item') {
          const checked = item.attrs.checked ? 'x' : ' ';
          lines.push(`- [${checked}] ${serializeInline(item.firstChild!)}`);
        } else {
          lines.push(`${prefix} ${serializeInline(item.firstChild!)}`);
        }
      });
    } else if (node.type.name === 'checkbox_item') {
      const checked = node.attrs.checked ? 'x' : ' ';
      lines.push(`- [${checked}] ${serializeInline(node.firstChild!)}`);
    }
  });

  return lines.join('\n\n');
}

function serializeInline(node: ProsemirrorNode): string {
  let result = '';

  node.forEach((child) => {
    if (child.isText) {
      let text = child.text || '';

      // Apply marks
      child.marks.forEach((mark) => {
        if (mark.type.name === 'strong') {
          text = `**${text}**`;
        } else if (mark.type.name === 'em') {
          text = `*${text}*`;
        } else if (mark.type.name === 'code') {
          text = `\`${text}\``;
        } else if (mark.type.name === 'strikethrough') {
          text = `~~${text}~~`;
        } else if (mark.type.name === 'highlight') {
          text = `==${text}==`;
        } else if (mark.type.name === 'link') {
          text = `[${text}](${mark.attrs.href})`;
        } else if (mark.type.name === 'wikilink') {
          const target = mark.attrs.target;
          const display = text;
          text = target === display ? `[[${target}]]` : `[[${target}|${display}]]`;
        } else if (mark.type.name === 'tag') {
          // Tags are already prefixed with #
        }
      });

      result += text;
    } else if (child.type.name === 'hard_break') {
      result += '\n';
    }
  });

  return result;
}

/**
 * Create a plugin for handling checkbox clicks
 */
function createCheckboxPlugin(onCheckboxToggle?: (pos: number, checked: boolean) => void) {
  return new Plugin({
    key: new PluginKey('checkbox'),
    props: {
      handleClickOn(view, _pos, node, nodePos, event) {
        if (
          node.type.name === 'checkbox_item' &&
          (event.target as HTMLElement).tagName === 'INPUT'
        ) {
          const checked = !node.attrs.checked;
          const tr = view.state.tr.setNodeMarkup(nodePos, undefined, {
            ...node.attrs,
            checked,
          });
          view.dispatch(tr);
          onCheckboxToggle?.(nodePos, checked);
          return true;
        }
        return false;
      },
    },
  });
}

/**
 * Create a plugin for handling wikilink clicks
 */
function createWikilinkPlugin(onWikilinkClick?: (target: string) => void) {
  return new Plugin({
    key: new PluginKey('wikilink'),
    props: {
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement;
        if (target.classList.contains('wikilink') || target.closest('.wikilink')) {
          const wikilinkEl = target.classList.contains('wikilink')
            ? target
            : target.closest('.wikilink');
          const linkTarget = wikilinkEl?.getAttribute('data-target');
          if (linkTarget && onWikilinkClick) {
            event.preventDefault();
            onWikilinkClick(linkTarget);
            return true;
          }
        }
        return false;
      },
    },
  });
}

/**
 * Create a plugin for tracking document changes
 */
function createDocChangePlugin(onChange?: (content: string) => void) {
  return new Plugin({
    key: docChangePluginKey,
    state: {
      init() {
        return null;
      },
      apply(tr: Transaction, _value, _oldState, newState) {
        if (tr.docChanged && onChange) {
          const content = serializeToMarkdown(newState.doc);
          onChange(content);
        }
        return null;
      },
    },
  });
}

export const LivePreview = React.memo(function LivePreview({
  content,
  onChange,
  onWikilinkClick,
  className,
  readOnly = false,
}: LivePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onWikilinkClickRef = useRef(onWikilinkClick);

  // Keep refs updated
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onWikilinkClickRef.current = onWikilinkClick;
  }, [onWikilinkClick]);

  // Initialize editor
  useEffect(() => {
    if (!containerRef.current) return;

    // Parse initial content
    const container = parseMarkdownContent(content);
    const doc = DOMParser.fromSchema(extendedSchema).parse(container);

    const state = EditorState.create({
      doc,
      plugins: [
        history(),
        keymap({ 'Mod-z': undo, 'Mod-y': redo, 'Mod-Shift-z': redo }),
        keymap(baseKeymap),
        createCheckboxPlugin(),
        createWikilinkPlugin((target) => onWikilinkClickRef.current?.(target)),
        createDocChangePlugin((newContent) => onChangeRef.current?.(newContent)),
      ],
    });

    const view = new EditorView(containerRef.current, {
      state,
      editable: () => !readOnly,
      attributes: {
        class: 'live-preview-editor',
      },
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
    if (view) {
      const currentContent = serializeToMarkdown(view.state.doc);
      if (content !== currentContent) {
        const container = parseMarkdownContent(content);
        const doc = DOMParser.fromSchema(extendedSchema).parse(container);
        const tr = view.state.tr.replaceWith(
          0,
          view.state.doc.content.size,
          doc.content
        );
        view.dispatch(tr);
      }
    }
  }, [content]);

  // Update editable state
  useEffect(() => {
    const view = viewRef.current;
    if (view) {
      view.setProps({ editable: () => !readOnly });
    }
  }, [readOnly]);

  // Focus method
  const focus = useCallback(() => {
    viewRef.current?.focus();
  }, []);

  // Get current content
  const getContent = useCallback(() => {
    if (viewRef.current) {
      return serializeToMarkdown(viewRef.current.state.doc);
    }
    return '';
  }, []);

  // Expose methods via ref
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      (container as HTMLDivElement & { editor?: { focus: () => void; getContent: () => string } }).editor = {
        focus,
        getContent,
      };
    }
  }, [focus, getContent]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'live-preview h-full w-full overflow-auto',
        'prose prose-invert max-w-none',
        className
      )}
    />
  );
});
