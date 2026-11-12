import { getDirectoryHandleByPath } from './directoryOperations';
import {
  getParentPath,
  getBaseName,
  normalizePath,
  joinPath,
  isDescendantOf,
} from '../../utils/pathUtils';
import { writeFileContents } from './fileWriter';

export interface MoveCopyResult {
  success: boolean;
  destinationPath?: string;
  error?: string;
}

/**
 * Moves a file or folder from sourcePath into destinationDirPath.
 */
export async function moveEntry(
  rootHandle: FileSystemDirectoryHandle,
  sourcePath: string,
  destinationDirPath: string,
  isDirectory = false
): Promise<MoveCopyResult> {
  const normSource = normalizePath(sourcePath);
  const normDest = normalizePath(destinationDirPath);

  if (normSource === '/') {
    return { success: false, error: 'Cannot move the root directory.' };
  }

  // Prevent moving into itself or a child folder
  if (normSource === normDest || isDescendantOf(normDest, normSource)) {
    return {
      success: false,
      error: 'Cannot move a directory into itself or one of its subdirectories.',
    };
  }

  const sourceParentPath = getParentPath(normSource);
  if (sourceParentPath === normDest) {
    return { success: true, destinationPath: normSource }; // already there
  }

  const itemName = getBaseName(normSource);
  const targetFinalPath = joinPath(normDest, itemName);

  try {
    const sourceParentHandle = await getDirectoryHandleByPath(rootHandle, sourceParentPath);
    const destDirHandle = await getDirectoryHandleByPath(rootHandle, normDest);

    // Check collision in target directory
    let collision = false;
    try {
      if (isDirectory) {
        await destDirHandle.getDirectoryHandle(itemName);
        collision = true;
      } else {
        await destDirHandle.getFileHandle(itemName);
        collision = true;
      }
    } catch {
      collision = false;
    }

    if (collision) {
      return {
        success: false,
        error: `An item named "${itemName}" already exists in the destination folder.`,
      };
    }

    // Try native .move(destDirHandle)
    let movedViaApi = false;
    if (isDirectory) {
      const sourceDirHandle = await sourceParentHandle.getDirectoryHandle(itemName);
      // @ts-expect-error move supported in modern browsers
      if (typeof sourceDirHandle.move === 'function') {
        // @ts-expect-error move with directory handle
        await sourceDirHandle.move(destDirHandle);
        movedViaApi = true;
      }
    } else {
      const sourceFileHandle = await sourceParentHandle.getFileHandle(itemName);
      // @ts-expect-error move supported in modern browsers
      if (typeof sourceFileHandle.move === 'function') {
        // @ts-expect-error move with directory handle
        await sourceFileHandle.move(destDirHandle);
        movedViaApi = true;
      }
    }

    // Fallback: Copy and delete original
    if (!movedViaApi) {
      const copyRes = await copyEntry(rootHandle, normSource, normDest, isDirectory);
      if (!copyRes.success) {
        return copyRes;
      }
      await sourceParentHandle.removeEntry(itemName, { recursive: isDirectory });
    }

    return { success: true, destinationPath: targetFinalPath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Move operation failed';
    return { success: false, error: msg };
  }
}

/**
 * Copies a file or folder into destinationDirPath.
 */
export async function copyEntry(
  rootHandle: FileSystemDirectoryHandle,
  sourcePath: string,
  destinationDirPath: string,
  isDirectory = false,
  customNewName?: string
): Promise<MoveCopyResult> {
  const normSource = normalizePath(sourcePath);
  const normDest = normalizePath(destinationDirPath);

  if (normSource === '/') {
    return { success: false, error: 'Cannot copy the root directory.' };
  }

  const sourceParentPath = getParentPath(normSource);
  const itemName = customNewName || getBaseName(normSource);
  const targetFinalPath = joinPath(normDest, itemName);

  try {
    const sourceParentHandle = await getDirectoryHandleByPath(rootHandle, sourceParentPath);
    const destDirHandle = await getDirectoryHandleByPath(rootHandle, normDest);

    if (!isDirectory) {
      const sourceFileHandle = await sourceParentHandle.getFileHandle(getBaseName(normSource));
      const fileData = await sourceFileHandle.getFile();
      const newFileHandle = await destDirHandle.getFileHandle(itemName, { create: true });
      await writeFileContents(newFileHandle, fileData);
      return { success: true, destinationPath: targetFinalPath };
    }

    // Directory recursive copy
    const sourceDirHandle = await sourceParentHandle.getDirectoryHandle(getBaseName(normSource));
    const newDirHandle = await destDirHandle.getDirectoryHandle(itemName, { create: true });

    await deepCopyDirectory(sourceDirHandle, newDirHandle);
    return { success: true, destinationPath: targetFinalPath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Copy operation failed';
    return { success: false, error: msg };
  }
}

async function deepCopyDirectory(
  source: FileSystemDirectoryHandle,
  target: FileSystemDirectoryHandle
): Promise<void> {
  for await (const [name, handle] of (source as any).entries()) {
    if (handle.kind === 'file') {
      const srcFile = await (handle as FileSystemFileHandle).getFile();
      const targetFileHandle = await target.getFileHandle(name, { create: true });
      await writeFileContents(targetFileHandle, srcFile);
    } else if (handle.kind === 'directory') {
      const subTarget = await target.getDirectoryHandle(name, { create: true });
      await deepCopyDirectory(handle as FileSystemDirectoryHandle, subTarget);
    }
  }
}
