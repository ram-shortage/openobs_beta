import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { writeFile } from '../lib/tauri';

/**
 * Hook that provides file saving functionality with autosave support
 */
export function useFileSave() {
  const openFiles = useStore((state) => state.openFiles);
  const activeFilePath = useStore((state) => state.activeFilePath);
  const currentContent = useStore((state) => state.currentContent);
  const markFileDirty = useStore((state) => state.markFileDirty);
  const addNotification = useStore((state) => state.addNotification);

  // Track last saved content to avoid unnecessary saves
  const lastSavedContentRef = useRef<string>('');
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Save file function
  const saveFile = useCallback(async (path: string, content: string) => {
    try {
      await writeFile(path, content);
      markFileDirty(path, false);
      lastSavedContentRef.current = content;
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save file';
      addNotification({
        type: 'error',
        message: `Failed to save: ${message}`,
      });
      return false;
    }
  }, [markFileDirty, addNotification]);

  // Manual save with notification
  const saveCurrentFile = useCallback(async () => {
    if (activeFilePath && currentContent) {
      const saved = await saveFile(activeFilePath, currentContent);
      if (saved) {
        addNotification({
          type: 'success',
          message: 'File saved',
        });
      }
      return saved;
    }
    return false;
  }, [activeFilePath, currentContent, saveFile, addNotification]);

  // Autosave effect
  useEffect(() => {
    // Only autosave if there's an active file with changes
    const activeFile = openFiles.find(f => f.path === activeFilePath);
    if (!activeFile || !activeFile.note?.isDirty || !activeFilePath) {
      return;
    }

    // Don't autosave if content hasn't actually changed since last save
    if (currentContent === lastSavedContentRef.current) {
      return;
    }

    // Clear existing timeout
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
    }

    // Set new autosave timeout (2 seconds after last change)
    autosaveTimeoutRef.current = setTimeout(async () => {
      await saveFile(activeFilePath, currentContent);
    }, 2000);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
      }
    };
  }, [currentContent, activeFilePath, openFiles, saveFile]);

  // Update lastSavedContent when file is loaded
  useEffect(() => {
    const activeFile = openFiles.find(f => f.path === activeFilePath);
    if (activeFile?.note && !activeFile.note.isDirty) {
      lastSavedContentRef.current = activeFile.note.content;
    }
  }, [activeFilePath, openFiles]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        await saveCurrentFile();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [saveCurrentFile]);

  return {
    saveFile,
    saveCurrentFile,
  };
}
