import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Home,
  ArrowLeft,
  ArrowRight,
  LayoutList,
  LayoutGrid,
  Copy,
  Check,
  Monitor,
} from 'lucide-react';
import { splitPath } from '../../utils/pathUtils';
import { useFileManagerStore } from '../../stores/fileManager.store';
import toast from 'react-hot-toast';

interface BreadcrumbBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const BreadcrumbBar: React.FC<BreadcrumbBarProps> = ({ currentPath, onNavigate }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = React.useState(false);
  const segments = splitPath(currentPath);

  const viewMode = useFileManagerStore((s) => s.viewMode);
  const setViewMode = useFileManagerStore((s) => s.setViewMode);
  const navigateBack = useFileManagerStore((s) => s.navigateBack);
  const navigateForward = useFileManagerStore((s) => s.navigateForward);
  const history = useFileManagerStore((s) => s.history);
  const historyIndex = useFileManagerStore((s) => s.historyIndex);

  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;

  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentPath);
    setCopied(true);
    toast.success('Path copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 flex items-center justify-between gap-3 text-xs">
      {/* Navigation history arrows & breadcrumb links */}
      <div className="flex items-center gap-1.5 overflow-hidden flex-1">
        <div className="flex items-center gap-1 shrink-0 mr-1">
          <button
            onClick={navigateBack}
            disabled={!canBack}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Go back"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <button
            onClick={navigateForward}
            disabled={!canForward}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-30 disabled:hover:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
            title="Go forward"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* This PC */}
        <button
          onClick={() => navigate('/this-pc')}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors shrink-0 font-medium"
          title="This PC"
        >
          <Monitor className="w-3.5 h-3.5 text-blue-500" />
          <span>This PC</span>
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />

        {/* Root home */}
        <button
          onClick={() => onNavigate('/')}
          className={`flex items-center gap-1 px-2 py-1 rounded-lg transition-colors shrink-0 ${
            currentPath === '/'
              ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Root</span>
        </button>

        {/* Path segments */}
        {segments.map((seg, idx) => {
          const subPath = '/' + segments.slice(0, idx + 1).join('/');
          const isLast = idx === segments.length - 1;

          return (
            <React.Fragment key={subPath}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                onClick={() => onNavigate(subPath)}
                className={`px-2 py-1 rounded-lg transition-colors truncate max-w-[150px] shrink-0 ${
                  isLast
                    ? 'font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800'
                }`}
                title={seg}
              >
                {seg}
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Right controls: copy path & view toggles */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleCopyPath}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
          title="Copy path"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700" />

        <div className="flex items-center bg-slate-200/80 dark:bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'list'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            title="List view"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-md transition-all ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
            title="Grid view"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

