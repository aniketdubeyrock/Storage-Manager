import { describe, it, expect } from 'vitest';
import {
  normalizePath,
  getParentPath,
  getBaseName,
  joinPath,
  splitPath,
  isDescendantOf,
} from '../../utils/pathUtils';

describe('pathUtils', () => {
  it('normalizes paths correctly with slashes', () => {
    expect(normalizePath('///')).toBe('/');
    expect(normalizePath('')).toBe('/');
    expect(normalizePath('folder\\subfolder')).toBe('/folder/subfolder');
    expect(normalizePath('/docs/report.pdf/')).toBe('/docs/report.pdf');
  });

  it('retrieves parent path accurately', () => {
    expect(getParentPath('/')).toBe('/');
    expect(getParentPath('/documents')).toBe('/');
    expect(getParentPath('/documents/projects/code')).toBe('/documents/projects');
  });

  it('retrieves base name accurately', () => {
    expect(getBaseName('/')).toBe('');
    expect(getBaseName('/documents/resume.pdf')).toBe('resume.pdf');
    expect(getBaseName('/photos')).toBe('photos');
  });

  it('splits paths into clean segments', () => {
    expect(splitPath('/')).toEqual([]);
    expect(splitPath('/var/log/nginx.log')).toEqual(['var', 'log', 'nginx.log']);
  });

  it('joins path segments cleanly', () => {
    expect(joinPath('/home', 'user', 'docs')).toBe('/home/user/docs');
    expect(joinPath('/', 'documents')).toBe('/documents');
  });

  it('detects descendant relationship to prevent cyclic moves', () => {
    expect(isDescendantOf('/projects/react/src', '/projects/react')).toBe(true);
    expect(isDescendantOf('/projects/react', '/projects/react')).toBe(false);
    expect(isDescendantOf('/other/path', '/projects/react')).toBe(false);
    expect(isDescendantOf('/projects', '/projects/sub')).toBe(false);
  });
});

