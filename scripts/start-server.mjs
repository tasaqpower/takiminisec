import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const port = process.env.PORT || '10000';
const host = '0.0.0.0';
const cli = fileURLToPath(new URL('../node_modules/vinext/dist/cli.js', import.meta.url));

const proc = spawn(process.execPath, [cli, 'start', '--port', port, '--host', host], {
  stdio: 'inherit'
});

proc.on('exit', (code) => process.exit(code ?? 0));
proc.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
