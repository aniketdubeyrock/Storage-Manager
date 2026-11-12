import React from 'react';
import {
  Folder,
  File,
  Eye,
  Download,
  Trash2,
  MoreVertical,
  Info,
} from 'lucide-react';
import type { AnyFsNode, FileNode, FolderNode } from '../../types/filesystem.types';
import { formatBytes } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';
import { getCategoryColor, detectCategory } from '../../services/filesystem/fileTypeDetector';

interface FileGridViewProps {
  items: AnyFsNode[];
  selectedPaths: Set<string>;
  onToggleSelect: (path: string, isShift: boolean) => void;
  onNavigateToFolder: (path: string) => void;
  onPreview: (node: FileNode) => void;
  onDownload: (node: AnyFsNode) => void;
  onRename: (node: AnyFsNode) => void;
  onMove: (node: AnyFsNode) => void;
  onDelete: (node: AnyFsNode) => void;
  onShowDetails: (node: AnyFsNode) => void;
}

export const FileGridView: React.FC<FileGridViewProps> = ({
  items,
  selectedPaths,
  onToggleSelect,
  onNavigateToFolder,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onDelete,
  onShowDetails,
}) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5 p-4">
      {items.map((item) => {
        const isDir = item.kind === 'directory';
        const folderNode = isDir ? (item as FolderNode) : null;
        const fileNode = !isDir ? (item as FileNode) : null;
        const isSelected = selectedPaths.has(item.path);
        const size = isDir ? folderNode!.totalSize : fileNode!.size;
        const color = isDir
          ? '#F59E0B'
          : getCategoryColor(detectCategory(fileNode!.extension));

        return (
          <div
            key={item.id}
            onClick={(e) => {
              onToggleSelect(item.path, e.shiftKey || e.ctrlKey || e.metaKey);
            }}
            onDoubleClick={() => {
              if (isDir) {
                onNavigateToFolder(item.path);
              } else {
                onPreview(fileNode!);
              }
            }}
            className={`group relative flex flex-col justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
              isSelected
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-500 shadow-sm'
                : 'bg-white dark:bg-[#141e33] border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
            }`}
          >
            {/* Top row: Checkbox and Info Button */}
            <div className="flex items-center justify-between mb-2">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggleSelect(item.path, true)}
                onClick={(e) => e.stopPropagation()}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onShowDetails(item);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Center Icon */}
            <div className="flex items-center justify-center py-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
                style={{ backgroundColor: `${color}15`, color }}
              >
                {isDir ? <Folder className="w-6 h-6" /> : <File className="w-6 h-6" />}
              </div>
            </div>

            {/* Bottom Info */}
            <div className="mt-2 text-center">
              <p
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate"
                title={item.name}
              >
                {item.name}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                {isDir && (folderNode!.calculationStatus === 'calculating' || folderNode!.calculationStatus === 'pending') ? (
                  <span className="text-[10px] text-blue-500 animate-pulse font-sans">Calculating...</span>
                ) : (
                  formatBytes(size, displayUnits)
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

