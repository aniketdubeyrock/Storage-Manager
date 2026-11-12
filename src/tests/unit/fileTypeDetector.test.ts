import { describe, it, expect } from 'vitest';
import {
  extractExtension,
  detectCategory,
  isPreviewable,
  getMimeType,
} from '../../services/filesystem/fileTypeDetector';

describe('fileTypeDetector', () => {
  it('extracts extensions reliably', () => {
    expect(extractExtension('document.pdf')).toBe('pdf');
    expect(extractExtension('archive.tar.gz')).toBe('gz');
    expect(extractExtension('noextension')).toBe('');
    expect(extractExtension('.gitignore')).toBe('gitignore');
  });

  it('categorizes extensions into accurate buckets', () => {
    expect(detectCategory('photo.JPG')).toBe('images');
    expect(detectCategory('movie.mp4')).toBe('videos');
    expect(detectCategory('song.flac')).toBe('audio');
    expect(detectCategory('sheet.xlsx')).toBe('documents');
    expect(detectCategory('bundle.zip')).toBe('archives');
    expect(detectCategory('script.tsx')).toBe('code');
    expect(detectCategory('setup.exe')).toBe('applications');
    expect(detectCategory('unknown.xyz')).toBe('other');
  });

  it('determines in-browser previewability', () => {
    expect(isPreviewable('image.png').canPreview).toBe(true);
    expect(isPreviewable('notes.md').canPreview).toBe(true);
    expect(isPreviewable('app.exe').canPreview).toBe(false);
  });

  it('provides default mime types', () => {
    expect(getMimeType('style.css')).toBe('text/css');
    expect(getMimeType('data.json')).toBe('application/json');
    expect(getMimeType('custom.bin')).toBe('application/octet-stream');
  });
});

