import { describe, it, expect } from 'vitest';
import { analyzeStorage } from '../../services/storage/storageAnalyzer';
import type { FolderNode, FileNode } from '../../types/filesystem.types';

describe('storageAnalyzer', () => {
  const mockTree: FolderNode = {
    id: '/',
    name: 'TestRoot',
    path: '/',
    parentPath: '',
    totalSize: 15500000,
    fileCount: 4,
    folderCount: 2,
    directFileCount: 1,
    directFolderCount: 2,
    lastScanned: Date.now(),
    kind: 'directory',
    children: [
      {
        id: '/large_video.mp4',
        name: 'large_video.mp4',
        path: '/large_video.mp4',
        parentPath: '/',
        extension: 'mp4',
        mimeType: 'video/mp4',
        size: 10000000,
        lastModified: 1700000000000,
        kind: 'file',
        scanStatus: 'scanned',
      },
      {
        id: '/Documents',
        name: 'Documents',
        path: '/Documents',
        parentPath: '/',
        totalSize: 5500000,
        fileCount: 3,
        folderCount: 1,
        directFileCount: 2,
        directFolderCount: 1,
        lastScanned: Date.now(),
        kind: 'directory',
        children: [
          {
            id: '/Documents/report.pdf',
            name: 'report.pdf',
            path: '/Documents/report.pdf',
            parentPath: '/Documents',
            extension: 'pdf',
            mimeType: 'application/pdf',
            size: 5000000,
            lastModified: 1700000000000,
            kind: 'file',
            scanStatus: 'scanned',
          },
          {
            id: '/Documents/notes.txt',
            name: 'notes.txt',
            path: '/Documents/notes.txt',
            parentPath: '/Documents',
            extension: 'txt',
            mimeType: 'text/plain',
            size: 200000,
            lastModified: 1700000000000,
            kind: 'file',
            scanStatus: 'scanned',
          },
          {
            id: '/Documents/Code',
            name: 'Code',
            path: '/Documents/Code',
            parentPath: '/Documents',
            totalSize: 300000,
            fileCount: 1,
            folderCount: 0,
            directFileCount: 1,
            directFolderCount: 0,
            lastScanned: Date.now(),
            kind: 'directory',
            children: [
              {
                id: '/Documents/Code/app.ts',
                name: 'app.ts',
                path: '/Documents/Code/app.ts',
                parentPath: '/Documents/Code',
                extension: 'ts',
                mimeType: 'text/typescript',
                size: 300000,
                lastModified: 1700000000000,
                kind: 'file',
                scanStatus: 'scanned',
              },
            ],
          },
        ],
      },
    ],
  };

  it('accurately identifies the largest file and folder', () => {
    const report = analyzeStorage(mockTree);
    expect(report.summary.largestFile?.name).toBe('large_video.mp4');
    expect(report.summary.largestFile?.size).toBe(10000000);
    expect(report.summary.largestFolder?.name).toBe('Documents');
    expect(report.summary.largestFolder?.totalSize).toBe(5500000);
  });

  it('aggregates file categories correctly', () => {
    const report = analyzeStorage(mockTree);
    const videoCat = report.categories.find((c) => c.category === 'videos');
    const docCat = report.categories.find((c) => c.category === 'documents');
    const codeCat = report.categories.find((c) => c.category === 'code');

    expect(videoCat?.size).toBe(10000000);
    expect(videoCat?.count).toBe(1);
    expect(docCat?.size).toBe(5200000); // 5000000 + 200000
    expect(docCat?.count).toBe(2);
    expect(codeCat?.size).toBe(300000);
    expect(codeCat?.count).toBe(1);
  });

  it('builds size distribution buckets correctly', () => {
    const report = analyzeStorage(mockTree);
    expect(report.sizeDistribution.length).toBe(5);
    const tiny = report.sizeDistribution.find((b) => b.id === 'tiny');
    expect(tiny?.count).toBe(2); // notes.txt (200KB) and app.ts (300KB)
  });
});

