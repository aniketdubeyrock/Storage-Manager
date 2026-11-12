import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderTree,
  Folder,
  ChevronRight,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useFileManagerStore } from '../stores/fileManager.store';
import { useSettingsStore } from '../stores/settings.store';
import { formatBytes, formatNumber } from '../utils/formatters';
import type { FolderNode } from '../types/filesystem.types';

export const LargestFoldersPage: React.FC = () => {
  const navigate = useNavigate();
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const analysisReport = useFilesystemStore((s) => s.analysisReport);
  const navigateToFile = useFileManagerStore((s) => s.navigateTo);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<'size' | 'files' | 'name'>('size');
  const [sortAsc, setSortAsc] = useState(false);

  const folders = useMemo(() => {
    if (!analysisReport) return [];

    let list = [...analysisReport.allFolders];

    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'size') cmp = a.totalSize - b.totalSize;
      else if (sortField === 'files') cmp = a.fileCount - b.fileCount;
      else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [analysisReport, search, sortField, sortAsc]);

  if (!rootFolder || !analysisReport) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <FolderTree className="w-12 h-12 mb-3 text-slate-300" />
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">
          No Folder Data
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Please scan a directory to identify the largest folders.
        </p>
      </div>
    );
  }

  const rootSize = rootFolder.totalSize || 1;

  const handleOpenFolder = (path: string) => {
    navigateToFile(path);
    navigate('/files');
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FolderTree className="w-5 h-5 text-amber-500" />
            <span>Largest Folders Directory</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Identify directories holding the greatest volume of data
          </p>
        </div>

        <div className="w-full sm:w-72 relative text-xs">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search folder name or path..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>

      {/* Folders List Card */}
      <div className="rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 text-slate-500 font-semibold">
                <th
                  onClick={() => {
                    if (sortField === 'name') setSortAsc(!sortAsc);
                    else {
                      setSortField('name');
                      setSortAsc(true);
                    }
                  }}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Folder Name</span>
                    {sortField === 'name' && (sortAsc ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                  </div>
                </th>
                <th className="py-3 px-3 hidden md:table-cell">Relative Path</th>
                <th
                  onClick={() => {
                    if (sortField === 'files') setSortAsc(!sortAsc);
                    else {
                      setSortField('files');
                      setSortAsc(false);
                    }
                  }}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Files Count</span>
                    {sortField === 'files' && (sortAsc ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                  </div>
                </th>
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
                    <span>Total Size</span>
                    {sortField === 'size' && (sortAsc ? <ArrowUp className="w-3 h-3 text-blue-500" /> : <ArrowDown className="w-3 h-3 text-blue-500" />)}
                  </div>
                </th>
                <th className="py-3 px-3 w-44 text-right">% of Scanned</th>
                <th className="py-3 px-4 text-right w-20">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {folders.map((folder) => {
                const percent = (folder.totalSize / rootSize) * 100;

                return (
                  <tr
                    key={folder.path}
                    onClick={() => handleOpenFolder(folder.path)}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2.5">
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate max-w-xs">{folder.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-400 font-mono text-[11px] truncate max-w-sm hidden md:table-cell">
                      {folder.path}
                    </td>
                    <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                      {formatNumber(folder.fileCount)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatBytes(folder.totalSize, displayUnits)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 w-10 text-right">
                          {percent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenFolder(folder.path);
                        }}
                        className="px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium inline-flex items-center gap-1"
                      >
                        <span>Explore</span>
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

