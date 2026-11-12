import React from 'react';
import { Download, Trash2, FolderInput, X, Archive, CloudUpload } from 'lucide-react';
import type { AnyFsNode } from '../../types/filesystem.types';
import { formatBytes } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';

interface BulkActionToolbarProps {
  selectedItems: AnyFsNode[];
  onClearSelection: () => void;
  onDownloadZip: () => void;
  onMoveSelected: () => void;
  onDeleteSelected: () => void;
  onUploadToDrive?: () => void;
}

export const BulkActionToolbar: React.FC<BulkActionToolbarProps> = ({
  selectedItems,
  onClearSelection,
  onDownloadZip,
  onMoveSelected,
  onDeleteSelected,
  onUploadToDrive,
}) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  if (selectedItems.length === 0) return null;

  const totalBytes = selectedItems.reduce((acc, curr) => {
    return acc + (curr.kind === 'directory' ? curr.totalSize : curr.size);
  }, 0);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 text-white px-5 py-2.5 rounded-2xl shadow-2xl border border-slate-700/80 backdrop-blur-md flex items-center gap-4 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 pr-3 border-r border-slate-700">
        <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        <span className="text-xs font-semibold">
          {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'items'} selected
        </span>
        <span className="text-xs text-slate-400">({formatBytes(totalBytes, displayUnits)})</span>
      </div>

      <div className="flex items-center gap-2">
        {onUploadToDrive && (
          <button
            onClick={onUploadToDrive}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-medium text-white shadow-sm transition-colors"
            title="Upload selected to Google Drive"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Drive</span>
          </button>
        )}

        <button
          onClick={onDownloadZip}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          title="Download as ZIP"
        >
          <Archive className="w-3.5 h-3.5 text-blue-400" />
          <span>ZIP</span>
        </button>

        <button
          onClick={onDeleteSelected}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-600 text-xs font-medium text-white shadow-sm transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>

        <button
          onClick={onClearSelection}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 ml-1"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

