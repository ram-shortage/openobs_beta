/**
 * Reading view - fully rendered markdown with remark/rehype
 */

import React, { useMemo, useCallback } from 'react';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeStringify from 'rehype-stringify';
import { cn } from '../../lib/utils';

export interface ReadingViewProps {
  /** Markdown content to render */
  content: string;
  /** Callback when a wikilink is clicked */
  onWikilinkClick?: (target: string) => void;
  /** Callback when a checkbox is toggled */
  onCheckboxToggle?: (lineIndex: number, checked: boolean) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Strip YAML/TOML frontmatter from markdown content
 */
function stripFrontmatter(content: string): string {
  // Match YAML frontmatter (--- delimited) or TOML frontmatter (+++ delimited)
  const frontmatterRegex = /^---\r?\n[\s\S]*?\r?\n---\r?\n?|^\+\+\+\r?\n[\s\S]*?\r?\n\+\+\+\r?\n?/;
  return content.replace(frontmatterRegex, '');
}

/**
 * Pre-process markdown to handle custom syntax
 */
function preprocessMarkdown(content: string): string {
  // First strip frontmatter
  const contentWithoutFrontmatter = stripFrontmatter(content);
  return contentWithoutFrontmatter
    // Convert wikilinks to HTML spans
    .replace(
      /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
      '<span class="wikilink" data-target="$1">$2</span>'
    )
    .replace(
      /\[\[([^\]]+)\]\]/g,
      '<span class="wikilink" data-target="$1">$1</span>'
    )
    // Convert tags to HTML spans
    .replace(
      /(^|\s)#([\w/-]+)/g,
      '$1<span class="tag" data-tag="$2">#$2</span>'
    )
    // Convert callouts (Obsidian style)
    .replace(
      /^> \[!(\w+)\]([-+]?)\s*(.*)$/gm,
      (_, type, fold, title) => {
        const foldClass = fold === '-' ? 'collapsed' : fold === '+' ? 'expanded' : '';
        return `<div class="callout callout-${type.toLowerCase()} ${foldClass}"><div class="callout-title"><span class="callout-icon"></span><span class="callout-title-text">${title || type}</span></div><div class="callout-content">`;
      }
    );
}

/**
 * Post-process HTML to close callout divs and enhance elements
 */
function postprocessHtml(html: string): string {
  // Close callout divs
  let result = html;
  const calloutMatches = result.match(/<div class="callout[^"]*">/g);
  if (calloutMatches) {
    calloutMatches.forEach(() => {
      // Find the next blockquote end and close the callout
      result = result.replace(
        /(<div class="callout-content">)([\s\S]*?)(<\/blockquote>|$)/,
        '$1$2</div></div>'
      );
    });
  }

  // Enhance code blocks with language classes
  result = result.replace(
    /<pre><code class="language-(\w+)">/g,
    '<pre class="code-block language-$1"><code class="language-$1">'
  );

  // Add data attributes to checkboxes for interaction
  let checkboxIndex = 0;
  result = result.replace(
    /<input[^>]*type="checkbox"[^>]*>/g,
    (match) => {
      const index = checkboxIndex++;
      const checked = match.includes('checked');
      return `<input type="checkbox" data-checkbox-index="${index}" ${checked ? 'checked' : ''}>`;
    }
  );

  return result;
}

/**
 * Process markdown to HTML
 */
async function processMarkdown(content: string): Promise<string> {
  const preprocessed = preprocessMarkdown(content);

  const result = await unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml', 'toml']) // Parse and remove frontmatter
    .use(remarkGfm) // Tables, strikethrough, task lists, etc.
    .use(remarkMath) // Math equations
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex) // KaTeX rendering
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(preprocessed);

  return postprocessHtml(String(result));
}

/**
 * Synchronous markdown processing for initial render
 */
function processMarkdownSync(content: string): string {
  const preprocessed = preprocessMarkdown(content);

  // Basic synchronous processing for initial render
  // The full async processing will update this
  let html = preprocessed
    // Headers
    .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
    .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    // Strikethrough
    .replace(/~~(.+?)~~/g, '<del>$1</del>')
    // Highlight
    .replace(/==(.+?)==/g, '<mark>$1</mark>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr>')
    .replace(/^\*\*\*$/gm, '<hr>')
    // Task lists
    .replace(
      /^- \[x\] (.+)$/gm,
      '<li class="task-list-item"><input type="checkbox" checked disabled> $1</li>'
    )
    .replace(
      /^- \[ \] (.+)$/gm,
      '<li class="task-list-item"><input type="checkbox" disabled> $1</li>'
    )
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
    // Paragraphs
    .split(/\n\n+/)
    .map((para) => {
      const trimmed = para.trim();
      if (
        !trimmed ||
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<blockquote') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<li') ||
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<span') ||
        trimmed.startsWith('<img')
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');

  // Wrap list items in lists
  html = html.replace(/(<li class="task-list-item">.*?<\/li>)+/g, '<ul class="task-list">$&</ul>');
  html = html.replace(/(<li>.*?<\/li>)+/g, (match) => {
    if (match.includes('task-list-item')) return match;
    return `<ul>${match}</ul>`;
  });

  return postprocessHtml(html);
}

export const ReadingView = React.memo(function ReadingView({
  content,
  onWikilinkClick,
  onCheckboxToggle,
  className,
}: ReadingViewProps) {
  const [html, setHtml] = React.useState(() => processMarkdownSync(content));

  // Process markdown asynchronously for full features
  React.useEffect(() => {
    let cancelled = false;

    processMarkdown(content).then((result) => {
      if (!cancelled) {
        setHtml(result);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [content]);

  // Handle click events
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;

      // Handle wikilink clicks
      if (target.classList.contains('wikilink')) {
        event.preventDefault();
        const linkTarget = target.getAttribute('data-target');
        if (linkTarget && onWikilinkClick) {
          onWikilinkClick(linkTarget);
        }
        return;
      }

      // Handle tag clicks
      if (target.classList.contains('tag')) {
        event.preventDefault();
        const tagName = target.getAttribute('data-tag');
        if (tagName) {
          // Could trigger a tag search or navigation
          console.log('Tag clicked:', tagName);
        }
        return;
      }

      // Handle checkbox clicks
      if (target.tagName === 'INPUT' && target.getAttribute('type') === 'checkbox') {
        const indexStr = target.getAttribute('data-checkbox-index');
        if (indexStr && onCheckboxToggle) {
          const index = parseInt(indexStr, 10);
          const checked = (target as HTMLInputElement).checked;
          onCheckboxToggle(index, checked);
        }
        return;
      }

      // Handle external link clicks
      if (target.tagName === 'A') {
        const href = target.getAttribute('href');
        if (href && (href.startsWith('http://') || href.startsWith('https://'))) {
          event.preventDefault();
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      }
    },
    [onWikilinkClick, onCheckboxToggle]
  );

  // Memoize the rendered content
  const renderedContent = useMemo(
    () => ({ __html: html }),
    [html]
  );

  return (
    <div
      className={cn(
        'reading-view h-full w-full overflow-auto p-6',
        'prose prose-invert max-w-none',
        'prose-headings:text-text-normal prose-headings:font-semibold',
        'prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl',
        'prose-p:text-text-normal prose-p:leading-relaxed',
        'prose-a:text-text-accent prose-a:no-underline hover:prose-a:underline',
        'prose-strong:text-text-normal prose-strong:font-semibold',
        'prose-em:text-text-normal',
        'prose-code:text-text-accent prose-code:bg-background-modifier-code prose-code:rounded prose-code:px-1',
        'prose-pre:bg-background-secondary prose-pre:border prose-pre:border-background-modifier-border',
        'prose-blockquote:border-l-interactive-accent prose-blockquote:text-text-muted',
        'prose-ul:text-text-normal prose-ol:text-text-normal',
        'prose-li:text-text-normal',
        'prose-hr:border-background-modifier-border',
        'prose-img:rounded-lg prose-img:max-w-full',
        'prose-table:text-text-normal',
        'prose-th:text-text-normal prose-th:bg-background-secondary',
        'prose-td:text-text-normal prose-td:border-background-modifier-border',
        className
      )}
      onClick={handleClick}
      dangerouslySetInnerHTML={renderedContent}
    />
  );
});

