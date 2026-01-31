/**
 * Main editor wrapper that switches between modes
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { SourceEditor } from './SourceEditor';
import { LivePreview } from './LivePreview';
import { ReadingView } from './ReadingView';
import { Toolbar, getFormatSyntax, type FormatType, type SaveState } from './Toolbar';
import { useStore, useEditor, useEditorActions, useUI } from '../../store';
import { cn, generateId, getFileName, getParentPath } from '../../lib/utils';
import { readFile, writeFile, fileExists, createNote } from '../../lib/tauri';
import type { Note } from '../../types';

export interface EditorProps {
  /** Additional class names */
  className?: string;
}

// Auto-save debounce delay in ms
const AUTO_SAVE_DELAY = 1000;

export const Editor = React.memo(function Editor({ className }: EditorProps) {
  const { activeFilePath, openFiles, editorMode, currentContent } = useEditor();
  const { setCurrentContent, setEditorMode, setCursorPosition, markFileDirty, setFileContent, setFileError } = useEditorActions();
  const { resolvedTheme } = useUI();
  const addNotification = useStore((state) => state.addNotification);

  // Get the active file
  const activeFile = openFiles.find((f) => f.path === activeFilePath);
  const isLoading = activeFile?.isLoading ?? false;
  const error = activeFile?.error ?? null;
  const note = activeFile?.note ?? null;

  // Track save state for UI feedback
  const [saveState, setSaveState] = useState<SaveState>('saved');

  // Load file content when a file is opened and isLoading is true
  useEffect(() => {
    if (!activeFilePath || !isLoading) return;

    const loadFileContent = async () => {
      try {
        const fileContent = await readFile(activeFilePath);

        // Create a Note object from the file content
        const fileName = getFileName(activeFilePath);
        const title = fileName.replace(/\.md$/, '');
        const parentPath = getParentPath(activeFilePath);

        const note: Note = {
          metadata: {
            id: generateId(),
            title,
            path: activeFilePath,
            extension: 'md',
            created: fileContent.modified ? new Date(fileContent.modified).getTime() : Date.now(),
            modified: fileContent.modified ? new Date(fileContent.modified).getTime() : Date.now(),
            size: fileContent.content.length,
            parent: parentPath,
            tags: [],
            aliases: [],
            links: [],
            backlinks: [],
          },
          content: fileContent.content,
          isDirty: false,
        };

        setFileContent(activeFilePath, note);
      } catch (err) {
        console.error('Failed to load file:', activeFilePath, err);
        // Handle different error types from Tauri
        let errorMessage = 'Failed to load file';
        if (err instanceof Error) {
          errorMessage = err.message;
        } else if (typeof err === 'string') {
          errorMessage = err;
        } else if (err && typeof err === 'object' && 'message' in err) {
          errorMessage = String((err as { message: unknown }).message);
        }
        setFileError(activeFilePath, errorMessage);
      }
    };

    loadFileContent();
  }, [activeFilePath, isLoading, setFileContent, setFileError]);

  // Track original content for dirty detection
  const originalContentRef = useRef<string>(note?.content ?? '');

  // Update original content when file changes
  useEffect(() => {
    if (note) {
      originalContentRef.current = note.content;
    }
  }, [note?.metadata.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // State for the editor content (used for live updates)
  const [localContent, setLocalContent] = useState(currentContent);

  // Sync local content with store
  useEffect(() => {
    setLocalContent(currentContent);
  }, [currentContent]);

  // Track if save is in progress to avoid duplicate saves
  const isSavingRef = useRef(false);
  // Track the last saved content to know what's on disk
  const lastSavedContentRef = useRef<string>(note?.content ?? '');

  // Update lastSavedContent when a new file is loaded
  useEffect(() => {
    if (note && !note.isDirty) {
      lastSavedContentRef.current = note.content;
      setSaveState('saved');
    }
  }, [note?.metadata?.path]); // eslint-disable-line react-hooks/exhaustive-deps

  // Immediate save function - actually writes to disk
  const saveToFile = useCallback(
    async (content: string, path: string): Promise<boolean> => {
      // Skip if content matches what's on disk
      if (content === lastSavedContentRef.current) {
        setSaveState('saved');
        markFileDirty(path, false);
        return true;
      }

      // Skip if already saving
      if (isSavingRef.current) {
        return false;
      }

      isSavingRef.current = true;
      setSaveState('saving');

      try {
        await writeFile(path, content);
        lastSavedContentRef.current = content;
        markFileDirty(path, false);
        setSaveState('saved');
        console.log('File saved:', path);
        return true;
      } catch (err) {
        console.error('Failed to save file:', path, err);
        setSaveState('dirty');
        addNotification({
          type: 'error',
          message: `Failed to save: ${err instanceof Error ? err.message : 'Unknown error'}`,
        });
        return false;
      } finally {
        isSavingRef.current = false;
      }
    },
    [markFileDirty, addNotification]
  );

  // Debounced save function - schedules a save after delay
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingContentRef = useRef<{ content: string; path: string } | null>(null);

  const debouncedSave = useCallback(
    (content: string, path: string) => {
      // Track pending content for flush on navigation
      pendingContentRef.current = { content, path };

      // Mark as dirty immediately
      const isDirty = content !== lastSavedContentRef.current;
      if (isDirty) {
        markFileDirty(path, true);
        setSaveState('dirty');
      }

      // Clear existing timeout
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }

      // Schedule save
      debouncedSaveRef.current = setTimeout(() => {
        saveToFile(content, path);
        pendingContentRef.current = null;
      }, AUTO_SAVE_DELAY);
    },
    [markFileDirty, saveToFile]
  );

  // Flush pending saves immediately (used before navigation)
  const flushPendingSave = useCallback(async () => {
    // Clear the debounce timer
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
      debouncedSaveRef.current = null;
    }

    // Save pending content
    if (pendingContentRef.current) {
      const { content, path } = pendingContentRef.current;
      pendingContentRef.current = null;
      await saveToFile(content, path);
    }
  }, [saveToFile]);

  // Save before switching files - intercept setActiveFile
  const previousActivePathRef = useRef<string | null>(activeFilePath);
  useEffect(() => {
    // When active file changes, save the previous file
    if (previousActivePathRef.current && previousActivePathRef.current !== activeFilePath) {
      flushPendingSave();
    }
    previousActivePathRef.current = activeFilePath;
  }, [activeFilePath, flushPendingSave]);

  // Save on window blur (switching to another app)
  useEffect(() => {
    const handleWindowBlur = () => {
      flushPendingSave();
    };

    window.addEventListener('blur', handleWindowBlur);
    return () => window.removeEventListener('blur', handleWindowBlur);
  }, [flushPendingSave]);

  // Save before page unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if there are unsaved changes
      if (pendingContentRef.current || saveState === 'dirty') {
        // Try to save synchronously isn't possible, but we can warn
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
        // Also try to flush
        flushPendingSave();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flushPendingSave, saveState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) {
        clearTimeout(debouncedSaveRef.current);
      }
    };
  }, []);

  // Keyboard shortcut for manual save (Ctrl+S / Cmd+S)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        await flushPendingSave();
        // Also save current content if no pending
        if (activeFilePath && localContent !== lastSavedContentRef.current) {
          const saved = await saveToFile(localContent, activeFilePath);
          if (saved) {
            addNotification({
              type: 'success',
              message: 'File saved',
            });
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [flushPendingSave, activeFilePath, localContent, saveToFile, addNotification]);

  // Handle content changes
  const handleContentChange = useCallback(
    (content: string) => {
      setLocalContent(content);
      setCurrentContent(content);

      // Trigger auto-save
      if (activeFilePath) {
        debouncedSave(content, activeFilePath);
      }
    },
    [setCurrentContent, activeFilePath, debouncedSave]
  );

  // Handle cursor position changes
  const handleCursorChange = useCallback(
    (line: number, column: number) => {
      setCursorPosition(line, column);
    },
    [setCursorPosition]
  );

  // Handle wikilink clicks - creates note if it doesn't exist
  const handleWikilinkClick = useCallback(
    async (target: string) => {
      const store = useStore.getState();
      const vaultPath = store.vaultPath;

      if (!vaultPath) return;

      // Resolve the wikilink target to a relative file path
      const targetPath = target.endsWith('.md') ? target : `${target}.md`;

      // Check if file exists, create it if not
      const exists = await fileExists(targetPath);
      if (!exists) {
        try {
          // Extract title from the target (without .md extension)
          const title = target.endsWith('.md') ? target.slice(0, -3) : target;
          // Create the note at vault root
          await createNote('/', title);

          // Add to file tree
          store.addFileTreeItem(
            {
              id: generateId(),
              name: `${title}.md`,
              path: targetPath,
              isFolder: false,
            },
            '/'
          );

          addNotification({
            type: 'info',
            message: `Created new note: ${title}`,
          });
        } catch (err) {
          console.error('Failed to create note:', err);
          addNotification({
            type: 'error',
            message: `Failed to create note: ${err instanceof Error ? err.message : 'Unknown error'}`,
          });
          return;
        }
      }

      // Open the note using relative path
      store.openFile(targetPath);
    },
    [addNotification]
  );

  // Handle checkbox toggle in reading view
  const handleCheckboxToggle = useCallback(
    (lineIndex: number, checked: boolean) => {
      // Find and update the checkbox in the content
      const lines = localContent.split('\n');
      let checkboxCount = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^- \[([ x])\]/.test(line)) {
          if (checkboxCount === lineIndex) {
            lines[i] = checked
              ? line.replace(/^- \[ \]/, '- [x]')
              : line.replace(/^- \[x\]/, '- [ ]');
            break;
          }
          checkboxCount++;
        }
      }

      const newContent = lines.join('\n');
      handleContentChange(newContent);
    },
    [localContent, handleContentChange]
  );

  // Handle format button clicks
  const handleFormat = useCallback(
    (format: FormatType) => {
      const syntax = getFormatSyntax(format);
      const { prefix, suffix, block, placeholder } = syntax;

      // Get the current selection or cursor position
      // This is a simplified version - in practice, you'd need to interact with the editor
      const selectedText = placeholder || '';
      const newText = block
        ? `\n${prefix}${selectedText}${suffix}\n`
        : `${prefix}${selectedText}${suffix}`;

      // Insert the formatted text
      // For now, just append to content - in practice, you'd insert at cursor
      const newContent = localContent + newText;
      handleContentChange(newContent);
    },
    [localContent, handleContentChange]
  );

  // Handle editor mode change
  const handleEditorModeChange = useCallback(
    (mode: typeof editorMode) => {
      setEditorMode(mode);
    },
    [setEditorMode]
  );

  // Determine if we're in dark mode
  const isDarkMode = resolvedTheme === 'dark';

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-2 text-text-muted">
          <div className="animate-spin h-8 w-8 border-2 border-interactive-accent border-t-transparent rounded-full" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-2 text-red-500">
          <span className="text-lg">Error loading file</span>
          <span className="text-sm text-text-muted">{error}</span>
        </div>
      </div>
    );
  }

  // Show empty state
  if (!activeFilePath || !note) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center gap-2 text-text-muted">
          <span className="text-lg">No file selected</span>
          <span className="text-sm">Select a file from the sidebar to start editing</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Toolbar */}
      <Toolbar
        editorMode={editorMode}
        onEditorModeChange={handleEditorModeChange}
        onFormat={handleFormat}
        disabled={editorMode === 'preview'}
        saveState={saveState}
      />

      {/* Editor content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {editorMode === 'edit' && (
          <SourceEditor
            content={localContent}
            onChange={handleContentChange}
            onCursorChange={handleCursorChange}
            showLineNumbers={true}
            darkMode={isDarkMode}
            className="h-full"
          />
        )}

        {editorMode === 'preview' && (
          <ReadingView
            content={localContent}
            onWikilinkClick={handleWikilinkClick}
            onCheckboxToggle={handleCheckboxToggle}
            className="h-full"
          />
        )}

        {editorMode === 'split' && (
          <div className="flex h-full">
            <div className="flex-1 border-r border-background-modifier-border overflow-hidden">
              <SourceEditor
                content={localContent}
                onChange={handleContentChange}
                onCursorChange={handleCursorChange}
                showLineNumbers={true}
                darkMode={isDarkMode}
                className="h-full"
              />
            </div>
            <div className="flex-1 overflow-hidden">
              <LivePreview
                content={localContent}
                onChange={handleContentChange}
                onWikilinkClick={handleWikilinkClick}
                className="h-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

// Export components for individual use
export { SourceEditor } from './SourceEditor';
export { LivePreview } from './LivePreview';
export { ReadingView } from './ReadingView';
export { Toolbar, getFormatSyntax } from './Toolbar';
export type { FormatType, SaveState } from './Toolbar';
