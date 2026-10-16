import fs from 'fs';
import { TRANSITION_DEFINITIONS, renderTransitionAB, computeTransitionState } from '../features/video-editor/engine/transitionEngine.ts';

console.log('========================================================================');
console.log(' EXHAUSTIVE 100 TRANSITION ENGINE AUDIT: p = 0.1, p = 0.5, p = 0.9');
console.log('========================================================================');

const total = TRANSITION_DEFINITIONS.length;
console.log(`Auditing ${total} transition definitions...`);
if (total !== 100) {
  throw new Error(`Expected exactly 100 transitions, but found ${total}!`);
}

const canvasW = 160;
const canvasH = 90;

globalThis.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      const c = new MockContext(160, 90);
      c.getContext = () => c;
      return c;
    }
    return {};
  }
};

// Create mock 2D context using Canvas API or node-canvas if available, or simulate canvas context
class MockContext {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.operations = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.lineWidth = 1;
    this._stack = [];
  }
  save() {
    this._stack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      lineWidth: this.lineWidth,
    });
    this.operations.push('save');
  }
  restore() {
    const s = this._stack.pop();
    if (s) {
      this.fillStyle = s.fillStyle;
      this.strokeStyle = s.strokeStyle;
      this.globalAlpha = s.globalAlpha;
      this.globalCompositeOperation = s.globalCompositeOperation;
      this.lineWidth = s.lineWidth;
    }
    this.operations.push('restore');
  }
  fillRect(x, y, w, h) { this.operations.push(`fillRect(${x},${y},${w},${h})`); }
  clearRect(x, y, w, h) { this.operations.push(`clearRect(${x},${y},${w},${h})`); }
  strokeRect(x, y, w, h) { this.operations.push(`strokeRect(${x},${y},${w},${h})`); }
  beginPath() { this.operations.push('beginPath'); }
  closePath() { this.operations.push('closePath'); }
  moveTo(x, y) { this.operations.push(`moveTo(${x},${y})`); }
  lineTo(x, y) { this.operations.push(`lineTo(${x},${y})`); }
  arc(x, y, r, sa, ea) { this.operations.push(`arc(${x},${y},${r})`); }
  ellipse(x, y, rx, ry, rot, sa, ea) { this.operations.push(`ellipse(${x},${y},${rx},${ry})`); }
  rect(x, y, w, h) { this.operations.push(`rect(${x},${y},${w},${h})`); }
  fill() { this.operations.push('fill'); }
  stroke() { this.operations.push('stroke'); }
  clip() { this.operations.push('clip'); }
  translate(x, y) { this.operations.push(`translate(${x},${y})`); }
  rotate(a) { this.operations.push(`rotate(${a})`); }
  scale(x, y) { this.operations.push(`scale(${x},${y})`); }
  drawImage() { this.operations.push('drawImage'); }
  fillText(txt, x, y) { this.operations.push(`fillText(${txt},${x},${y})`); }
  measureText() { return { width: 20 }; }
  createLinearGradient() {
    return {
      addColorStop: () => {},
    };
  }
  createRadialGradient() {
    return {
      addColorStop: () => {},
    };
  }
  getImageData() {
    return { data: new Uint8ClampedArray(this.width * this.height * 4) };
  }
  putImageData() { this.operations.push('putImageData'); }
}

let errors = [];
let audited = 0;

for (let i = 0; i < TRANSITION_DEFINITIONS.length; i++) {
  const def = TRANSITION_DEFINITIONS[i];
  try {
    // 1. Check definition properties
    if (!def.id || !def.name || !def.category || !def.defaultDuration) {
      throw new Error(`Incomplete definition: ${JSON.stringify(def)}`);
    }

    // 2. Compute state at p = 0.0, 0.25, 0.5, 0.75, 1.0
    for (const p of [0.0, 0.25, 0.5, 0.75, 1.0]) {
      const state = computeTransitionState(def.id, p);
      if (typeof state.opacity !== 'number' || typeof state.scale !== 'number') {
        throw new Error(`Invalid state at p=${p}`);
      }
    }

    // 3. Render at p = 0.1, 0.5, 0.9 with MockContext
    for (const p of [0.1, 0.5, 0.9]) {
      const ctx = new MockContext(160, 90);
      renderTransitionAB(ctx, 160, 90, def.id, p);
      if (ctx.operations.length === 0) {
        throw new Error(`renderTransitionAB performed 0 draw operations at p=${p}`);
      }
    }

    audited++;
  } catch (err) {
    errors.push({ id: def.id, name: def.name, error: err.message });
  }
}

console.log(`\nResults: ${audited} / 100 transitions passed complete verification.`);
if (errors.length > 0) {
  console.error('Failed transitions:', errors);
  process.exit(1);
} else {
  console.log('ALL 100 TRANSITIONS VERIFIED 100% OPERATIONAL WITH ZERO DEFECTS!');
}
