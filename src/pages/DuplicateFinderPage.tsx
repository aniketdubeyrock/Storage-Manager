import React, { useState } from 'react';
import {
  Copy,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Loader2,
  File,
  ShieldCheck,
  Eye,
  RefreshCw,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useSettingsStore } from '../stores/settings.store';
import { useTrashStore } from '../stores/trash.store';
import { formatBytes, formatDate } from '../utils/formatters';
import { findDuplicateFiles } from '../services/duplicate/duplicateDetector';
import { FilePreviewModal } from '../components/dialogs/FilePreviewModal';
import { DeleteConfirmModal } from '../components/dialogs/DeleteConfirmModal';
import { deleteEntry } from '../services/filesystem/fileDeleter';
import { appTrashManager } from '../services/trash/appTrashManager';
import type { DuplicateGroup } from '../types/analytics.types';
import type { FileNode } from '../types/filesystem.types';
import toast from 'react-hot-toast';

export const DuplicateFinderPage: React.FC = () => {
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const rootHandle = useFilesystemStore((s) => s.rootHandle);
  const analysisReport = useFilesystemStore((s) => s.analysisReport);
  const removeNodeFromTree = useFilesystemStore((s) => s.removeNodeFromTree);
  const loadTrash = useTrashStore((s) => s.loadTrash);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const [isSearching, setIsSearching] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; filename: string }>({
    current: 0,
    total: 0,
    filename: '',
  });
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[] | null>(null);
  const [abortCtrl, setAbortCtrl] = useState<AbortController | null>(null);

  // Selection for deletion
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [deleteModalItems, setDeleteModalItems] = useState<FileNode[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!rootFolder || !analysisReport) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <Copy className="w-12 h-12 mb-3 text-slate-300" />
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">
          No Scanned Folder
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Select and scan a folder to detect exact duplicate files using SHA-256 hashing.
        </p>
      </div>
    );
  }

  const handleStartScan = async () => {
    const ctrl = new AbortController();
    setAbortCtrl(ctrl);
    setIsSearching(true);
    setProgress({ current: 0, total: 0, filename: '' });
    setSelectedPaths(new Set());

    try {
      const groups = await findDuplicateFiles(analysisReport.allFiles, {
        signal: ctrl.signal,
        minFileSize: 1024, // 1KB minimum
        onProgress: (current, total, filename) => {
          setProgress({ current, total, filename });
        },
      });

      setDuplicateGroups(groups);
      if (groups.length === 0) {
        toast.success('No duplicate files found in scanned folder.');
      } else {
        toast.success(`Found ${groups.length} duplicate group(s)!`);
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast('Duplicate scan stopped', { icon: '⏹️' });
      } else {
        const msg = err instanceof Error ? err.message : 'Scan error';
        toast.error(`Duplicate scan failed: ${msg}`);
      }
    } finally {
      setIsSearching(false);
      setAbortCtrl(null);
    }
  };

  const handleCancelScan = () => {
    if (abortCtrl) {
      abortCtrl.abort();
    }
  };

  const toggleSelect = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelectAllDuplicatesExceptFirst = () => {
    if (!duplicateGroups) return;
    const paths = new Set<string>();
    for (const group of duplicateGroups) {
      // Keep index 0 as original, select all subsequent duplicates
      for (let i = 1; i < group.files.length; i++) {
        paths.add(group.files[i].path);
      }
    }
    setSelectedPaths(paths);
  };

  const handleDeleteConfirm = async (permanent: boolean) => {
    if (!rootHandle || deleteModalItems.length === 0) return;
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

    // Remove deleted files from current duplicate groups state
    if (duplicateGroups) {
      const deletedSet = new Set(deleteModalItems.map((d) => d.path));
      const updated = duplicateGroups
        .map((g) => {
          const remaining = g.files.filter((f) => !deletedSet.has(f.path));
          return {
            ...g,
            files: remaining,
            reclaimableSize: Math.max(0, (remaining.length - 1) * g.size),
          };
        })
        .filter((g) => g.files.length > 1);

      setDuplicateGroups(updated);
    }

    setIsDeleting(false);
    setDeleteModalItems([]);
    setSelectedPaths(new Set());
    await loadTrash();

    if (count > 0) {
      toast.success(
        permanent
          ? `Permanently deleted ${count} duplicate file(s)`
          : `Moved ${count} duplicate file(s) to Application Trash`
      );
    }
  };

  const totalReclaimable = duplicateGroups
    ? duplicateGroups.reduce((acc, curr) => acc + curr.reclaimableSize, 0)
    : 0;

  const selectedFilesForDeletion = duplicateGroups
    ? duplicateGroups.flatMap((g) => g.files).filter((f) => selectedPaths.has(f.path))
    : [];

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Copy className="w-5 h-5 text-indigo-500" />
            <span>Duplicate File Finder</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Cryptographic SHA-256 analysis to detect identical duplicate content
          </p>
        </div>

        {!isSearching && (
          <button
            onClick={handleStartScan}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm flex items-center gap-2 self-start sm:self-auto cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{duplicateGroups ? 'Scan Again' : 'Find Duplicates'}</span>
          </button>
        )}
      </div>

      {/* Progress Card during active scan */}
      {isSearching && (
        <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-blue-200 dark:border-blue-900 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Comparing file contents...
                </h4>
                <p className="text-xs text-slate-400 truncate max-w-md">
                  Hashing: {progress.filename || 'Calculating candidates'}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancelScan}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100"
            >
              Cancel Scan
            </button>
          </div>

          {progress.total > 0 && (
            <div>
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>
                  Candidate {progress.current} of {progress.total}
                </span>
                <span>{Math.round((progress.current / progress.total) * 100)}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-200"
                  style={{ width: `${(progress.current / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Header Banner */}
      {duplicateGroups && (
        <div className="p-5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider block mb-0.5">
              Reclaimable Storage
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {formatBytes(totalReclaimable, displayUnits)}
              </span>
              <span className="text-xs text-slate-500">
                across {duplicateGroups.length} duplicate groups
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllDuplicatesExceptFirst}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              Select All Duplicates
            </button>
            {selectedFilesForDeletion.length > 0 && (
              <button
                onClick={() => setDeleteModalItems(selectedFilesForDeletion)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedFilesForDeletion.length})</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Duplicate Groups List */}
      {duplicateGroups && duplicateGroups.length === 0 ? (
        <div className="p-12 text-center rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No Duplicate Files Found
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            All files with equal sizes have distinct cryptographic fingerprints.
          </p>
        </div>
      ) : (
        duplicateGroups && (
          <div className="space-y-4">
            {duplicateGroups.map((group, groupIndex) => (
              <div
                key={group.id}
                className="p-5 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                      #{groupIndex + 1}
                    </span>
                    <div>
                      <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200">
                        {group.files.length} Identical Copies • {formatBytes(group.size, displayUnits)} each
                      </h4>
                      <p className="text-[10px] text-slate-400 font-mono truncate max-w-sm">
                        SHA-256: {group.hash}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    +{formatBytes(group.reclaimableSize, displayUnits)} reclaimable
                  </span>
                </div>

                {/* Copies list */}
                <div className="space-y-1.5">
                  {group.files.map((file, fileIdx) => {
                    const isSelected = selectedPaths.has(file.path);
                    const isOriginal = fileIdx === 0;

                    return (
                      <div
                        key={file.path}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-colors ${
                          isSelected
                            ? 'bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900'
                            : 'bg-slate-50 dark:bg-slate-800/40 border border-transparent hover:border-slate-200 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate flex-1 pr-4">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(file.path)}
                            className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                          />
                          <File className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <div className="truncate">
                            <span className="font-medium text-slate-800 dark:text-slate-200">
                              {file.name}
                            </span>
                            <span className="text-slate-400 font-mono text-[11px] block truncate">
                              {file.path}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          {isOriginal && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
                              Original
                            </span>
                          )}
                          <span className="text-[11px] text-slate-400">
                            {formatDate(file.lastModified)}
                          </span>
                          <button
                            onClick={() => setPreviewFile(file)}
                            className="p-1 rounded-lg text-slate-400 hover:text-blue-600"
                            title="Preview file"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )
      )}

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

