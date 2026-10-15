import fs from 'fs';

const logPath = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\.system_generated\\logs\\transcript_full.jsonl';
const stat = fs.statSync(logPath);
const bufferSize = Math.min(stat.size, 1024 * 1024); // last 1MB
const buffer = Buffer.alloc(bufferSize);
const fd = fs.openSync(logPath, 'r');
fs.readSync(fd, buffer, 0, bufferSize, stat.size - bufferSize);
fs.closeSync(fd);

const text = buffer.toString('utf8');
const lines = text.split('\n');
for (let i = lines.length - 1; i >= 0; i--) {
  const line = lines[i].trim();
  if (!line) continue;
  try {
    const data = JSON.parse(line);
    if (data.type === 'USER_INPUT') {
      console.log('--- FOUND USER_INPUT at step:', data.step_index, '---');
      fs.writeFileSync('last_user_prompt.txt', data.content, 'utf8');
      console.log('Saved to last_user_prompt.txt (length:', data.content.length, ')');
      break;
    }
  } catch (e) {
    // ignore partial lines
  }
}
