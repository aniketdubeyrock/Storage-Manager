import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  X,
  Download,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FileCode,
  AlertCircle,
  Loader2,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Table,
  BookOpen,
  Binary,
  Copy,
  Check,
  Search,
  ExternalLink,
  Monitor,
  FolderOpen,
  WrapText,
  Sparkles,
} from 'lucide-react';
import JSZip from 'jszip';
import type { FileNode } from '../../types/filesystem.types';
import {
  getViewerCapabilities,
  type ViewerMode,
  type ViewerModeOption,
} from '../../services/filesystem/fileTypeDetector';
import {
  getFileStreamUrl,
  readFileTextFromNode,
  readFileBytesFromNode,
  readFileBlobFromNode,
  revokeBlobUrl,
  openWithSystemApp,
  revealInSystemExplorer,
} from '../../services/filesystem/fileReader';
import { downloadSingleFile } from '../../services/filesystem/fileExporter';
import { formatBytes, formatDate } from '../../utils/formatters';
import { useSettingsStore } from '../../stores/settings.store';
import toast from 'react-hot-toast';

interface FilePreviewModalProps {
  node: FileNode | null;
  onClose: () => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({ node, onClose }) => {
  const displayUnits = useSettingsStore((s) => s.displayUnits);

  // Capabilities & Selected Mode
  const capabilities = useMemo(() => {
    if (!node) return null;
    return getViewerCapabilities(node.name, node.mimeType);
  }, [node]);

  const [activeMode, setActiveMode] = useState<ViewerMode>('code');

  // Sync mode when node changes
  useEffect(() => {
    if (capabilities) {
      setActiveMode(capabilities.defaultMode);
    }
  }, [capabilities]);

  // Loading & Content states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stream / Blob URL
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [isBlobUrl, setIsBlobUrl] = useState(false);

  // Text content
  const [textContent, setTextContent] = useState<string | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isWordWrap, setIsWordWrap] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);

  // Hex binary content
  const [hexBytes, setHexBytes] = useState<Uint8Array | null>(null);

  // Table (CSV/TSV) parsed content
  const [tableData, setTableData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [tableFilter, setTableFilter] = useState('');

  // Office Doc (.docx) extracted text
  const [docSummary, setDocSummary] = useState<string | null>(null);

  // Image controls
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Video playback speed
  const [playbackRate, setPlaybackRate] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Filtered rows for CSV/TSV table viewer (must be declared before any conditional return)
  const filteredTableRows = useMemo(() => {
    if (!tableData) return [];
    if (!tableFilter.trim()) return tableData.rows;
    const q = tableFilter.toLowerCase();
    return tableData.rows.filter((row) => row.some((cell) => cell.toLowerCase().includes(q)));
  }, [tableData, tableFilter]);

  // Load content whenever node or activeMode changes
  useEffect(() => {
    if (!node) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    let createdUrl: string | null = null;
    let isCreatedBlob = false;

    setLoading(true);
    setError(null);

    async function loadViewerData() {
      try {
        if (!node) return;

        // 1. Media & PDF modes require stream/blob URL
        if (['image', 'video', 'audio', 'pdf'].includes(activeMode)) {
          const res = await getFileStreamUrl(node);
          if (!isMounted) {
            if (res.isBlob) revokeBlobUrl(res.url);
            return;
          }
          createdUrl = res.url;
          isCreatedBlob = res.isBlob;
          setStreamUrl(res.url);
          setIsBlobUrl(res.isBlob);
          setLoading(false);
          return;
        }

        // 2. Text / Code / Markdown modes
        if (['code', 'markdown'].includes(activeMode)) {
          const res = await readFileTextFromNode(node, 2 * 1024 * 1024);
          if (!isMounted) return;
          setTextContent(res.text);
          setIsTruncated(res.truncated);
          setLoading(false);
          return;
        }

        // 3. Table mode (CSV / TSV)
        if (activeMode === 'table') {
          const res = await readFileTextFromNode(node, 1024 * 1024);
          if (!isMounted) return;
          const separator = node.name.toLowerCase().endsWith('.tsv') ? '\t' : ',';
          const lines = res.text.split(/\r?\n/).filter((l) => l.trim().length > 0);
          if (lines.length > 0) {
            const parseLine = (line: string) => {
              if (separator === '\t') return line.split('\t');
              // CSV parsing with basic quote handling
              const cells: string[] = [];
              let cur = '';
              let inQuote = false;
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') inQuote = !inQuote;
                else if (char === ',' && !inQuote) {
                  cells.push(cur.trim());
                  cur = '';
                } else cur += char;
              }
              cells.push(cur.trim());
              return cells;
            };

            const headers = parseLine(lines[0]);
            const rows = lines.slice(1, 201).map(parseLine); // limit first 200 rows for smooth UI
            setTableData({ headers, rows });
          } else {
            setTableData({ headers: ['Empty file'], rows: [] });
          }
          setLoading(false);
          return;
        }

        // 4. Office Document mode
        if (activeMode === 'office') {
          const ext = node.name.split('.').pop()?.toLowerCase();
          if (ext === 'docx') {
            try {
              const blob = await readFileBlobFromNode(node);
              const zip = await JSZip.loadAsync(blob);
              const docXml = await zip.file('word/document.xml')?.async('text');
              if (docXml) {
                // Strip XML tags and reconstruct paragraphs
                const cleanText = docXml
                  .replace(/<\/w:p>/g, '\n\n')
                  .replace(/<[^>]+>/g, '')
                  .replace(/&lt;/g, '<')
                  .replace(/&gt;/g, '>')
                  .replace(/&amp;/g, '&')
                  .replace(/&quot;/g, '"')
                  .trim();
                if (isMounted) setDocSummary(cleanText || 'No readable text content extracted.');
              } else {
                if (isMounted) setDocSummary('Could not locate document text structure in DOCX package.');
              }
            } catch {
              if (isMounted) setDocSummary('Word document preview extraction unavailable.');
            }
          }
          setLoading(false);
          return;
        }

        // 5. Hex & Binary mode
        if (activeMode === 'hex') {
          const res = await readFileBytesFromNode(node, 64 * 1024); // first 64KB for hex view
          if (!isMounted) return;
          setHexBytes(res.bytes);
          setIsTruncated(res.truncated);
          setLoading(false);
          return;
        }

        setLoading(false);
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load file preview');
          setLoading(false);
        }
      }
    }

    loadViewerData();

    return () => {
      isMounted = false;
      if (createdUrl && isCreatedBlob) {
        revokeBlobUrl(createdUrl);
      }
    };
  }, [node, activeMode]);

  // Reset image controls when mode or node changes
  useEffect(() => {
    setZoomLevel(1);
    setRotation(0);
    setImageDimensions(null);
  }, [node, activeMode]);

  if (!node) return null;

  // Actions
  const handleDownload = async () => {
    try {
      await downloadSingleFile(node);
      toast.success(`Downloaded ${node.name}`);
    } catch {
      toast.error('Download failed');
    }
  };

  const handleOpenSystem = async () => {
    const success = await openWithSystemApp(node);
    if (success) {
      toast.success(`Opening ${node.name} in system application...`);
    } else {
      toast.error('Could not open file in desktop app');
    }
  };

  const handleRevealExplorer = async () => {
    const success = await revealInSystemExplorer(node);
    if (success) {
      toast.success(`Revealed ${node.name} in file manager`);
    } else {
      toast.error('Could not reveal file');
    }
  };

  const handleCopyText = async () => {
    if (textContent !== null) {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      toast.success('Copied text to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handlePrettifyJson = () => {
    if (!textContent) return;
    try {
      const parsed = JSON.parse(textContent);
      setTextContent(JSON.stringify(parsed, null, 2));
      toast.success('JSON formatted successfully');
    } catch {
      toast.error('File does not contain valid JSON');
    }
  };

  // All available viewer modes for this file
  const availableModes: ViewerModeOption[] = capabilities?.supportedModes || [
    { mode: 'hex', label: 'Hex Inspector', iconName: 'Binary' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-colors">
        {/* HEADER BAR */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 dark:bg-[#151f33]/80">
          {/* File Identity */}
          <div className="flex items-center gap-3 min-w-0 max-w-md">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              {activeMode === 'image' && <ImageIcon className="w-5 h-5" />}
              {activeMode === 'video' && <Film className="w-5 h-5" />}
              {activeMode === 'audio' && <Music className="w-5 h-5" />}
              {activeMode === 'pdf' && <FileText className="w-5 h-5" />}
              {activeMode === 'table' && <Table className="w-5 h-5" />}
              {activeMode === 'markdown' && <BookOpen className="w-5 h-5" />}
              {activeMode === 'code' && <FileCode className="w-5 h-5" />}
              {activeMode === 'office' && <FileText className="w-5 h-5" />}
              {activeMode === 'hex' && <Binary className="w-5 h-5" />}
            </div>
            <div className="truncate">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate" title={node.name}>
                {node.name}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {formatBytes(node.size, displayUnits)} • Modified {formatDate(node.lastModified)}
              </p>
            </div>
          </div>

          {/* VIEWER SELECTOR (Choose Which Viewer to Use) */}
          <div className="flex items-center gap-1.5 bg-slate-200/70 dark:bg-slate-900/80 p-1 rounded-xl">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 px-2 hidden sm:inline">
              Viewer:
            </span>
            {availableModes.map((opt) => {
              const isActive = activeMode === opt.mode;
              return (
                <button
                  key={opt.mode}
                  onClick={() => setActiveMode(opt.mode)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-300/60 dark:hover:bg-slate-800'
                  }`}
                  title={`Switch to ${opt.label}`}
                >
                  {opt.mode === 'image' && <ImageIcon className="w-3.5 h-3.5" />}
                  {opt.mode === 'pdf' && <FileText className="w-3.5 h-3.5" />}
                  {opt.mode === 'table' && <Table className="w-3.5 h-3.5" />}
                  {opt.mode === 'markdown' && <BookOpen className="w-3.5 h-3.5" />}
                  {opt.mode === 'code' && <FileCode className="w-3.5 h-3.5" />}
                  {opt.mode === 'office' && <FileText className="w-3.5 h-3.5" />}
                  {opt.mode === 'video' && <Film className="w-3.5 h-3.5" />}
                  {opt.mode === 'audio' && <Music className="w-3.5 h-3.5" />}
                  {opt.mode === 'hex' && <Binary className="w-3.5 h-3.5" />}
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>

          {/* ACTIONS & CONTROLS */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Open in Desktop App */}
            <button
              onClick={handleOpenSystem}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
              title="Open with your system default desktop application (Word, Excel, VLC, Photos, etc.)"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">System App</span>
            </button>

            {/* Reveal in Explorer */}
            <button
              onClick={handleRevealExplorer}
              className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              title="Reveal in file explorer"
            >
              <FolderOpen className="w-4 h-4" />
            </button>

            {/* Download File */}
            <button
              onClick={handleDownload}
              className="p-1.5 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              title="Download file"
            >
              <Download className="w-4 h-4" />
            </button>

            {/* Close Modal */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors"
              title="Close viewer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* VIEWER CONTENT BODY */}
        <div className="flex-1 overflow-auto bg-slate-100/60 dark:bg-[#0c1222] relative flex flex-col">
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-9 h-9 animate-spin text-blue-500" />
              <p className="text-xs font-medium">Loading {node.name}...</p>
            </div>
          ) : error ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-rose-500 text-center p-6 max-w-md mx-auto">
              <AlertCircle className="w-10 h-10" />
              <p className="text-sm font-semibold">Viewer Error</p>
              <p className="text-xs text-slate-400">{error}</p>
              <button
                onClick={() => setActiveMode('hex')}
                className="mt-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200"
              >
                Inspect in Hex View
              </button>
            </div>
          ) : (
            <>
              {/* 1. IMAGE VIEWER */}
              {activeMode === 'image' && streamUrl && (
                <div className="flex-1 flex flex-col">
                  {/* Image Toolbar */}
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800/80 bg-white/70 dark:bg-[#151f33]/70 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                      {imageDimensions && (
                        <span>
                          {imageDimensions.width} × {imageDimensions.height} px
                        </span>
                      )}
                      <span>•</span>
                      <span>{Math.round(zoomLevel * 100)}% zoom</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setZoomLevel((z) => Math.max(0.25, z - 0.25))}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        title="Zoom Out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setZoomLevel(1)}
                        className="px-2 py-0.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono text-[11px]"
                        title="Reset 100%"
                      >
                        100%
                      </button>
                      <button
                        onClick={() => setZoomLevel((z) => Math.min(4, z + 0.25))}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
                        title="Zoom In"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRotation((r) => (r + 90) % 360)}
                        className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 ml-1"
                        title="Rotate 90°"
                      >
                        <RotateCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Canvas View */}
                  <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px]">
                    <img
                      src={streamUrl}
                      alt={node.name}
                      onLoad={(e) => {
                        const img = e.currentTarget;
                        setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });
                      }}
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                        transition: 'transform 0.15s ease-out',
                      }}
                      className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-xl border border-slate-200/50 dark:border-slate-800/50 bg-white/20"
                    />
                  </div>
                </div>
              )}

              {/* 2. PDF VIEWER */}
              {activeMode === 'pdf' && streamUrl && (
                <div className="flex-1 flex flex-col h-full">
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#151f33]/70 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Native PDF Reader</span>
                    <a
                      href={streamUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      <span>Open in new browser tab</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                  <iframe
                    src={`${streamUrl}#toolbar=1`}
                    title={node.name}
                    className="w-full flex-1 border-0 bg-slate-900"
                  />
                </div>
              )}

              {/* 3. CSV / TSV DATA TABLE VIEWER */}
              {activeMode === 'table' && tableData && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Table Controls */}
                  <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#151f33]/70 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">
                        {tableData.headers.length} columns
                      </span>
                      <span>•</span>
                      <span>Showing {filteredTableRows.length} rows</span>
                    </div>

                    <div className="flex items-center gap-2 max-w-xs w-full">
                      <div className="relative w-full">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={tableFilter}
                          onChange={(e) => setTableFilter(e.target.value)}
                          placeholder="Filter table rows..."
                          className="w-full pl-8 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Table Grid */}
                  <div className="flex-1 overflow-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-200/90 dark:bg-slate-800/90 backdrop-blur-xs text-slate-700 dark:text-slate-200 font-bold border-b border-slate-300 dark:border-slate-700">
                        <tr>
                          <th className="p-2.5 text-slate-400 font-mono w-12 text-center">#</th>
                          {tableData.headers.map((h, i) => (
                            <th key={i} className="p-2.5 border-r border-slate-300/40 dark:border-slate-700/40 last:border-r-0 truncate max-w-[200px]">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/50 dark:divide-slate-800/60 font-mono text-[11px]">
                        {filteredTableRows.map((row, rIdx) => (
                          <tr
                            key={rIdx}
                            className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors"
                          >
                            <td className="p-2 text-center text-slate-400 select-none bg-slate-100/50 dark:bg-slate-900/40 font-mono">
                              {rIdx + 1}
                            </td>
                            {row.map((cell, cIdx) => (
                              <td
                                key={cIdx}
                                className="p-2 text-slate-800 dark:text-slate-200 border-r border-slate-200/30 dark:border-slate-800/30 last:border-r-0 truncate max-w-[250px]"
                                title={cell}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* 4. CODE & TEXT VIEWER */}
              {activeMode === 'code' && textContent !== null && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  {/* Code Toolbar */}
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#151f33]/70 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsWordWrap(!isWordWrap)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs transition-colors ${
                          isWordWrap
                            ? 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <WrapText className="w-3.5 h-3.5" />
                        <span>Word Wrap</span>
                      </button>

                      {node.name.toLowerCase().endsWith('.json') && (
                        <button
                          onClick={handlePrettifyJson}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:text-blue-600 text-xs transition-colors"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Prettify JSON</span>
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search in file..."
                          className="pl-8 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 w-44"
                        />
                      </div>

                      <button
                        onClick={handleCopyText}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>

                  {isTruncated && (
                    <div className="px-4 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
                      <span>Large file preview truncated to first 2MB.</span>
                      <button onClick={handleOpenSystem} className="underline font-semibold ml-2">
                        Open full file in system app
                      </button>
                    </div>
                  )}

                  {/* Code Editor Body */}
                  <div className="flex-1 overflow-auto bg-[#0f172a] text-slate-100 p-4 font-mono text-xs leading-relaxed select-text flex">
                    {/* Line Numbers */}
                    <div className="pr-4 border-r border-slate-800 text-slate-600 select-none text-right font-mono text-xs">
                      {textContent.split('\n').map((_, idx) => (
                        <div key={idx}>{idx + 1}</div>
                      ))}
                    </div>
                    {/* Text Area */}
                    <pre
                      className={`pl-4 flex-1 ${
                        isWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                      } overflow-x-auto`}
                    >
                      <code>{textContent}</code>
                    </pre>
                  </div>
                </div>
              )}

              {/* 5. MARKDOWN VIEWER */}
              {activeMode === 'markdown' && textContent !== null && (
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                  <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-[#151f33]/70 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Rendered Markdown</span>
                    <button
                      onClick={handleCopyText}
                      className="flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:text-blue-600"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>Copy source</span>
                    </button>
                  </div>
                  <div className="flex-1 overflow-auto p-6 md:p-8 bg-white dark:bg-[#0c1222] text-slate-800 dark:text-slate-200 prose dark:prose-invert max-w-none">
                    <div className="space-y-4 font-sans text-sm leading-relaxed">
                      {textContent.split(/\r?\n\r?\n/).map((para, idx) => {
                        const trimmed = para.trim();
                        if (trimmed.startsWith('# ')) {
                          return (
                            <h1 key={idx} className="text-2xl font-bold border-b border-slate-200 dark:border-slate-800 pb-2">
                              {trimmed.slice(2)}
                            </h1>
                          );
                        }
                        if (trimmed.startsWith('## ')) {
                          return (
                            <h2 key={idx} className="text-xl font-bold border-b border-slate-200 dark:border-slate-800 pb-1">
                              {trimmed.slice(3)}
                            </h2>
                          );
                        }
                        if (trimmed.startsWith('### ')) {
                          return (
                            <h3 key={idx} className="text-lg font-bold">
                              {trimmed.slice(4)}
                            </h3>
                          );
                        }
                        if (trimmed.startsWith('```')) {
                          const lines = trimmed.split('\n');
                          const code = lines.slice(1, -1).join('\n');
                          return (
                            <pre key={idx} className="p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-xs overflow-auto">
                              <code>{code}</code>
                            </pre>
                          );
                        }
                        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                          const items = trimmed.split('\n');
                          return (
                            <ul key={idx} className="list-disc pl-5 space-y-1">
                              {items.map((item, i) => (
                                <li key={i}>{item.replace(/^[-*]\s+/, '')}</li>
                              ))}
                            </ul>
                          );
                        }
                        return <p key={idx}>{trimmed}</p>;
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* 6. OFFICE DOCUMENT PREVIEW (.docx, .xlsx, .pptx) */}
              {activeMode === 'office' && (
                <div className="flex-1 flex flex-col h-full overflow-hidden p-6 md:p-8 max-w-3xl mx-auto w-full">
                  <div className="bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-md mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                        <FileText className="w-7 h-7" />
                      </div>
                      <div className="flex-1 truncate">
                        <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">{node.name}</h4>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Format: .{node.name.split('.').pop()?.toUpperCase()} • {formatBytes(node.size, displayUnits)}
                        </p>
                      </div>
                      <button
                        onClick={handleOpenSystem}
                        className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-2 shadow-xs transition-colors shrink-0"
                      >
                        <Monitor className="w-4 h-4" />
                        <span>Open in Desktop Office</span>
                      </button>
                    </div>
                  </div>

                  {/* Extracted Text Content (for .docx) */}
                  {docSummary ? (
                    <div className="flex-1 flex flex-col bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 overflow-hidden">
                      <h5 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        Extracted Document Text
                      </h5>
                      <div className="flex-1 overflow-auto font-sans text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap select-text pr-2">
                        {docSummary}
                      </div>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-800 rounded-2xl">
                      <FileText className="w-12 h-12 text-slate-400 mb-3" />
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                        Ready to view with your Desktop Application
                      </p>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm">
                        You can open this document directly in Microsoft Office, LibreOffice, or inspect its raw binary contents.
                      </p>
                      <div className="flex items-center gap-3 mt-4">
                        <button
                          onClick={handleOpenSystem}
                          className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1.5"
                        >
                          <Monitor className="w-3.5 h-3.5" />
                          <span>Open in System App</span>
                        </button>
                        <button
                          onClick={() => setActiveMode('hex')}
                          className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-300 dark:hover:bg-slate-700 flex items-center gap-1.5"
                        >
                          <Binary className="w-3.5 h-3.5" />
                          <span>View in Hex Inspector</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 7. VIDEO PLAYER */}
              {activeMode === 'video' && streamUrl && (
                <div className="flex-1 flex flex-col h-full items-center justify-center p-6 bg-black">
                  <video
                    ref={videoRef}
                    src={streamUrl}
                    controls
                    className="max-h-[70vh] max-w-full rounded-xl shadow-2xl"
                  />
                  {/* Speed Controls */}
                  <div className="mt-4 flex items-center gap-2 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                    <span className="text-slate-500 font-semibold">Speed:</span>
                    {[0.5, 1, 1.25, 1.5, 2].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => {
                          setPlaybackRate(rate);
                          if (videoRef.current) videoRef.current.playbackRate = rate;
                        }}
                        className={`px-2 py-0.5 rounded-md font-mono ${
                          playbackRate === rate ? 'bg-blue-600 text-white font-bold' : 'hover:bg-slate-800'
                        }`}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 8. AUDIO PLAYER */}
              {activeMode === 'audio' && streamUrl && (
                <div className="flex-1 flex flex-col items-center justify-center p-8">
                  <div className="p-8 bg-white dark:bg-[#151f33] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl w-full max-w-md text-center flex flex-col items-center">
                    <div className="w-20 h-20 rounded-2xl bg-pink-500/10 text-pink-500 flex items-center justify-center mb-4 shadow-inner">
                      <Music className="w-10 h-10 animate-pulse" />
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 truncate max-w-xs">
                      {node.name}
                    </h4>
                    <p className="text-xs text-slate-500 mb-6">
                      {formatBytes(node.size, displayUnits)} • Audio Stream
                    </p>
                    <audio src={streamUrl} controls className="w-full" />
                  </div>
                </div>
              )}

              {/* 9. PROFESSIONAL HEX & BINARY INSPECTOR */}
              {activeMode === 'hex' && hexBytes && (
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0f1d] text-slate-200">
                  <div className="px-4 py-2 border-b border-slate-800 bg-[#0f172a] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-mono text-slate-400">
                      <span className="text-blue-400 font-bold">Offset</span>
                      <span>|</span>
                      <span>16 Bytes (Hex)</span>
                      <span>|</span>
                      <span>Decoded Text</span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      Showing first {formatBytes(hexBytes.length, displayUnits)}
                    </div>
                  </div>

                  <div className="flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed select-text space-y-0.5">
                    {Array.from({ length: Math.ceil(hexBytes.length / 16) }).map((_, lineIdx) => {
                      const offset = lineIdx * 16;
                      const slice = hexBytes.slice(offset, offset + 16);
                      const hexParts: string[] = [];
                      let ascii = '';

                      for (let i = 0; i < 16; i++) {
                        if (i < slice.length) {
                          const byte = slice[i];
                          hexParts.push(byte.toString(16).padStart(2, '0').toUpperCase());
                          ascii += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '·';
                        } else {
                          hexParts.push('  ');
                          ascii += ' ';
                        }
                      }

                      const offsetHex = offset.toString(16).padStart(8, '0').toUpperCase();

                      return (
                        <div key={lineIdx} className="flex hover:bg-slate-800/40 rounded px-1 transition-colors">
                          <span className="text-slate-500 mr-4 select-none">{offsetHex}</span>
                          <span className="text-sky-400 mr-2">{hexParts.slice(0, 8).join(' ')}</span>
                          <span className="text-cyan-400 mr-4">{hexParts.slice(8, 16).join(' ')}</span>
                          <span className="text-emerald-400/90 font-mono tracking-widest">{ascii}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
