import { StateCreator } from 'zustand';
import type { Note } from '../types';

export type EditorMode = 'edit' | 'preview' | 'split';

export interface OpenFile {
  path: string;
  note: Note | null;
  isLoading: boolean;
  error: string | null;
}

export interface EditorState {
  // Active file
  activeFilePath: string | null;

  // Open files (tabs)
  openFiles: OpenFile[];

  // Editor mode
  editorMode: EditorMode;

  // Editor content (for tracking unsaved changes)
  currentContent: string;

  // Cursor position
  cursorPosition: { line: number; column: number };

  // Selection
  selection: { start: number; end: number } | null;

  // Search in editor
  searchQuery: string;
  searchResults: number[];
  currentSearchIndex: number;
}

export interface EditorActions {
  // File operations
  setActiveFile: (path: string | null) => void;
  openFile: (path: string) => void;
  closeFile: (path: string) => void;
  closeAllFiles: () => void;
  closeOtherFiles: (path: string) => void;

  // File content
  setFileContent: (path: string, note: Note) => void;
  setFileLoading: (path: string, loading: boolean) => void;
  setFileError: (path: string, error: string | null) => void;
  markFileDirty: (path: string, isDirty: boolean) => void;

  // Editor content
  setCurrentContent: (content: string) => void;

  // Editor mode
  setEditorMode: (mode: EditorMode) => void;
  toggleEditorMode: () => void;

  // Cursor and selection
  setCursorPosition: (line: number, column: number) => void;
  setSelection: (start: number, end: number) => void;
  clearSelection: () => void;

  // Search
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: number[]) => void;
  nextSearchResult: () => void;
  prevSearchResult: () => void;
  clearSearch: () => void;
}

export type EditorSlice = EditorState & EditorActions;

const initialState: EditorState = {
  activeFilePath: null,
  openFiles: [],
  editorMode: 'edit',
  currentContent: '',
  cursorPosition: { line: 1, column: 1 },
  selection: null,
  searchQuery: '',
  searchResults: [],
  currentSearchIndex: -1,
};

export const createEditorSlice: StateCreator<EditorSlice, [], [], EditorSlice> = (set, get) => ({
  ...initialState,

  setActiveFile: (path) => {
    set({ activeFilePath: path });

    // Update current content if the file is loaded
    if (path) {
      const file = get().openFiles.find((f) => f.path === path);
      if (file?.note) {
        set({ currentContent: file.note.content });
      }
    }
  },

  openFile: (path) => {
    const { openFiles } = get();

    // Check if file is already open
    const existingFile = openFiles.find((f) => f.path === path);
    if (existingFile) {
      set({ activeFilePath: path });
      return;
    }

    // Add new file to open files
    const newFile: OpenFile = {
      path,
      note: null,
      isLoading: true,
      error: null,
    };

    set({
      openFiles: [...openFiles, newFile],
      activeFilePath: path,
    });
  },

  closeFile: (path) => {
    const { openFiles, activeFilePath } = get();
    const newOpenFiles = openFiles.filter((f) => f.path !== path);

    let newActivePath = activeFilePath;
    if (activeFilePath === path) {
      // Find new active file
      const closedIndex = openFiles.findIndex((f) => f.path === path);
      if (newOpenFiles.length > 0) {
        const newIndex = Math.min(closedIndex, newOpenFiles.length - 1);
        newActivePath = newOpenFiles[newIndex].path;
      } else {
        newActivePath = null;
      }
    }

    set({
      openFiles: newOpenFiles,
      activeFilePath: newActivePath,
    });
  },

  closeAllFiles: () => {
    set({
      openFiles: [],
      activeFilePath: null,
      currentContent: '',
    });
  },

  closeOtherFiles: (path) => {
    const { openFiles } = get();
    const fileToKeep = openFiles.find((f) => f.path === path);

    if (fileToKeep) {
      set({
        openFiles: [fileToKeep],
        activeFilePath: path,
      });
    }
  },

  setFileContent: (path, note) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, note, isLoading: false, error: null } : f
      ),
      currentContent: state.activeFilePath === path ? note.content : state.currentContent,
    }));
  },

  setFileLoading: (path, loading) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, isLoading: loading } : f
      ),
    }));
  },

  setFileError: (path, error) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path ? { ...f, error, isLoading: false } : f
      ),
    }));
  },

  markFileDirty: (path, isDirty) => {
    set((state) => ({
      openFiles: state.openFiles.map((f) =>
        f.path === path && f.note
          ? { ...f, note: { ...f.note, isDirty } }
          : f
      ),
    }));
  },

  setCurrentContent: (content) => {
    set({ currentContent: content });
  },

  setEditorMode: (mode) => {
    set({ editorMode: mode });
  },

  toggleEditorMode: () => {
    set((state) => {
      const modes: EditorMode[] = ['edit', 'preview', 'split'];
      const currentIndex = modes.indexOf(state.editorMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { editorMode: modes[nextIndex] };
    });
  },

  setCursorPosition: (line, column) => {
    set({ cursorPosition: { line, column } });
  },

  setSelection: (start, end) => {
    set({ selection: { start, end } });
  },

  clearSelection: () => {
    set({ selection: null });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query, currentSearchIndex: -1 });
  },

  setSearchResults: (results) => {
    set({
      searchResults: results,
      currentSearchIndex: results.length > 0 ? 0 : -1,
    });
  },

  nextSearchResult: () => {
    set((state) => {
      if (state.searchResults.length === 0) return state;
      const nextIndex = (state.currentSearchIndex + 1) % state.searchResults.length;
      return { currentSearchIndex: nextIndex };
    });
  },

  prevSearchResult: () => {
    set((state) => {
      if (state.searchResults.length === 0) return state;
      const prevIndex = state.currentSearchIndex <= 0
        ? state.searchResults.length - 1
        : state.currentSearchIndex - 1;
      return { currentSearchIndex: prevIndex };
    });
  },

  clearSearch: () => {
    set({
      searchQuery: '',
      searchResults: [],
      currentSearchIndex: -1,
    });
  },
});
