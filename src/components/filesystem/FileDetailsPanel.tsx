import React from 'react';
import {
  X,
  File,
  Folder,
  Download,
  Trash2,
  Edit3,
  FolderInput,
  Eye,
  Calendar,
  HardDrive,
  FileCode,
  Tag,
  CloudUpload,
} from 'lucide-react';
import type { AnyFsNode, FileNode, FolderNode } from '../../types/filesystem.types';
import { formatBytes, formatDate } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';
import { getCategoryLabel, detectCategory } from '../../services/filesystem/fileTypeDetector';

interface FileDetailsPanelProps {
  node: AnyFsNode | null;
  onClose: () => void;
  onPreview: (node: FileNode) => void;
  onDownload: (node: AnyFsNode) => void;
  onRename: (node: AnyFsNode) => void;
  onMove: (node: AnyFsNode) => void;
  onDelete: (node: AnyFsNode) => void;
  onUploadToDrive?: (node: AnyFsNode) => void;
}

export const FileDetailsPanel: React.FC<FileDetailsPanelProps> = ({
  node,
  onClose,
  onPreview,
  onDownload,
  onRename,
  onMove,
  onDelete,
  onUploadToDrive,
}) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  if (!node) return null;

  const isDir = node.kind === 'directory';
  const folderNode = isDir ? (node as FolderNode) : null;
  const fileNode = !isDir ? (node as FileNode) : null;
  const size = isDir ? folderNode!.totalSize : fileNode!.size;
  const category = !isDir ? detectCategory(fileNode!.extension) : null;

  return (
    <div className="w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] h-full flex flex-col z-10 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
          Properties
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Info */}
      <div className="p-5 flex-1 overflow-y-auto space-y-5">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3 shadow-inner">
            {isDir ? <Folder className="w-8 h-8" /> : <File className="w-8 h-8" />}
          </div>
          <h4 className="font-bold text-sm text-slate-900 dark:text-white break-all">
            {node.name}
          </h4>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
            {formatBytes(size, displayUnits)}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          {!isDir && (
            <button
              onClick={() => onPreview(fileNode!)}
              className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 font-medium transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          )}

          <button
            onClick={() => onDownload(node)}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>

          <button
            onClick={() => onRename(node)}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Rename</span>
          </button>

          <button
            onClick={() => onMove(node)}
            className="flex items-center justify-center gap-1.5 p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium transition-colors"
          >
            <FolderInput className="w-3.5 h-3.5" />
            <span>Move</span>
          </button>
        </div>

        {/* Upload to Google Drive button */}
        {!isDir && onUploadToDrive && (
          <button
            onClick={() => onUploadToDrive(node)}
            className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-xs font-semibold transition-colors"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>Upload to Google Drive</span>
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={() => onDelete(node)}
          className="w-full flex items-center justify-center gap-1.5 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-xs font-semibold transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete {isDir ? 'Folder' : 'File'}</span>
        </button>

        {/* Property details list */}
        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="text-slate-400 block mb-0.5">Location</span>
            <span className="text-slate-700 dark:text-slate-300 font-mono break-all text-[11px]">
              {node.path}
            </span>
          </div>

          <div>
            <span className="text-slate-400 block mb-0.5">Kind</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              {isDir ? 'Folder / Directory' : `${fileNode!.extension.toUpperCase()} File`}
            </span>
          </div>

          {!isDir && (
            <>
              <div>
                <span className="text-slate-400 block mb-0.5">Category</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {getCategoryLabel(category!)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">MIME Type</span>
                <span className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                  {fileNode!.mimeType}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Last Modified</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {formatDate(fileNode!.lastModified)}
                </span>
              </div>
            </>
          )}

          {isDir && (
            <>
              <div>
                <span className="text-slate-400 block mb-0.5">Contains</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {folderNode!.fileCount} files, {folderNode!.folderCount} subfolders
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-0.5">Direct Items</span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  {folderNode!.directFileCount} files, {folderNode!.directFolderCount} folders
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

