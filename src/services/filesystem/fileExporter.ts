import JSZip from 'jszip';
import type { FileNode, FolderNode, AnyFsNode } from '../../types/filesystem.types';
import { readFileBlobFromNode } from './fileReader';

/**
 * Downloads a single file directly via browser anchor tag.
 * Works seamlessly for both browser FileSystem handles and Companion system files.
 */
export async function downloadSingleFile(fileNode: FileNode): Promise<void> {
  const blob = await readFileBlobFromNode(fileNode);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileNode.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Packs multiple files or folders into a single ZIP archive and triggers download.
 * Works seamlessly for both browser FileSystem handles and Companion system files.
 */
export async function downloadAsZip(
  items: AnyFsNode[],
  zipFileName = 'storage-manager-export.zip',
  onProgress?: (percent: number) => void
): Promise<void> {
  const zip = new JSZip();

  const addFolderToZip = async (folder: FolderNode, currentZipFolder: JSZip) => {
    for (const child of folder.children) {
      if (child.kind === 'file') {
        try {
          const blob = await readFileBlobFromNode(child as FileNode);
          currentZipFolder.file(child.name, blob);
        } catch (err) {
          console.warn(`Could not add ${child.name} to zip:`, err);
        }
      } else if (child.kind === 'directory') {
        const nestedZip = currentZipFolder.folder(child.name);
        if (nestedZip) {
          await addFolderToZip(child, nestedZip);
        }
      }
    }
  };

  for (const item of items) {
    if (item.kind === 'file') {
      try {
        const blob = await readFileBlobFromNode(item as FileNode);
        zip.file(item.name, blob);
      } catch (err) {
        console.warn(`Could not add ${item.name} to zip:`, err);
      }
    } else if (item.kind === 'directory') {
      const folderZip = zip.folder(item.name);
      if (folderZip) {
        await addFolderToZip(item as FolderNode, folderZip);
      }
    }
  }

  const content = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => {
      onProgress?.(Math.round(metadata.percent));
    }
  );

  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipFileName.endsWith('.zip') ? zipFileName : `${zipFileName}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
