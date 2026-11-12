import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Monitor,
  HardDrive,
  Usb,
  Folder,
  ArrowRight,
  RefreshCw,
  PieChart,
  ExternalLink,
  Disc,
  FolderOpen,
  Download,
  Image,
  Film,
  Music,
  FileText,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useSettingsStore } from '../stores/settings.store';
import { formatBytes } from '../utils/formatters';
import type { DriveInfo, QuickFolder } from '../types/companion.types';
import { openWithSystemApp } from '../services/filesystem/fileReader';
import toast from 'react-hot-toast';

export const ThisPcPage: React.FC = () => {
  const navigate = useNavigate();
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const availableDrives = useFilesystemStore((s) => s.availableDrives);
  const quickFolders = useFilesystemStore((s) => s.quickFolders);
  const loadAvailableDrives = useFilesystemStore((s) => s.loadAvailableDrives);
  const loadQuickFolders = useFilesystemStore((s) => s.loadQuickFolders);
  const scanDrive = useFilesystemStore((s) => s.scanDrive);
  const scanPath = useFilesystemStore((s) => s.scanPath);

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAvailableDrives();
    loadQuickFolders();
  }, [loadAvailableDrives, loadQuickFolders]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadAvailableDrives(), loadQuickFolders()]);
    setRefreshing(false);
    toast.success('Drives and folders refreshed');
  };

  const handleOpenDrive = async (drive: DriveInfo) => {
    toast(`Opening ${drive.name}...`, { icon: '📂' });
    await scanDrive(drive);
    navigate('/files');
  };

  const handleAnalyzeDrive = async (drive: DriveInfo) => {
    toast(`Analyzing storage for ${drive.name}...`, { icon: '📊' });
    await scanDrive(drive);
    navigate('/analysis');
  };

  const handleOpenQuickFolder = async (folder: QuickFolder) => {
    toast(`Opening ${folder.name}...`, { icon: '📁' });
    await scanPath(folder.path, folder.name);
    navigate('/files');
  };

  const handleOpenInWindowsExplorer = async (targetPath: string) => {
    const success = await openWithSystemApp(targetPath);
    if (success) {
      toast.success(`Opened ${targetPath} in Windows Explorer`);
    } else {
      toast.error('Could not open in Windows Explorer');
    }
  };

  // Group drives: Internal vs Removable
  const internalDrives = availableDrives.filter(
    (d) => !d.driveType || d.driveType.toLowerCase().includes('fixed') || d.id === 'C:'
  );
  const externalDrives = availableDrives.filter(
    (d) => d.driveType && !d.driveType.toLowerCase().includes('fixed') && d.id !== 'C:'
  );

  // Compute total system storage
  const totalStorageBytes = availableDrives.reduce((acc, d) => acc + (d.totalSize || 0), 0);
  const totalFreeBytes = availableDrives.reduce((acc, d) => acc + (d.freeSpace || 0), 0);

  const getFolderIcon = (id: string) => {
    switch (id) {
      case 'downloads':
        return <Download className="w-5 h-5 text-blue-500" />;
      case 'documents':
        return <FileText className="w-5 h-5 text-emerald-500" />;
      case 'desktop':
        return <Monitor className="w-5 h-5 text-cyan-500" />;
      case 'pictures':
        return <Image className="w-5 h-5 text-amber-500" />;
      case 'videos':
        return <Film className="w-5 h-5 text-purple-500" />;
      case 'music':
        return <Music className="w-5 h-5 text-pink-500" />;
      default:
        return <Folder className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-blue-900/20 via-indigo-900/20 to-purple-900/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-slate-900 border border-blue-200/50 dark:border-blue-900/40 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
              <Monitor className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  This PC
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                  Windows File Manager
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Browse physical hard drives, internal partitions, removable storage, and personal folders.
              </p>
            </div>
          </div>

          {/* Quick Metrics & Refresh */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xs border border-slate-200/80 dark:border-slate-800 rounded-2xl px-4 py-2 flex items-center gap-3 shadow-xs">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Storage</p>
                <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {formatBytes(totalStorageBytes, displayUnits)}
                </p>
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Free Space</p>
                <p className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formatBytes(totalFreeBytes, displayUnits)}
                </p>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shadow-xs transition-colors flex items-center justify-center cursor-pointer"
              title="Refresh drives and folders"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-500' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* QUICK ACCESS FOLDERS SECTION */}
      {quickFolders.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Folders</h2>
              <span className="text-xs text-slate-400">({quickFolders.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {quickFolders.map((folder) => (
              <div
                key={folder.id}
                onClick={() => handleOpenQuickFolder(folder)}
                onDoubleClick={() => handleOpenQuickFolder(folder)}
                className="group p-4 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800/80 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between select-none"
                title="Double-click to open folder"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800/80 flex items-center justify-center group-hover:scale-105 transition-transform">
                    {getFolderIcon(folder.id)}
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-xs truncate">
                    {folder.name}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                    {folder.itemCount !== undefined ? `${folder.itemCount} items` : 'Ready to browse'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* INTERNAL DRIVES SECTION */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Devices and Drives
            </h2>
            <span className="text-xs text-slate-400">({internalDrives.length})</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {internalDrives.map((drive) => {
            const usedBytes = drive.usedSpace || drive.totalSize - drive.freeSpace;
            const usedPercent = drive.totalSize > 0 ? (usedBytes / drive.totalSize) * 100 : 0;
            const isAlmostFull = usedPercent > 90;
            const isSystemDrive = drive.id === 'C:';

            return (
              <div
                key={drive.id}
                onDoubleClick={() => handleOpenDrive(drive)}
                className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs hover:border-blue-500/80 dark:hover:border-blue-500/80 hover:shadow-lg transition-all flex flex-col justify-between group cursor-pointer select-none"
                title="Double-click to open drive"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 relative">
                        <HardDrive className="w-6 h-6" />
                        {isSystemDrive && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-[9px] font-bold shadow-xs">
                            C
                          </span>
                        )}
                      </div>
                      <div className="truncate">
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate flex items-center gap-2">
                          <span>{drive.name || `Local Disk (${drive.id})`}</span>
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {isSystemDrive ? 'Windows System Drive' : 'Internal Partition'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleOpenInWindowsExplorer(drive.path)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Reveal in Windows Explorer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Visual Capacity Bar */}
                  <div className="space-y-1.5 mb-4">
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                      <div
                        style={{ width: `${Math.min(100, Math.max(1, usedPercent))}%` }}
                        className={`h-full rounded-full transition-all duration-500 ${
                          isAlmostFull ? 'bg-rose-500' : 'bg-blue-600'
                        }`}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatBytes(drive.freeSpace, displayUnits)} free of{' '}
                        {formatBytes(drive.totalSize, displayUnits)}
                      </span>
                      <span
                        className={`font-mono text-[11px] font-bold ${
                          isAlmostFull ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {Math.round(usedPercent)}% used
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                  <button
                    onClick={() => handleOpenDrive(drive)}
                    className="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Open Drive</span>
                  </button>
                  <button
                    onClick={() => handleAnalyzeDrive(drive)}
                    className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold flex items-center justify-center transition-colors cursor-pointer"
                    title="Run Storage Analyzer on Drive"
                  >
                    <PieChart className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* EXTERNAL & REMOVABLE DRIVES SECTION */}
      {externalDrives.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Usb className="w-5 h-5 text-amber-500" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Devices with Removable Storage
              </h2>
              <span className="text-xs text-slate-400">({externalDrives.length})</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {externalDrives.map((drive) => {
              const usedBytes = drive.usedSpace || drive.totalSize - drive.freeSpace;
              const usedPercent = drive.totalSize > 0 ? (usedBytes / drive.totalSize) * 100 : 0;

              return (
                <div
                  key={drive.id}
                  onDoubleClick={() => handleOpenDrive(drive)}
                  className="bg-white dark:bg-[#111827] border border-amber-500/20 dark:border-amber-500/20 rounded-2xl p-5 shadow-xs hover:border-amber-500 hover:shadow-lg transition-all flex flex-col justify-between cursor-pointer select-none"
                  title="Double-click to open drive"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                          {drive.driveType?.toLowerCase().includes('cd') ? (
                            <Disc className="w-6 h-6" />
                          ) : (
                            <Usb className="w-6 h-6" />
                          )}
                        </div>
                        <div className="truncate">
                          <h3 className="font-extrabold text-slate-900 dark:text-white text-sm truncate">
                            {drive.name || `Removable Disk (${drive.id})`}
                          </h3>
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                            {drive.driveType || 'USB Flash / Removable Disk'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => handleOpenInWindowsExplorer(drive.path)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Reveal in Windows Explorer"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-1.5 mb-4">
                      <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-0.5">
                        <div
                          style={{ width: `${Math.min(100, Math.max(1, usedPercent))}%` }}
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
                        <span>
                          {formatBytes(drive.freeSpace, displayUnits)} free of{' '}
                          {formatBytes(drive.totalSize, displayUnits)}
                        </span>
                        <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                          {Math.round(usedPercent)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenDrive(drive)}
                      className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>Browse Device</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
};
