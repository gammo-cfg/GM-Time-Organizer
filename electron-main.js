'use strict';

/**
 * Electron main process.
 *
 * Starts the existing zero-dependency server as a child process, then opens
 * a native window pointing at http://127.0.0.1:4777. No browser involved.
 *
 * 100% portable behaviour:
 *   - data/ folder lives next to the .exe (packaged) or next to server.js (dev)
 *   - profile/ folder (Chromium cache) also lives next to the .exe (packaged)
 *   - Nothing is ever written to %APPDATA%, registry, or Program Files
 */

const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('node:path');
const { spawn } = require('node:child_process');
const http = require('node:http');

const HOST = '127.0.0.1';
const PORT = 4777;
const URL = 'http://' + HOST + ':' + PORT;

const SERVER_PATH = path.join(app.getAppPath(), 'server.js');

const APP_DIR = app.isPackaged
  ? path.dirname(app.getPath('exe'))
  : app.getAppPath();

const DATA_DIR = path.join(APP_DIR, 'data');
const PROFILE_DIR = path.join(APP_DIR, 'profile');

// Force Chromium userData (cache, GPU, session state) into the portable folder.
// MUST be called before app.whenReady() — Electron reads this path early.
try {
  app.setPath('userData', PROFILE_DIR);
} catch (e) {
  console.error('Could not set userData path:', e);
}

let serverProcess = null;
let mainWindow = null;
let stopping = false;

function startServer() {
  return new Promise((resolve, reject) => {
    const env = Object.assign({}, process.env, {
      TIME_ORGANIZER_DATA: DATA_DIR,
      PORT: String(PORT),
      NO_OPEN: '1',
      ELECTRON_RUN_AS_NODE: '1'
    });

    serverProcess = spawn(process.execPath, [SERVER_PATH], {
      env: env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    let resolved = false;

    serverProcess.stdout.on('data', function (buf) {
      process.stdout.write('[server] ' + buf.toString());
    });
    serverProcess.stderr.on('data', function (buf) {
      process.stderr.write('[server!] ' + buf.toString());
    });
    serverProcess.on('exit', function (code) {
      if (!resolved && code !== 0 && !stopping) {
        reject(new Error('Server exited with code ' + code));
      }
    });

    const startedAt = Date.now();
    function poll() {
      if (stopping) return;
      const req = http.get(URL + '/api/health', function (r) {
        if (r.statusCode === 200) {
          if (!resolved) { resolved = true; resolve(); }
          r.resume();
        } else {
          r.resume();
          retry();
        }
      });
      req.on('error', retry);
    }
    function retry() {
      if (Date.now() - startedAt > 15000) {
        if (!resolved) reject(new Error('Server did not start within 15s'));
        return;
      }
      setTimeout(poll, 200);
    }
    poll();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#16150F',
    title: 'GM-Time-Organizer',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true
    }
  });

  mainWindow.once('ready-to-show', function () {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(function (details) {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', function (event, url) {
    if (!url.startsWith(URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(URL);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function stopServer() {
  if (!serverProcess) return;
  stopping = true;
  try { serverProcess.kill(); } catch (e) {}
  serverProcess = null;
}

app.whenReady().then(async function () {
  Menu.setApplicationMenu(null);
  try {
    await startServer();
  } catch (e) {
    console.error('Failed to start embedded server:', e);
    dialog.showErrorBox('Time Organizer could not start', String(e && e.message ? e.message : e));
    app.quit();
    return;
  }
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  stopServer();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', function () {
  stopServer();
});
