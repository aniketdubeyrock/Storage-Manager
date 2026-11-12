import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  Eye,
  Download,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  File,
  HardDrive,
  CloudUpload,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useSettingsStore } from '../stores/settings.store';
import { useTrashStore } from '../stores/trash.store';
import { useGoogleDriveStore } from '../stores/googleDrive.store';
import { formatBytes, formatDate } from '../utils/formatters';
import { FilePreviewModal } from '../components/dialogs/FilePreviewModal';
import { DeleteConfirmModal } from '../components/dialogs/DeleteConfirmModal';
import { BulkActionToolbar } from '../components/filesystem/BulkActionToolbar';
import { downloadSingleFile, downloadAsZip } from '../services/filesystem/fileExporter';
import { deleteEntry } from '../services/filesystem/fileDeleter';
import { appTrashManager } from '../services/trash/appTrashManager';
import type { FileNode } from '../types/filesystem.types';
import toast from 'react-hot-toast';

type SizeThreshold = 0 | 100 | 500 | 1024 | 5120; // in MB

export const LargestFilesPage: React.FC = () => {
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const rootHandle = useFilesystemStore((s) => s.rootHandle);
  const analysisReport = useFilesystemStore((s) => s.analysisReport);
  const removeNodeFromTree = useFilesystemStore((s) => s.removeNodeFromTree);
  const loadTrash = useTrashStore((s) => s.loadTrash);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const enqueueDriveFile = useGoogleDriveStore((s) => s.enqueueFile);
  const enqueueDriveBatch = useGoogleDriveStore((s) => s.enqueueBatchFiles);

  const handleUploadSingleToDrive = (file: FileNode) => {
    enqueueDriveFile({
      name: file.name,
      size: file.size,
      mimeType: file.mimeType,
      path: file.path,
    });
  };

  const handleBulkUploadToDrive = () => {
    if (selectedItems.length === 0) return;
    enqueueDriveBatch(
      selectedItems.map((f) => ({
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        path: f.path,
      }))
    );
    setSelectedPaths(new Set());
  };

  const [thresholdMb, setThresholdMb] = useState<SizeThreshold>(0);
  const [search, setSearch] = useState('');
  const [selectedExtension, setSelectedExtension] = useState<string>('all');
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());

  // Sorting
  const [sortField, setSortField] = useState<'size' | 'name' | 'modified'>('size');
  const [sortAsc, setSortAsc] = useState(false);

  // Modals
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [deleteModalItems, setDeleteModalItems] = useState<FileNode[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Unique extensions for filter
  const availableExtensions = useMemo(() => {
    if (!analysisReport) return [];
    const set = new Set<string>();
    for (const file of analysisReport.allFiles) {
      if (file.extension) set.add(file.extension);
    }
    return Array.from(set).sort();
  }, [analysisReport]);

  // Filtered and sorted largest files
  const filteredFiles = useMemo(() => {
    if (!analysisReport) return [];

    let list = [...analysisReport.allFiles];

    // Filter by threshold
    if (thresholdMb > 0) {
      const minBytes = thresholdMb * 1024 * 1024;
      list = list.filter((f) => f.size >= minBytes);
    }

    // Filter by extension
    if (selectedExtension !== 'all') {
      list = list.filter((f) => f.extension === selectedExtension);
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'size') cmp = a.size - b.size;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortField === 'modified') cmp = a.lastModified - b.lastModified;
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [analysisReport, thresholdMb, selectedExtension, search, sortField, sortAsc]);

  const selectedItems = useMemo(() => {
    return filteredFiles.filter((f) => selectedPaths.has(f.path));
  }, [filteredFiles, selectedPaths]);

  const allSelected = filteredFiles.length > 0 && filteredFiles.every((f) => selectedPaths.has(f.path));

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedPaths(new Set());
    } else {
      setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
    }
  };

  const handleDeleteConfirm = async (permanent: boolean) => {
    if (deleteModalItems.length === 0) return;
    setIsDeleting(true);

    let count = 0;
    for (const file of deleteModalItems) {
      try {
        if (permanent) {
          const res = await deleteEntry(rootHandle, file.path, false);
          if (res.success) {
            removeNodeFromTree(file.path);
            count++;
          }
        } else {
          await appTrashManager.trashFile(file);
          removeNodeFromTree(file.path);
          count++;
        }
      } catch (err) {
        console.warn('Delete error:', err);
      }
    }

    setIsDeleting(false);
    setDeleteModalItems([]);
    setSelectedPaths(new Set());
    await loadTrash();

    if (count > 0) {
      toast.success(
        permanent
          ? `Permanently deleted ${count} file(s)`
          : `Moved ${count} file(s) to Application Trash`
      );
    }
  };

  const handleBulkZip = async () => {
    if (selectedItems.length === 0) return;
    try {
      toast.loading('Preparing ZIP archive...', { id: 'zip-download' });
      await downloadAsZip(selectedItems, 'largest-files-archive.zip');
      toast.success('ZIP downloaded', { id: 'zip-download' });
    } catch {
      toast.error('ZIP generation failed', { id: 'zip-download' });
    }
  };

  if (!rootFolder || !analysisReport) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <FileSpreadsheet className="w-12 h-12 mb-3 text-slate-300" />
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">
          No File Data
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Scan a folder to detect massive storage-hogging files.
        </p>
      </div>
    );
  }

  const thresholdFilters: Array<{ label: string; value: SizeThreshold }> = [
    { label: 'All Sizes', value: 0 },
    { label: '> 100 MB', value: 100 },
    { label: '> 500 MB', value: 500 },
    { label: '> 1 GB', value: 1024 },
    { label: '> 5 GB', value: 5120 },
  ];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-rose-500" />
            <span>Largest Files Finder</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Identify and prune the largest space consumers across all subdirectories
          </p>
        </div>

        {/* Threshold Quick Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {thresholdFilters.map((tf) => (
            <button
              key={tf.value}
              onClick={() => setThresholdMb(tf.value)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                thresholdMb === tf.value
                  ? 'bg-rose-600 text-white shadow-xs shadow-rose-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        <div className="w-full md:w-72 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by file name or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Extension:</span>
            <select
              value={selectedExtension}
              onChange={(e) => setSelectedExtension(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">All Extensions ({availableExtensions.length})</option>
              {availableExtensions.map((ext) => (
                <option key={ext} value={ext}>
                  .{ext}
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-500 font-medium">
            {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'} found
          </span>
        </div>
      </div>

      {/* Files Table */}
      <div className="rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 font-semibold">
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'name') setSortAsc(!sortAsc);
                    else {
                      setSortField('name');
                      setSortAsc(true);
                    }
                  }}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>File Name</span>
                    {sortField === 'name' && (sortAsc ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                  </div>
                </th>
                <th className="py-3 px-3 hidden md:table-cell">Folder Location</th>
                <th
                  onClick={() => {
                    if (sortField === 'size') setSortAsc(!sortAsc);
                    else {
                      setSortField('size');
                      setSortAsc(false);
                    }
                  }}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white w-32"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Size</span>
                    {sortField === 'size' && (sortAsc ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                  </div>
                </th>
                <th
                  onClick={() => {
                    if (sortField === 'modified') setSortAsc(!sortAsc);
                    else {
                      setSortField('modified');
                      setSortAsc(false);
                    }
                  }}
                  className="py-3 px-3 hidden lg:table-cell cursor-pointer hover:text-slate-900 dark:hover:text-white w-36"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Modified</span>
                    {sortField === 'modified' && (sortAsc ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                  </div>
                </th>
                <th className="py-3 px-3 text-right w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {filteredFiles.slice(0, 50).map((file) => {
                const isSelected = selectedPaths.has(file.path);

                return (
                  <tr
                    key={file.id}
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-blue-50/70 dark:bg-blue-950/40'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(file.path)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <File className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-xs sm:max-w-md">
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs hidden md:table-cell">
                      {file.parentPath}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      {formatBytes(file.size, displayUnits)}
                    </td>
                    <td className="py-3 px-3 text-slate-400 hidden lg:table-cell text-[11px]">
                      {formatDate(file.lastModified)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleUploadSingleToDrive(file)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Upload to Google Drive"
                        >
                          <CloudUpload className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="p-1 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Preview"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => downloadSingleFile(file)}
                          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="Download"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteModalItems([file])}
                          className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
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
      </div>

      {/* Bulk Toolbar */}
      <BulkActionToolbar
        selectedItems={selectedItems}
        onClearSelection={() => setSelectedPaths(new Set())}
        onDownloadZip={handleBulkZip}
        onMoveSelected={() => {}}
        onDeleteSelected={() => setDeleteModalItems(selectedItems)}
        onUploadToDrive={handleBulkUploadToDrive}
      />

      {/* Modals */}
      <FilePreviewModal node={previewFile} onClose={() => setPreviewFile(null)} />

      <DeleteConfirmModal
        isOpen={deleteModalItems.length > 0}
        items={deleteModalItems}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalItems([])}
      />
    </div>
  );
};

