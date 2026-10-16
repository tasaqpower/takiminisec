/**
 * FORMA Video Editor — Dynamic Animated Stickers & Vector Elements Engine
 * High-performance 60fps procedural vector animations for Canvas preview & MP4 export.
 *
 * Implements real-life interactive social media animations:
 * 1. TikTok Follow (+ morphs into ✓ checkmark with tap ripple and confetti burst)
 * 2. TikTok Like (elastic bounce pop, fills with TikTok red + cyan shadow, shockwave & floating mini hearts)
 * 3. TikTok Double-Tap Heart (screen pop with 3D chromatic aberration and upward drift)
 * 4. YouTube Subscribe & Bell (Red "ABONE OL" -> clicks to grey "✓ ABONE OLUNDU" -> bell rings with yellow soundwaves)
 * 5. Instagram Like (Heart pop with Instagram radiant gradient & floating hearts)
 */

import { VideoClip } from '../types';

/**
 * Universal safe rounded rectangle renderer
 */
function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number = 0
): void {
  if (w <= 0 || h <= 0) return;
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, w, h, radius);
      return;
    } catch {}
  }
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

/**
 * Draw a mathematical cubic bezier heart centered at (0, 0)
 */
function drawHeartPath(ctx: CanvasRenderingContext2D, size: number): void {
  const s = size / 32;
  ctx.beginPath();
  ctx.moveTo(0, 16 * s);
  ctx.bezierCurveTo(-2 * s, -2 * s, -24 * s, -2 * s, -24 * s, -14 * s);
  ctx.bezierCurveTo(-24 * s, -24 * s, -12 * s, -28 * s, 0, -18 * s);
  ctx.bezierCurveTo(12 * s, -28 * s, 24 * s, -24 * s, 24 * s, -14 * s);
  ctx.bezierCurveTo(24 * s, -2 * s, 2 * s, -2 * s, 0, 16 * s);
  ctx.closePath();
}

/**
 * Animated checkmark path from start to end with progress 0..1
 */
function drawAnimatedCheckmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  progress: number,
  color: string = '#ffffff',
  lineWidth: number = 3.5
): void {
  if (progress <= 0) return;
  const p = Math.min(1, Math.max(0, progress));

  // Points for checkmark: start (left), vertex (bottom), end (top right)
  const x1 = cx - size * 0.42;
  const y1 = cy - size * 0.05;
  const x2 = cx - size * 0.12;
  const y2 = cy + size * 0.32;
  const x3 = cx + size * 0.45;
  const y3 = cy - size * 0.35;

  ctx.save();
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.moveTo(x1, y1);
  if (p < 0.4) {
    const segP = p / 0.4;
    ctx.lineTo(x1 + (x2 - x1) * segP, y1 + (y2 - y1) * segP);
  } else {
    ctx.lineTo(x2, y2);
    const segP = (p - 0.4) / 0.6;
    ctx.lineTo(x2 + (x3 - x2) * segP, y2 + (y3 - y2) * segP);
  }
  ctx.stroke();
  ctx.restore();
}

/**
 * Draw celebratory particles / confetti bursting radially from (cx, cy)
 */
function drawCelebrationSparks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  progress: number
): void {
  if (progress <= 0 || progress >= 1) return;
  const p = progress;
  const count = 12;
  const colors = ['#fe2c55', '#25f4ee', '#facc15', '#ffffff', '#a855f7', '#22c55e'];

  ctx.save();
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count + (i % 2 === 0 ? 0.2 : -0.1);
    const dist = radius * (0.3 + 1.2 * Math.pow(p, 0.7));
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const sparkSize = Math.max(1.5, (1 - p) * 5.5);
    const alpha = Math.max(0, (1 - p) * 0.95);

    ctx.fillStyle = colors[i % colors.length];
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(px, py, sparkSize, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * 1. TIKTOK TAKIP ET (AVATAR + PLUS TO CHECKMARK ✓)
 * Starts with user profile avatar and red plus badge.
 * At t ~ 0.8s, clicks: plus spins 90deg and morphs into a checkmark ✓ with celebration sparks!
 */
export function drawTikTokFollowAvatar(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const baseScale = Math.min(dw, dh) / 160;
  ctx.scale(baseScale, baseScale);

  // Time milestones
  const clickStart = 0.8;
  const clickDur = 0.45;
  const isClicked = t >= clickStart;
  const clickProgress = isClicked ? Math.min(1, (t - clickStart) / clickDur) : 0;

  // 1. Profile Avatar Circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, -15, 52, 0, Math.PI * 2);
  ctx.fillStyle = '#18181b';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Subtle user portrait icon inside
  ctx.fillStyle = '#71717a';
  ctx.beginPath();
  ctx.arc(0, -25, 18, 0, Math.PI * 2); // Head
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 14, 30, 20, 0, 0, Math.PI * 2); // Shoulders
  ctx.fill();
  ctx.restore();

  // 2. Plus / Checkmark Badge positioned at bottom rim of avatar (0, 36)
  const badgeY = 34;
  let badgeScale = 1.0;
  if (t < clickStart) {
    // Gentle breathing idle pulse before click
    badgeScale = 1.0 + 0.04 * Math.sin(t * 6);
  } else if (clickProgress < 1) {
    // Elastic click bounce
    badgeScale = 1.0 - 0.28 * Math.sin(clickProgress * Math.PI) + 0.15 * Math.sin(clickProgress * Math.PI * 2);
  }

  ctx.save();
  ctx.translate(0, badgeY);
  ctx.scale(badgeScale, badgeScale);

  // Tap ripple ring during click
  if (clickProgress > 0 && clickProgress < 0.85) {
    const ringR = 24 + clickProgress * 36;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(254, 44, 85, ${1 - clickProgress / 0.85})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Badge background circle
  ctx.beginPath();
  ctx.arc(0, 0, 22, 0, Math.PI * 2);
  if (!isClicked) {
    // Vibrant TikTok red before click
    ctx.fillStyle = '#fe2c55';
    ctx.fill();
  } else {
    // Smooth transition from red to settled dark grey/white checkmark
    const r = Math.round(254 - (254 - 39) * clickProgress);
    const g = Math.round(44 - (44 - 39) * clickProgress);
    const b = Math.round(85 - (85 - 43) * clickProgress);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // Icon drawing: Plus (+) vs Checkmark (✓)
  if (!isClicked || clickProgress < 0.35) {
    // Rotating / shrinking Plus (+)
    const plusRot = clickProgress > 0 ? (clickProgress / 0.35) * (Math.PI / 2) : 0;
    const plusScale = clickProgress > 0 ? 1 - clickProgress / 0.35 : 1;

    ctx.save();
    ctx.rotate(plusRot);
    ctx.scale(plusScale, plusScale);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    // Vertical bar
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(0, 11);
    ctx.stroke();
    // Horizontal bar
    ctx.beginPath();
    ctx.moveTo(-11, 0);
    ctx.lineTo(11, 0);
    ctx.stroke();
    ctx.restore();
  } else {
    // Animated Checkmark (✓)
    const checkP = Math.min(1, (clickProgress - 0.35) / 0.65);
    drawAnimatedCheckmark(ctx, 0, 0, 26, checkP, '#ffffff', 4);
  }

  ctx.restore(); // restore badge transform

  // 3. Celebration sparks bursting on follow!
  if (clickProgress > 0 && clickProgress < 1) {
    drawCelebrationSparks(ctx, 0, badgeY, 32, clickProgress);
  }

  // 4. Settled label below badge
  if (isClicked && clickProgress >= 0.7) {
    const labelAlpha = Math.min(1, (clickProgress - 0.7) / 0.3);
    ctx.save();
    ctx.globalAlpha = labelAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 13px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText('✓ TAKİP EDİLDİ', 0, badgeY + 28);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * 2. TIKTOK TAKIP BUTONU (+ -> ✓ PILL BUTTON)
 * Red "+ Takip Et" button clicks and transforms into grey "✓ Takip Ediliyor" with confetti!
 */
export function drawTikTokFollowPill(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const clickStart = 0.8;
  const clickDur = 0.45;
  const isClicked = t >= clickStart;
  const clickProgress = isClicked ? Math.min(1, (t - clickStart) / clickDur) : 0;

  let btnScale = 1.0;
  if (t < clickStart) {
    btnScale = 1.0 + 0.02 * Math.sin(t * 6);
  } else if (clickProgress < 1) {
    btnScale = 1.0 - 0.12 * Math.sin(clickProgress * Math.PI);
  }
  ctx.scale(btnScale, btnScale);

  const radius = Math.min(dw, dh) * 0.48;

  // Background pill
  ctx.beginPath();
  safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, radius);
  if (!isClicked) {
    ctx.fillStyle = '#fe2c55';
    ctx.fill();
  } else {
    // Transition to sleek dark glass
    const r = Math.round(254 - (254 - 30) * clickProgress);
    const g = Math.round(44 - (44 - 35) * clickProgress);
    const b = Math.round(85 - (85 - 45) * clickProgress);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, Math.round(dh * 0.04));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.stroke();
  }

  // Left icon: + turning into ✓
  const iconX = -dw * 0.32;
  const iconSize = dh * 0.38;

  if (!isClicked || clickProgress < 0.35) {
    const plusRot = clickProgress > 0 ? (clickProgress / 0.35) * (Math.PI / 2) : 0;
    ctx.save();
    ctx.translate(iconX, 0);
    ctx.rotate(plusRot);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.5, dh * 0.08);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -iconSize / 2);
    ctx.lineTo(0, iconSize / 2);
    ctx.moveTo(-iconSize / 2, 0);
    ctx.lineTo(iconSize / 2, 0);
    ctx.stroke();
    ctx.restore();
  } else {
    const checkP = Math.min(1, (clickProgress - 0.35) / 0.65);
    drawAnimatedCheckmark(ctx, iconX, 0, iconSize * 1.3, checkP, '#22c55e', Math.max(2.5, dh * 0.08));
  }

  // Text: "TAKİP ET" -> "TAKİP EDİLİYOR"
  const fontSize = Math.max(12, Math.round(dh * 0.32));
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const textX = -dw * 0.15;
  if (!isClicked) {
    ctx.fillText('TAKİP ET', textX, 0);
  } else if (clickProgress < 0.5) {
    ctx.globalAlpha = 1 - clickProgress / 0.5;
    ctx.fillText('TAKİP ET', textX, 0);
  } else {
    ctx.globalAlpha = (clickProgress - 0.5) / 0.5;
    ctx.fillText('TAKİP EDİLİYOR', textX, 0);
  }

  // Confetti sparks during click
  if (clickProgress > 0 && clickProgress < 1) {
    drawCelebrationSparks(ctx, iconX, 0, dh * 0.7, clickProgress);
  }

  ctx.restore();
}

/**
 * 3. TIKTOK BEĞEN (POP & HEARTS BURST & INCREMENTING COUNTER)
 * Starts unliked/idle. At t ~ 0.6s, double-taps: elastic bounce, fills with red + cyan 3D shadow,
 * shockwave ring explodes, 8 mini hearts shoot out, and counter increments to "+1 / BEĞENİLDİ"!
 */
export function drawTikTokAnimatedLike(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const popStart = 0.6;
  const popDur = 0.55;
  const isPopped = t >= popStart;
  const popProgress = isPopped ? Math.min(1, (t - popStart) / popDur) : 0;

  // 1. Background Pill Container
  const pillRadius = Math.min(dw, dh) * 0.46;
  ctx.beginPath();
  safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, pillRadius);
  ctx.fillStyle = '#090a0f';
  ctx.fill();

  // Subtle border with chromatic glow
  ctx.lineWidth = Math.max(2, Math.round(dh * 0.035));
  ctx.strokeStyle = isPopped ? '#fe2c55' : 'rgba(255, 255, 255, 0.25)';
  ctx.stroke();

  // Cyan inner border
  ctx.beginPath();
  safeRoundRect(ctx, -dw / 2 + 2, -dh / 2 + 2, dw - 4, dh - 4, Math.max(4, pillRadius - 2));
  ctx.lineWidth = Math.max(1, Math.round(dh * 0.02));
  ctx.strokeStyle = 'rgba(37, 244, 238, 0.6)';
  ctx.stroke();

  // 2. Heart Positioning and Elastic Bounce
  const heartX = -dw * 0.28;
  const heartY = 0;
  const baseHeartSize = Math.min(dw, dh) * 0.5;

  let heartScale = 1.0;
  if (!isPopped) {
    // Idle gentle heartbeat
    heartScale = 1.0 + 0.04 * Math.sin(t * 8);
  } else if (popProgress < 1) {
    // Elastic spring bounce: 1.0 -> 0.75 -> 1.48 -> 0.95 -> 1.0
    heartScale = 1.0 + 0.52 * Math.sin(popProgress * Math.PI) * Math.exp(-popProgress * 2.5);
  } else {
    // Settled heartbeat pulse
    const settledT = t - (popStart + popDur);
    heartScale = 1.0 + 0.06 * Math.abs(Math.sin(settledT * 5));
  }

  // Shockwave ring explosion during pop
  if (popProgress > 0 && popProgress < 0.9) {
    const shockR = baseHeartSize * 0.6 + popProgress * dh * 0.9;
    const shockAlpha = (1 - popProgress / 0.9) * 0.85;
    ctx.save();
    ctx.beginPath();
    ctx.arc(heartX, heartY, shockR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(37, 244, 238, ${shockAlpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(heartX, heartY, shockR * 0.85, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(254, 44, 85, ${shockAlpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // Floating mini hearts bursting around the main heart!
  if (popProgress > 0) {
    const miniHeartCount = 7;
    for (let i = 0; i < miniHeartCount; i++) {
      const angle = -Math.PI / 2 + ((i - 3) * 0.42); // fan out upwards
      const dist = (0.2 + 0.85 * Math.pow(popProgress, 0.6)) * (dh * 0.85);
      const mx = heartX + Math.cos(angle) * dist;
      const my = heartY + Math.sin(angle) * dist - (popProgress * 18);
      const mSize = Math.max(1, (1 - popProgress * 0.85) * (dh * 0.22));
      const mAlpha = Math.max(0, 1 - popProgress);

      ctx.save();
      ctx.translate(mx, my);
      ctx.globalAlpha = mAlpha;
      drawHeartPath(ctx, mSize);
      ctx.fillStyle = i % 2 === 0 ? '#fe2c55' : '#25f4ee';
      ctx.fill();
      ctx.restore();
    }
  }

  // 3. Main Heart Drawing
  ctx.save();
  ctx.translate(heartX, heartY);
  ctx.scale(heartScale, heartScale);

  if (!isPopped) {
    // Unliked state: crisp white outline heart
    drawHeartPath(ctx, baseHeartSize);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  } else {
    // Liked state: 3D chromatic cyan shadow offset + vibrant TikTok red heart!
    // Cyan 3D shadow
    ctx.save();
    ctx.translate(-2.5, -1.5);
    drawHeartPath(ctx, baseHeartSize);
    ctx.fillStyle = '#25f4ee';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.restore();

    // Vibrant TikTok red heart
    drawHeartPath(ctx, baseHeartSize);
    ctx.fillStyle = '#fe2c55';
    ctx.fill();

    // Specular highlight gleam on top left lobe
    ctx.beginPath();
    ctx.ellipse(-baseHeartSize * 0.22, -baseHeartSize * 0.22, baseHeartSize * 0.12, baseHeartSize * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
  }
  ctx.restore();

  // 4. BEĞEN Text and Counter
  const textX = -dw * 0.06;
  const titleSize = Math.max(12, Math.round(dh * 0.28));
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${titleSize}px "Arial Black", Impact, sans-serif`;
  if (!isPopped) {
    ctx.fillText('BEĞEN', textX, -dh * 0.05);
  } else {
    ctx.fillText('BEĞENİLDİ', textX, -dh * 0.05);
  }

  // Counter
  const counterSize = Math.max(10, Math.round(dh * 0.18));
  ctx.font = `800 ${counterSize}px Arial, sans-serif`;
  if (!isPopped) {
    ctx.fillStyle = '#929aa8';
    ctx.fillText('❤️ 1.4M', textX, dh * 0.28);
  } else {
    // Counter pops and turns bright red with "+1"
    const countScale = popProgress < 1 ? 1.0 + 0.22 * Math.sin(popProgress * Math.PI) : 1.0;
    ctx.save();
    ctx.translate(textX, dh * 0.28);
    ctx.scale(countScale, countScale);
    ctx.fillStyle = '#fe2c55';
    ctx.fillText('❤️ 1.4M +1', 0, 0);
    ctx.restore();
  }

  ctx.restore();
}

/**
 * 4. TIKTOK ÇİFT TIKLA KALP (DOUBLE-TAP POP EFFECT)
 * Big tilted heart springs onto screen, double-taps, bursts sparkles, and floats upwards.
 */
export function drawTikTokAnimatedDoubleTap(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const maxDim = Math.min(dw, dh);
  const heartBaseSize = maxDim * 0.65;

  // Tap 1 at t=0.25s, Tap 2 at t=0.55s
  const t1 = Math.max(0, t - 0.25);
  const t2 = Math.max(0, t - 0.55);

  const scale1 = t1 > 0 ? Math.min(1.0, t1 / 0.2) + 0.35 * Math.sin(Math.min(Math.PI, t1 * 6)) : 0;
  const scale2 = t2 > 0 ? Math.min(1.0, t2 / 0.2) + 0.45 * Math.sin(Math.min(Math.PI, t2 * 6)) : 0;

  // Upward floating drift over time
  const driftY = -Math.min(60, t * 18);
  const fadeAlpha = t > 2.2 ? Math.max(0, 1 - (t - 2.2) / 0.8) : 1;

  ctx.globalAlpha = fadeAlpha;
  ctx.translate(0, driftY);

  // Heart 1 (tilted left -14 deg)
  if (scale1 > 0.05) {
    ctx.save();
    ctx.translate(-maxDim * 0.08, 0);
    ctx.rotate(-0.24);
    ctx.scale(scale1, scale1);

    // Cyan chromatic 3D shadow
    ctx.save();
    ctx.translate(-4, -2);
    drawHeartPath(ctx, heartBaseSize);
    ctx.fillStyle = '#25f4ee';
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.restore();

    // Red heart
    drawHeartPath(ctx, heartBaseSize);
    ctx.fillStyle = '#fe2c55';
    ctx.fill();
    ctx.restore();
  }

  // Heart 2 (tilted right +12 deg, popped by double tap)
  if (scale2 > 0.05) {
    ctx.save();
    ctx.translate(maxDim * 0.08, -maxDim * 0.05);
    ctx.rotate(0.2);
    ctx.scale(scale2, scale2);

    // Cyan shadow
    ctx.save();
    ctx.translate(-3, -2);
    drawHeartPath(ctx, heartBaseSize * 0.85);
    ctx.fillStyle = '#25f4ee';
    ctx.globalAlpha = 0.75;
    ctx.fill();
    ctx.restore();

    // Red heart
    drawHeartPath(ctx, heartBaseSize * 0.85);
    ctx.fillStyle = '#ff0050';
    ctx.fill();
    ctx.restore();
  }

  // Radiating sparkle particles
  if (t > 0.55 && t < 2.0) {
    const p = (t - 0.55) / 1.45;
    drawCelebrationSparks(ctx, 0, 0, maxDim * 0.7, p);
  }

  // Bottom Label: "ÇİFT TIKLA ❤️"
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.max(12, Math.round(maxDim * 0.1))}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText('ÇİFT TIKLA ❤️', 0, maxDim * 0.38);

  ctx.restore();
}

/**
 * 5. YOUTUBE ABONE OL + BİLDİRİM ZİLİ
 * Red "ABONE OL" -> clicks to grey "✓ ABONE OLUNDU" -> bell rings with yellow soundwaves!
 */
export function drawYouTubeAnimatedSubscribe(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const clickStart = 0.9;
  const clickDur = 0.45;
  const isClicked = t >= clickStart;
  const clickProgress = isClicked ? Math.min(1, (t - clickStart) / clickDur) : 0;

  let btnScale = 1.0;
  if (t < clickStart) {
    btnScale = 1.0 + 0.02 * Math.sin(t * 5);
  } else if (clickProgress < 1) {
    btnScale = 1.0 - 0.1 * Math.sin(clickProgress * Math.PI);
  }
  ctx.scale(btnScale, btnScale);

  const radius = Math.min(dw, dh) * 0.48;

  // Background pill
  ctx.beginPath();
  safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, radius);
  if (!isClicked) {
    ctx.fillStyle = '#cc0000';
    ctx.fill();
  } else {
    // Morph to YouTube Dark Slate
    const r = Math.round(204 - (204 - 39) * clickProgress);
    const g = Math.round(0 + 39 * clickProgress);
    const b = Math.round(0 + 43 * clickProgress);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#52525b';
    ctx.stroke();
  }

  // Text
  const fontSize = Math.max(12, Math.round(dh * 0.32));
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!isClicked) {
    ctx.fillText('ABONE OL', -dw * 0.05, 0);
  } else {
    const textP = (clickProgress - 0.2) / 0.8;
    if (textP > 0) {
      drawAnimatedCheckmark(ctx, -dw * 0.32, 0, dh * 0.4, Math.min(1, textP), '#22c55e', 3.5);
      ctx.fillText('ABONE OLUNDU', dw * 0.02, 0);
    } else {
      ctx.fillText('ABONE OL', -dw * 0.05, 0);
    }
  }

  // Notification Bell on right side
  if (isClicked && clickProgress >= 0.8) {
    const bellX = dw * 0.38;
    const bellT = t - (clickStart + clickDur);
    let bellRot = 0;
    if (bellT > 0 && bellT < 1.5) {
      // Shaking ringing bell!
      bellRot = Math.sin(bellT * 26) * 0.28;
    }

    ctx.save();
    ctx.translate(bellX, 0);
    ctx.rotate(bellRot);

    // Bell shape
    const bSize = dh * 0.35;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -bSize * 0.2, bSize * 0.35, Math.PI, 0);
    ctx.lineTo(bSize * 0.45, bSize * 0.3);
    ctx.lineTo(-bSize * 0.45, bSize * 0.3);
    ctx.closePath();
    ctx.fill();
    // Clapper
    ctx.beginPath();
    ctx.arc(0, bSize * 0.42, bSize * 0.12, 0, Math.PI * 2);
    ctx.fill();

    // Soundwaves pulsing
    if (bellT > 0 && bellT < 1.5) {
      const waveAlpha = (1 + Math.sin(bellT * 20)) * 0.45;
      ctx.strokeStyle = `rgba(250, 204, 21, ${waveAlpha})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, bSize * 0.7, -0.6, 0.6);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, bSize * 0.7, Math.PI - 0.6, Math.PI + 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore();
}

/**
 * 6. INSTAGRAM BEĞENİ (GRADIENT HEART POP)
 * Outline heart -> pop bounce -> fills with Instagram radiant sunset gradient -> floating mini hearts!
 */
export function drawInstagramAnimatedLike(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const popStart = 0.5;
  const popDur = 0.5;
  const isPopped = t >= popStart;
  const popProgress = isPopped ? Math.min(1, (t - popStart) / popDur) : 0;

  const baseSize = Math.min(dw, dh) * 0.55;
  let scale = 1.0;
  if (!isPopped) {
    scale = 1.0 + 0.03 * Math.sin(t * 7);
  } else if (popProgress < 1) {
    scale = 1.0 + 0.45 * Math.sin(popProgress * Math.PI) * Math.exp(-popProgress * 2.5);
  }

  ctx.scale(scale, scale);

  if (!isPopped) {
    drawHeartPath(ctx, baseSize);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.stroke();
  } else {
    // Instagram gradient fill
    const grad = ctx.createLinearGradient(-baseSize / 2, baseSize / 2, baseSize / 2, -baseSize / 2);
    grad.addColorStop(0, '#feda75');
    grad.addColorStop(0.25, '#fa7e1e');
    grad.addColorStop(0.5, '#d62976');
    grad.addColorStop(0.75, '#962fbf');
    grad.addColorStop(1, '#4f5bd5');

    drawHeartPath(ctx, baseSize);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  if (popProgress > 0 && popProgress < 1) {
    drawCelebrationSparks(ctx, 0, 0, baseSize * 0.8, popProgress);
  }

  ctx.restore();
}

/**
 * Master dispatcher for all procedural animated stickers and vector elements.
 * Returns true if the clip was handled as an animated element, false otherwise.
 */
export function renderAnimatedElement(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  dw: number,
  dh: number,
  clipRelSec: number
): boolean {
  if (clip.isAnimated === false) return false;

  const animType = clip.elementAnimation || '';
  const presetId = (clip.elementPresetId || clip.assetId || '').toLowerCase();
  const name = (clip.name || '').toLowerCase();
  const t = Math.max(0, clipRelSec);

  // 1. TikTok Follow (+ -> ✓)
  if (
    animType === 'tiktok-follow' ||
    presetId === 'tiktok-animated-follow' ||
    presetId === 'tiktok-follow-plus' ||
    (name.includes('takip') && (name.includes('tiktok') || clip.isAnimated))
  ) {
    const isPill = (dw / Math.max(1, dh)) > 1.6;
    if (isPill) {
      drawTikTokFollowPill(ctx, dw, dh, t);
    } else {
      drawTikTokFollowAvatar(ctx, dw, dh, t);
    }
    return true;
  }

  // 2. TikTok Follow Pill Button explicitly
  if (animType === 'tiktok-follow-btn' || presetId === 'tiktok-animated-follow-btn') {
    drawTikTokFollowPill(ctx, dw, dh, t);
    return true;
  }

  // 3. TikTok Like (Pop, Hearts, Red Fill, +1 Counter)
  if (
    animType === 'tiktok-like' ||
    presetId === 'tiktok-animated-like' ||
    presetId === 'tiktok-like' ||
    ((name.includes('beğen') || name.includes('like')) && (name.includes('tiktok') || clip.isAnimated))
  ) {
    drawTikTokAnimatedLike(ctx, dw, dh, t);
    return true;
  }

  // 4. TikTok Double-Tap Heart
  if (
    animType === 'tiktok-double-tap' ||
    presetId === 'tiktok-animated-double-tap' ||
    presetId === 'tiktok-double-tap-heart' ||
    name.includes('çift tık')
  ) {
    drawTikTokAnimatedDoubleTap(ctx, dw, dh, t);
    return true;
  }

  // 5. YouTube Subscribe + Bell
  if (
    animType === 'youtube-sub' ||
    presetId === 'youtube-animated-subscribe' ||
    presetId === 'youtube-subscribe' ||
    (name.includes('youtube') && name.includes('abone'))
  ) {
    drawYouTubeAnimatedSubscribe(ctx, dw, dh, t);
    return true;
  }

  // 6. Instagram Like
  if (
    animType === 'instagram-like' ||
    presetId === 'instagram-animated-like' ||
    (name.includes('instagram') && (name.includes('beğen') || name.includes('like')))
  ) {
    drawInstagramAnimatedLike(ctx, dw, dh, t);
    return true;
  }

  return false;
}
