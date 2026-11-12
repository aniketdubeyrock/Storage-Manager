import React, { useState, useMemo } from 'react';
import {
  FolderTree,
  Search,
  Filter,
  Plus,
  ArrowUpDown,
  FolderOpen,
  LayoutList,
  LayoutGrid,
} from 'lucide-react';
import { useFilesystemStore } from '../stores/filesystem.store';
import { useFileManagerStore } from '../stores/fileManager.store';
import { useTrashStore } from '../stores/trash.store';
import { DirectoryTree } from '../components/filesystem/DirectoryTree';
import { BreadcrumbBar } from '../components/filesystem/BreadcrumbBar';
import { FileListView } from '../components/tables/FileListView';
import { FileGridView } from '../components/tables/FileGridView';
import { FileDetailsPanel } from '../components/filesystem/FileDetailsPanel';
import { BulkActionToolbar } from '../components/filesystem/BulkActionToolbar';
import { DeleteConfirmModal } from '../components/dialogs/DeleteConfirmModal';
import { RenameModal } from '../components/dialogs/RenameModal';
import { MoveModal } from '../components/dialogs/MoveModal';
import { FilePreviewModal } from '../components/dialogs/FilePreviewModal';
import { findFolderByPath } from '../services/filesystem/directoryOperations';
import { deleteEntry } from '../services/filesystem/fileDeleter';
import { renameEntry } from '../services/filesystem/fileRenamer';
import { moveEntry } from '../services/filesystem/fileMover';
import { downloadSingleFile, downloadAsZip } from '../services/filesystem/fileExporter';
import { appTrashManager } from '../services/trash/appTrashManager';
import { detectCategory } from '../services/filesystem/fileTypeDetector';
import { useGoogleDriveStore } from '../stores/googleDrive.store';
import type { AnyFsNode, FileNode, FolderNode } from '../types/filesystem.types';
import type { FileCategory } from '../types/analytics.types';
import toast from 'react-hot-toast';

export const FileManagerPage: React.FC = () => {
  const rootFolder = useFilesystemStore((s) => s.rootFolder);
  const rootHandle = useFilesystemStore((s) => s.rootHandle);
  const removeNodeFromTree = useFilesystemStore((s) => s.removeNodeFromTree);
  const renameNodeInTree = useFilesystemStore((s) => s.renameNodeInTree);
  const openPickerModal = useFilesystemStore((s) => s.openPickerModal);

  const currentPath = useFileManagerStore((s) => s.currentPath);
  const navigateTo = useFileManagerStore((s) => s.navigateTo);
  const selectedPaths = useFileManagerStore((s) => s.selectedPaths);
  const toggleSelect = useFileManagerStore((s) => s.toggleSelect);
  const selectAll = useFileManagerStore((s) => s.selectAll);
  const clearSelection = useFileManagerStore((s) => s.clearSelection);
  const viewMode = useFileManagerStore((s) => s.viewMode);
  const sortBy = useFileManagerStore((s) => s.sortBy);
  const sortDirection = useFileManagerStore((s) => s.sortDirection);
  const setSorting = useFileManagerStore((s) => s.setSorting);
  const searchQuery = useFileManagerStore((s) => s.searchQuery);
  const setSearchQuery = useFileManagerStore((s) => s.setSearchQuery);
  const categoryFilter = useFileManagerStore((s) => s.categoryFilter);
  const setCategoryFilter = useFileManagerStore((s) => s.setCategoryFilter);
  const previewNode = useFileManagerStore((s) => s.previewNode);
  const setPreviewNode = useFileManagerStore((s) => s.setPreviewNode);
  const detailsNode = useFileManagerStore((s) => s.detailsNode);
  const setDetailsNode = useFileManagerStore((s) => s.setDetailsNode);

  const enqueueDriveFile = useGoogleDriveStore((s) => s.enqueueFile);
  const enqueueDriveBatch = useGoogleDriveStore((s) => s.enqueueBatchFiles);

  const handleUploadNodeToDrive = (node: AnyFsNode) => {
    if (node.kind === 'file') {
      const fn = node as FileNode;
      enqueueDriveFile({
        name: fn.name,
        size: fn.size,
        mimeType: fn.mimeType,
        path: fn.path,
      });
    } else {
      toast.error('Direct folder upload is in development. Please select files inside to upload.');
    }
  };

  const handleBulkUploadToDrive = () => {
    const fileItems = selectedItems.filter((i): i is FileNode => i.kind === 'file');
    if (fileItems.length === 0) {
      toast.error('Please select one or more files to upload to Google Drive.');
      return;
    }
    enqueueDriveBatch(
      fileItems.map((f) => ({
        name: f.name,
        size: f.size,
        mimeType: f.mimeType,
        path: f.path,
      }))
    );
    clearSelection();
  };

  const loadTrash = useTrashStore((s) => s.loadTrash);

  // Dialog states
  const [deleteModalItems, setDeleteModalItems] = useState<AnyFsNode[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const [renameTarget, setRenameTarget] = useState<AnyFsNode | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const [moveTarget, setMoveTarget] = useState<AnyFsNode | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  // Active folder node
  const activeFolder = useMemo(() => {
    if (!rootFolder) return null;
    return findFolderByPath(rootFolder, currentPath) || rootFolder;
  }, [rootFolder, currentPath]);

  // Filtered and sorted items in active directory
  const displayedItems = useMemo(() => {
    if (!activeFolder) return [];

    let items = [...activeFolder.children];

    // Filter by search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      items = items.filter(
        (i) => i.name.toLowerCase().includes(q) || i.path.toLowerCase().includes(q)
      );
    }

    // Filter by category
    if (categoryFilter !== 'all') {
      items = items.filter((i) => {
        if (i.kind === 'directory') return false;
        return detectCategory((i as FileNode).extension) === categoryFilter;
      });
    }

    // Sort items
    items.sort((a, b) => {
      // Directories first
      if (a.kind !== b.kind) {
        return a.kind === 'directory' ? -1 : 1;
      }

      let cmp = 0;
      if (sortBy === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sortBy === 'size') {
        const sA = a.kind === 'directory' ? (a as FolderNode).totalSize : (a as FileNode).size;
        const sB = b.kind === 'directory' ? (b as FolderNode).totalSize : (b as FileNode).size;
        cmp = sA - sB;
      } else if (sortBy === 'lastModified') {
        const mA = a.kind === 'file' ? (a as FileNode).lastModified : 0;
        const mB = b.kind === 'file' ? (b as FileNode).lastModified : 0;
        cmp = mA - mB;
      } else if (sortBy === 'type') {
        const tA = a.kind === 'file' ? (a as FileNode).extension : 'folder';
        const tB = b.kind === 'file' ? (b as FileNode).extension : 'folder';
        cmp = tA.localeCompare(tB);
      }

      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return items;
  }, [activeFolder, searchQuery, categoryFilter, sortBy, sortDirection]);

  // Selected item objects for bulk actions
  const selectedItems = useMemo(() => {
    if (!activeFolder) return [];
    return activeFolder.children.filter((i) => selectedPaths.has(i.path));
  }, [activeFolder, selectedPaths]);

  // Deletion execution
  const handleDeleteConfirm = async (permanent: boolean) => {
    if (deleteModalItems.length === 0) return;
    setIsDeleting(true);

    let successCount = 0;
    for (const item of deleteModalItems) {
      try {
        if (permanent) {
          const res = await deleteEntry(rootHandle, item.path, item.kind === 'directory');
          if (res.success) {
            removeNodeFromTree(item.path);
            successCount++;
          } else {
            toast.error(`Failed to delete ${item.name}: ${res.error}`);
          }
        } else {
          // Move to app trash
          if (item.kind === 'file') {
            await appTrashManager.trashFile(item as FileNode);
          } else {
            await appTrashManager.trashFolder(item as FolderNode);
          }
          removeNodeFromTree(item.path);
          successCount++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Deletion error';
        toast.error(`Error deleting ${item.name}: ${msg}`);
      }
    }

    setIsDeleting(false);
    setDeleteModalItems([]);
    clearSelection();
    if (detailsNode && deleteModalItems.some((d) => d.id === detailsNode.id)) {
      setDetailsNode(null);
    }
    await loadTrash();

    if (successCount > 0) {
      toast.success(
        permanent
          ? `Permanently deleted ${successCount} item(s)`
          : `Moved ${successCount} item(s) to Application Trash`
      );
    }
  };

  // Rename execution
  const handleRenameConfirm = async (newName: string) => {
    if (!rootHandle || !renameTarget) return;
    setIsRenaming(true);

    try {
      const isDir = renameTarget.kind === 'directory';
      const res = await renameEntry(rootHandle, renameTarget.path, newName, isDir);
      if (res.success && res.newPath) {
        renameNodeInTree(renameTarget.path, res.newPath, newName);
        toast.success(`Renamed to "${newName}"`);
        setRenameTarget(null);
      } else {
        toast.error(res.error || 'Rename failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Rename failed';
      toast.error(msg);
    } finally {
      setIsRenaming(false);
    }
  };

  // Move execution
  const handleMoveConfirm = async (destinationPath: string) => {
    if (!rootHandle || !moveTarget) return;
    setIsMoving(true);

    try {
      const isDir = moveTarget.kind === 'directory';
      const res = await moveEntry(rootHandle, moveTarget.path, destinationPath, isDir);
      if (res.success) {
        removeNodeFromTree(moveTarget.path);
        toast.success(`Moved "${moveTarget.name}" to ${destinationPath}`);
        setMoveTarget(null);
      } else {
        toast.error(res.error || 'Move failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Move failed';
      toast.error(msg);
    } finally {
      setIsMoving(false);
    }
  };

  // Bulk ZIP Download
  const handleDownloadSelectedZip = async () => {
    if (selectedItems.length === 0) return;
    try {
      toast.loading('Creating ZIP archive...', { id: 'zip-download' });
      await downloadAsZip(selectedItems, `${activeFolder?.name || 'export'}-bundle.zip`);
      toast.success('ZIP downloaded successfully', { id: 'zip-download' });
    } catch (err) {
      toast.error('Failed to create ZIP export', { id: 'zip-download' });
    }
  };

  if (!rootFolder) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-blue-500/10 text-blue-600 flex items-center justify-center mb-4">
          <FolderOpen className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
          No directory currently open
        </h2>
        <p className="text-sm text-slate-500 max-w-sm mb-5">
          Scan a local folder with the File System Access API to explore and manage files.
        </p>
        <button
          onClick={() => openPickerModal()}
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm shadow-blue-500/25 transition-all cursor-pointer"
        >
          Scan Drive or Folder
        </button>
      </div>
    );
  }

  const categories: Array<{ id: FileCategory | 'all'; label: string }> = [
    { id: 'all', label: 'All Files' },
    { id: 'images', label: 'Images' },
    { id: 'videos', label: 'Videos' },
    { id: 'documents', label: 'Documents' },
    { id: 'archives', label: 'Archives' },
    { id: 'code', label: 'Code' },
  ];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left Directory Tree Pane */}
      <div className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] h-full flex flex-col shrink-0 hidden md:flex">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <FolderTree className="w-3.5 h-3.5 text-blue-500" />
            <span>Folder Tree</span>
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          <DirectoryTree
            rootFolder={rootFolder}
            activePath={currentPath}
            onSelectFolder={(path) => navigateTo(path)}
          />
        </div>
      </div>

      {/* Main File Explorer View Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#0a0f1d] overflow-hidden">
        {/* Breadcrumb & View Toggle Header */}
        <BreadcrumbBar currentPath={currentPath} onNavigate={(path) => navigateTo(path)} />

        {/* Filter bar */}
        <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0f172a] flex items-center justify-between gap-3 overflow-x-auto text-xs">
          <div className="flex items-center gap-1.5 shrink-0">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCategoryFilter(c.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  categoryFilter === c.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-slate-400 shrink-0">
            {displayedItems.length} {displayedItems.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* File List / Grid Container */}
        <div className="flex-1 overflow-y-auto">
          {displayedItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 text-xs">
              <p className="font-semibold text-slate-600 dark:text-slate-300 mb-1">
                This folder is empty
              </p>
              <p>No matching files or subfolders found.</p>
            </div>
          ) : viewMode === 'list' ? (
            <FileListView
              items={displayedItems}
              selectedPaths={selectedPaths}
              sortBy={sortBy}
              sortDirection={sortDirection}
              onSort={(field) => setSorting(field)}
              onToggleSelect={(path, isShift) => toggleSelect(path, isShift)}
              onSelectAll={(paths) => selectAll(paths)}
              onNavigateToFolder={(path) => navigateTo(path)}
              onPreview={(node) => setPreviewNode(node)}
              onDownload={(node) => {
                if (node.kind === 'file') downloadSingleFile(node as FileNode);
                else downloadAsZip([node], `${node.name}.zip`);
              }}
              onRename={(node) => setRenameTarget(node)}
              onMove={(node) => setMoveTarget(node)}
              onDelete={(node) => setDeleteModalItems([node])}
              onShowDetails={(node) => setDetailsNode(node)}
              onUploadToDrive={handleUploadNodeToDrive}
            />
          ) : (
            <FileGridView
              items={displayedItems}
              selectedPaths={selectedPaths}
              onToggleSelect={(path, isShift) => toggleSelect(path, isShift)}
              onNavigateToFolder={(path) => navigateTo(path)}
              onPreview={(node) => setPreviewNode(node)}
              onDownload={(node) => {
                if (node.kind === 'file') downloadSingleFile(node as FileNode);
                else downloadAsZip([node], `${node.name}.zip`);
              }}
              onRename={(node) => setRenameTarget(node)}
              onMove={(node) => setMoveTarget(node)}
              onDelete={(node) => setDeleteModalItems([node])}
              onShowDetails={(node) => setDetailsNode(node)}
            />
          )}
        </div>
      </div>

      {/* Right File Properties Panel */}
      {detailsNode && (
        <FileDetailsPanel
          node={detailsNode}
          onClose={() => setDetailsNode(null)}
          onPreview={(node) => setPreviewNode(node)}
          onDownload={(node) => {
            if (node.kind === 'file') downloadSingleFile(node as FileNode);
            else downloadAsZip([node], `${node.name}.zip`);
          }}
          onRename={(node) => setRenameTarget(node)}
          onMove={(node) => setMoveTarget(node)}
          onDelete={(node) => setDeleteModalItems([node])}
          onUploadToDrive={handleUploadNodeToDrive}
        />
      )}

      {/* Floating Bulk Action Bar */}
      <BulkActionToolbar
        selectedItems={selectedItems}
        onClearSelection={clearSelection}
        onDownloadZip={handleDownloadSelectedZip}
        onMoveSelected={() => {
          if (selectedItems.length > 0) {
            setMoveTarget(selectedItems[0]);
          }
        }}
        onDeleteSelected={() => setDeleteModalItems(selectedItems)}
        onUploadToDrive={handleBulkUploadToDrive}
      />

      {/* Modals */}
      <DeleteConfirmModal
        isOpen={deleteModalItems.length > 0}
        items={deleteModalItems}
        isDeleting={isDeleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteModalItems([])}
      />

      <RenameModal
        isOpen={Boolean(renameTarget)}
        item={renameTarget}
        isRenaming={isRenaming}
        onRename={handleRenameConfirm}
        onCancel={() => setRenameTarget(null)}
      />

      <MoveModal
        isOpen={Boolean(moveTarget)}
        item={moveTarget}
        isMoving={isMoving}
        onMove={handleMoveConfirm}
        onCancel={() => setMoveTarget(null)}
      />

      <FilePreviewModal
        node={previewNode}
        onClose={() => setPreviewNode(null)}
      />
    </div>
  );
};
