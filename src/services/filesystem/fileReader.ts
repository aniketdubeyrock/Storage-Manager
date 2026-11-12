import type { FileNode } from '../../types/filesystem.types';

/**
 * Safely reads file contents for preview and downloading.
 * Supports both Browser File System Access API and Companion Engine.
 */

export async function readFileAsBlob(fileHandle: FileSystemFileHandle): Promise<Blob> {
  return await fileHandle.getFile();
}

export async function readFileAsText(
  fileHandle: FileSystemFileHandle,
  maxBytes = 5 * 1024 * 1024
): Promise<{ text: string; truncated: boolean }> {
  const file = await fileHandle.getFile();
  if (file.size > maxBytes) {
    const slice = file.slice(0, maxBytes);
    const text = await slice.text();
    return { text, truncated: true };
  }
  const text = await file.text();
  return { text, truncated: false };
}

export async function readFileAsDataUrl(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function createBlobUrl(fileHandle: FileSystemFileHandle): Promise<string> {
  const file = await fileHandle.getFile();
  return URL.createObjectURL(file);
}

export function revokeBlobUrl(url: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

/**
 * Universal Node Blob Fetcher
 * Reads Blob whether the file originates from Browser FileSystem API or Companion Engine.
 */
export async function readFileBlobFromNode(node: FileNode): Promise<Blob> {
  if (node.handle) {
    return await node.handle.getFile();
  }

  const res = await fetch(`/api/system/stream-file?path=${encodeURIComponent(node.path)}`);
  if (!res.ok) {
    throw new Error(`Failed to load file content (${res.status} ${res.statusText})`);
  }
  return await res.blob();
}

/**
 * Universal Node URL Generator
 * Returns a fast streamable URL (direct companion URL or Object URL) for media, PDF, and image rendering.
 */
export async function getFileStreamUrl(node: FileNode): Promise<{ url: string; isBlob: boolean }> {
  if (node.handle) {
    const file = await node.handle.getFile();
    return { url: URL.createObjectURL(file), isBlob: true };
  }

  // Use direct companion stream URL for instant loading and range-seeking support
  return {
    url: `/api/system/stream-file?path=${encodeURIComponent(node.path)}`,
    isBlob: false,
  };
}

/**
 * Universal Node Text Reader with truncation safeguard
 */
export async function readFileTextFromNode(
  node: FileNode,
  maxBytes = 2 * 1024 * 1024
): Promise<{ text: string; truncated: boolean }> {
  if (node.handle) {
    const file = await node.handle.getFile();
    if (file.size > maxBytes) {
      const slice = file.slice(0, maxBytes);
      return { text: await slice.text(), truncated: true };
    }
    return { text: await file.text(), truncated: false };
  }

  const isOversized = (node.size || 0) > maxBytes;
  const headers: HeadersInit = isOversized ? { Range: `bytes=0-${maxBytes - 1}` } : {};

  const res = await fetch(`/api/system/stream-file?path=${encodeURIComponent(node.path)}`, { headers });
  if (!res.ok && res.status !== 206) {
    throw new Error(`Failed to read file text (${res.status})`);
  }
  const text = await res.text();
  return { text, truncated: isOversized };
}

/**
 * Universal Node Byte Array Reader for Hex & Binary Inspection
 */
export async function readFileBytesFromNode(
  node: FileNode,
  maxBytes = 256 * 1024
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  let buffer: ArrayBuffer;
  const isOversized = (node.size || 0) > maxBytes;

  if (node.handle) {
    const file = await node.handle.getFile();
    if (file.size > maxBytes) {
      const slice = file.slice(0, maxBytes);
      buffer = await slice.arrayBuffer();
    } else {
      buffer = await file.arrayBuffer();
    }
  } else {
    const headers: HeadersInit = isOversized ? { Range: `bytes=0-${maxBytes - 1}` } : {};
    const res = await fetch(`/api/system/stream-file?path=${encodeURIComponent(node.path)}`, { headers });
    if (!res.ok && res.status !== 206) {
      throw new Error(`Failed to read file bytes (${res.status})`);
    }
    buffer = await res.arrayBuffer();
  }

  return { bytes: new Uint8Array(buffer), truncated: isOversized };
}

/**
 * Launches the file in the operating system's native default desktop application (e.g. Word, Excel, Photoshop, VLC).
 */
export async function openWithSystemApp(nodeOrPath: FileNode | string): Promise<boolean> {
  const targetPath = typeof nodeOrPath === 'string' ? nodeOrPath : nodeOrPath.path;
  try {
    const res = await fetch('/api/system/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Reveals and highlights the file inside the operating system's file manager (e.g. Windows Explorer).
 */
export async function revealInSystemExplorer(nodeOrPath: FileNode | string): Promise<boolean> {
  const targetPath = typeof nodeOrPath === 'string' ? nodeOrPath : nodeOrPath.path;
  try {
    const res = await fetch('/api/system/reveal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetPath }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
