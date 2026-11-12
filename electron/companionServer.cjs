const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const WINDOWS_SYSTEM_SKIP = new Set([
  '$recycle.bin',
  'system volume information',
  'pagefile.sys',
  'hiberfil.sys',
  'swapfile.sys',
  'dumpstack.log.tmp',
  'appdata',
  'windows',
  'program files',
  'program files (x86)',
  'programdata',
  'recovery',
  'msocache',
]);

const COMPANION_MIME_TYPES = {
  // Web Assets
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  // Media
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  pdf: 'application/pdf',
  txt: 'text/plain; charset=utf-8',
  log: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  csv: 'text/csv; charset=utf-8',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  zip: 'application/zip',
};

function extractExt(filename) {
  if (!filename || !filename.includes('.')) return '';
  return filename.split('.').pop().toLowerCase().trim();
}

async function getShallowDirectory(dirPath, relPath = '/', rootBaseName = '') {
  const folderNode = {
    id: relPath || '/',
    name: rootBaseName || path.basename(dirPath) || dirPath,
    path: relPath || '/',
    parentPath: null,
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

  let entries = [];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    folderNode.calculationStatus = 'error';
    return folderNode;
  }

  for (const entry of entries) {
    const entryLower = entry.name.toLowerCase();
    if (WINDOWS_SYSTEM_SKIP.has(entryLower)) continue;

    const fullChildPath = path.join(dirPath, entry.name);
    const childRelPath = relPath === '/' ? `/${entry.name}` : `${relPath}/${entry.name}`;

    if (entry.isFile()) {
      try {
        const stat = await fs.promises.stat(fullChildPath);
        const ext = extractExt(entry.name);
        const fileNode = {
          id: childRelPath,
          name: entry.name,
          path: childRelPath,
          parentPath: relPath || '/',
          size: stat.size,
          lastModified: stat.mtimeMs,
          extension: ext,
          mimeType: COMPANION_MIME_TYPES[ext] || 'application/octet-stream',
          kind: 'file',
        };
        folderNode.children.push(fileNode);
        folderNode.directFileCount++;
        folderNode.fileCount++;
        folderNode.totalSize += stat.size;
      } catch {}
    } else if (entry.isDirectory()) {
      folderNode.directFolderCount++;
      folderNode.folderCount++;
      const subFolderNode = {
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

  folderNode.children.sort((a, b) => {
    if (a.kind === b.kind) return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    return a.kind === 'directory' ? -1 : 1;
  });

  return folderNode;
}

function startCompanionServer(distDir, preferredPort = 5173) {
  let activeRootPath = '';

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      // CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

      // 1. List Physical Drives
      if (url.pathname === '/api/system/drives' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        const drives = [];
        const volumeMap = {};

        try {
          await new Promise((resP) => {
            exec(
              'powershell -NoProfile -Command "Get-CimInstance Win32_LogicalDisk | ForEach-Object { $_.DeviceID + \'|\' + $_.VolumeName }"',
              { timeout: 3000 },
              (err, stdout) => {
                if (!err && stdout) {
                  const lines = stdout.trim().split(/\r?\n/);
                  for (const line of lines) {
                    const [devId, volName] = line.split('|');
                    if (devId) volumeMap[devId.trim().toUpperCase()] = volName ? volName.trim() : '';
                  }
                }
                resP();
              }
            );
          });
        } catch {}

        for (let i = 65; i <= 90; i++) {
          const letter = String.fromCharCode(i);
          const driveRoot = `${letter}:\\`;
          try {
            if (fs.existsSync(driveRoot)) {
              let totalBytes = 0;
              let freeBytes = 0;
              try {
                if (fs.statfsSync) {
                  const s = fs.statfsSync(driveRoot);
                  totalBytes = s.blocks * s.bsize;
                  freeBytes = s.bfree * s.bsize;
                }
              } catch {}

              const devId = `${letter}:`;
              drives.push({
                id: devId,
                name: `${letter}:`,
                volumeName: volumeMap[devId] || '',
                path: driveRoot,
                totalSize: totalBytes,
                freeSpace: freeBytes,
                usedSpace: totalBytes - freeBytes,
                driveType: letter === 'C' ? 'Fixed Disk' : 'Fixed Disk',
              });
            }
          } catch {}
        }

        res.end(JSON.stringify({ success: true, drives }));
        return;
      }

      // 2. Quick Access Folders
      if (url.pathname === '/api/system/quick-folders' && req.method === 'GET') {
        res.setHeader('Content-Type', 'application/json');
        const home = os.homedir();
        const candidates = [
          { id: 'downloads', name: 'Downloads', folderName: 'Downloads' },
          { id: 'documents', name: 'Documents', folderName: 'Documents' },
          { id: 'desktop', name: 'Desktop', folderName: 'Desktop' },
          { id: 'pictures', name: 'Pictures', folderName: 'Pictures' },
          { id: 'videos', name: 'Videos', folderName: 'Videos' },
          { id: 'music', name: 'Music', folderName: 'Music' },
        ];

        const quickFolders = [];
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

      // 3. Instant Shallow List (< 50ms)
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

      // 4. Progressive Scan Stream (SSE)
      if (url.pathname === '/api/system/scan-stream' && req.method === 'GET') {
        const targetPath = url.searchParams.get('path');
        if (!targetPath || !fs.existsSync(targetPath)) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'Valid target path is required.' }));
          return;
        }

        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        });

        let cancelled = false;
        req.on('close', () => { cancelled = true; });

        const sendEvent = (data) => {
          if (!cancelled) res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const normalizedRoot = path.normalize(targetPath);
        activeRootPath = normalizedRoot;
        const rootBaseName = path.basename(normalizedRoot) || normalizedRoot;
        const rootNode = await getShallowDirectory(normalizedRoot, '/', rootBaseName);
        rootNode.name = normalizedRoot;

        sendEvent({
          type: 'initial_surface',
          rootFolder: rootNode,
          filesScanned: rootNode.directFileCount,
          foldersScanned: rootNode.directFolderCount,
          bytesScanned: rootNode.totalSize,
        });

        // Scan direct subfolders progressively
        for (const child of rootNode.children) {
          if (cancelled) break;
          if (child.kind === 'directory') {
            const fullSubPath = path.join(normalizedRoot, child.name);
            try {
              const resolved = await getShallowDirectory(fullSubPath, child.path, child.name);
              child.totalSize = resolved.totalSize;
              child.fileCount = resolved.fileCount;
              child.folderCount = resolved.folderCount;
              child.children = resolved.children;
              child.calculationStatus = 'ready';

              sendEvent({
                type: 'folder_resolved',
                folderPath: child.path,
                resolvedFolder: child,
                filesScanned: rootNode.children.reduce((acc, c) => acc + (c.fileCount || 0), 0),
                foldersScanned: rootNode.children.reduce((acc, c) => acc + (c.folderCount || 0), 0),
                bytesScanned: rootNode.children.reduce((acc, c) => acc + (c.totalSize || 0), 0),
              });
            } catch {
              child.calculationStatus = 'error';
            }
          }
        }

        sendEvent({
          type: 'complete',
          rootFolder: rootNode,
          filesScanned: rootNode.fileCount,
          foldersScanned: rootNode.folderCount,
          bytesScanned: rootNode.totalSize,
        });

        res.end();
        return;
      }

      // 5. File Content & Streaming
      if ((url.pathname === '/api/system/file' || url.pathname === '/api/system/stream-file') && (req.method === 'GET' || req.method === 'HEAD')) {
        let filePath = url.searchParams.get('path');
        if (!filePath) {
          res.statusCode = 404;
          res.end('File path parameter is required.');
          return;
        }

        if (!fs.existsSync(filePath) && activeRootPath) {
          const candidate = path.resolve(activeRootPath, filePath.replace(/^[/\\]+/, ''));
          if (fs.existsSync(candidate)) filePath = candidate;
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
          if (req.method === 'HEAD') { res.end(); return; }
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
        if (req.method === 'HEAD') { res.end(); return; }
        fs.createReadStream(filePath).pipe(res);
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
              res.end(JSON.stringify({ success: false, error: 'Target path required' }));
              return;
            }
            if (!fs.existsSync(targetPath) && activeRootPath) {
              const candidate = path.resolve(activeRootPath, targetPath.replace(/^[/\\]+/, ''));
              if (fs.existsSync(candidate)) targetPath = candidate;
            }
            if (!fs.existsSync(targetPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: 'Path not found' }));
              return;
            }
            if (/^[a-zA-Z]:\\?$/.test(targetPath.trim())) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Cannot delete drive root' }));
              return;
            }
            await fs.promises.rm(targetPath, { recursive: isDirectory, force: true });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, deletedPath: targetPath }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // 7. Open with System Application
      if (url.pathname === '/api/system/open' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
          try {
            let { targetPath } = JSON.parse(body);
            if (!fs.existsSync(targetPath) && activeRootPath) {
              const candidate = path.resolve(activeRootPath, targetPath.replace(/^[/\\]+/, ''));
              if (fs.existsSync(candidate)) targetPath = candidate;
            }
            if (!fs.existsSync(targetPath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false, error: 'File not found' }));
              return;
            }
            const command = process.platform === 'win32'
              ? `cmd /c start "" "${targetPath.replace(/"/g, '""')}"`
              : process.platform === 'darwin'
              ? `open "${targetPath}"`
              : `xdg-open "${targetPath}"`;
            exec(command, (err) => {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: !err, error: err ? err.message : null }));
            });
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false, error: err.message }));
          }
        });
        return;
      }

      // 8. Reveal in File Explorer
      if (url.pathname === '/api/system/reveal' && req.method === 'POST') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
          try {
            let { targetPath } = JSON.parse(body);
            if (!fs.existsSync(targetPath) && activeRootPath) {
              const candidate = path.resolve(activeRootPath, targetPath.replace(/^[/\\]+/, ''));
              if (fs.existsSync(candidate)) targetPath = candidate;
            }
            if (fs.existsSync(targetPath)) {
              const command = process.platform === 'win32'
                ? `explorer.exe /select,"${targetPath.replace(/"/g, '""')}"`
                : process.platform === 'darwin'
                ? `open -R "${targetPath}"`
                : `xdg-open "${path.dirname(targetPath)}"`;
              exec(command, () => {
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              });
            } else {
              res.statusCode = 404;
              res.end(JSON.stringify({ success: false }));
            }
          } catch {
            res.statusCode = 500;
            res.end(JSON.stringify({ success: false }));
          }
        });
        return;
      }

      // 9. Static File Serving (for production dist/ directory)
      if (distDir && fs.existsSync(distDir)) {
        let reqPath = decodeURIComponent(url.pathname);
        if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

        let targetFile = path.join(distDir, reqPath);
        if (!fs.existsSync(targetFile) || fs.statSync(targetFile).isDirectory()) {
          targetFile = path.join(distDir, 'index.html'); // SPA fallback
        }

        if (fs.existsSync(targetFile)) {
          const ext = path.extname(targetFile).slice(1).toLowerCase();
          const contentType = COMPANION_MIME_TYPES[ext] || 'application/octet-stream';
          res.writeHead(200, { 'Content-Type': contentType });
          fs.createReadStream(targetFile).pipe(res);
          return;
        }
      }

      res.statusCode = 404;
      res.end('Not found');
    });

    server.listen(preferredPort, 'localhost', () => {
      resolve({ port: server.address().port, server });
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port in use, pick next available
        server.listen(0, 'localhost', () => {
          resolve({ port: server.address().port, server });
        });
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { startCompanionServer };

