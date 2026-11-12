import React from 'react';
import {
  Folder,
  File,
  Eye,
  Download,
  Edit3,
  FolderInput,
  Trash2,
  MoreVertical,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  CloudUpload,
} from 'lucide-react';
import type { AnyFsNode, FileNode, FolderNode } from '../../types/filesystem.types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';
import { getCategoryLabel, detectCategory } from '../../services/filesystem/fileTypeDetector';
import type { SortField, SortDirection } from '../../stores/fileManager.store';

interface FileListViewProps {
  items: AnyFsNode[];
  selectedPaths: Set<string>;
  sortBy: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onToggleSelect: (path: string, isShift: boolean) => void;
  onSelectAll: (paths: string[]) => void;
  onNavigateToFolder: (path: string) => void;
  onPreview: (node: FileNode) => void;
  onDownload: (node: AnyFsNode) => void;
  onRename: (node: AnyFsNode) => void;
  onMove: (node: AnyFsNode) => void;
  onDelete: (node: AnyFsNode) => void;
  onShowDetails: (node: AnyFsNode) => void;
  onUploadToDrive?: (node: AnyFsNode) => void;
}

export const FileListView: React.FC<FileListViewProps> = ({
  items,
  selectedPaths,
  sortBy,
  sortDirection,
  onSort,
  onToggleSelect,
  onSelectAll,
  onNavigateToFolder,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onDelete,
  onShowDetails,
  onUploadToDrive,
}) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const allSelected = items.length > 0 && items.every((i) => selectedPaths.has(i.path));

  const renderSortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-blue-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-500" />
    );
  };

  return (
    <div className="w-full overflow-x-auto select-none">
      <table className="w-full text-left border-collapse text-xs">
        {/* Table Head */}
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 dark:text-slate-400 font-semibold">
            <th className="py-2.5 px-3 w-8">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  if (allSelected) {
                    onSelectAll([]);
                  } else {
                    onSelectAll(items.map((i) => i.path));
                  }
                }}
                className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </th>
            <th
              onClick={() => onSort('name')}
              className="py-2.5 px-3 cursor-pointer group hover:text-slate-900 dark:hover:text-white"
            >
              <div className="flex items-center gap-1.5">
                <span>Name</span>
                {renderSortIcon('name')}
              </div>
            </th>
            <th
              onClick={() => onSort('type')}
              className="py-2.5 px-3 cursor-pointer group hover:text-slate-900 dark:hover:text-white w-32 hidden sm:table-cell"
            >
              <div className="flex items-center gap-1.5">
                <span>Type</span>
                {renderSortIcon('type')}
              </div>
            </th>
            <th
              onClick={() => onSort('size')}
              className="py-2.5 px-3 cursor-pointer group hover:text-slate-900 dark:hover:text-white w-28 text-right"
            >
              <div className="flex items-center justify-end gap-1.5">
                <span>Size</span>
                {renderSortIcon('size')}
              </div>
            </th>
            <th
              onClick={() => onSort('lastModified')}
              className="py-2.5 px-3 cursor-pointer group hover:text-slate-900 dark:hover:text-white w-36 hidden md:table-cell"
            >
              <div className="flex items-center gap-1.5">
                <span>Last Modified</span>
                {renderSortIcon('lastModified')}
              </div>
            </th>
            <th className="py-2.5 px-3 w-20 text-right">Actions</th>
          </tr>
        </thead>

        {/* Table Body */}
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
          {items.map((item) => {
            const isDir = item.kind === 'directory';
            const folderNode = isDir ? (item as FolderNode) : null;
            const fileNode = !isDir ? (item as FileNode) : null;
            const isSelected = selectedPaths.has(item.path);
            const size = isDir ? folderNode!.totalSize : fileNode!.size;
            const category = !isDir ? detectCategory(fileNode!.extension) : null;

            return (
              <tr
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
                className={`group transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/70 dark:bg-blue-950/40'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                }`}
              >
                {/* Checkbox */}
                <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={(e) => onToggleSelect(item.path, true)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>

                {/* Name */}
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2.5">
                    {isDir ? (
                      <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                    ) : (
                      <File className="w-4 h-4 text-blue-500 shrink-0" />
                    )}
                    <span
                      className="font-medium text-slate-800 dark:text-slate-200 truncate max-w-xs sm:max-w-md"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>
                </td>

                {/* Type */}
                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                  {isDir ? (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
                      Folder ({folderNode!.calculationStatus === 'pending' || folderNode!.calculationStatus === 'calculating' ? '...' : folderNode!.fileCount})
                    </span>
                  ) : (
                    <span className="text-[11px]">
                      {getCategoryLabel(category!)}
                    </span>
                  )}
                </td>

                {/* Size */}
                <td className="py-2.5 px-3 text-right font-mono text-slate-700 dark:text-slate-300">
                  {isDir && (folderNode!.calculationStatus === 'calculating' || folderNode!.calculationStatus === 'pending') ? (
                    <span className="text-[11px] text-blue-500 animate-pulse font-sans">
                      Calculating...
                    </span>
                  ) : (
                    formatBytes(size, displayUnits)
                  )}
                </td>

                {/* Last Modified */}
                <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400 hidden md:table-cell text-[11px]">
                  {!isDir ? formatDate(fileNode!.lastModified) : '—'}
                </td>

                {/* Actions */}
                <td
                  className="py-2.5 px-3 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                    {!isDir && onUploadToDrive && (
                      <button
                        onClick={() => onUploadToDrive(item)}
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Upload to Google Drive"
                      >
                        <CloudUpload className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!isDir && (
                      <button
                        onClick={() => onPreview(fileNode!)}
                        className="p-1 rounded-lg text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        title="Preview"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => onShowDetails(item)}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
                      title="Properties"
                    >
                      <Info className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(item)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

