import React, { useState, useMemo } from 'react';
import type { FolderNode, AnyFsNode, FileNode } from '../../types/filesystem.types';
import { formatBytes } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';
import { getCategoryColor, detectCategory } from '../../services/filesystem/fileTypeDetector';
import { Folder, File, ChevronRight, Home } from 'lucide-react';
import { normalizePath } from '../../utils/pathUtils';

interface TreemapProps {
  rootFolder: FolderNode;
  onNavigateToFileManager?: (path: string) => void;
  onSelectPreview?: (file: FileNode) => void;
}

interface TreemapRect {
  node: AnyFsNode;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export const StorageTreemap: React.FC<TreemapProps> = ({
  rootFolder,
  onNavigateToFileManager,
  onSelectPreview,
}) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);
  const [currentFolder, setCurrentFolder] = useState<FolderNode>(rootFolder);
  const [hoveredNode, setHoveredNode] = useState<AnyFsNode | null>(null);

  // Sync if rootFolder changes
  React.useEffect(() => {
    setCurrentFolder(rootFolder);
  }, [rootFolder]);

  // Compute treemap rectangles using 2D slice-and-dice layout
  const rects: TreemapRect[] = useMemo(() => {
    if (!currentFolder || currentFolder.children.length === 0) return [];

    const total = currentFolder.children.reduce((sum, item) => {
      return sum + (item.kind === 'directory' ? item.totalSize : item.size);
    }, 0);

    if (total === 0) return [];

    // Sort descending by size
    const items = [...currentFolder.children]
      .filter((i) => (i.kind === 'directory' ? i.totalSize : i.size) > 0)
      .sort((a, b) => {
        const sA = a.kind === 'directory' ? a.totalSize : a.size;
        const sB = b.kind === 'directory' ? b.totalSize : b.size;
        return sB - sA;
      });

    // Layout algorithm: Squarified / Alternating slice layout
    const result: TreemapRect[] = [];
    const layout = (
      nodes: AnyFsNode[],
      x: number,
      y: number,
      width: number,
      height: number
    ) => {
      if (nodes.length === 0) return;
      if (nodes.length === 1) {
        const node = nodes[0];
        const isDir = node.kind === 'directory';
        const color = isDir
          ? '#2563EB'
          : getCategoryColor(detectCategory((node as FileNode).extension));
        result.push({ node, x, y, width, height, color });
        return;
      }

      const isWide = width >= height;
      const subTotal = nodes.reduce(
        (sum, n) => sum + (n.kind === 'directory' ? n.totalSize : n.size),
        0
      );

      // Split into two balanced halves
      let acc = 0;
      let splitIdx = 0;
      for (let i = 0; i < nodes.length; i++) {
        const itemSize = nodes[i].kind === 'directory' ? (nodes[i] as FolderNode).totalSize : (nodes[i] as FileNode).size;
        acc += itemSize;
        if (acc >= subTotal / 2 || i === nodes.length - 2) {
          splitIdx = i + 1;
          break;
        }
      }

      const leftNodes = nodes.slice(0, splitIdx);
      const rightNodes = nodes.slice(splitIdx);
      const leftSum = leftNodes.reduce(
        (s, n) => s + (n.kind === 'directory' ? n.totalSize : n.size),
        0
      );
      const ratio = subTotal > 0 ? leftSum / subTotal : 0.5;

      if (isWide) {
        const leftWidth = width * ratio;
        layout(leftNodes, x, y, leftWidth, height);
        layout(rightNodes, x + leftWidth, y, width - leftWidth, height);
      } else {
        const topHeight = height * ratio;
        layout(leftNodes, x, y, width, topHeight);
        layout(rightNodes, x, y + topHeight, width, height - topHeight);
      }
    };

    layout(items, 0, 0, 100, 100);
    return result;
  }, [currentFolder]);

  const handleDrillDown = (node: AnyFsNode) => {
    if (node.kind === 'directory') {
      setCurrentFolder(node as FolderNode);
    } else {
      if (onSelectPreview) {
        onSelectPreview(node as FileNode);
      }
    }
  };

  return (
    <div className="w-full flex flex-col space-y-3">
      {/* Treemap Breadcrumbs */}
      <div className="flex items-center justify-between text-xs pb-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setCurrentFolder(rootFolder)}
            className="flex items-center gap-1 text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Root</span>
          </button>
          {currentFolder.path !== '/' && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                {currentFolder.name}
              </span>
            </>
          )}
        </div>

        {onNavigateToFileManager && (
          <button
            onClick={() => onNavigateToFileManager(currentFolder.path)}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1"
          >
            <span>Open in File Manager</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Main Treemap Canvas / Container */}
      <div className="w-full h-80 sm:h-96 relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner p-1 select-none">
        {rects.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">
            Empty folder
          </div>
        ) : (
          rects.map((rect, idx) => {
            const isDir = rect.node.kind === 'directory';
            const nodeSize = isDir
              ? (rect.node as FolderNode).totalSize
              : (rect.node as FileNode).size;

            return (
              <div
                key={rect.node.id || idx}
                style={{
                  position: 'absolute',
                  left: `${rect.x}%`,
                  top: `${rect.y}%`,
                  width: `${rect.width}%`,
                  height: `${rect.height}%`,
                  padding: '2px',
                }}
              >
                <div
                  onClick={() => handleDrillDown(rect.node)}
                  onMouseEnter={() => setHoveredNode(rect.node)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className={`w-full h-full rounded-lg transition-all duration-150 p-2 overflow-hidden flex flex-col justify-between border cursor-pointer ${
                    isDir
                      ? 'border-blue-500/30 hover:border-blue-400 shadow-sm'
                      : 'border-white/10 hover:border-white/40'
                  }`}
                  style={{
                    backgroundColor: isDir ? '#1e293b' : rect.color + '33',
                    borderLeftColor: rect.color,
                    borderLeftWidth: '3px',
                  }}
                  title={`${rect.node.name} (${formatBytes(nodeSize, displayUnits)})`}
                >
                  {rect.width > 7 && rect.height > 8 && (
                    <div className="truncate">
                      <div className="flex items-center gap-1.5 text-white font-medium text-xs truncate">
                        {isDir ? (
                          <Folder className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        ) : (
                          <File className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                        )}
                        <span className="truncate">{rect.node.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block truncate">
                        {formatBytes(nodeSize, displayUnits)}
                      </span>
                    </div>
                  )}
                  {isDir && rect.width > 12 && rect.height > 15 && (
                    <span className="text-[9px] uppercase tracking-wider text-blue-400 font-semibold self-end bg-blue-950/60 px-1.5 py-0.5 rounded">
                      Folder
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Hover Info Footer */}
      <div className="h-6 flex items-center justify-between text-xs px-1 text-slate-500 dark:text-slate-400">
        {hoveredNode ? (
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-slate-900 dark:text-white truncate">
              {hoveredNode.name}
            </span>
            <span>•</span>
            <span className="text-blue-500 font-medium">
              {formatBytes(
                hoveredNode.kind === 'directory'
                  ? (hoveredNode as FolderNode).totalSize
                  : (hoveredNode as FileNode).size,
                displayUnits
              )}
            </span>
            <span className="hidden sm:inline text-slate-400 truncate">
              ({hoveredNode.path})
            </span>
          </div>
        ) : (
          <span className="text-slate-400">Hover or click a block to inspect/drill down</span>
        )}
      </div>
    </div>
  );
};

