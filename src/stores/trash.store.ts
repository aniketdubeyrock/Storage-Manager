import { create } from 'zustand';
import type { TrashItem } from '../types/trash.types';
import { appTrashManager } from '../services/trash/appTrashManager';
import toast from 'react-hot-toast';

interface TrashState {
  trashItems: TrashItem[];
  isLoading: boolean;
  loadTrash: () => Promise<void>;
  restoreItem: (id: string) => Promise<boolean>;
  removePermanently: (id: string) => Promise<boolean>;
  emptyTrash: () => Promise<void>;
}

export const useTrashStore = create<TrashState>((set, get) => ({
  trashItems: [],
  isLoading: false,

  loadTrash: async () => {
    set({ isLoading: true });
    try {
      const items = await appTrashManager.list();
      set({ trashItems: items, isLoading: false });
    } catch (err) {
      console.warn('Failed to load trash items:', err);
      set({ isLoading: false });
    }
  },

  restoreItem: async (id: string) => {
    try {
      await appTrashManager.restore(id);
      await get().loadTrash();
      toast.success('Item restored successfully.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to restore item.';
      toast.error(msg);
      return false;
    }
  },

  removePermanently: async (id: string) => {
    try {
      await appTrashManager.removePermanently(id);
      await get().loadTrash();
      toast.success('Item permanently deleted from trash.');
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete item.';
      toast.error(msg);
      return false;
    }
  },

  emptyTrash: async () => {
    try {
      const count = await appTrashManager.empty();
      await get().loadTrash();
      toast.success(`Trash emptied (${count} items removed).`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to empty trash.';
      toast.error(msg);
    }
  },
}));

