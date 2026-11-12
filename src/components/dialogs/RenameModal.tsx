import React, { useState, useEffect } from 'react';
import { Edit3, X } from 'lucide-react';
import { validateFileName } from '../../services/filesystem/fileRenamer';
import type { AnyFsNode } from '../../types/filesystem.types';

interface RenameModalProps {
  isOpen: boolean;
  item: AnyFsNode | null;
  onRename: (newName: string) => Promise<void>;
  onCancel: () => void;
  isRenaming?: boolean;
}

export const RenameModal: React.FC<RenameModalProps> = ({
  isOpen,
  item,
  onRename,
  onCancel,
  isRenaming = false,
}) => {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setError(null);
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateFileName(name);
    if (!validation.valid) {
      setError(validation.error || 'Invalid name');
      return;
    }
    if (name.trim() === item.name) {
      onCancel();
      return;
    }
    await onRename(name.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Edit3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Rename {item.kind === 'directory' ? 'Folder' : 'File'}
              </h3>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isRenaming}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                New Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                autoFocus
                disabled={isRenaming}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 focus:border-blue-500 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
              {error && <p className="text-xs text-rose-500 mt-1.5">{error}</p>}
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onCancel}
              disabled={isRenaming}
              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isRenaming || !name.trim()}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-sm shadow-blue-500/25 transition-all"
            >
              {isRenaming ? 'Renaming...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

