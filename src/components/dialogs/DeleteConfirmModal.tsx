import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { formatBytes } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';
import type { AnyFsNode } from '../../types/filesystem.types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  items: AnyFsNode[];
  onConfirm: (permanent: boolean) => Promise<void>;
  onCancel: () => void;
  isDeleting?: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  items,
  onConfirm,
  onCancel,
  isDeleting = false,
}) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const [permanent, setPermanent] = React.useState(false);

  if (!isOpen || items.length === 0) return null;

  const totalSize = items.reduce((acc, curr) => {
    return acc + (curr.kind === 'directory' ? curr.totalSize : curr.size);
  }, 0);

  const hasDirectories = items.some((i) => i.kind === 'directory');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Confirm Deletion
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {items.length === 1 ? '1 item selected' : `${items.length} items selected`}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-300 font-medium mb-1">
              <span>Total affected space:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatBytes(totalSize, displayUnits)}
              </span>
            </div>
            {hasDirectories && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                ⚠️ Includes folders. All subfolders and nested files will be deleted recursively.
              </p>
            )}
          </div>

          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {items.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="text-xs flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300"
              >
                <span className="truncate max-w-[240px] font-medium">{item.name}</span>
                <span className="text-slate-400">
                  {formatBytes(item.kind === 'directory' ? item.totalSize : item.size, displayUnits)}
                </span>
              </div>
            ))}
            {items.length > 5 && (
              <p className="text-xs text-center text-slate-400">
                + {items.length - 5} more items
              </p>
            )}
          </div>

          {/* Action Choice: Trash vs Permanent */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={permanent}
                onChange={(e) => setPermanent(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <div className="text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200 block">
                  Delete permanently
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  By default, items move to Application Trash where they can be restored.
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(permanent)}
            disabled={isDeleting}
            className={`px-4 py-2 rounded-xl text-xs font-semibold text-white shadow-sm flex items-center gap-1.5 transition-all ${
              permanent
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-500/25'
                : 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/25'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isDeleting ? 'Deleting...' : permanent ? 'Delete Permanently' : 'Move to Trash'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

