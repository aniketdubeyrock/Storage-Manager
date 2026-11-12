import type { FileNode } from '../../types/filesystem.types';
import type { DuplicateGroup } from '../../types/analytics.types';
import { computeFileHash } from '../../utils/hashUtils';
import { readFileAsBlob } from '../filesystem/fileReader';

export interface DuplicateDetectionOptions {
  signal?: AbortSignal;
  minFileSize?: number; // default e.g. 1KB, skip empty or tiny files
  onProgress?: (processed: number, total: number, currentFileName: string) => void;
}

export async function findDuplicateFiles(
  files: FileNode[],
  options: DuplicateDetectionOptions = {}
): Promise<DuplicateGroup[]> {
  const minSize = options.minFileSize ?? 1024; // 1KB min by default

  // Stage 1: Group files by exact byte size
  const sizeMap = new Map<number, FileNode[]>();
  for (const file of files) {
    if (file.size < minSize) continue;
    const group = sizeMap.get(file.size);
    if (group) {
      group.push(file);
    } else {
      sizeMap.set(file.size, [file]);
    }
  }

  // Filter out sizes with only 1 file
  const candidateLists: FileNode[][] = [];
  let totalCandidates = 0;
  for (const [, group] of sizeMap.entries()) {
    if (group.length > 1) {
      candidateLists.push(group);
      totalCandidates += group.length;
    }
  }

  if (totalCandidates === 0) {
    return [];
  }

  // Stage 2: Hash candidate files
  let processedCount = 0;
  const groups: DuplicateGroup[] = [];

  for (const candidateGroup of candidateLists) {
    if (options.signal?.aborted) {
      throw new DOMException('Duplicate detection was cancelled.', 'AbortError');
    }

    const hashMap = new Map<string, FileNode[]>();

    for (const fileNode of candidateGroup) {
      if (options.signal?.aborted) {
        throw new DOMException('Duplicate detection was cancelled.', 'AbortError');
      }

      processedCount++;
      options.onProgress?.(processedCount, totalCandidates, fileNode.name);

      if (!fileNode.handle) continue;

      try {
        const blob = await readFileAsBlob(fileNode.handle);
        const hash = await computeFileHash(blob);

        const hashGroup = hashMap.get(hash);
        if (hashGroup) {
          hashGroup.push(fileNode);
        } else {
          hashMap.set(hash, [fileNode]);
        }
      } catch (err) {
        console.warn(`Could not compute hash for file ${fileNode.path}:`, err);
      }
    }

    // Identify genuine duplicates with matching hash
    for (const [hash, matchingFiles] of hashMap.entries()) {
      if (matchingFiles.length > 1) {
        const size = matchingFiles[0].size;
        groups.push({
          id: `${size}_${hash}`,
          size,
          hash,
          files: matchingFiles,
          reclaimableSize: (matchingFiles.length - 1) * size,
        });
      }
    }
  }

  // Sort groups by highest reclaimable storage first
  groups.sort((a, b) => b.reclaimableSize - a.reclaimableSize);
  return groups;
}

