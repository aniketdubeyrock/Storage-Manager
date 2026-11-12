import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  HardDrive,
  FolderOpen,
  Files,
  FolderTree,
  FileSpreadsheet,
  FileType,
  Copy,
  Clock,
  ArrowRight,
  ShieldCheck,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useSettingsStore } from '../stores/settings.store';
import { formatBytes, formatNumber, formatDuration, formatDate } from '../utils/formatters';
import { CategoryDonutChart } from '../components/charts/CategoryDonutChart';
import { FolderBarChart } from '../components/charts/FolderBarChart';
import { StorageTreemap } from '../components/charts/StorageTreemap';
import { FilePreviewModal } from '../components/dialogs/FilePreviewModal';
import type { FileNode } from '../types/filesystem.types';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const analysisReport = useFilesystemStore((s) => s.analysisReport);
  const openPickerModal = useFilesystemStore((s) => s.openPickerModal);
  const scanProgress = useFilesystemStore((s) => s.scanProgress);
  const storedDirectories = useFilesystemStore((s) => s.storedDirectories);
  const restoreStoredDirectory = useFilesystemStore((s) => s.restoreStoredDirectory);
  const removeStoredDirectory = useFilesystemStore((s) => s.removeStoredDirectory);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const [previewFile, setPreviewFile] = React.useState<FileNode | null>(null);

  // If no directory is scanned, show Welcome Hero & Recents
  if (!rootFolder || !analysisReport) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
        {/* Hero Card */}
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-blue-600 via-blue-700 to-indigo-800 text-white p-8 md:p-12 shadow-xl shadow-blue-500/15">
          <div className="relative z-10 max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-blue-100 border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>100% Local & Private • Zero Cloud Uploads</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight leading-tight">
              Analyze and reclaim local disk storage.
            </h1>
            <p className="text-blue-100 text-sm md:text-base leading-relaxed">
              Select any folder on your computer to scan recursive storage consumption, identify massive files, detect duplicate contents, and safely manage your filesystem directly in your browser.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={() => openPickerModal()}
                disabled={scanProgress.isScanning}
                className="px-6 py-3.5 rounded-2xl bg-white text-blue-700 hover:bg-blue-50 text-sm font-bold shadow-lg shadow-black/10 transition-all flex items-center gap-2 cursor-pointer"
              >
                <FolderOpen className="w-5 h-5" />
                <span>{scanProgress.isScanning ? 'Scanning...' : 'Select Drive or Folder to Scan'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Recently Scanned Locations */}
        {storedDirectories.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Recently Scanned Folders</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {storedDirectories.map((item) => (
                <div
                  key={item.id}
                  className="p-5 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs hover:border-blue-500/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <FolderTree className="w-5 h-5 text-blue-500" />
                      <button
                        onClick={() => removeStoredDirectory(item.id)}
                        className="text-slate-400 hover:text-rose-500 p-1"
                        title="Remove from history"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate" title={item.name}>
                      {item.name}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {item.fileCount ? `${formatNumber(item.fileCount)} files • ` : ''}
                      {item.totalSize ? formatBytes(item.totalSize, displayUnits) : 'Size unknown'}
                    </p>
                  </div>
                  <button
                    onClick={() => restoreStoredDirectory(item)}
                    className="mt-4 w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Reconnect & Scan</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  const { summary, categories, largestFiles, largestFolders } = analysisReport;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-200">
      {/* Telemetry Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Scanned Size */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Scanned
            </span>
            <HardDrive className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatBytes(summary.totalSize, displayUnits)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
            Folder capacity
          </span>
        </div>

        {/* Files */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Files
            </span>
            <Files className="w-4 h-4 text-indigo-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatNumber(summary.fileCount)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Total files
          </span>
        </div>

        {/* Folders */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Folders
            </span>
            <FolderTree className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {formatNumber(summary.folderCount)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Nested directories
          </span>
        </div>

        {/* Largest Folder */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Top Folder
            </span>
            <FolderOpen className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {summary.largestFolder ? formatBytes(summary.largestFolder.totalSize, displayUnits) : '—'}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5 truncate" title={summary.largestFolder?.name}>
            {summary.largestFolder?.name || 'None'}
          </span>
        </div>

        {/* Largest File */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Top File
            </span>
            <FileSpreadsheet className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {summary.largestFile ? formatBytes(summary.largestFile.size, displayUnits) : '—'}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5 truncate" title={summary.largestFile?.name}>
            {summary.largestFile?.name || 'None'}
          </span>
        </div>

        {/* Scan Duration */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Scan Time
            </span>
            <Clock className="w-4 h-4 text-cyan-500" />
          </div>
          <p className="text-lg font-bold text-slate-900 dark:text-white truncate">
            {formatDuration(summary.durationMs)}
          </p>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Non-blocking
          </span>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Type Distribution */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                File Types Breakdown
              </h3>
              <p className="text-xs text-slate-400">Storage consumption by category</p>
            </div>
            <button
              onClick={() => navigate('/file-types')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Details</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <CategoryDonutChart categories={categories} totalSize={summary.totalSize} />
        </div>

        {/* Largest Folders Bar Chart */}
        <div className="p-5 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Largest Folders
              </h3>
              <p className="text-xs text-slate-400">Directories consuming the most space</p>
            </div>
            <button
              onClick={() => navigate('/largest-folders')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
            >
              <span>View all</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <FolderBarChart
            folders={largestFolders}
            onFolderClick={(path) => {
              navigate('/files');
            }}
          />
        </div>
      </div>

      {/* Treemap Overview */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Storage Treemap Visualizer
            </h3>
            <p className="text-xs text-slate-400">
              Proportional block representation (click to drill into folders)
            </p>
          </div>
          <button
            onClick={() => navigate('/analysis')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>Full Analysis</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <StorageTreemap
          rootFolder={rootFolder}
          onNavigateToFileManager={(path) => navigate('/files')}
          onSelectPreview={(file) => setPreviewFile(file)}
        />
      </div>

      {/* Top 5 Largest Files Quick Table */}
      <div className="p-5 rounded-3xl bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">
              Top Heavy Files
            </h3>
            <p className="text-xs text-slate-400">Quick candidates for storage reclamation</p>
          </div>
          <button
            onClick={() => navigate('/largest-files')}
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-semibold"
          >
            <span>All Largest Files</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold">
                <th className="py-2 px-3">File Name</th>
                <th className="py-2 px-3">Path</th>
                <th className="py-2 px-3 text-right">Size</th>
                <th className="py-2 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {largestFiles.slice(0, 5).map((file) => (
                <tr key={file.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                    {file.name}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px] truncate max-w-xs">
                    {file.path}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-blue-600 dark:text-blue-400 font-semibold">
                    {formatBytes(file.size, displayUnits)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => setPreviewFile(file)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-medium"
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
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
