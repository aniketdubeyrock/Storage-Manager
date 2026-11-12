import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { DashboardPage } from '../pages/DashboardPage';
import { FileManagerPage } from '../pages/FileManagerPage';
import { StorageAnalysisPage } from '../pages/StorageAnalysisPage';
import { LargestFilesPage } from '../pages/LargestFilesPage';
import { LargestFoldersPage } from '../pages/LargestFoldersPage';
import { FileTypesPage } from '../pages/FileTypesPage';
import { DuplicateFinderPage } from '../pages/DuplicateFinderPage';
import { TrashPage } from '../pages/TrashPage';
import { SettingsPage } from '../pages/SettingsPage';
import { GoogleDrivePage } from '../pages/GoogleDrivePage';
import { ThisPcPage } from '../pages/ThisPcPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'this-pc', element: <ThisPcPage /> },
      { path: 'my-computer', element: <ThisPcPage /> },
      { path: 'files', element: <FileManagerPage /> },
      { path: 'analysis', element: <StorageAnalysisPage /> },
      { path: 'largest-files', element: <LargestFilesPage /> },
      { path: 'largest-folders', element: <LargestFoldersPage /> },
      { path: 'file-types', element: <FileTypesPage /> },
      { path: 'duplicates', element: <DuplicateFinderPage /> },
      { path: 'trash', element: <TrashPage /> },
      { path: 'google-drive', element: <GoogleDrivePage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <DashboardPage /> },
    ],
  },
]);

