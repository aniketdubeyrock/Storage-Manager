import type { DisplayUnit } from '../types/settings.types';

export function formatBytes(
  bytes: number,
  unit: DisplayUnit = 'binary',
  decimals = 2
): string {
  if (bytes === 0) return '0 B';
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';

  const k = unit === 'binary' ? 1024 : 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const binarySizes = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const decimalSizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const sizes = unit === 'binary' ? binarySizes : decimalSizes;

  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const safeIndex = Math.min(i, sizes.length - 1);
  const value = bytes / Math.pow(k, safeIndex);

  return `${parseFloat(value.toFixed(dm))} ${sizes[safeIndex]}`;
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat().format(num);
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '—';
  const now = Date.now();
  const diffSec = Math.floor((now - timestamp) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 2592000) return `${Math.floor(diffSec / 86400)}d ago`;
  return formatDate(timestamp);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${(ms / 1000).toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

