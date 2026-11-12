import type { FolderNode, AnyFsNode } from '../../types/filesystem.types';
import type { TreemapItem } from '../../types/analytics.types';
import { getCategoryColor, detectCategory } from '../filesystem/fileTypeDetector';

export function buildTreemapHierarchy(
  folder: FolderNode,
  maxDepth = 2,
  minSizePercentage = 0.005 // prune items smaller than 0.5% for visual clarity
): TreemapItem {
  const rootSize = folder.totalSize || 1;

  const buildItem = (node: AnyFsNode, depth: number): TreemapItem => {
    const isDir = node.kind === 'directory';
    const size = isDir ? (node as FolderNode).totalSize : node.size;
    const cat = isDir ? 'other' : detectCategory(node.extension);
    const color = isDir ? '#3B82F6' : getCategoryColor(cat);

    const item: TreemapItem = {
      id: node.id,
      name: node.name,
      path: node.path,
      size,
      kind: node.kind,
      color,
    };

    if (isDir && depth < maxDepth) {
      const folderNode = node as FolderNode;
      const sortedChildren = [...folderNode.children]
        .sort((a, b) => {
          const sA = a.kind === 'directory' ? (a as FolderNode).totalSize : a.size;
          const sB = b.kind === 'directory' ? (b as FolderNode).totalSize : b.size;
          return sB - sA;
        })
        .filter((child) => {
          const childSize = child.kind === 'directory' ? (child as FolderNode).totalSize : child.size;
          return childSize / rootSize >= minSizePercentage;
        });

      if (sortedChildren.length > 0) {
        item.children = sortedChildren.map((child) => buildItem(child, depth + 1));
      }
    }

    return item;
  };

  return buildItem(folder, 0);
}

