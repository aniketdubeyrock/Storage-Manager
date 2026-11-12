# Storage Manager — Comprehensive Setup Guide 🚀

This document provides step-by-step instructions for running and installing **Storage Manager** both as a **standalone Windows Desktop `.exe` Software** and as a **Web Browser Application**.

---

## Table of Contents
- [🖥️ Desktop Version (.exe) Setup Guide](#️-desktop-version-exe-setup-guide)
  - [Option A: Install via Setup Wizard (Recommended for Users)](#option-a-install-via-setup-wizard-recommended-for-users)
  - [Option B: Run Standalone Portable Executable (No Install)](#option-b-run-standalone-portable-executable-no-install)
  - [Option C: Build .exe from Source (For Developers)](#option-c-build-exe-from-source-for-developers)
- [🌐 Web Application Setup Guide](#-web-application-setup-guide)
  - [Prerequisites](#prerequisites)
  - [Step 1: Clone & Install Dependencies](#step-1-clone--install-dependencies)
  - [Step 2: Start Development Server](#step-2-start-development-server)
  - [Step 3: Access in Browser](#step-3-access-in-browser)
- [☁️ Google Drive Cloud Integration Setup](#️-google-drive-cloud-integration-setup)
- [🧪 Running Automated Tests](#-running-automated-tests)
- [❓ Troubleshooting & FAQ](#-troubleshooting--faq)

---

## 🖥️ Desktop Version (.exe) Setup Guide

### Option A: Install via Setup Wizard (Recommended for Users)

If you have downloaded the installer file:

1. Locate **`Storage Manager Setup 1.0.0.exe`** (in the `release/` folder or downloaded from GitHub Releases).
2. **Double-click** the setup file.
3. The Windows installer wizard will launch:
   - Select your desired installation folder (defaults to `C:\Users\<user>\AppData\Local\Programs\storage-manager`).
   - Click **Install**.
4. Once installation completes, **Storage Manager** will automatically launch.
5. A **Storage Manager** shortcut will be placed on your **Desktop** and added to your **Windows Start Menu**.

> [!TIP]
> You can uninstall or modify the installation anytime via Windows **Settings $\rightarrow$ Apps $\rightarrow$ Installed Apps $\rightarrow$ Storage Manager**.

---

### Option B: Run Standalone Portable Executable (No Install)

If you prefer zero installation (e.g. running directly from a USB flash drive or desktop):

1. Locate **`Storage Manager 1.0.0.exe`** (portable version).
2. **Double-click** the file.
3. The software launches immediately without making any permanent system changes or writing to `Program Files`.

---

### Option C: Build `.exe` from Source (For Developers)

To compile your own executable from source code:

#### 1. Install Dependencies
```powershell
npm install
```

#### 2. Test in Desktop Development Mode (Live Hot-Reload)
```powershell
npm run electron:dev
```
*This starts the Vite web server and launches the native Electron desktop window in parallel.*

#### 3. Build the Single-File Installer `.exe`
```powershell
npm run electron:build:nsis
```
*Output: `release/Storage Manager Setup 1.0.0.exe`*

#### 4. Build the Single-File Portable `.exe`
```powershell
npm run electron:build:portable
```
*Output: `release/Storage Manager 1.0.0.exe`*

---

## 🌐 Web Application Setup Guide

### Prerequisites
- **Node.js**: v18.0.0 or higher ([Download Node.js](https://nodejs.org/))
- **npm**: v9.0.0 or higher (included with Node.js)
- **Browser**: Google Chrome, Microsoft Edge, Brave, or Opera (any Chromium-based browser supporting the modern File System Access API).

---

### Step 1: Clone & Install Dependencies

Open PowerShell, Command Prompt, or Terminal:

```bash
# Clone the repository
git clone https://github.com/aniketdubeyrock/Storage-Manager.git

# Enter project directory
cd Storage-Manager

# Install required packages
npm install
```

---

### Step 2: Start Development Server

```bash
npm run dev
```

You should see output similar to:
```text
  VITE v8.3.8  ready in 320 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

---

### Step 3: Access in Browser

1. Open your browser and navigate to:
   ```text
   http://localhost:5173
   ```
2. **Accessing Local Drives & System Folders**:
   - Click on **This PC** in the sidebar to view all physical internal partitions (`C:`, `D:`, etc.) and quick access folders (*Downloads*, *Documents*, *Desktop*, *Pictures*, *Videos*, *Music*).
   - Double-click any drive or folder to immediately open it in the File Manager with instant progressive sizing (< 50ms).
3. **Using Browser Folder Picker**:
   - Click **Scan Storage** in the top navigation bar.
   - Choose any directory on your computer to grant browser access.

---

## ☁️ Google Drive Cloud Integration Setup

Storage Manager includes integrated cloud backup to Google Drive. To connect your Google account:

### 1. Create Google Cloud OAuth Client ID (1-Minute Setup)
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project (e.g. `storage-manager`).
3. Enable the **Google Drive API**:
   - Go to **APIs & Services $\rightarrow$ Library $\rightarrow$ Google Drive API $\rightarrow$ Enable**.
4. Configure the **OAuth Consent Screen**:
   - Select **External** audience.
   - Fill in App Name (`Storage Manager`) and your email address.
   - Under **Test Users**, click **+ Add Users** and enter your Google email.
5. Create Credentials:
   - Go to **Credentials $\rightarrow$ + Create Credentials $\rightarrow$ OAuth client ID**.
   - Application Type: **Web application**.
   - Name: `Storage Manager Web Client`.
   - **Authorized JavaScript origins**:
     ```text
     http://localhost:5173
     ```
   - Click **Create** and copy your **Client ID** (ends with `.apps.googleusercontent.com`).

### 2. Connect in Storage Manager
1. Open Storage Manager and click **Google Drive** in the sidebar.
2. Paste your **Client ID** into the input field and click **Connect Google Drive**.
3. Sign in with your Google account.
4. All uploads will automatically be organized inside a dedicated **`Storage Manager`** folder in your Google Drive!

---

## 🧪 Running Automated Tests

Run the complete test suite (26 unit and integration tests):

```bash
# Run tests once:
npm run test

# Run tests in interactive watch mode:
npx vitest
```

---

## ❓ Troubleshooting & FAQ

### Q: Why did Google say "Google hasn't verified this app" during Drive login?
**A:** New Google Cloud developer projects are initially in "Testing" mode. 
1. Ensure your email is added under **Google Cloud Console $\rightarrow$ Audience / OAuth consent screen $\rightarrow$ Test users**.
2. When the warning appears, click **Advanced $\rightarrow$ Go to Storage Manager (unsafe) $\rightarrow$ Continue**.

### Q: Which browser works best for the Web version?
**A:** Google Chrome, Microsoft Edge, Brave, or Opera. Chromium browsers natively support the File System Access API. On Firefox or Safari, all physical drives and quick folders still work seamlessly via the Companion Engine!

### Q: Can I run both the Web version and Desktop version simultaneously?
**A:** **Yes!** The application is dual-mode. You can run `npm run dev` in the terminal for web development, and run `Storage Manager.exe` as native desktop software simultaneously.
