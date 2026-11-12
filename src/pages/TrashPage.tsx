import React, { useEffect, useState } from 'react';
import {
  Trash2,
  RotateCcw,
  XCircle,
  AlertTriangle,
  Info,
  File,
  Folder,
  ShieldAlert,
} from 'lucide-react';
import { useTrashStore } from '../stores/trash.store';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useSettingsStore } from '../stores/settings.store';
import { formatBytes, formatDate } from '../utils/formatters';
import type { TrashItem } from '../types/trash.types';

export const TrashPage: React.FC = () => {
  const trashItems = useTrashStore((s) => s.trashItems);
  const isLoading = useTrashStore((s) => s.isLoading);
  const loadTrash = useTrashStore((s) => s.loadTrash);
  const restoreItem = useTrashStore((s) => s.restoreItem);
  const removePermanently = useTrashStore((s) => s.removePermanently);
  const emptyTrash = useTrashStore((s) => s.emptyTrash);

  const rescan = useFilesystemStore((s) => s.rescan);
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const [confirmEmpty, setConfirmEmpty] = useState(false);

  useEffect(() => {
    loadTrash();
  }, [loadTrash]);

  const handleRestore = async (item: TrashItem) => {
    const success = await restoreItem(item.id);
    if (success && rootFolder) {
      await rescan();
    }
  };

  const handleEmpty = async () => {
    await emptyTrash();
    setConfirmEmpty(false);
  };

  const totalTrashSize = trashItems.reduce((acc, curr) => acc + curr.size, 0);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-500" />
            <span>Application Trash</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Safely recoverable ledger for deleted files and directories
          </p>
        </div>

        {trashItems.length > 0 && (
          <button
            onClick={() => setConfirmEmpty(true)}
            className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-rose-500/20 self-start sm:self-auto transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Empty Trash</span>
          </button>
        )}
      </div>

      {/* OS Recycle Bin Sandbox Disclaimer Callout */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-xs flex items-start gap-3">
        <Info className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">
            Browser Security Notice: Native OS Recycle Bin vs Application Trash
          </p>
          <p className="leading-relaxed opacity-90 text-[11px]">
            Browsers cannot directly manipulate the Windows Recycle Bin without a native companion software. Storage Manager maintains this application-managed trash ledger backed by IndexedDB and authorized local directory restoration.
          </p>
        </div>
      </div>

      {/* Trash Items List */}
      <div className="rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 dark:text-slate-200">
            {trashItems.length} {trashItems.length === 1 ? 'item' : 'items'} in Trash
          </span>
          <span className="text-slate-500 font-mono">
            Total Volume: <strong className="text-slate-800 dark:text-slate-200">{formatBytes(totalTrashSize, displayUnits)}</strong>
          </span>
        </div>

        {trashItems.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Trash2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Trash is empty
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              Deleted items will appear here where you can restore them.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 font-semibold">
                  <th className="py-3 px-4">Item Name</th>
                  <th className="py-3 px-3 hidden md:table-cell">Original Location</th>
                  <th className="py-3 px-3 text-right">Size</th>
                  <th className="py-3 px-3 hidden sm:table-cell">Deleted At</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {trashItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {item.isDirectory ? (
                          <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        ) : (
                          <File className="w-4 h-4 text-blue-500 shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs hidden md:table-cell">
                      {item.originalPath}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                      {formatBytes(item.size, displayUnits)}
                    </td>
                    <td className="py-3 px-3 text-slate-400 hidden sm:table-cell text-[11px]">
                      {formatDate(item.deletedAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleRestore(item)}
                          disabled={!rootFolder}
                          className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 font-medium disabled:opacity-40 inline-flex items-center gap-1"
                          title="Restore item to original location"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>
                        <button
                          onClick={() => removePermanently(item.id)}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Delete permanently"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm Empty Modal */}
      {confirmEmpty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <ShieldAlert className="w-6 h-6" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Empty Application Trash?
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              This will permanently delete all {trashItems.length} records ({formatBytes(totalTrashSize, displayUnits)}). This operation cannot be undone.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmEmpty(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEmpty}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
              >
                Permanently Empty
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

