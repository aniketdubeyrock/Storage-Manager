import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  PieChart,
  FileSpreadsheet,
  FolderTree,
  FileType,
  Copy,
  Trash2,
  Settings,
  ChevronLeft,
  ChevronRight,
  HardDrive,
  FolderGit2,
  CloudUpload,
  Monitor,
} from 'lucide-react';
import { useFilesystemStore } from '../../stores/filesystem.store';
import { useSettingsStore } from '../../stores/settings.store';
import { useGoogleDriveStore } from '../../stores/googleDrive.store';
import { formatBytes } from '../../utils/formatters';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string | number;
}

export const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const uploadQueue = useGoogleDriveStore((s) => s.uploadQueue);

  const activeUploadsCount = uploadQueue.filter(
    (i) => i.status === 'uploading' || i.status === 'queued'
  ).length;

  const navItems: NavItem[] = [
    { name: 'Overview', path: '/', icon: LayoutDashboard },
    { name: 'File Manager', path: '/files', icon: FolderOpen },
    { name: 'Storage Analysis', path: '/analysis', icon: PieChart },
    { name: 'Largest Files', path: '/largest-files', icon: FileSpreadsheet },
    { name: 'Largest Folders', path: '/largest-folders', icon: FolderTree },
    { name: 'File Types', path: '/file-types', icon: FileType },
    { name: 'Duplicate Finder', path: '/duplicates', icon: Copy },
    { name: 'Trash', path: '/trash', icon: Trash2 },
    {
      name: 'Google Drive',
      path: '/google-drive',
      icon: CloudUpload,
      badge: activeUploadsCount > 0 ? `${activeUploadsCount} ⬆` : undefined,
    },
    { name: 'Settings', path: '/settings', icon: Settings },
    { name: 'This PC', path: '/this-pc', icon: Monitor },
  ];

  return (
    <aside
      className={`h-screen flex flex-col border-r transition-all duration-300 select-none z-30 sticky top-0 ${
        collapsed ? 'w-20' : 'w-64'
      } bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          {!collapsed && (
            <div className="truncate">
              <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white block leading-tight">
                Storage Manager
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Local Analyzer
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.name : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="truncate flex-1">{item.name}</span>}
              {!collapsed && item.badge && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Folder Status */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800">
        {rootFolder ? (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/50">
            <div className="flex items-center gap-2 mb-1">
              <FolderGit2 className="w-4 h-4 text-blue-500 shrink-0" />
              {!collapsed && (
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {rootFolder.name}
                </span>
              )}
            </div>
            {!collapsed && (
              <div className="flex justify-between items-center text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span>{formatBytes(rootFolder.totalSize, displayUnits)}</span>
                <span>{rootFolder.fileCount} files</span>
              </div>
            )}
          </div>
        ) : (
          !collapsed && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
              No folder selected. Click Scan Folder above to begin.
            </div>
          )
        )}
      </div>
    </aside>
  );
};

