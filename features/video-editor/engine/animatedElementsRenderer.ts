/**
 * FORMA Video Editor — Authentic Social Media Vector & Animation Engine
 * 100% Authentic, Direct Replicas of Real TikTok, YouTube, and Instagram UI Elements.
 *
 * Implements:
 * 1. TikTok Double-Tap Pop Heart (Ekrana Çift Tıklama Kalp Patlaması) — Authentic -14° tilted neon red heart, 3D cyan glitch, expanding shockwave ring, floating mini hearts.
 * 2. TikTok Right-Rail Like Heart (TikTok Yan Bar Beğeni Kalbi & Sayacı) — Pure heart + 1.4M counter below, pops into red with floating hearts, transparent background.
 * 3. TikTok Follow Avatar (TikTok Profil & Takip Et) — Authentic circular profile avatar with overlapping red plus (+) that pops, spins 90°, and morphs into a white checkmark (✓) with confetti sparks.
 * 4. TikTok Follow Button (+ Takip Et) — Real red TikTok profile button that clicks to "Takip Ediliyor ✓".
 * 5. TikTok Right-Side Combo Bar — Full authentic vertical right rail (Avatar + Heart + Comment + Bookmark + Share + Spinning Disc).
 * 6. YouTube Subscribe & Bell — Real red "Abone Ol" pill that turns into grey "Abone Olundu" + shaking ringing bell.
 * 7. Instagram Double-Tap Heart — Real Instagram heart pop with gradient and flying hearts.
 */

import { VideoClip } from '../types';

/**
 * Universal safe rounded rectangle renderer
 */
export function safeRoundRect(
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
 * Draw the EXACT authentic TikTok mathematical cubic bezier heart centered at (0, 0)
 */
export function drawHeartPath(ctx: CanvasRenderingContext2D, size: number): void {
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
export function drawAnimatedCheckmark(
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
export function drawCelebrationSparks(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  progress: number
): void {
  if (progress <= 0 || progress >= 1) return;
  const p = progress;
  const count = 12;
  const colors = ['#fe2c55', '#25f4ee', '#facc15', '#ffffff', '#ff007f', '#22c55e'];

  ctx.save();
  for (let i = 0; i < count; i++) {
    const angle = (i * 2 * Math.PI) / count + (i % 2 === 0 ? 0.2 : -0.1);
    const dist = radius * (0.2 + 1.3 * Math.pow(p, 0.7));
    const px = cx + Math.cos(angle) * dist;
    const py = cy + Math.sin(angle) * dist;
    const sparkSize = Math.max(1.5, (1 - p) * 6);
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
 * 1. TIKTOK DOUBLE-TAP POP HEART (Ekrana Çift Tıklama Kalp Patlaması)
 * Real TikTok double-tap heart:
 * Pure heart rotated at -14 degrees, pops in with spring physics, 3D cyan shadow,
 * expanding shockwave, floating mini hearts, and upward floating drift. Loops continuously!
 */
export function drawTikTokAnimatedDoubleTap(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const maxDim = Math.min(dw, dh);
  const heartBaseSize = maxDim * 0.72;

  // Continuous seamless loop every 2.4 seconds
  const cycleDur = 2.4;
  const loopT = t % cycleDur;

  // Elastic pop-in curve
  let scale = 1.0;
  let alpha = 1.0;
  let driftY = 0;

  if (loopT < 0.35) {
    // Zoom punch spring: 0 -> 1.35 -> 1.0
    const p = loopT / 0.35;
    scale = Math.sin((p * Math.PI) / 2) * 1.35 - (p > 0.7 ? (p - 0.7) * 1.16 : 0);
  } else if (loopT < 1.8) {
    // Floating upward drift and subtle breathing
    const p = (loopT - 0.35) / 1.45;
    scale = 1.0 + 0.06 * Math.sin(p * Math.PI * 4);
    driftY = -p * (maxDim * 0.18);
  } else {
    // Fade out and shrink for next cycle
    const p = (loopT - 1.8) / 0.6;
    scale = 1.0 - p * 0.4;
    alpha = Math.max(0, 1 - p);
    driftY = -maxDim * 0.18 - p * 15;
  }

  ctx.globalAlpha = alpha;
  ctx.translate(0, driftY);

  // Shockwave ring explosion (around 0.25s - 0.85s)
  if (loopT >= 0.25 && loopT < 0.95) {
    const shockP = (loopT - 0.25) / 0.7;
    const shockR = heartBaseSize * 0.5 + shockP * maxDim * 0.55;
    const shockAlpha = (1 - shockP) * 0.85;

    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, shockR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(37, 244, 238, ${shockAlpha})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, shockR * 0.88, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(254, 44, 85, ${shockAlpha * 0.8})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  // 8 Floating Mini Hearts bursting in an upward arc
  if (loopT >= 0.25 && loopT < 1.9) {
    const p = (loopT - 0.25) / 1.65;
    const miniCount = 8;
    for (let i = 0; i < miniCount; i++) {
      const angle = -Math.PI / 2 + ((i - 3.5) * 0.42);
      const dist = (0.25 + 0.85 * Math.pow(p, 0.6)) * (maxDim * 0.55);
      const mx = Math.cos(angle) * dist;
      const my = Math.sin(angle) * dist - (p * maxDim * 0.35);
      const mSize = Math.max(1, (1 - p * 0.8) * (maxDim * 0.16));
      const mAlpha = Math.max(0, (1 - p) * 0.9);

      ctx.save();
      ctx.translate(mx, my);
      ctx.globalAlpha = alpha * mAlpha;
      ctx.rotate(angle * 0.3);
      drawHeartPath(ctx, mSize);
      ctx.fillStyle = i % 2 === 0 ? '#fe2c55' : '#25f4ee';
      ctx.fill();
      ctx.restore();
    }
  }

  // Main TikTok Heart (tilted -14 degrees)
  ctx.save();
  ctx.rotate(-0.24); // Authentic TikTok -14 deg tilt
  ctx.scale(scale, scale);

  // Cyan 3D chromatic aberration shadow (offset -3.5px, -2px)
  ctx.save();
  ctx.translate(-4, -2.5);
  drawHeartPath(ctx, heartBaseSize);
  ctx.fillStyle = '#25f4ee';
  ctx.globalAlpha = alpha * 0.85;
  ctx.fill();
  ctx.restore();

  // Vibrant TikTok Red Heart
  drawHeartPath(ctx, heartBaseSize);
  ctx.fillStyle = '#fe2c55';
  ctx.fill();

  // White glossy specular sheen on top-left lobe
  ctx.beginPath();
  ctx.ellipse(-heartBaseSize * 0.22, -heartBaseSize * 0.22, heartBaseSize * 0.12, heartBaseSize * 0.06, -0.6, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();

  ctx.restore();
  ctx.restore();
}

/**
 * 2. TIKTOK RIGHT-RAIL LIKE HEART (Yan Bar Beğeni Kalbi & Sayacı)
 * Pure authentic TikTok vertical like button:
 * Transparent background, heart on top, clean white/red counter (1.4M) below.
 * Pops with elastic bounce, turns from white to solid red, emits mini hearts!
 */
export function drawTikTokRightRailLike(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const maxDim = Math.min(dw, dh);
  const heartSize = maxDim * 0.55;

  // Continuous seamless loop every 2.8s
  const cycleDur = 2.8;
  const loopT = t % cycleDur;

  const isLiked = loopT >= 0.5;
  const likeP = isLiked ? Math.min(1, (loopT - 0.5) / 0.5) : 0;

  // Elastic heart bounce
  let heartScale = 1.0;
  if (!isLiked) {
    heartScale = 1.0 + 0.03 * Math.sin(loopT * 8);
  } else if (likeP < 1) {
    heartScale = 1.0 + 0.48 * Math.sin(likeP * Math.PI) * Math.exp(-likeP * 2.2);
  } else {
    // Settled heartbeat pulse
    const settledT = loopT - 1.0;
    heartScale = 1.0 + 0.05 * Math.abs(Math.sin(settledT * 5));
  }

  const heartY = -maxDim * 0.12;

  // Floating mini hearts during like pop
  if (isLiked && loopT < 2.2) {
    const p = (loopT - 0.5) / 1.7;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + ((i - 2.5) * 0.45);
      const dist = (0.3 + 0.8 * Math.pow(p, 0.7)) * (heartSize * 1.3);
      const mx = Math.cos(angle) * dist;
      const my = heartY + Math.sin(angle) * dist - (p * 24);
      const mSize = Math.max(1, (1 - p * 0.9) * (heartSize * 0.35));
      const mAlpha = Math.max(0, (1 - p) * 0.95);

      ctx.save();
      ctx.translate(mx, my);
      ctx.globalAlpha = mAlpha;
      drawHeartPath(ctx, mSize);
      ctx.fillStyle = i % 2 === 0 ? '#fe2c55' : '#25f4ee';
      ctx.fill();
      ctx.restore();
    }
  }

  // Draw Heart
  ctx.save();
  ctx.translate(0, heartY);
  ctx.scale(heartScale, heartScale);

  if (!isLiked) {
    // White unliked heart with soft drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 8;
    drawHeartPath(ctx, heartSize);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
  } else {
    // Liked state: 3D cyan shadow + vibrant TikTok Red #fe2c55
    ctx.save();
    ctx.translate(-2.5, -1.5);
    drawHeartPath(ctx, heartSize);
    ctx.fillStyle = '#25f4ee';
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.restore();

    ctx.shadowColor = 'rgba(254, 44, 85, 0.6)';
    ctx.shadowBlur = 10;
    drawHeartPath(ctx, heartSize);
    ctx.fillStyle = '#fe2c55';
    ctx.fill();

    // Specular highlight
    ctx.beginPath();
    ctx.ellipse(-heartSize * 0.22, -heartSize * 0.22, heartSize * 0.12, heartSize * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();
  }
  ctx.restore();

  // TikTok Counter underneath
  const counterY = heartY + heartSize * 0.78;
  const countScale = isLiked && likeP < 1 ? 1.0 + 0.25 * Math.sin(likeP * Math.PI) : 1.0;

  ctx.save();
  ctx.translate(0, counterY);
  ctx.scale(countScale, countScale);
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.max(12, Math.round(maxDim * 0.18))}px "Proxima Nova", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 6;
  ctx.fillText(isLiked ? '1.4M' : '1.3M', 0, 0);
  ctx.restore();

  ctx.restore();
}

/**
 * 3. TIKTOK FOLLOW AVATAR (Profil Avatarı + Kırmızı Artı)
 * Real TikTok profile avatar on right rail:
 * 50px circular avatar with white rim. At the bottom rim, an overlapping red circle (#fe2c55)
 * with a white plus (+). When tapped, the plus pops, spins 90 degrees, and morphs into a
 * checkmark (✓) in a dark circle with 12 confetti celebration sparks!
 */
export function drawTikTokFollowAvatar(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const maxDim = Math.min(dw, dh);
  const avatarR = maxDim * 0.38;
  const badgeR = avatarR * 0.42;

  // Continuous seamless loop every 3.2s
  const cycleDur = 3.2;
  const loopT = t % cycleDur;

  const isFollowed = loopT >= 0.7;
  const followP = isFollowed ? Math.min(1, (loopT - 0.7) / 0.5) : 0;

  const avatarY = -maxDim * 0.08;
  const badgeY = avatarY + avatarR * 0.95;

  // 1. Profile Avatar Circle
  ctx.save();
  ctx.translate(0, avatarY);
  ctx.beginPath();
  ctx.arc(0, 0, avatarR, 0, Math.PI * 2);
  ctx.fillStyle = '#1c1d22';
  ctx.fill();
  ctx.lineWidth = Math.max(2, Math.round(maxDim * 0.025));
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();

  // Clean user portrait silhouette inside
  ctx.fillStyle = '#8e8e93';
  ctx.beginPath();
  ctx.arc(0, -avatarR * 0.18, avatarR * 0.35, 0, Math.PI * 2); // Head
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, avatarR * 0.52, avatarR * 0.6, avatarR * 0.42, 0, 0, Math.PI * 2); // Shoulders
  ctx.fill();
  ctx.restore();

  // 2. Plus / Checkmark Badge
  let badgeScale = 1.0;
  if (!isFollowed) {
    badgeScale = 1.0 + 0.04 * Math.sin(loopT * 7);
  } else if (followP < 1) {
    badgeScale = 1.0 - 0.3 * Math.sin(followP * Math.PI) + 0.18 * Math.sin(followP * Math.PI * 2);
  }

  ctx.save();
  ctx.translate(0, badgeY);
  ctx.scale(badgeScale, badgeScale);

  // Tap ripple ring during tap
  if (isFollowed && followP > 0 && followP < 0.85) {
    const ringR = badgeR + followP * badgeR * 1.5;
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(254, 44, 85, ${1 - followP / 0.85})`;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Badge background circle
  ctx.beginPath();
  ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
  if (!isFollowed) {
    ctx.fillStyle = '#fe2c55';
    ctx.fill();
  } else {
    // Smooth transition from red to settled dark circle with white/cyan border
    const r = Math.round(254 - (254 - 34) * followP);
    const g = Math.round(44 - (44 - 35) * followP);
    const b = Math.round(85 - (85 - 40) * followP);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
  }

  // Plus (+) to Checkmark (✓) transformation
  if (!isFollowed || followP < 0.35) {
    const plusRot = followP > 0 ? (followP / 0.35) * (Math.PI / 2) : 0;
    const pScale = followP > 0 ? 1 - followP / 0.35 : 1;
    ctx.save();
    ctx.rotate(plusRot);
    ctx.scale(pScale, pScale);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2.5, badgeR * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -badgeR * 0.5);
    ctx.lineTo(0, badgeR * 0.5);
    ctx.moveTo(-badgeR * 0.5, 0);
    ctx.lineTo(badgeR * 0.5, 0);
    ctx.stroke();
    ctx.restore();
  } else {
    const checkP = Math.min(1, (followP - 0.35) / 0.65);
    drawAnimatedCheckmark(ctx, 0, 0, badgeR * 1.25, checkP, '#ffffff', Math.max(2.5, badgeR * 0.2));
  }

  ctx.restore();

  // Celebration Sparks on follow
  if (isFollowed && followP > 0 && followP < 1) {
    drawCelebrationSparks(ctx, 0, badgeY, badgeR * 2, followP);
  }

  ctx.restore();
}

/**
 * 4. TIKTOK FOLLOW BUTTON (Kırmızı Takip Butonu)
 * Authentic TikTok profile follow pill button:
 * Red button "+ Takip Et" -> clicks to dark grey "Takip Ediliyor ✓" with confetti.
 */
export function drawTikTokFollowPill(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const cycleDur = 3.2;
  const loopT = t % cycleDur;

  const isFollowed = loopT >= 0.7;
  const followP = isFollowed ? Math.min(1, (loopT - 0.7) / 0.5) : 0;

  let btnScale = 1.0;
  if (!isFollowed) {
    btnScale = 1.0 + 0.02 * Math.sin(loopT * 6);
  } else if (followP < 1) {
    btnScale = 1.0 - 0.12 * Math.sin(followP * Math.PI);
  }
  ctx.scale(btnScale, btnScale);

  const radius = Math.min(dw, dh) * 0.48;

  // Background pill
  ctx.beginPath();
  safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, radius);
  if (!isFollowed) {
    ctx.fillStyle = '#fe2c55';
    ctx.fill();
  } else {
    const r = Math.round(254 - (254 - 40) * followP);
    const g = Math.round(44 - (44 - 42) * followP);
    const b = Math.round(85 - (85 - 48) * followP);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, Math.round(dh * 0.04));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.stroke();
  }

  // Left icon: + turning into ✓
  const iconX = -dw * 0.32;
  const iconSize = dh * 0.38;

  if (!isFollowed || followP < 0.35) {
    const plusRot = followP > 0 ? (followP / 0.35) * (Math.PI / 2) : 0;
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
    const checkP = Math.min(1, (followP - 0.35) / 0.65);
    drawAnimatedCheckmark(ctx, iconX, 0, iconSize * 1.3, checkP, '#22c55e', Math.max(2.5, dh * 0.08));
  }

  // Text: "Takip Et" -> "Takip Ediliyor"
  const fontSize = Math.max(12, Math.round(dh * 0.32));
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px "Proxima Nova", Arial, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const textX = -dw * 0.16;
  if (!isFollowed) {
    ctx.fillText('Takip Et', textX, 0);
  } else if (followP < 0.5) {
    ctx.globalAlpha = 1 - followP / 0.5;
    ctx.fillText('Takip Et', textX, 0);
  } else {
    ctx.globalAlpha = (followP - 0.5) / 0.5;
    ctx.fillText('Takip Ediliyor', textX, 0);
  }

  // Confetti sparks during click
  if (isFollowed && followP > 0 && followP < 1) {
    drawCelebrationSparks(ctx, iconX, 0, dh * 0.7, followP);
  }

  ctx.restore();
}

/**
 * 5. TIKTOK RIGHT-SIDE COMBO BAR (Tüm Sağ Eylem Barı)
 * The complete authentic TikTok right-side vertical overlay:
 * 1. Profile avatar with red + morphing to ✓
 * 2. Heart with 1.4M (pops into red with mini hearts)
 * 3. Comment bubble with 24.8K
 * 4. Bookmark ribbon with 95.2K (turns gold)
 * 5. Share curved arrow with 12.8K
 * 6. Spinning music disc with floating musical notes!
 */
export function drawTikTokRightSideCombo(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  // Vertical column of icons with 6 evenly spaced slots
  const slotCount = 6;
  const slotH = dh / slotCount;
  const iconScale = Math.min(dw, slotH) * 0.75;

  for (let i = 0; i < slotCount; i++) {
    const slotY = -dh / 2 + (i + 0.5) * slotH;

    ctx.save();
    ctx.translate(0, slotY);

    if (i === 0) {
      // Slot 1: Profile + Follow
      drawTikTokFollowAvatar(ctx, iconScale, iconScale, t);
    } else if (i === 1) {
      // Slot 2: Like Heart + Count
      drawTikTokRightRailLike(ctx, iconScale, iconScale, t);
    } else if (i === 2) {
      // Slot 3: Comment Bubble + 24.8K
      const cSize = iconScale * 0.45;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      // Rounded speech bubble
      ctx.beginPath();
      safeRoundRect(ctx, -cSize, -cSize * 0.7, cSize * 2, cSize * 1.4, cSize * 0.5);
      ctx.fill();
      // Pointer
      ctx.beginPath();
      ctx.moveTo(-cSize * 0.4, cSize * 0.7);
      ctx.lineTo(-cSize * 0.7, cSize * 1.1);
      ctx.lineTo(0, cSize * 0.7);
      ctx.fill();
      // 3 dots inside
      ctx.fillStyle = '#111216';
      ctx.beginPath();
      ctx.arc(-cSize * 0.45, 0, cSize * 0.12, 0, Math.PI * 2);
      ctx.arc(0, 0, cSize * 0.12, 0, Math.PI * 2);
      ctx.arc(cSize * 0.45, 0, cSize * 0.12, 0, Math.PI * 2);
      ctx.fill();
      // Counter
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(iconScale * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('24.8K', 0, cSize * 1.35);
    } else if (i === 3) {
      // Slot 4: Bookmark Ribbon + 95.2K
      const bSize = iconScale * 0.48;
      const isBookmarked = (t % 3.0) > 1.2;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = isBookmarked ? '#facc15' : '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-bSize * 0.5, -bSize * 0.7);
      ctx.lineTo(bSize * 0.5, -bSize * 0.7);
      ctx.lineTo(bSize * 0.5, bSize * 0.7);
      ctx.lineTo(0, bSize * 0.3);
      ctx.lineTo(-bSize * 0.5, bSize * 0.7);
      ctx.closePath();
      ctx.fill();
      // Counter
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(iconScale * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('95.2K', 0, bSize * 1.15);
    } else if (i === 4) {
      // Slot 5: Share Curved Arrow + 12.8K
      const sSize = iconScale * 0.48;
      ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(-sSize * 0.6, sSize * 0.4);
      ctx.quadraticCurveTo(-sSize * 0.6, -sSize * 0.3, sSize * 0.1, -sSize * 0.3);
      ctx.lineTo(sSize * 0.1, -sSize * 0.6);
      ctx.lineTo(sSize * 0.7, 0);
      ctx.lineTo(sSize * 0.1, sSize * 0.6);
      ctx.lineTo(sSize * 0.1, sSize * 0.2);
      ctx.quadraticCurveTo(-sSize * 0.3, sSize * 0.2, -sSize * 0.6, sSize * 0.4);
      ctx.closePath();
      ctx.fill();
      // Counter
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(iconScale * 0.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('12.8K', 0, sSize * 1.15);
    } else if (i === 5) {
      // Slot 6: Spinning Music Disc
      const dSize = iconScale * 0.42;
      const discRot = (t * 2.5) % (Math.PI * 2);
      ctx.save();
      ctx.rotate(discRot);
      // Vinyl outer
      ctx.beginPath();
      ctx.arc(0, 0, dSize, 0, Math.PI * 2);
      ctx.fillStyle = '#121212';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#383838';
      ctx.stroke();
      // Vinyl grooves
      ctx.beginPath();
      ctx.arc(0, 0, dSize * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = '#222222';
      ctx.stroke();
      // Center label
      ctx.beginPath();
      ctx.arc(0, 0, dSize * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#fe2c55';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, dSize * 0.12, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.restore();

      // Floating musical note
      const noteT = (t * 1.8) % 1.0;
      const nx = -dSize * (1.2 + noteT * 0.8);
      const ny = -dSize * (0.5 + noteT * 1.2);
      ctx.save();
      ctx.translate(nx, ny);
      ctx.globalAlpha = Math.max(0, 1 - noteT);
      ctx.fillStyle = '#25f4ee';
      ctx.font = `bold ${Math.round(iconScale * 0.28)}px sans-serif`;
      ctx.fillText('♫', 0, 0);
      ctx.restore();
    }

    ctx.restore();
  }

  ctx.restore();
}

/**
 * 6. YOUTUBE SUBSCRIBE & BELL (YouTube Abone Ol & Çan)
 * Real YouTube red pill "Abone Ol" -> clicks to dark grey "Abone Olundu ✓" + ringing golden bell!
 */
export function drawYouTubeAnimatedSubscribe(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const cycleDur = 3.4;
  const loopT = t % cycleDur;

  const isClicked = loopT >= 0.8;
  const clickP = isClicked ? Math.min(1, (loopT - 0.8) / 0.5) : 0;

  let btnScale = 1.0;
  if (!isClicked) {
    btnScale = 1.0 + 0.02 * Math.sin(loopT * 5);
  } else if (clickP < 1) {
    btnScale = 1.0 - 0.1 * Math.sin(clickP * Math.PI);
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
    const r = Math.round(204 - (204 - 39) * clickP);
    const g = Math.round(0 + 39 * clickP);
    const b = Math.round(0 + 43 * clickP);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#52525b';
    ctx.stroke();
  }

  // Text
  const fontSize = Math.max(12, Math.round(dh * 0.34));
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${fontSize}px "Roboto", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (!isClicked) {
    ctx.fillText('Abone Ol', -dw * 0.05, 0);
  } else {
    drawAnimatedCheckmark(ctx, -dw * 0.32, 0, dh * 0.4, Math.min(1, clickP * 1.5), '#22c55e', 3.5);
    ctx.fillText('Abone Olundu', dw * 0.02, 0);
  }

  // Notification Bell on right side
  if (isClicked && clickP >= 0.7) {
    const bellX = dw * 0.38;
    const bellT = loopT - 1.3;
    let bellRot = 0;
    if (bellT > 0 && bellT < 1.4) {
      bellRot = Math.sin(bellT * 26) * 0.28;
    }

    ctx.save();
    ctx.translate(bellX, 0);
    ctx.rotate(bellRot);

    const bSize = dh * 0.36;
    ctx.fillStyle = '#facc15';
    ctx.beginPath();
    ctx.arc(0, -bSize * 0.2, bSize * 0.35, Math.PI, 0);
    ctx.lineTo(bSize * 0.45, bSize * 0.3);
    ctx.lineTo(-bSize * 0.45, bSize * 0.3);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, bSize * 0.42, bSize * 0.12, 0, Math.PI * 2);
    ctx.fill();

    if (bellT > 0 && bellT < 1.4) {
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
 * 7. INSTAGRAM DOUBLE-TAP HEART (Instagram Çift Tıklama Kalp)
 * Real Instagram double-tap heart pop:
 * Pops with elastic scale, fills with sunset gradient (#feda75 -> #fa7e1e -> #d62976 -> #962fbf -> #4f5bd5),
 * emits floating hearts, and drifts upward! Loops continuously!
 */
export function drawInstagramAnimatedLike(
  ctx: CanvasRenderingContext2D,
  dw: number,
  dh: number,
  t: number
): void {
  ctx.save();
  const maxDim = Math.min(dw, dh);
  const baseSize = maxDim * 0.68;

  const cycleDur = 2.4;
  const loopT = t % cycleDur;

  let scale = 1.0;
  let alpha = 1.0;
  let driftY = 0;

  if (loopT < 0.35) {
    const p = loopT / 0.35;
    scale = Math.sin((p * Math.PI) / 2) * 1.35;
  } else if (loopT < 1.8) {
    const p = (loopT - 0.35) / 1.45;
    scale = 1.0 + 0.05 * Math.sin(p * Math.PI * 4);
    driftY = -p * (maxDim * 0.18);
  } else {
    const p = (loopT - 1.8) / 0.6;
    scale = 1.0 - p * 0.4;
    alpha = Math.max(0, 1 - p);
    driftY = -maxDim * 0.18 - p * 15;
  }

  ctx.globalAlpha = alpha;
  ctx.translate(0, driftY);
  ctx.scale(scale, scale);

  // Instagram radiant gradient fill
  const grad = ctx.createLinearGradient(-baseSize / 2, baseSize / 2, baseSize / 2, -baseSize / 2);
  grad.addColorStop(0, '#feda75');
  grad.addColorStop(0.25, '#fa7e1e');
  grad.addColorStop(0.5, '#d62976');
  grad.addColorStop(0.75, '#962fbf');
  grad.addColorStop(1, '#4f5bd5');

  drawHeartPath(ctx, baseSize);
  ctx.fillStyle = grad;
  ctx.fill();

  // Floating sparkle particles
  if (loopT >= 0.25 && loopT < 1.4) {
    const p = (loopT - 0.25) / 1.15;
    drawCelebrationSparks(ctx, 0, 0, baseSize * 0.85, p);
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

  // 1. TikTok Double-Tap Pop Heart (Pure Heart, no cards/boxes)
  if (
    animType === 'tiktok-double-tap' ||
    presetId === 'tiktok-double-tap-heart' ||
    presetId === 'tiktok-animated-double-tap' ||
    name.includes('çift tık') ||
    name.includes('double tap')
  ) {
    drawTikTokAnimatedDoubleTap(ctx, dw, dh, t);
    return true;
  }

  // 2. TikTok Right-Rail Combo Bar (Full stack)
  if (
    animType === 'tiktok-combo' ||
    presetId === 'tiktok-sidebar-combo' ||
    name.includes('eylem barı') ||
    name.includes('sağ bar') ||
    name.includes('combo')
  ) {
    drawTikTokRightSideCombo(ctx, dw, dh, t);
    return true;
  }

  // 3. TikTok Follow Profile Avatar (+ to ✓)
  if (
    animType === 'tiktok-follow-avatar' ||
    presetId === 'tiktok-follow-plus' ||
    presetId === 'tiktok-animated-follow' ||
    (name.includes('takip') && (name.includes('profil') || name.includes('avatar') || name.includes('+')))
  ) {
    drawTikTokFollowAvatar(ctx, dw, dh, t);
    return true;
  }

  // 4. TikTok Follow Pill Button
  if (
    animType === 'tiktok-follow-btn' ||
    presetId === 'tiktok-follow-btn' ||
    presetId === 'tiktok-animated-follow-btn' ||
    (name.includes('takip') && name.includes('buton'))
  ) {
    drawTikTokFollowPill(ctx, dw, dh, t);
    return true;
  }

  // 5. TikTok Right-Rail Vertical Like Heart + Count
  if (
    animType === 'tiktok-like' ||
    presetId === 'tiktok-like' ||
    presetId === 'tiktok-animated-like' ||
    presetId === 'tiktok-like-counter' ||
    ((name.includes('beğen') || name.includes('like')) && (name.includes('tiktok') || clip.isAnimated))
  ) {
    drawTikTokRightRailLike(ctx, dw, dh, t);
    return true;
  }

  // 6. Generic follow fallback
  if (name.includes('takip') || presetId.includes('follow')) {
    const isPill = (dw / Math.max(1, dh)) > 1.6;
    if (isPill) {
      drawTikTokFollowPill(ctx, dw, dh, t);
    } else {
      drawTikTokFollowAvatar(ctx, dw, dh, t);
    }
    return true;
  }

  // 7. YouTube Subscribe + Bell
  if (
    animType === 'youtube-sub' ||
    presetId.includes('youtube') && (presetId.includes('sub') || name.includes('abone')) ||
    name.includes('abone ol')
  ) {
    drawYouTubeAnimatedSubscribe(ctx, dw, dh, t);
    return true;
  }

  // 8. Instagram Like
  if (
    animType === 'instagram-like' ||
    presetId.includes('instagram') ||
    presetId.includes('ig-gradient-heart') ||
    name.includes('instagram')
  ) {
    drawInstagramAnimatedLike(ctx, dw, dh, t);
    return true;
  }

  return false;
}
