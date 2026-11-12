import { describe, it, expect, beforeEach } from 'vitest';
import { AppTrashManager } from '../../services/trash/appTrashManager';

describe('AppTrashManager', () => {
  let trashManager: AppTrashManager;

  beforeEach(async () => {
    trashManager = new AppTrashManager();
    await trashManager.empty();
  });

  it('adds items to the trash ledger and lists them', async () => {
    const item = await trashManager.add({
      name: 'old_contract.pdf',
      originalPath: '/Documents/Contracts/old_contract.pdf',
      parentPath: '/Documents/Contracts',
      size: 450000,
      extension: 'pdf',
      mimeType: 'application/pdf',
      isDirectory: false,
      restorePath: '/Documents/Contracts/old_contract.pdf',
    });

    expect(item.id).toBeDefined();
    expect(item.name).toBe('old_contract.pdf');

    const list = await trashManager.list();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe('old_contract.pdf');
  });

  it('removes items permanently from the trash ledger', async () => {
    const item = await trashManager.add({
      name: 'temp.log',
      originalPath: '/Logs/temp.log',
      parentPath: '/Logs',
      size: 12000,
      extension: 'log',
      mimeType: 'text/plain',
      isDirectory: false,
    });

    let list = await trashManager.list();
    expect(list.length).toBe(1);

    await trashManager.removePermanently(item.id);
    list = await trashManager.list();
    expect(list.length).toBe(0);
  });

  it('empties all items from the trash ledger', async () => {
    await trashManager.add({
      name: 'file1.txt',
      originalPath: '/file1.txt',
      parentPath: '/',
      size: 100,
      extension: 'txt',
      mimeType: 'text/plain',
      isDirectory: false,
    });

    await trashManager.add({
      name: 'file2.txt',
      originalPath: '/file2.txt',
      parentPath: '/',
      size: 200,
      extension: 'txt',
      mimeType: 'text/plain',
      isDirectory: false,
    });

    const initialList = await trashManager.list();
    expect(initialList.length).toBe(2);

    const clearedCount = await trashManager.empty();
    expect(clearedCount).toBe(2);

    const finalList = await trashManager.list();
    expect(finalList.length).toBe(0);
  });
});

