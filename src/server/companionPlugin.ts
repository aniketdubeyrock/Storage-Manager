import type { Plugin, ViteDevServer } from 'vite';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import type { DriveInfo, QuickFolder, SystemScanEvent } from '../types/companion.types';
import type { FolderNode, FileNode, ScanError } from '../types/filesystem.types';

function extractExt(filename: string): string {
  if (!filename || !filename.includes('.')) return '';
  const parts = filename.split('.');
  return parts[parts.length - 1].toLowerCase().trim();
}

// System directories and files that should not be traversed to avoid hanging on Windows locks
const WINDOWS_SYSTEM_SKIP = new Set([
  '$recycle.bin',
  'system volume information',
  'pagefile.sys',
  'swapfile.sys',
  'hiberfil.sys',
  'dumpstack.log.tmp',
]);

async function getShallowDirectory(
  currentDirPath: string,
  relPath: string,
  rootBaseName: string
): Promise<FolderNode> {
  const folderNode: FolderNode = {
    id: relPath || '/',
    name: path.basename(currentDirPath) || rootBaseName,
    path: relPath || '/',
    parentPath: path.dirname(relPath) === '.' ? '/' : '/' + path.dirname(relPath).replace(/\\/g, '/'),
    totalSize: 0,
    fileCount: 0,
    folderCount: 0,
    directFileCount: 0,
    directFolderCount: 0,
    lastScanned: Date.now(),
    kind: 'directory',
    calculationStatus: 'calculating',
    children: [],
  };

  let entries: fs.Dirent[] = [];
  try {
    entries = await fs.promises.readdir(currentDirPath, { withFileTypes: true });
  } catch {
    folderNode.calculationStatus = 'error';
    return folderNode;
  }

  for (const entry of entries) {
    const entryLower = entry.name.toLowerCase();
    if (WINDOWS_SYSTEM_SKIP.has(entryLower)) {
      continue;
    }

    const childRelPath = relPath === '/' ? `/${entry.name}` : `${relPath}/${entry.name}`;
    const fullChildPath = path.join(currentDirPath, entry.name);

    if (entry.isFile()) {
      try {
        const stat = await fs.promises.stat(fullChildPath);
        const ext = extractExt(entry.name);

        const fileNode: FileNode = {
          id: childRelPath,
          name: entry.name,
          path: childRelPath,
          parentPath: relPath || '/',
          extension: ext,
          mimeType: 'application/octet-stream',
          size: stat.size,
          lastModified: stat.mtimeMs,
          kind: 'file',
          scanStatus: 'scanned',
        };

        folderNode.children.push(fileNode);
        folderNode.directFileCount++;
        folderNode.fileCount++;
        folderNode.totalSize += stat.size;
      } catch {
        // Locked file
      }
    } else if (entry.isDirectory()) {
      folderNode.directFolderCount++;
      folderNode.folderCount++;

      const subFolderNode: FolderNode = {
        id: childRelPath,
        name: entry.name,
        path: childRelPath,
        parentPath: relPath || '/',
        totalSize: 0,
        fileCount: 0,
        folderCount: 0,
        directFileCount: 0,
        directFolderCount: 0,
        lastScanned: Date.now(),
        kind: 'directory',
        calculationStatus: 'pending',
        children: [],
      };

      folderNode.children.push(subFolderNode);
    }
  }

  // Sort: directories first, then alphabetical
  folderNode.children.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return a.kind === 'directory' ? -1 : 1;
  });

  return folderNode;
}

export function storageCompanionPlugin(): Plugin {
  let activeRootPath = '';

  return {
    name: 'storage-manager-companion',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost:5173'}`);

        // 1. List Physical Drives
        if (url.pathname === '/api/system/drives' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');

          const drives: DriveInfo[] = [];
          let volumeMap: Record<string, string> = {};

          try {
            await new Promise<void>((resolve) => {
              exec(
                'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | ForEach-Object { $_.DeviceID + \'|\' + $_.VolumeName }"',
                { timeout: 3000 },
                (err, stdout) => {
                  if (!err && stdout) {
                    const lines = stdout.trim().split(/\r?\n/);
                    for (const line of lines) {
                      const [devId, volName] = line.split('|');
                      if (devId) {
                        volumeMap[devId.trim().toUpperCase()] = volName ? volName.trim() : '';
                      }
                    }
                  }
                  resolve();
                }
              );
            });
          } catch {}

          for (let i = 65; i <= 90; i++) {
            const letter = String.fromCharCode(i);
            const driveRoot = `${letter}:\\`;
            try {
              const stat = fs.statfsSync(driveRoot);
              const totalSize = stat.blocks * stat.bsize;
              const freeSpace = stat.bavail * stat.bsize;
              const usedSpace = totalSize - freeSpace;

              const volName = volumeMap[`${letter}:`] || '';
              const driveName = volName
                ? `${volName} (${letter}:)`
                : letter === 'C'
                ? `Local Disk (${letter}:)`
                : `Drive (${letter}:)`;

              drives.push({
                id: `${letter}:`,
                name: driveName,
                volumeName: volName,
                path: driveRoot,
                totalSize,
                freeSpace,
                usedSpace,
                driveType: letter === 'C' ? 'System Disk' : 'Logical Disk',
              });
            } catch {}
          }

          res.end(JSON.stringify({ success: true, drives }));
          return;
        }

        // 2. List Quick User Folders (Downloads, Documents, Desktop, etc.)
        if (url.pathname === '/api/system/quick-folders' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const home = os.homedir();

          const candidates: Array<{ id: QuickFolder['icon']; name: string; folderName: string }> = [
            { id: 'downloads', name: 'Downloads', folderName: 'Downloads' },
            { id: 'documents', name: 'Documents', folderName: 'Documents' },
            { id: 'desktop', name: 'Desktop', folderName: 'Desktop' },
            { id: 'pictures', name: 'Pictures', folderName: 'Pictures' },
            { id: 'videos', name: 'Videos', folderName: 'Videos' },
            { id: 'music', name: 'Music', folderName: 'Music' },
          ];

          const quickFolders: QuickFolder[] = [];

          for (const c of candidates) {
            const folderPath = path.join(home, c.folderName);
            try {
              if (fs.existsSync(folderPath)) {
                let count = 0;
                try {
                  count = fs.readdirSync(folderPath).length;
                } catch {}
                quickFolders.push({
                  id: c.id,
                  name: c.name,
                  path: folderPath,
                  icon: c.id,
                  itemCount: count,
                });
              }
            } catch {}
          }

          res.end(JSON.stringify({ success: true, quickFolders }));
          return;
        }

        // 3. Instant Shallow List of any folder (returns in < 50ms)
        if (url.pathname === '/api/system/shallow-list' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          const targetPath = url.searchParams.get('path');
          if (!targetPath || !fs.existsSync(targetPath)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Valid target path is required.' }));
            return;
          }

          const normalizedRoot = path.normalize(targetPath);
          activeRootPath = normalizedRoot;
          const rootBaseName = path.basename(normalizedRoot) || normalizedRoot;

          const folderNode = await getShallowDirectory(normalizedRoot, '/', rootBaseName);
          folderNode.name = normalizedRoot;

          res.end(JSON.stringify({ success: true, folderNode }));
          return;
        }

        // 4. Progressive Scan Stream (Emits instant surface first, then streams folder sizing)
        if (url.pathname === '/api/system/scan-stream' && req.method === 'GET') {
          const targetPath = url.searchParams.get('path');
          if (!targetPath || !fs.existsSync(targetPath)) {
            res.statusCode = 400;
            res.end(JSON.stringify({ error: 'Valid target path is required.' }));
            return;
          }

          // Setup SSE
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
          });

          let cancelled = false;
          req.on('close', () => {
            cancelled = true;
          });

          const sendEvent = (data: SystemScanEvent) => {
            if (!cancelled) {
              res.write(`data: ${JSON.stringify(data)}\n\n`);
            }
          };

          const startTime = Date.now();
          const normalizedRoot = path.normalize(targetPath);
          activeRootPath = normalizedRoot;
          const rootBaseName = path.basename(normalizedRoot) || normalizedRoot;

          // STEP 1: Instant shallow discovery (< 50ms)
          const rootNode = await getShallowDirectory(normalizedRoot, '/', rootBaseName);
          rootNode.name = normalizedRoot;

          let filesScanned = rootNode.directFileCount;
          let foldersScanned = rootNode.directFolderCount;
          let bytesScanned = rootNode.totalSize;
          const errors: ScanError[] = [];

          // Emit initial shallow surface immediately so UI renders in < 50ms!
          sendEvent({
            type: 'initial_surface',
            rootFolder: rootNode,
            filesScanned,
            foldersScanned,
            bytesScanned,
          });

          // STEP 2: Asynchronous recursive calculation of nested directories
          const scanDeep = async (
            currentDirPath: string,
            relPath: string,
            depth = 1
          ): Promise<FolderNode> => {
            if (cancelled) throw new Error('Cancelled');

            const node: FolderNode = {
              id: relPath || '/',
              name: path.basename(currentDirPath) || rootBaseName,
              path: relPath || '/',
              parentPath: path.dirname(relPath) === '.' ? '/' : '/' + path.dirname(relPath).replace(/\\/g, '/'),
              totalSize: 0,
              fileCount: 0,
              folderCount: 0,
              directFileCount: 0,
              directFolderCount: 0,
              lastScanned: Date.now(),
              kind: 'directory',
              calculationStatus: 'ready',
              children: [],
            };

            let entries: fs.Dirent[] = [];
            try {
              entries = await fs.promises.readdir(currentDirPath, { withFileTypes: true });
            } catch (err: unknown) {
              node.calculationStatus = 'error';
              const errMsg = err instanceof Error ? err.message : 'Cannot read directory';
              errors.push({ path: currentDirPath, message: errMsg, timestamp: Date.now() });
              return node;
            }

            for (const entry of entries) {
              if (cancelled) break;

              const entryLower = entry.name.toLowerCase();
              if (WINDOWS_SYSTEM_SKIP.has(entryLower)) continue;

              const fullChildPath = path.join(currentDirPath, entry.name);
              const childRelPath = relPath === '/' ? `/${entry.name}` : `${relPath}/${entry.name}`;

              if (entry.isFile()) {
                try {
                  const stat = await fs.promises.stat(fullChildPath);
                  const ext = extractExt(entry.name);

                  const fileNode: FileNode = {
                    id: childRelPath,
                    name: entry.name,
                    path: childRelPath,
                    parentPath: relPath || '/',
                    extension: ext,
                    mimeType: 'application/octet-stream',
                    size: stat.size,
                    lastModified: stat.mtimeMs,
                    kind: 'file',
                    scanStatus: 'scanned',
                  };

                  node.children.push(fileNode);
                  node.directFileCount++;
                  node.fileCount++;
                  node.totalSize += stat.size;

                  filesScanned++;
                  bytesScanned += stat.size;
                } catch {}
              } else if (entry.isDirectory()) {
                try {
                  foldersScanned++;
                  const subNode = await scanDeep(fullChildPath, childRelPath, depth + 1);
                  node.children.push(subNode);
                  node.directFolderCount++;
                  node.folderCount += 1 + subNode.folderCount;
                  node.fileCount += subNode.fileCount;
                  node.totalSize += subNode.totalSize;
                } catch {}
              }
            }

            node.children.sort((a, b) => {
              if (a.kind === b.kind) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
              return a.kind === 'directory' ? -1 : 1;
            });

            return node;
          };

          // Find direct subfolders that were pending in root
          const subfolderItems = rootNode.children.filter((c) => c.kind === 'directory') as FolderNode[];
          const totalSubfoldersToResolve = subfolderItems.length;
          let resolvedCount = 0;

          for (let i = 0; i < subfolderItems.length; i++) {
            if (cancelled) break;

            const subStub = subfolderItems[i];
            const fullSubPath = path.join(normalizedRoot, subStub.name);

            sendEvent({
              type: 'progress',
              currentPath: `Calculating ${subStub.name}...`,
              filesScanned,
              foldersScanned,
              bytesScanned,
              pendingFoldersCount: totalSubfoldersToResolve - resolvedCount,
              resolvedFoldersCount: resolvedCount,
            });

            // Micro-yield to keep server event loop non-blocking
            await new Promise((resolve) => setTimeout(resolve, 0));

            const resolvedSubNode = await scanDeep(fullSubPath, subStub.path, 1);
            resolvedCount++;

            // Replace stub in root children with deep-calculated node
            const childIdx = rootNode.children.findIndex((c) => c.path === subStub.path);
            if (childIdx !== -1) {
              rootNode.children[childIdx] = resolvedSubNode;
            }

            // Recalculate root totals
            rootNode.fileCount += resolvedSubNode.fileCount;
            rootNode.folderCount += 1 + resolvedSubNode.folderCount;
            rootNode.totalSize += resolvedSubNode.totalSize;

            // Stream resolved folder event to frontend
            sendEvent({
              type: 'folder_resolved',
              folderPath: subStub.path,
              resolvedFolder: resolvedSubNode,
              filesScanned,
              foldersScanned,
              bytesScanned: rootNode.totalSize,
              pendingFoldersCount: totalSubfoldersToResolve - resolvedCount,
              resolvedFoldersCount: resolvedCount,
            });
          }

          rootNode.calculationStatus = 'ready';

          sendEvent({
            type: 'complete',
            rootFolder: rootNode,
            durationMs: Date.now() - startTime,
            filesScanned,
            foldersScanned,
            bytesScanned: rootNode.totalSize,
            errors,
          });

          res.end();
          return;
        }

const COMPANION_MIME_TYPES: Record<string, string> = {
  // Images
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  avif: 'image/avif',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  // Videos
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  m4v: 'video/mp4',
  avi: 'video/x-msvideo',
  // Audio
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  opus: 'audio/opus',
  // Documents
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  log: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  markdown: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  tsv: 'text/tab-separated-values; charset=utf-8',
  json: 'application/json; charset=utf-8',
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  ts: 'text/plain; charset=utf-8',
  tsx: 'text/plain; charset=utf-8',
  jsx: 'text/plain; charset=utf-8',
  xml: 'application/xml; charset=utf-8',
  yaml: 'text/yaml; charset=utf-8',
  yml: 'text/yaml; charset=utf-8',
  toml: 'text/plain; charset=utf-8',
  ini: 'text/plain; charset=utf-8',
  env: 'text/plain; charset=utf-8',
  sql: 'text/plain; charset=utf-8',
  py: 'text/plain; charset=utf-8',
  rs: 'text/plain; charset=utf-8',
  go: 'text/plain; charset=utf-8',
  java: 'text/plain; charset=utf-8',
  c: 'text/plain; charset=utf-8',
  cpp: 'text/plain; charset=utf-8',
  h: 'text/plain; charset=utf-8',
  sh: 'text/plain; charset=utf-8',
  bat: 'text/plain; charset=utf-8',
  ps1: 'text/plain; charset=utf-8',
  // Office docs
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  ppt: 'application/vnd.ms-powerpoint',
  zip: 'application/zip',
};

        // 5. Serve File Contents for Preview, Download, or Cloud Upload
        if ((url.pathname === '/api/system/file' || url.pathname === '/api/system/stream-file') && (req.method === 'GET' || req.method === 'HEAD')) {
          let filePath = url.searchParams.get('path');
          if (!filePath) {
            res.statusCode = 404;
            res.end('File path parameter is required.');
            return;
          }

          if (!fs.existsSync(filePath) && activeRootPath) {
            const candidate = path.resolve(activeRootPath, filePath.replace(/^[/\\]+/, ''));
            if (fs.existsSync(candidate)) {
              filePath = candidate;
            }
          }

          if (!fs.existsSync(filePath)) {
            res.statusCode = 404;
            res.end(`File not found: ${filePath}`);
            return;
          }

          const stat = fs.statSync(filePath);
          const ext = path.extname(filePath).slice(1).toLowerCase();
          const contentType = COMPANION_MIME_TYPES[ext] || 'application/octet-stream';
          const range = req.headers.range;

          if (range) {
            const parts = range.replace(/bytes=/, '').split('-');
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
            const chunkSize = (end - start) + 1;
            res.writeHead(206, {
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': chunkSize,
              'Content-Type': contentType,
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Headers': 'Range',
            });
            if (req.method === 'HEAD') {
              res.end();
              return;
            }
            fs.createReadStream(filePath, { start, end }).pipe(res);
            return;
          }

          res.writeHead(200, {
            'Content-Length': stat.size,
            'Content-Type': contentType,
            'Accept-Ranges': 'bytes',
            'Content-Disposition': `inline; filename="${path.basename(filePath)}"`,
            'Access-Control-Allow-Origin': '*',
          });
          if (req.method === 'HEAD') {
            res.end();
            return;
          }
          const stream = fs.createReadStream(filePath);
          stream.pipe(res);
          return;
        }

        // 6. Delete File or Directory
        if (url.pathname === '/api/system/delete' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              let { targetPath, isDirectory } = JSON.parse(body);
              if (!targetPath) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Target path is required.' }));
                return;
              }

              // Resolve relative path against activeRootPath if not directly found
              if (!fs.existsSync(targetPath) && activeRootPath) {
                const candidate = path.resolve(activeRootPath, targetPath.replace(/^[/\\]+/, ''));
                if (fs.existsSync(candidate)) {
                  targetPath = candidate;
                }
              }

              if (!fs.existsSync(targetPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: `Path does not exist: ${targetPath}` }));
                return;
              }

              // Safeguard: Never delete root drives like C:\ or D:\
              if (/^[a-zA-Z]:\\?$/.test(targetPath.trim())) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Cannot delete physical drive root.' }));
                return;
              }

              await fs.promises.rm(targetPath, { recursive: isDirectory, force: true });
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, deletedPath: targetPath }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Delete failed';
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: msg }));
            }
          });
          return;
        }

        // 7. Rename File or Directory
        if (url.pathname === '/api/system/rename' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const { targetPath, newName } = JSON.parse(body);
              const dir = path.dirname(targetPath);
              const newPath = path.join(dir, newName);

              if (fs.existsSync(newPath)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'Destination file already exists.' }));
                return;
              }

              await fs.promises.rename(targetPath, newPath);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, newPath }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Rename failed';
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: msg }));
            }
          });
          return;
        }

        // 8. Move File or Directory
        if (url.pathname === '/api/system/move' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', async () => {
            try {
              const { sourcePath, destinationDirPath } = JSON.parse(body);
              const fileName = path.basename(sourcePath);
              const destPath = path.join(destinationDirPath, fileName);

              if (fs.existsSync(destPath)) {
                res.statusCode = 400;
                res.end(JSON.stringify({ success: false, error: 'An item with that name already exists in destination.' }));
                return;
              }

              await fs.promises.rename(sourcePath, destPath);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, newPath: destPath }));
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Move failed';
              res.statusCode = 500;
              res.end(JSON.stringify({ success: false, error: msg }));
            }
          });
          return;
        }

        // 9. Open file with native system default application
        if (url.pathname === '/api/system/open' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              let { targetPath } = JSON.parse(body);
              if (!targetPath) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Target path is required.' }));
                return;
              }

              if (!fs.existsSync(targetPath) && activeRootPath) {
                const candidate = path.resolve(activeRootPath, targetPath.replace(/^[/\\]+/, ''));
                if (fs.existsSync(candidate)) targetPath = candidate;
              }

              if (!fs.existsSync(targetPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: `Path does not exist: ${targetPath}` }));
                return;
              }

              const command = process.platform === 'win32'
                ? `cmd /c start "" "${targetPath.replace(/"/g, '""')}"`
                : process.platform === 'darwin'
                ? `open "${targetPath}"`
                : `xdg-open "${targetPath}"`;

              exec(command, (err) => {
                res.setHeader('Content-Type', 'application/json');
                if (err) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ success: false, error: err.message }));
                } else {
                  res.end(JSON.stringify({ success: true }));
                }
              });
            } catch (err: unknown) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Failed to open file' }));
            }
          });
          return;
        }

        // 10. Reveal file in native system file explorer
        if (url.pathname === '/api/system/reveal' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => (body += chunk));
          req.on('end', () => {
            try {
              let { targetPath } = JSON.parse(body);
              if (!fs.existsSync(targetPath) && activeRootPath) {
                const candidate = path.resolve(activeRootPath, targetPath.replace(/^[/\\]+/, ''));
                if (fs.existsSync(candidate)) targetPath = candidate;
              }

              if (!fs.existsSync(targetPath)) {
                res.statusCode = 404;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'File not found' }));
                return;
              }

              const command = process.platform === 'win32'
                ? `explorer.exe /select,"${targetPath.replace(/"/g, '""')}"`
                : process.platform === 'darwin'
                ? `open -R "${targetPath}"`
                : `xdg-open "${path.dirname(targetPath)}"`;

              exec(command, () => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              });
            } catch {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Failed to reveal' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
