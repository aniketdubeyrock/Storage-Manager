import React, { useState } from 'react';
import { FolderInput, Folder, ChevronRight, ChevronDown, X } from 'lucide-react';
import { useFilesystemStore } from '../../stores/filesystem.store';
import { isDescendantOf, normalizePath, getParentPath } from '../../utils/pathUtils';
import type { FolderNode, AnyFsNode } from '../../types/filesystem.types';

interface MoveModalProps {
  isOpen: boolean;
  item: AnyFsNode | null;
  onMove: (destinationPath: string) => Promise<void>;
  onCancel: () => void;
  isMoving?: boolean;
}

export const MoveModal: React.FC<MoveModalProps> = ({
  isOpen,
  item,
  onMove,
  onCancel,
  isMoving = false,
}) => {
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const [selectedDest, setSelectedDest] = useState<string>('/');
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));

  if (!isOpen || !item || !rootFolder) return null;

  const currentParent = getParentPath(item.path);

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

  const renderFolderTreeNode = (folder: FolderNode, depth = 0) => {
    const isExpanded = expandedPaths.has(folder.path);
    const isCurrent = normalizePath(folder.path) === normalizePath(currentParent);
    const isSelfOrDescendant =
      item.kind === 'directory' &&
      (normalizePath(folder.path) === normalizePath(item.path) ||
        isDescendantOf(folder.path, item.path));

    const isSelected = selectedDest === folder.path;
    const subFolders = folder.children.filter((c) => c.kind === 'directory') as FolderNode[];

    return (
      <div key={folder.path} className="select-none">
        <div
          onClick={() => {
            if (!isSelfOrDescendant && !isCurrent) {
              setSelectedDest(folder.path);
            }
          }}
          className={`flex items-center gap-1.5 py-1 px-2 rounded-lg text-xs cursor-pointer transition-colors ${
            isSelected
              ? 'bg-blue-600 text-white font-medium'
              : isSelfOrDescendant || isCurrent
              ? 'opacity-40 cursor-not-allowed text-slate-400'
              : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
          style={{ paddingLeft: `${depth * 14 + 8}px` }}
        >
          {subFolders.length > 0 ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(folder.path);
              }}
              className="p-0.5 hover:text-blue-500"
            >
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <span className="w-3.5 h-3.5 inline-block" />
          )}

          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span className="truncate">{folder.name === '/' ? 'Root Directory' : folder.name}</span>
          {isCurrent && <span className="text-[10px] ml-auto opacity-70">(Current location)</span>}
        </div>

        {isExpanded && subFolders.length > 0 && (
          <div>
            {subFolders.map((sub) => renderFolderTreeNode(sub, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141e33] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <FolderInput className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                Move &ldquo;{item.name}&rdquo;
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose a destination directory
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isMoving}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tree Container */}
        <div className="p-4">
          <div className="max-h-60 overflow-y-auto p-2 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800">
            {renderFolderTreeNode(rootFolder)}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 truncate">
            Target destination:{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {selectedDest}
            </span>
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isMoving}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onMove(selectedDest)}
            disabled={isMoving || selectedDest === currentParent}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white shadow-sm shadow-blue-500/25 transition-all"
          >
            {isMoving ? 'Moving...' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  );
};

