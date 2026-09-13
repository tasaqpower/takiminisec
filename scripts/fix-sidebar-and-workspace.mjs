import fs from 'node:fs';

let css = fs.readFileSync('app/globals.css', 'utf8');

// Replace nav-item styles to ensure auto height, proper padding, no text collision, and unsquashed badges
const navFix = `
.nav-item {
  font-size: 13px !important;
  min-height: 38px !important;
  height: auto !important;
  border-radius: 8px !important;
  padding: 8px 12px !important;
  gap: 10px !important;
  font-weight: 500 !important;
  display: flex !important;
  align-items: center !important;
  line-height: 1.3 !important;
}
.nav-item > span:not(.nav-new) {
  flex: 1 1 auto !important;
  min-width: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
}
.nav-new {
  margin-left: auto !important;
  flex-shrink: 0 !important;
  white-space: nowrap !important;
  background: #ede9fe !important;
  color: #6d28d9 !important;
  padding: 2px 7px !important;
  border-radius: 6px !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  line-height: 1.2 !important;
}
html.dark .nav-new {
  background: #2e265c !important;
  color: #c4b5fd !important;
  border: 1px solid #4338ca44 !important;
}
html.dark .nav-item {
  color: #cbd5e1 !important;
}
html.dark .nav-item:hover {
  background: #1e2335 !important;
  color: #ffffff !important;
}
html.dark .nav-item[data-active=true] {
  color: #a78bfa !important;
  background: #252048 !important;
  font-weight: 600 !important;
}
html.dark .nav-caption {
  color: #64748b !important;
}

/* File screen / workspace dark mode perfection */
html.dark .editor-shell {
  background-color: #0b0d14 !important;
}
html.dark .editor-heading {
  background-color: #121522 !important;
  border-bottom: 1px solid #222638 !important;
}
html.dark .editor-heading input {
  color: #f8fafc !important;
  background: transparent !important;
}
html.dark .editor-heading span {
  color: #94a3b8 !important;
}
html.dark .editor-toolbar {
  background-color: #121522 !important;
  border-bottom: 1px solid #222638 !important;
}
html.dark .tool-buttons > button {
  color: #94a3b8 !important;
}
html.dark .tool-buttons > button:hover {
  background-color: #1c2133 !important;
  color: #f1f5f9 !important;
}
html.dark .tool-buttons > button.active {
  background-color: #2f2a5e !important;
  color: #c4b5fd !important;
}
html.dark .pdf-workarea, html.dark .word-workarea {
  background-color: #080a10 !important;
}
html.dark .page-panel {
  background-color: #121522 !important;
  border-right: 1px solid #222638 !important;
}
html.dark .panel-heading {
  color: #cbd5e1 !important;
}
html.dark .panel-heading span {
  background-color: #1c2133 !important;
  color: #94a3b8 !important;
}
html.dark .page-thumb {
  background-color: #181c2b !important;
  border-color: #272d42 !important;
  color: #94a3b8 !important;
}
html.dark .page-thumb.active {
  border-color: #7c6cf0 !important;
  background-color: #252048 !important;
  color: #c4b5fd !important;
}
html.dark .page-bottom {
  background-color: #121522 !important;
  border-top: 1px solid #222638 !important;
  color: #94a3b8 !important;
}
html.dark .page-hint {
  color: #64748b !important;
}
html.dark .zoom-label {
  color: #94a3b8 !important;
}
html.dark .toolbar-divider {
  background-color: #252b3e !important;
}
html.dark .icon-button {
  color: #94a3b8 !important;
}
html.dark .icon-button:hover {
  background-color: #1c2133 !important;
  color: #7c6cf0 !important;
}
.pdf-surface .inline-text-editor {
  color: #000000 !important;
}
`;

fs.appendFileSync('app/globals.css', navFix, 'utf8');
console.log('Appended layout & dark mode fixes to app/globals.css');
