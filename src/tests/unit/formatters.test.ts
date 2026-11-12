import { describe, it, expect } from 'vitest';
import { formatBytes, formatDuration } from '../../utils/formatters';

describe('formatBytes', () => {
  it('formats zero bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(0, 'decimal')).toBe('0 B');
  });

  it('formats binary units correctly (1024 base)', () => {
    expect(formatBytes(1024, 'binary')).toBe('1 KiB');
    expect(formatBytes(1048576, 'binary')).toBe('1 MiB');
    expect(formatBytes(1073741824, 'binary')).toBe('1 GiB');
    expect(formatBytes(1536, 'binary', 1)).toBe('1.5 KiB');
  });

  it('formats decimal units correctly (1000 base)', () => {
    expect(formatBytes(1000, 'decimal')).toBe('1 KB');
    expect(formatBytes(1000000, 'decimal')).toBe('1 MB');
    expect(formatBytes(1000000000, 'decimal')).toBe('1 GB');
    expect(formatBytes(1500, 'decimal', 1)).toBe('1.5 KB');
  });

  it('handles negative or invalid values gracefully', () => {
    expect(formatBytes(-100)).toBe('0 B');
    expect(formatBytes(NaN)).toBe('0 B');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds and seconds', () => {
    expect(formatDuration(450)).toBe('450ms');
    expect(formatDuration(2500)).toBe('2.5s');
    expect(formatDuration(65000)).toBe('1m 5s');
  });
});

