import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import type { FolderNode } from '../../types/filesystem.types';
import { normalizePath } from '../../utils/pathUtils';
import { formatBytes } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';

interface DirectoryTreeProps {
  rootFolder: FolderNode;
  activePath: string;
  onSelectFolder: (path: string) => void;
}

export const DirectoryTree: React.FC<DirectoryTreeProps> = ({
  rootFolder,
  activePath,
  onSelectFolder,
}) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  const toggleExpand = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const renderNode = (folder: FolderNode, depth = 0) => {
    const isExpanded = expandedPaths.has(folder.path);
    const isActive = normalizePath(folder.path) === normalizePath(activePath);
    const subFolders = folder.children.filter((c) => c.kind === 'directory') as FolderNode[];

    return (
      <div key={folder.path} className="select-none">
        <div
          onClick={() => onSelectFolder(folder.path)}
          className={`group flex items-center justify-between py-1.5 px-2 rounded-xl text-xs cursor-pointer transition-all ${
            isActive
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {subFolders.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(folder.path);
                }}
                className={`p-0.5 rounded transition-transform ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
            ) : (
              <span className="w-3.5 h-3.5 inline-block" />
            )}

            {isActive || isExpanded ? (
              <FolderOpen className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-amber-500'}`} />
            ) : (
              <Folder className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-white' : 'text-amber-500'}`} />
            )}

            <span className="truncate max-w-[130px]">
              {folder.path === '/' ? (folder.name || 'Root') : folder.name}
            </span>
          </div>

          <span
            className={`text-[10px] tabular-nums shrink-0 ml-1 ${
              isActive ? 'text-blue-100' : 'text-slate-400'
            }`}
          >
            {folder.calculationStatus === 'calculating' || folder.calculationStatus === 'pending'
              ? '...'
              : formatBytes(folder.totalSize, displayUnits, 0)}
          </span>
        </div>

        {isExpanded && subFolders.length > 0 && (
          <div>
            {subFolders.map((sub) => renderNode(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-0.5 py-1">
      {renderNode(rootFolder)}
    </div>
  );
};

