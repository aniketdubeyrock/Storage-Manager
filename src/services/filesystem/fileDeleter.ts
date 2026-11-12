import { getDirectoryHandleByPath } from './directoryOperations';
import { getParentPath, getBaseName, normalizePath } from '../../utils/pathUtils';

export interface DeleteOperationResult {
  path: string;
  success: boolean;
  error?: string;
}

/**
 * Deletes a file or directory at the given path.
 * Supports both Native File System Access API (via rootHandle) and Companion Engine (via /api/system/delete).
 */
export async function deleteEntry(
  rootHandle: FileSystemDirectoryHandle | null,
  targetPath: string,
  isRecursiveDirectory = false
): Promise<DeleteOperationResult> {
  const normPath = normalizePath(targetPath);

  // Safety guard: Never delete root
  if (normPath === '/' || /^[a-zA-Z]:\\?$/.test(normPath.trim())) {
    return {
      path: normPath,
      success: false,
      error: 'Cannot delete the root directory or physical drive.',
    };
  }

  // 1. If no rootHandle, use Companion Engine backend API
  if (!rootHandle) {
    try {
      const res = await fetch('/api/system/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetPath: normPath,
          isDirectory: isRecursiveDirectory,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        return {
          path: normPath,
          success: true,
        };
      }
      return {
        path: normPath,
        success: false,
        error: data.error || 'Companion deletion failed',
      };
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Deletion request failed';
      return {
        path: normPath,
        success: false,
        error: errMsg,
      };
    }
  }

  // 2. Native File System Access API
  const parentPath = getParentPath(normPath);
  const entryName = getBaseName(normPath);

  try {
    const parentHandle = await getDirectoryHandleByPath(rootHandle, parentPath);
    await parentHandle.removeEntry(entryName, { recursive: isRecursiveDirectory });

    return {
      path: normPath,
      success: true,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : 'Unknown deletion error';
    return {
      path: normPath,
      success: false,
      error: errMsg,
    };
  }
}

/**
 * Bulk deletion of multiple paths.
 */
export async function deleteMultipleEntries(
  rootHandle: FileSystemDirectoryHandle | null,
  targets: Array<{ path: string; isDirectory: boolean }>
): Promise<DeleteOperationResult[]> {
  const results: DeleteOperationResult[] = [];

  for (const target of targets) {
    const res = await deleteEntry(rootHandle, target.path, target.isDirectory);
    results.push(res);
  }

  return results;
}

