/**
 * Portable path discovery utility for FORMA test suites and packaging.
 * Eliminates hardcoded user directories and platform-specific assumptions.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function getProjectRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..');
}

export function findNodeBinary() {
  if (process.env.NODE_BIN && fs.existsSync(process.env.NODE_BIN)) {
    return process.env.NODE_BIN;
  }
  const currentMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (currentMajor >= 22) {
    return process.execPath;
  }
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (home) {
    const candidate = path.join(home, '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'bin', process.platform === 'win32' ? 'node.exe' : 'node');
    if (fs.existsSync(candidate)) return candidate;
  }
  return process.execPath;
}

export function findChromeBinary() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  if (process.platform === 'win32') {
    const candidates = [
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Google/Chrome/Application/chrome.exe'),
      process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Google/Chrome/Application/chrome.exe'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
      process.env.PROGRAMW6432 && path.join(process.env.PROGRAMW6432, 'Google/Chrome/Application/chrome.exe'),
      process.env.PROGRAMFILES && path.join(process.env.PROGRAMFILES, 'Microsoft/Edge/Application/msedge.exe'),
      process.env['PROGRAMFILES(X86)'] && path.join(process.env['PROGRAMFILES(X86)'], 'Microsoft/Edge/Application/msedge.exe')
    ].filter(Boolean);
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else if (process.platform === 'darwin') {
    const candidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium'
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) return c;
    }
  } else {
    const candidates = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
    for (const c of candidates) {
      try {
        const p = execSync(`which ${c}`, { encoding: 'utf-8' }).trim();
        if (p && fs.existsSync(p)) return p;
      } catch {}
    }
  }
  return 'chrome';
}

export function getTempDir(prefix = 'forma_v72_') {
  return path.join(os.tmpdir(), prefix + Date.now() + '_' + Math.random().toString(36).substring(2, 8));
}

export function getArtifactDir(projectRoot) {
  if (process.env.FORMA_ARTIFACT_DIR && fs.existsSync(process.env.FORMA_ARTIFACT_DIR)) {
    return path.resolve(process.env.FORMA_ARTIFACT_DIR);
  }
  const convId = process.env.FORMA_CONVERSATION_ID || '094b1c26-b9f9-4b08-93a4-797170dbff1b';
  const home = process.env.USERPROFILE || process.env.HOME || '';
  if (home) {
    const candidate = path.join(home, '.gemini', 'antigravity', 'brain', convId);
    if (fs.existsSync(candidate)) return candidate;
    const defaultBrainDir = path.join(home, '.gemini', 'antigravity', 'brain');
    if (fs.existsSync(defaultBrainDir)) {
      try {
        const convs = fs.readdirSync(defaultBrainDir)
          .map(c => ({ name: c, full: path.join(defaultBrainDir, c), stat: fs.statSync(path.join(defaultBrainDir, c)) }))
          .filter(c => c.stat.isDirectory() && c.name !== 'scratch')
          .sort((a, b) => b.stat.mtimeMs - a.mtimeMs);
        if (convs.length > 0) return convs[0].full;
      } catch {}
    }
  }
  return path.join(projectRoot, 'outputs', 'v72-evidence');
}
