import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FolderSearch,
  RotateCw,
  Sun,
  Moon,
  Search,
  X,
  AlertTriangle,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { useFilesystemStore } from '../../stores/filesystem.store';
import { useFileManagerStore } from '../../stores/fileManager.store';
import { useSettingsStore } from '../../stores/settings.store';
import { isFileSystemAccessSupported } from '../../services/filesystem/permissionManager';
import { formatBytes } from '../../utils/formatters';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Storage Overview',
  '/this-pc': 'This PC',
  '/files': 'File Manager',
  '/analysis': 'Storage Analysis',
  '/largest-files': 'Largest Files',
  '/largest-folders': 'Largest Folders',
  '/file-types': 'File Types Analysis',
  '/duplicates': 'Duplicate Finder',
  '/trash': 'Application Trash',
  '/google-drive': 'Google Drive Backup',
  '/settings': 'Settings',
};

export const Header: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const scanProgress = useFilesystemStore((s) => s.scanProgress);
  const openPickerModal = useFilesystemStore((s) => s.openPickerModal);
  const rescan = useFilesystemStore((s) => s.rescan);
  const cancelScan = useFilesystemStore((s) => s.cancelScan);

  const searchQuery = useFileManagerStore((s) => s.searchQuery);
  const setSearchQuery = useFileManagerStore((s) => s.setSearchQuery);

  const theme = useSettingsStore((s) => s.theme);
  const toggleTheme = useSettingsStore((s) => s.toggleTheme);
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const isSupported = isFileSystemAccessSupported();
  const pageTitle = PAGE_TITLES[location.pathname] || 'Storage Manager';

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (location.pathname !== '/files') {
      navigate('/files');
    }
  };

  return (
    <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between gap-4">
      {/* Title & Status */}
      <div className="flex items-center gap-3 min-w-0">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate leading-tight">
              {pageTitle}
            </h1>
            {typeof window !== 'undefined' && Boolean((window as any).desktopApp?.isElectron) && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                Desktop App
              </span>
            )}
          </div>
          {rootFolder && (
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Authorized: <span className="font-semibold text-slate-700 dark:text-slate-300">{rootFolder.name}</span> ({formatBytes(rootFolder.totalSize, displayUnits)})
            </p>
          )}
        </div>

        {!isSupported && (
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-medium border border-rose-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Browser lacks File System Access API</span>
          </div>
        )}
      </div>

      {/* Center Search Input */}
      <form onSubmit={handleSearchSubmit} className="hidden md:flex flex-1 max-w-md relative">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-1.5 text-sm bg-slate-100 dark:bg-slate-800/80 border border-transparent focus:border-blue-500 rounded-xl text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </form>

      {/* Right Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Scanning / Background Sizing Indicator Pill */}
        {scanProgress.isScanning && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-xs font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
            <span className="hidden sm:inline">
              {scanProgress.isBackgroundSizing && (scanProgress.pendingFoldersCount || 0) > 0
                ? `Background sizing (${scanProgress.resolvedFoldersCount || 0}/${(scanProgress.resolvedFoldersCount || 0) + (scanProgress.pendingFoldersCount || 0)} folders)`
                : `Scanning... ${scanProgress.filesScanned} files`}
            </span>
            <button
              onClick={cancelScan}
              className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-semibold underline ml-1 cursor-pointer"
            >
              Stop
            </button>
          </div>
        )}

        {/* Rescan Button */}
        {rootFolder && !scanProgress.isScanning && (
          <button
            onClick={() => rescan()}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="Rescan current folder"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        )}

        {/* Scan Folder Button */}
        <button
          onClick={() => openPickerModal()}
          disabled={scanProgress.isScanning}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs sm:text-sm font-semibold shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
        >
          <FolderOpen className="w-4 h-4" />
          <span>{rootFolder ? 'Change Folder / Drive' : 'Scan Storage'}</span>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};
