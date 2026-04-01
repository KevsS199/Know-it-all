import { createCanvas } from '@napi-rs/canvas';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const W = 1080;
const H = 1920;
const LOOP_FRAMES = 12;
const LOOP_FPS = 6;

const C = {
  bg: '#07110f',
  bgSoft: '#0c1715',
  panel: 'rgba(10, 20, 18, 0.88)',
  panelStroke: 'rgba(0, 255, 163, 0.16)',
  accent: '#00f5a0',
  accentSoft: '#7dffd6',
  text: '#f4f7f6',
  muted: '#9cb2ac',
  shadow: 'rgba(0, 0, 0, 0.24)',
  avatarSkin: '#ffc38a',
  avatarHair: '#dff7ff',
  avatarSuit: '#0f2f29',
  avatarShirt: '#f5fff9',
  avatarTie: '#00f5a0',
};

function fillBackground(ctx, phase) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.bg);
  bg.addColorStop(1, '#050807');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pulseX = W * 0.22 + Math.sin(phase) * 24;
  const pulseY = H * 0.74 + Math.cos(phase * 0.8) * 18;
  drawGlow(ctx, pulseX, pulseY, 420, 'rgba(0, 245, 160, 0.12)');
  drawGlow(ctx, W * 0.8, H * 0.2, 260, 'rgba(0, 160, 255, 0.08)');

  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
}

function drawGlow(ctx, cx, cy, radius, color) {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

function measureLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function fitLines(ctx, text, maxWidth, maxLines) {
  const lines = measureLines(ctx, text, maxWidth);
  if (lines.length <= maxLines) return lines;

  const trimmed = lines.slice(0, maxLines);
  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1].replace(/[.,;:!?]+$/g, '');
    const candidate = `${last}...`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      trimmed[trimmed.length - 1] = candidate;
      return trimmed;
    }
    const shorter = last.split(' ').slice(0, -1).join(' ');
    if (!shorter) break;
    trimmed[trimmed.length - 1] = shorter;
  }

  return trimmed;
}

function drawLines(ctx, lines, x, y, lineHeight) {
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], x, y + i * lineHeight);
  }
  return lines.length * lineHeight;
}

function drawRoundedPanel(ctx, x, y, w, h, radius = 42) {
  ctx.save();
  ctx.shadowColor = C.shadow;
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = C.panel;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = C.panelStroke;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

function drawPill(ctx, text, x, y, options = {}) {
  const {
    font = '600 24px sans-serif',
    bg = 'rgba(0, 245, 160, 0.12)',
    fg = C.accentSoft,
    paddingX = 20,
    paddingY = 10,
  } = options;

  ctx.save();
  ctx.font = font;
  const fontSize = Number(font.match(/(\d+)px/)?.[1] || 24);
  const textWidth = ctx.measureText(text).width;
  const height = fontSize + paddingY * 2;
  const width = textWidth + paddingX * 2;

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();

  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + paddingX, y + height / 2);
  ctx.restore();

  return { width, height };
}

function drawAvatar(ctx, x, y, size, phase, options = {}) {
  const bob = Math.sin(phase) * 10;
  const blink = Math.cos(phase * 2) > 0.92;
  const mouthOpen = Math.sin(phase * 3) > 0.15;
  const wave = options.wave ? Math.sin(phase * 1.8) * 0.3 : 0;
  const px = x;
  const py = y + bob;

  ctx.save();
  ctx.translate(px, py);

  drawGlow(ctx, size * 0.5, size * 0.58, size * 0.72, 'rgba(0, 245, 160, 0.1)');

  ctx.fillStyle = 'rgba(0, 245, 160, 0.08)';
  ctx.beginPath();
  ctx.roundRect(size * 0.06, size * 0.08, size * 0.88, size * 0.92, 44);
  ctx.fill();

  ctx.fillStyle = C.avatarSuit;
  ctx.beginPath();
  ctx.roundRect(size * 0.2, size * 0.56, size * 0.6, size * 0.34, 36);
  ctx.fill();

  ctx.fillStyle = C.avatarShirt;
  ctx.beginPath();
  ctx.moveTo(size * 0.39, size * 0.57);
  ctx.lineTo(size * 0.5, size * 0.72);
  ctx.lineTo(size * 0.61, size * 0.57);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.avatarTie;
  ctx.beginPath();
  ctx.moveTo(size * 0.48, size * 0.62);
  ctx.lineTo(size * 0.52, size * 0.62);
  ctx.lineTo(size * 0.56, size * 0.82);
  ctx.lineTo(size * 0.44, size * 0.82);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.avatarSkin;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.34, size * 0.19, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = C.avatarHair;
  ctx.beginPath();
  ctx.arc(size * 0.5, size * 0.28, size * 0.2, Math.PI, Math.PI * 2);
  ctx.lineTo(size * 0.7, size * 0.34);
  ctx.quadraticCurveTo(size * 0.59, size * 0.18, size * 0.35, size * 0.24);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = '#13211d';
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.018;
  const eyeY = size * 0.34;
  const leftEyeX = size * 0.44;
  const rightEyeX = size * 0.56;

  if (blink) {
    ctx.beginPath();
    ctx.moveTo(leftEyeX - size * 0.03, eyeY);
    ctx.lineTo(leftEyeX + size * 0.03, eyeY);
    ctx.moveTo(rightEyeX - size * 0.03, eyeY);
    ctx.lineTo(rightEyeX + size * 0.03, eyeY);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#10201b';
    ctx.beginPath();
    ctx.arc(leftEyeX, eyeY, size * 0.018, 0, Math.PI * 2);
    ctx.arc(rightEyeX, eyeY, size * 0.018, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.strokeStyle = '#aa5d55';
  ctx.lineWidth = size * 0.012;
  ctx.beginPath();
  if (mouthOpen) {
    ctx.ellipse(size * 0.5, size * 0.43, size * 0.035, size * 0.024, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(size * 0.46, size * 0.43);
    ctx.quadraticCurveTo(size * 0.5, size * 0.45, size * 0.54, size * 0.43);
  }
  ctx.stroke();

  const armY = size * 0.62;
  ctx.strokeStyle = C.avatarSuit;
  ctx.lineWidth = size * 0.045;
  ctx.beginPath();
  ctx.moveTo(size * 0.24, armY);
  ctx.lineTo(size * 0.12, size * 0.82);
  ctx.moveTo(size * 0.76, armY);
  if (options.wave) {
    ctx.lineTo(size * (0.88 + wave * 0.08), size * 0.44);
  } else {
    ctx.lineTo(size * 0.88, size * 0.82);
  }
  ctx.stroke();

  ctx.restore();
}

function drawProgress(ctx, activeIndex, total) {
  const width = 360;
  const x = 620;
  const y = 112;
  const gap = 18;
  const barWidth = (width - gap * (total - 1)) / total;

  for (let i = 0; i < total; i++) {
    ctx.fillStyle = i + 1 === activeIndex ? C.accent : 'rgba(255,255,255,0.1)';
    ctx.beginPath();
    ctx.roundRect(x + i * (barWidth + gap), y, barWidth, 10, 5);
    ctx.fill();
  }
}

function drawHookScene(script, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;

  fillBackground(ctx, phase);
  drawAvatar(ctx, 74, 320, 390, phase);
  drawRoundedPanel(ctx, 430, 240, 570, 840, 44);

  ctx.fillStyle = C.accent;
  ctx.font = '700 30px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KNOW-IT-ALL DAILY BRIEF', 490, 324);

  ctx.fillStyle = C.muted;
  ctx.font = '500 24px sans-serif';
  ctx.fillText(script.date, 490, 364);

  ctx.fillStyle = C.accent;
  ctx.fillRect(490, 392, 112, 4);

  ctx.fillStyle = C.text;
  ctx.font = '700 74px sans-serif';
  const hookLines = fitLines(ctx, script.hook, 450, 5);
  drawLines(ctx, hookLines, 490, 510, 88);

  ctx.fillStyle = C.muted;
  ctx.font = '500 28px sans-serif';
  ctx.fillText('Resumen rapido con tu avatar anfitrion.', 490, 960);

  ctx.fillStyle = C.accentSoft;
  ctx.font = '600 24px sans-serif';
  ctx.fillText('IA + negocios + contexto claro', 84, 768);

  return writeFile(outputPath, canvas.toBuffer('image/png'));
}

function drawSegmentScene(segment, total, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;

  fillBackground(ctx, phase);
  drawProgress(ctx, segment.index, total);
  drawAvatar(ctx, 60, 270, 350, phase);
  drawRoundedPanel(ctx, 392, 208, 628, 1180, 44);

  const pill = drawPill(ctx, segment.source.toUpperCase(), 438, 270);

  ctx.fillStyle = C.muted;
  ctx.font = '600 22px sans-serif';
  ctx.fillText(`Story ${segment.index} of ${total}`, 438 + pill.width + 24, 304);

  ctx.fillStyle = C.text;
  ctx.font = '700 58px sans-serif';
  const headlineLines = fitLines(ctx, segment.headline, 530, 3);
  const headlineBottom = 390 + drawLines(ctx, headlineLines, 438, 390, 72);

  ctx.fillStyle = C.accent;
  ctx.fillRect(438, headlineBottom + 12, 120, 4);

  ctx.fillStyle = C.text;
  ctx.font = '500 34px sans-serif';
  const bodyLines = fitLines(ctx, segment.body, 520, 8);
  drawLines(ctx, bodyLines, 438, headlineBottom + 84, 50);

  ctx.fillStyle = C.accent;
  ctx.font = '700 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(segment.emoji, 232, 950);

  ctx.textAlign = 'left';
  ctx.fillStyle = C.muted;
  ctx.font = '500 24px sans-serif';
  drawLines(
    ctx,
    ['Host reaction:', 'this one actually matters.'],
    86,
    1100,
    34
  );

  return writeFile(outputPath, canvas.toBuffer('image/png'));
}

function drawCTAScene(script, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;

  fillBackground(ctx, phase);
  drawRoundedPanel(ctx, 140, 220, 800, 1020, 48);
  drawAvatar(ctx, 300, 300, 480, phase, { wave: true });

  ctx.textAlign = 'center';
  ctx.fillStyle = C.accent;
  ctx.font = '700 30px sans-serif';
  ctx.fillText('MANANA TE LO CUENTO EN 60 SEGUNDOS', W / 2, 910);

  ctx.fillStyle = C.text;
  ctx.font = '700 62px sans-serif';
  const ctaLines = fitLines(ctx, script.cta, 620, 3);
  drawLines(ctx, ctaLines, W / 2, 1010, 78);

  ctx.fillStyle = C.muted;
  ctx.font = '500 28px sans-serif';
  ctx.fillText('Sigue la cuenta para el siguiente brief.', W / 2, 1270);

  return writeFile(outputPath, canvas.toBuffer('image/png'));
}

async function renderLoop(renderer, basename, tmpDir) {
  const pattern = join(tmpDir, `${basename}_%03d.png`);

  for (let i = 0; i < LOOP_FRAMES; i++) {
    const framePath = join(tmpDir, `${basename}_${String(i).padStart(3, '0')}.png`);
    await renderer(framePath, i);
  }

  return {
    type: 'sequence',
    pattern,
    fps: LOOP_FPS,
    frames: LOOP_FRAMES,
  };
}

export async function generateFrames(script, tmpDir) {
  const hook = await renderLoop(
    (outputPath, frameIndex) => drawHookScene(script, outputPath, frameIndex),
    'hook',
    tmpDir
  );

  const segments = [];
  for (let i = 0; i < script.segments.length; i++) {
    const segment = await renderLoop(
      (outputPath, frameIndex) =>
        drawSegmentScene(script.segments[i], script.segments.length, outputPath, frameIndex),
      `segment_${i + 1}`,
      tmpDir
    );
    segments.push(segment);
  }

  const cta = await renderLoop(
    (outputPath, frameIndex) => drawCTAScene(script, outputPath, frameIndex),
    'cta',
    tmpDir
  );

  console.log('[canvas] All animated scenes generated');
  return { hook, segments, cta };
}
