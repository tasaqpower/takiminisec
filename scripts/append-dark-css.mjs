import fs from 'node:fs';

const darkCss = `

/* ==========================================================================
   DARK MODE THEME
   ========================================================================== */
html.dark, [data-theme="dark"] {
  --background: #0f111a;
  --foreground: #f1f5f9;
  --card: #181c28;
  --card-foreground: #f1f5f9;
  --popover: #181c28;
  --popover-foreground: #f1f5f9;
  --primary: #7c6cf0;
  --primary-foreground: #ffffff;
  --secondary: #212638;
  --secondary-foreground: #e2e8f0;
  --muted: #1e2333;
  --muted-foreground: #94a3b8;
  --accent: #2c294d;
  --accent-foreground: #c4b5fd;
  --border: #293044;
  --input: #293044;
  --ring: #7c6cf0;
  --sidebar: #131622;
  --sidebar-foreground: #94a3b8;
  --sidebar-primary: #7c6cf0;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #222638;
  --sidebar-accent-foreground: #e2e8f0;
  --sidebar-border: #222638;
  --sidebar-ring: #7c6cf0;
}

html.dark body {
  background-color: #0f111a !important;
  color: #f1f5f9 !important;
}

html.dark .forma-sidebar {
  background-color: #131622 !important;
  border-color: #222638 !important;
}

html.dark .brand a {
  color: #f8fafc !important;
}

html.dark .topbar {
  background-color: #131622 !important;
  border-color: #222638 !important;
}

html.dark .breadcrumb {
  color: #94a3b8 !important;
}
html.dark .breadcrumb strong {
  color: #e2e8f0 !important;
}

html.dark .upload-zone {
  background: radial-gradient(ellipse at 50% 12%, #1e1b4b 0%, #121522 75%) !important;
  border-color: #4338ca !important;
}

html.dark .upload-zone h2 {
  color: #f8fafc !important;
}

html.dark .upload-zone > p {
  color: #94a3b8 !important;
}

html.dark .file-tile {
  background: #1a1e2d !important;
  border-color: #2b3248 !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
}

html.dark .tool-card {
  background: #181c28 !important;
  border-color: #262c3e !important;
}

html.dark .tool-card:hover {
  background: #1e2333 !important;
  border-color: #6366f1 !important;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5) !important;
}

html.dark .tool-card h3 {
  color: #f1f5f9 !important;
}

html.dark .tool-card p {
  color: #94a3b8 !important;
}

html.dark .file-type {
  background: #222738 !important;
  color: #94a3b8 !important;
}

html.dark .start-strip {
  background: #151824 !important;
  border-color: #242a3c !important;
}

html.dark .strip-icon {
  background: #1f2436 !important;
  border-color: #2e354b !important;
  color: #a78bfa !important;
}

html.dark .start-strip h3 {
  color: #f1f5f9 !important;
}

html.dark .start-strip p {
  color: #94a3b8 !important;
}

html.dark .local-card {
  background: linear-gradient(140deg, #181730, #131622) !important;
  border-color: #2b2848 !important;
}

html.dark .local-card strong {
  color: #e2e8f0 !important;
}

html.dark .local-card p {
  color: #94a3b8 !important;
}

html.dark .category-tabs {
  background: #181c28 !important;
  border-color: #262c3e !important;
}

html.dark .category-tabs button {
  color: #94a3b8 !important;
}

html.dark .category-tabs button[data-state="active"] {
  background: #293046 !important;
  color: #ffffff !important;
}

html.dark .secondary {
  background: #1b1f2e !important;
  border-color: #2a3146 !important;
  color: #e2e8f0 !important;
}

html.dark .secondary:hover {
  background: #252b3f !important;
  color: #ffffff !important;
}

html.dark .dashboard-footer {
  color: #64748b !important;
}

html.dark .editor-heading {
  background: #131622 !important;
  border-color: #222638 !important;
}

html.dark .editor-title input {
  color: #f8fafc !important;
}

html.dark .editor-title span {
  color: #94a3b8 !important;
}

html.dark .editor-toolbar {
  background: #131622 !important;
  border-color: #222638 !important;
}

html.dark .tool-buttons > button {
  color: #94a3b8 !important;
}

html.dark .tool-buttons > button:hover {
  background: #1e2333 !important;
  color: #f1f5f9 !important;
}

html.dark .tool-buttons > button.active {
  background: #2f2a5e !important;
  color: #c4b5fd !important;
}

html.dark .pdf-workarea, html.dark .word-workarea {
  background: #090b10 !important;
}

html.dark .page-panel {
  background: #131622 !important;
  border-color: #222638 !important;
}

html.dark .page-thumb {
  background: #181c28 !important;
  border-color: #293046 !important;
  color: #94a3b8 !important;
}

html.dark .page-thumb.active {
  border-color: #7c6cf0 !important;
  background: #221e3f !important;
}

html.dark .page-bottom {
  background: #131622 !important;
  border-color: #222638 !important;
}

html.dark .icon-button {
  color: #94a3b8 !important;
}

html.dark .icon-button:hover {
  background: #1e2333 !important;
  color: #7c6cf0 !important;
}

html.dark .toolbar-divider {
  background: #252c3f !important;
}
`;

fs.appendFileSync('app/globals.css', darkCss, 'utf8');
console.log('Appended dark mode styles to app/globals.css');
