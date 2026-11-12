import { create } from 'zustand';
import type { FileNode, FolderNode, AnyFsNode } from '../types/filesystem.types';
import type { FileCategory } from '../types/analytics.types';
import type { DefaultViewMode } from '../types/settings.types';

export type SortField = 'name' | 'size' | 'lastModified' | 'type';
export type SortDirection = 'asc' | 'desc';

interface FileManagerState {
  currentPath: string; // Current directory being viewed in File Manager
  selectedPaths: Set<string>;
  viewMode: DefaultViewMode;
  sortBy: SortField;
  sortDirection: SortDirection;
  searchQuery: string;
  categoryFilter: FileCategory | 'all';
  previewNode: FileNode | null;
  detailsNode: AnyFsNode | null;
  history: string[];
  historyIndex: number;

  // Actions
  navigateTo: (path: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  toggleSelect: (path: string, isShiftOrCtrl?: boolean) => void;
  selectAll: (paths: string[]) => void;
  clearSelection: () => void;
  setViewMode: (mode: DefaultViewMode) => void;
  setSorting: (field: SortField) => void;
  setSearchQuery: (query: string) => void;
  setCategoryFilter: (category: FileCategory | 'all') => void;
  setPreviewNode: (node: FileNode | null) => void;
  setDetailsNode: (node: AnyFsNode | null) => void;
}

export const useFileManagerStore = create<FileManagerState>((set, get) => ({
  currentPath: '/',
  selectedPaths: new Set<string>(),
  viewMode: 'list',
  sortBy: 'name',
  sortDirection: 'asc',
  searchQuery: '',
  categoryFilter: 'all',
  previewNode: null,
  detailsNode: null,
  history: ['/'],
  historyIndex: 0,

  navigateTo: (path) => {
    const { history, historyIndex, currentPath } = get();
    if (path === currentPath) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(path);

    set({
      currentPath: path,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      selectedPaths: new Set(),
      detailsNode: null,
    });
  },

  navigateBack: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      set({
        historyIndex: prevIndex,
        currentPath: history[prevIndex],
        selectedPaths: new Set(),
      });
    }
  },

  navigateForward: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      set({
        historyIndex: nextIndex,
        currentPath: history[nextIndex],
        selectedPaths: new Set(),
      });
    }
  },

  toggleSelect: (path, isShiftOrCtrl = false) => {
    set((state) => {
      if (isShiftOrCtrl) {
        const next = new Set(state.selectedPaths);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return { selectedPaths: next };
      }
      // Standard Windows Explorer behavior: clicking an item selects it
      // and keeps it selected so that double-click fires cleanly
      return { selectedPaths: new Set([path]) };
    });
  },

  selectAll: (paths) => {
    set({ selectedPaths: new Set(paths) });
  },

  clearSelection: () => {
    set({ selectedPaths: new Set() });
  },

  setViewMode: (viewMode) => set({ viewMode }),

  setSorting: (field) => {
    const { sortBy, sortDirection } = get();
    if (sortBy === field) {
      set({ sortDirection: sortDirection === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortBy: field, sortDirection: field === 'size' ? 'desc' : 'asc' });
    }
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),

  setPreviewNode: (previewNode) => set({ previewNode }),

  setDetailsNode: (detailsNode) => set({ detailsNode }),
}));

