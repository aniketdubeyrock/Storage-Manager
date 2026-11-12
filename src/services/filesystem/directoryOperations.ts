import type { AnyFsNode, FolderNode, FileNode } from '../../types/filesystem.types';
import { splitPath, normalizePath } from '../../utils/pathUtils';

/**
 * Traverses down from the root directory handle following the path segments.
 */
export async function getDirectoryHandleByPath(
  rootHandle: FileSystemDirectoryHandle,
  targetPath: string,
  createIfMissing = false
): Promise<FileSystemDirectoryHandle> {
  const normPath = normalizePath(targetPath);
  if (normPath === '/') return rootHandle;

  const segments = splitPath(normPath);
  let currentHandle = rootHandle;

  for (const segment of segments) {
    currentHandle = await currentHandle.getDirectoryHandle(segment, { create: createIfMissing });
  }

  return currentHandle;
}

/**
 * Finds a node in the in-memory tree by its path.
 */
export function findNodeByPath(rootNode: FolderNode, targetPath: string): AnyFsNode | null {
  const normPath = normalizePath(targetPath);
  if (normPath === '/' || normPath === rootNode.path) return rootNode;

  const stack: AnyFsNode[] = [...rootNode.children];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (normalizePath(current.path) === normPath) {
      return current;
    }
    if (current.kind === 'directory') {
      stack.push(...current.children);
    }
  }

  return null;
}

/**
 * Finds a folder node in the in-memory tree by its path.
 */
export function findFolderByPath(rootNode: FolderNode, targetPath: string): FolderNode | null {
  const node = findNodeByPath(rootNode, targetPath);
  if (node && node.kind === 'directory') {
    return node as FolderNode;
  }
  return null;
}

/**
 * Collects all file nodes flat from a root or sub-folder.
 */
export function flattenFiles(folderNode: FolderNode): FileNode[] {
  const files: FileNode[] = [];
  const stack: FolderNode[] = [folderNode];

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of current.children) {
      if (child.kind === 'file') {
        files.push(child);
      } else if (child.kind === 'directory') {
        stack.push(child);
      }
    }
  }

  return files;
}

/**
 * Collects all folder nodes flat from a root or sub-folder.
 */
export function flattenFolders(folderNode: FolderNode): FolderNode[] {
  const folders: FolderNode[] = [];
  const stack: FolderNode[] = [folderNode];

  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current.path !== '/') {
      folders.push(current);
    }
    for (const child of current.children) {
      if (child.kind === 'directory') {
        stack.push(child);
      }
    }
  }

  return folders;
}

