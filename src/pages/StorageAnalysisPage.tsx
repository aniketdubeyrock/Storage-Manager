import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart,
  FolderTree,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  BarChart2,
  Folder,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useFileManagerStore } from '../stores/fileManager.store';
import { useSettingsStore } from '../stores/settings.store';
import { formatBytes, formatNumber } from '../utils/formatters';
import { StorageTreemap } from '../components/charts/StorageTreemap';
import { CategoryDonutChart } from '../components/charts/CategoryDonutChart';
import { SizeDistributionChart } from '../components/charts/SizeDistributionChart';
import { FilePreviewModal } from '../components/dialogs/FilePreviewModal';
import type { FolderNode, FileNode } from '../types/filesystem.types';

type FolderSortCol = 'size' | 'name' | 'files' | 'folders';

export const StorageAnalysisPage: React.FC = () => {
  const navigate = useNavigate();
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const analysisReport = useFilesystemStore((s) => s.analysisReport);
  const navigateToFile = useFileManagerStore((s) => s.navigateTo);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const [previewFile, setPreviewFile] = useState<FileNode | null>(null);
  const [sortCol, setSortCol] = useState<FolderSortCol>('size');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedFolders = useMemo(() => {
    if (!analysisReport) return [];

    const list = [...analysisReport.allFolders];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'size') cmp = a.totalSize - b.totalSize;
      else if (sortCol === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortCol === 'files') cmp = a.fileCount - b.fileCount;
      else if (sortCol === 'folders') cmp = a.folderCount - b.folderCount;
      return sortAsc ? cmp : -cmp;
    });

    return list;
  }, [analysisReport, sortCol, sortAsc]);

  if (!rootFolder || !analysisReport) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center text-slate-400">
        <PieChart className="w-12 h-12 mb-3 text-slate-300" />
        <h2 className="text-base font-bold text-slate-700 dark:text-slate-200">
          No Storage Data Available
        </h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Please scan a directory from the header to view detailed storage telemetry and charts.
        </p>
      </div>
    );
  }

  const { summary, categories, sizeDistribution, extensionStats } = analysisReport;
  const rootSize = rootFolder.totalSize || 1;

  const handleSort = (col: FolderSortCol) => {
    if (sortCol === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortCol(col);
      setSortAsc(col === 'name');
    }
  };

  const renderSortIndicator = (col: FolderSortCol) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 text-slate-400 opacity-30" />;
    return sortAsc ? (
      <ArrowUp className="w-3 h-3 text-blue-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-blue-500" />
    );
  };

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          Storage Usage Analysis
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Deep structural breakdown of &ldquo;{rootFolder.name}&rdquo; ({formatBytes(rootSize, displayUnits)})
        </p>
      </div>

      {/* Interactive Treemap Section */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="mb-4">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-500" />
            <span>Interactive Storage Treemap</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Click on folders to zoom in and navigate down the hierarchy.
          </p>
        </div>
        <StorageTreemap
          rootFolder={rootFolder}
          onNavigateToFileManager={(path) => {
            navigateToFile(path);
            navigate('/files');
          }}
          onSelectPreview={(file) => setPreviewFile(file)}
        />
      </div>

      {/* Analytics Grid: Donut + Size Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Donut */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
            File Category Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Percentage and volume across media, code, documents, and archives
          </p>
          <CategoryDonutChart categories={categories} totalSize={rootFolder.totalSize} />
        </div>

        {/* Size Distribution */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
            File Size Tier Distribution
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Number of files by size range threshold
          </p>
          <SizeDistributionChart buckets={sizeDistribution} />
        </div>
      </div>

      {/* Folder-Wise Storage Analysis Table */}
      <div className="p-6 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-blue-500" />
              <span>Folder-Wise Analysis</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparative storage footprint of all scanned directories
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {sortedFolders.length} folders
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold">
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Folder Name</span>
                    {renderSortIndicator('name')}
                  </div>
                </th>
                <th className="py-3 px-3 hidden md:table-cell">Path</th>
                <th
                  onClick={() => handleSort('files')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white text-right"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Files</span>
                    {renderSortIndicator('files')}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('size')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 dark:hover:text-white text-right w-36"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total Size</span>
                    {renderSortIndicator('size')}
                  </div>
                </th>
                <th className="py-3 px-3 w-40 text-right">% of Scanned</th>
                <th className="py-3 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {sortedFolders.slice(0, 30).map((folder) => {
                const percent = (folder.totalSize / rootSize) * 100;

                return (
                  <tr
                    key={folder.path}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="truncate max-w-[200px]">{folder.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs hidden md:table-cell">
                      {folder.path}
                    </td>
                    <td className="py-2.5 px-3 text-right text-slate-600 dark:text-slate-400 font-mono">
                      {formatNumber(folder.fileCount)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 dark:text-white">
                      {formatBytes(folder.totalSize, displayUnits)}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <div
                            className="h-full bg-blue-600 rounded-full"
                            style={{ width: `${Math.min(100, Math.max(2, percent))}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-slate-500 w-10 text-right">
                          {percent.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => {
                          navigateToFile(folder.path);
                          navigate('/files');
                        }}
                        className="px-2.5 py-1 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 font-medium inline-flex items-center gap-1"
                      >
                        <span>Open</span>
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

      {previewFile && (
        <FilePreviewModal node={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
};

