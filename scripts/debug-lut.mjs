import fs from 'fs';

function parseCubeLut(cubeText) {
  if (!cubeText || typeof cubeText !== 'string') return null;

  const lines = cubeText.split('\n');
  let size = 0;
  let title = 'Custom LUT';
  let domainMin = [0.0, 0.0, 0.0];
  let domainMax = [1.0, 1.0, 1.0];
  const values = [];

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.toUpperCase().startsWith('TITLE')) {
      const match = line.match(/^TITLE\s+["']?([^"']+)["']?/i);
      if (match) title = match[1];
      continue;
    }

    if (line.toUpperCase().startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
      continue;
    }

    if (line.toUpperCase().startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && !parts.some(Number.isNaN)) {
        domainMin = [parts[0], parts[1], parts[2]];
      }
      continue;
    }

    if (line.toUpperCase().startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && !parts.some(Number.isNaN)) {
        domainMax = [parts[0], parts[1], parts[2]];
      }
      continue;
    }

    if (line.toUpperCase().startsWith('LUT_1D_SIZE')) {
      return null;
    }

    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && !parts.some(Number.isNaN)) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }

  console.log({ size, expected: size * size * size * 3, actual: values.length });
  if (size >= 2 && values.length === size * size * size * 3) {
    return {
      title,
      size,
      domainMin,
      domainMax,
      data: new Float32Array(values),
    };
  }

  return null;
}

const text = fs.readFileSync('public/video-assets/luts/teal-orange.cube', 'utf-8');
const res = parseCubeLut(text);
console.log('Result:', res !== null ? 'SUCCESS' : 'NULL');

function interpolate3DLutRgb(r, g, b, lut) {
  const { size, data, domainMin, domainMax } = lut;
  const maxIdx = size - 1;

  const spanR = domainMax[0] - domainMin[0] || 1;
  const spanG = domainMax[1] - domainMin[1] || 1;
  const spanB = domainMax[2] - domainMin[2] || 1;

  const rNorm = Math.max(0, Math.min(1, (r - domainMin[0]) / spanR)) * maxIdx;
  const gNorm = Math.max(0, Math.min(1, (g - domainMin[1]) / spanG)) * maxIdx;
  const bNorm = Math.max(0, Math.min(1, (b - domainMin[2]) / spanB)) * maxIdx;

  const r0 = Math.floor(rNorm);
  const g0 = Math.floor(gNorm);
  const b0 = Math.floor(bNorm);

  const r1 = Math.min(maxIdx, r0 + 1);
  const g1 = Math.min(maxIdx, g0 + 1);
  const b1 = Math.min(maxIdx, b0 + 1);

  const dr = rNorm - r0;
  const dg = gNorm - g0;
  const db = bNorm - b0;

  const strideR = 3;
  const strideG = size * 3;
  const strideB = size * size * 3;

  const idx000 = b0 * strideB + g0 * strideG + r0 * strideR;
  const idx100 = b0 * strideB + g0 * strideG + r1 * strideR;
  const idx010 = b0 * strideB + g1 * strideG + r0 * strideR;
  const idx110 = b0 * strideB + g1 * strideG + r1 * strideR;
  const idx001 = b1 * strideB + g0 * strideG + r0 * strideR;
  const idx101 = b1 * strideB + g0 * strideG + r1 * strideR;
  const idx011 = b1 * strideB + g1 * strideG + r0 * strideR;
  const idx111 = b1 * strideB + g1 * strideG + r1 * strideR;

  const c00_0 = data[idx000] * (1 - dr) + data[idx100] * dr;
  const c10_0 = data[idx010] * (1 - dr) + data[idx110] * dr;
  const c01_0 = data[idx001] * (1 - dr) + data[idx101] * dr;
  const c11_0 = data[idx011] * (1 - dr) + data[idx111] * dr;
  const c0_0 = c00_0 * (1 - dg) + c10_0 * dg;
  const c1_0 = c01_0 * (1 - dg) + c11_0 * dg;
  const outR = c0_0 * (1 - db) + c1_0 * db;

  const c00_1 = data[idx000 + 1] * (1 - dr) + data[idx100 + 1] * dr;
  const c10_1 = data[idx010 + 1] * (1 - dr) + data[idx100 + 1] * dr;
  const c01_1 = data[idx001 + 1] * (1 - dr) + data[idx101 + 1] * dr;
  const c11_1 = data[idx011 + 1] * (1 - dr) + data[idx111 + 1] * dr;
  const c0_1 = c00_1 * (1 - dg) + c10_1 * dg;
  const c1_1 = c01_1 * (1 - dg) + c11_1 * dg;
  const outG = c0_1 * (1 - db) + c1_1 * db;

  const c00_2 = data[idx000 + 2] * (1 - dr) + data[idx100 + 2] * dr;
  const c10_2 = data[idx010 + 2] * (1 - dr) + data[idx110 + 2] * dr;
  const c01_2 = data[idx001 + 2] * (1 - dr) + data[idx101 + 2] * dr;
  const c11_2 = data[idx011 + 2] * (1 - dr) + data[idx111 + 2] * dr;
  const c0_2 = c00_2 * (1 - dg) + c10_2 * dg;
  const c1_2 = c01_2 * (1 - dg) + c11_2 * dg;
  const outB = c0_2 * (1 - db) + c1_2 * db;

  return [outR, outG, outB];
}

console.log('Blue [0.1, 0.2, 0.8] ->', interpolate3DLutRgb(0.1, 0.2, 0.8, res));

