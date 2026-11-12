import { getDirectoryHandleByPath } from './directoryOperations';
import { getParentPath, getBaseName, normalizePath, joinPath } from '../../utils/pathUtils';
import { writeFileContents } from './fileWriter';

const FORBIDDEN_CHARACTERS = /[/\\:*?"<>|]/;

export function validateFileName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: 'Name cannot be empty.' };
  }
  if (FORBIDDEN_CHARACTERS.test(trimmed)) {
    return { valid: false, error: 'Name contains invalid characters (/ \\ : * ? " < > |).' };
  }
  if (trimmed === '.' || trimmed === '..') {
    return { valid: false, error: 'Invalid file or folder name.' };
  }
  return { valid: true };
}

export async function renameEntry(
  rootHandle: FileSystemDirectoryHandle,
  targetPath: string,
  newName: string,
  isDirectory = false
): Promise<{ success: boolean; newPath?: string; error?: string }> {
  const normPath = normalizePath(targetPath);
  if (normPath === '/') {
    return { success: false, error: 'Cannot rename the root directory.' };
  }

  const validation = validateFileName(newName);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const parentPath = getParentPath(normPath);
  const oldName = getBaseName(normPath);

  if (oldName === newName) {
    return { success: true, newPath: normPath };
  }

  try {
    const parentHandle = await getDirectoryHandleByPath(rootHandle, parentPath);

    // Check collision in parent
    let collision = false;
    try {
      if (isDirectory) {
        await parentHandle.getDirectoryHandle(newName);
        collision = true;
      } else {
        await parentHandle.getFileHandle(newName);
        collision = true;
      }
    } catch {
      collision = false;
    }

    if (collision) {
      return { success: false, error: `An item named "${newName}" already exists in this folder.` };
    }

    // Try modern FileSystemHandle.move if available
    let movedViaApi = false;
    if (isDirectory) {
      const dirHandle = await parentHandle.getDirectoryHandle(oldName);
      // @ts-expect-error move is available in Chrome 111+
      if (typeof dirHandle.move === 'function') {
        // @ts-expect-error move call
        await dirHandle.move(newName);
        movedViaApi = true;
      }
    } else {
      const fileHandle = await parentHandle.getFileHandle(oldName);
      // @ts-expect-error move is available in Chrome 111+
      if (typeof fileHandle.move === 'function') {
        // @ts-expect-error move call
        await fileHandle.move(newName);
        movedViaApi = true;
      }
    }

    // Fallback for file renaming if .move is unavailable
    if (!movedViaApi && !isDirectory) {
      const oldFileHandle = await parentHandle.getFileHandle(oldName);
      const fileData = await oldFileHandle.getFile();
      const newFileHandle = await parentHandle.getFileHandle(newName, { create: true });
      await writeFileContents(newFileHandle, fileData);
      await parentHandle.removeEntry(oldName);
    } else if (!movedViaApi && isDirectory) {
      return {
        success: false,
        error: 'Directory renaming without native move API is not supported by your browser.',
      };
    }

    const newPath = joinPath(parentPath, newName);
    return { success: true, newPath };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Rename failed';
    return { success: false, error: msg };
  }
}

