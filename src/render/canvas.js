import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const W = 1080;
const H = 1920;
const LOOP_FRAMES = 12;
const LOOP_FPS = 6;
const GRID = 8;
const CARD_X = 184;
const CARD_Y = 152;
const CARD_W = 688;
const CARD_H = 792;
const CARD_PAD_X = GRID * 7;
const CARD_PAD_TOP = GRID * 7;
const CONTENT_X = CARD_X + CARD_PAD_X;
const CONTENT_W = CARD_W - CARD_PAD_X * 2;
const AVATAR_DIR = join(process.cwd(), 'public', 'avatar');

const C = {
  bg: '#0b0614',
  bgDeep: '#05030b',
  bubble: 'rgba(20, 11, 38, 0.95)',
  bubbleStroke: 'rgba(171, 107, 255, 0.24)',
  accent: '#ab6bff',
  accentSoft: '#d7bbff',
  text: '#f6f2ff',
  muted: '#b9add2',
};

const AVATAR_FILES = {
  normal: 'Web Mentor Robot Normal.png',
  happy: 'Web Mentor Robot Happy.png',
  hearts: 'Web Mentor Robot Hearts.png',
  logo: 'Web Mentor Robot Logo.png',
  share: 'Web Mentor Robot Share.png',
};

const avatarImagePromises = Object.fromEntries(
  Object.entries(AVATAR_FILES).map(([key, file]) => [key, loadImage(join(AVATAR_DIR, file))])
);
const storyImageCache = new Map();

async function getAvatarImage(name) {
  return avatarImagePromises[name] || avatarImagePromises.normal;
}

async function getStoryImage(url) {
  if (!url) return null;
  if (!storyImageCache.has(url)) {
    storyImageCache.set(
      url,
      (async () => {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) return null;
          const bytes = await response.arrayBuffer();
          return await loadImage(Buffer.from(bytes));
        } catch {
          return null;
        }
      })()
    );
  }
  return storyImageCache.get(url);
}

function fillBackground(ctx, phase) {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, C.bg);
  bg.addColorStop(1, C.bgDeep);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  drawGlow(ctx, W * 0.78 + Math.sin(phase) * 20, H * 0.24, 280, 'rgba(171, 107, 255, 0.16)');
  drawGlow(ctx, W * 0.22, H * 0.84 + Math.cos(phase) * 24, 320, 'rgba(110, 78, 255, 0.14)');

  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
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

  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.18, W / 2, H / 2, H * 0.78);
  vignette.addColorStop(0, 'rgba(5, 3, 11, 0)');
  vignette.addColorStop(0.72, 'rgba(5, 3, 11, 0.16)');
  vignette.addColorStop(1, 'rgba(5, 3, 11, 0.52)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
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
}

function drawTrackedText(ctx, text, x, y, tracking = 0) {
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
}

function drawPill(ctx, text, x, y, options = {}) {
  const {
    font = '600 22px sans-serif',
    bg = 'rgba(171, 107, 255, 0.1)',
    fg = '#efe6ff',
    stroke = 'rgba(215, 187, 255, 0.28)',
    paddingX = 18,
    paddingY = 8,
  } = options;

  ctx.save();
  ctx.font = font;
  const fontSize = Number(font.match(/(\d+)px/)?.[1] || 22);
  const textWidth = ctx.measureText(text).width;
  const height = fontSize + paddingY * 2;
  const width = textWidth + paddingX * 2;

  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, height / 2);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = fg;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + paddingX, y + height / 2);
  ctx.restore();

  return { width, height };
}

function drawSpeechBubble(ctx, x, y, w, h, tail = 'left', tailTarget = null) {
  ctx.save();
  ctx.shadowColor = 'rgba(115, 72, 201, 0.26)';
  ctx.shadowBlur = 46;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = C.bubble;
  ctx.strokeStyle = C.bubbleStroke;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 46);
  if (tail === 'left') {
    const targetX = tailTarget?.x ?? x + 94;
    const targetY = tailTarget?.y ?? y + h + 68;
    ctx.moveTo(x + 150, y + h - 8);
    ctx.quadraticCurveTo(x + 128, y + h + 18, targetX, targetY);
    ctx.quadraticCurveTo(x + 144, y + h + 34, x + 214, y + h + 10);
    ctx.closePath();
  } else {
    const targetX = tailTarget?.x ?? x + w - 94;
    const targetY = tailTarget?.y ?? y + h + 68;
    ctx.moveTo(x + w - 150, y + h - 8);
    ctx.quadraticCurveTo(x + w - 128, y + h + 18, targetX, targetY);
    ctx.quadraticCurveTo(x + w - 144, y + h + 34, x + w - 214, y + h + 10);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

async function drawStoryImagePanel(ctx, imageUrl, x, y, w, h) {
  const image = await getStoryImage(imageUrl);
  if (!image) return false;

  ctx.save();
  ctx.shadowColor = 'rgba(90, 54, 164, 0.2)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 12;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.strokeStyle = 'rgba(171, 107, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.fill();
  ctx.stroke();

  const scale = Math.max(w / image.width, h / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (w - drawWidth) / 2;
  const drawY = y + (h - drawHeight) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.clip();
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();

  ctx.restore();
  return true;
}

async function drawAvatar(ctx, x, y, size, phase, expression) {
  const image = await getAvatarImage(expression);
  const bob = Math.sin(phase) * 18 + Math.sin(phase * 2) * 6;
  const scale = Math.min(size / image.width, size / image.height);
  const pulse = 1 + Math.sin(phase * 1.4) * 0.03;
  const drawWidth = image.width * scale * 1.56 * pulse;
  const drawHeight = image.height * scale * 1.56 * pulse;
  const offsetX = (size - drawWidth) / 2;
  const offsetY = size - drawHeight;

  ctx.save();
  ctx.translate(x, y + bob);
  ctx.rotate(Math.sin(phase * 0.7) * 0.022);
  drawGlow(ctx, size * 0.56, size * 0.62, size * 0.92, 'rgba(171, 107, 255, 0.22)');
  ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
  ctx.restore();
}

function drawProgress(ctx, activeIndex, total) {
  const width = 360;
  const x = W / 2 - width / 2;
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

function getSegmentExpression(index) {
  const expressions = ['normal', 'happy', 'hearts'];
  return expressions[(index - 1) % expressions.length];
}

function formatDisplayDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(date);
}

async function drawHookScene(script, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;

  fillBackground(ctx, phase);
  drawProgress(ctx, 1, 3);
  drawGlow(ctx, 242, 1228, 320, 'rgba(171, 107, 255, 0.22)');
  drawSpeechBubble(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 'left', { x: 208, y: CARD_Y + CARD_H + 124 });
  await drawAvatar(ctx, -12, 720, 1060, phase, 'logo');

  const headerY = CARD_Y + CARD_PAD_TOP;
  const dateY = headerY + 44;
  const hookY = dateY + 84;
  const footerRuleY = CARD_Y + CARD_H - 118;
  const footerTextY = CARD_Y + CARD_H - 80;

  ctx.textAlign = 'left';
  ctx.fillStyle = C.accent;
  ctx.font = '700 24px sans-serif';
  drawTrackedText(ctx, 'KNOW-IT-ALL DAILY BRIEF', CONTENT_X, headerY, 3.4);

  ctx.fillStyle = C.muted;
  ctx.font = '500 22px sans-serif';
  ctx.fillText(formatDisplayDate(script.date), CONTENT_X, dateY);

  ctx.fillStyle = C.text;
  ctx.font = '700 42px sans-serif';
  const hookLines = fitLines(ctx, script.hook, CONTENT_W - 24, 3);
  drawLines(ctx, hookLines, CONTENT_X, hookY, 50);

  ctx.fillStyle = 'rgba(171, 107, 255, 0.9)';
  ctx.fillRect(CONTENT_X, footerRuleY, 96, 2);

  ctx.fillStyle = C.accentSoft;
  ctx.font = '600 22px sans-serif';
  ctx.fillText('Noticias explicadas por tu robot anfitrión', CONTENT_X, footerTextY);

  await writeFile(outputPath, canvas.toBuffer('image/png'));
}

async function drawSegmentScene(segment, total, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;
  const imagePanelX = CONTENT_X;
  const imagePanelY = CARD_Y + CARD_H - 248;
  const imagePanelW = CONTENT_W;
  const imagePanelH = 180;
  const hasStoryImage = Boolean(await getStoryImage(segment.storyImageUrl));

  fillBackground(ctx, phase);
  drawProgress(ctx, segment.index, total);
  drawGlow(ctx, 278, 1292, 320, 'rgba(171, 107, 255, 0.24)');
  drawSpeechBubble(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 'left', { x: 220, y: CARD_Y + CARD_H + 138 });

  ctx.font = '700 42px sans-serif';
  const headlineLines = fitLines(ctx, segment.headline, CONTENT_W - 24, 3);
  const headlineBlockHeight = Math.max(50, headlineLines.length * 50);

  ctx.font = '500 26px sans-serif';
  const bodyLines = fitLines(ctx, segment.body, CONTENT_W - 16, hasStoryImage ? 5 : 7);

  const pillY = CARD_Y + CARD_PAD_TOP;
  const metaY = pillY + 30;
  const headlineY = pillY + 96;
  const dividerY = headlineY + headlineBlockHeight + 24;
  const bodyY = dividerY + 44;
  const bodyBottomY = bodyY + (bodyLines.length - 1) * 38;
  const minImageY = bodyBottomY + 48;
  const resolvedImageY = Math.max(imagePanelY, minImageY);
  const canFitImage = hasStoryImage && resolvedImageY + imagePanelH <= CARD_Y + CARD_H - 40;

  const pill = drawPill(ctx, segment.source, CONTENT_X, pillY);

  ctx.fillStyle = C.muted;
  ctx.font = '600 18px sans-serif';
  ctx.fillText(`Historia ${segment.index} de ${total}`, CONTENT_X + pill.width + 20, metaY);

  ctx.fillStyle = C.text;
  ctx.font = '700 42px sans-serif';
  drawLines(ctx, headlineLines, CONTENT_X, headlineY, 50);

  ctx.fillStyle = 'rgba(171, 107, 255, 0.9)';
  ctx.fillRect(CONTENT_X, dividerY, 88, 2);

  ctx.fillStyle = '#e7def6';
  ctx.font = '500 26px sans-serif';
  drawLines(ctx, bodyLines, CONTENT_X, bodyY, 38);

  if (canFitImage) {
    await drawStoryImagePanel(ctx, segment.storyImageUrl, imagePanelX, resolvedImageY, imagePanelW, imagePanelH);
  } else {
    // Fallback when no image exists or long copy would crush it: keep the footer intentional.
    ctx.fillStyle = 'rgba(171, 107, 255, 0.14)';
    ctx.fillRect(CONTENT_X, CARD_Y + CARD_H - 120, CONTENT_W, 1);
    ctx.fillStyle = C.muted;
    ctx.font = '500 20px sans-serif';
    ctx.fillText(segment.source, CONTENT_X, CARD_Y + CARD_H - 84);
  }

  await drawAvatar(ctx, 28, CARD_Y + CARD_H - 304, 1380, phase, getSegmentExpression(segment.index));

  await writeFile(outputPath, canvas.toBuffer('image/png'));
}

async function drawCTAScene(script, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;

  fillBackground(ctx, phase);
  drawProgress(ctx, 3, 3);
  drawGlow(ctx, 788, 1270, 320, 'rgba(171, 107, 255, 0.24)');
  drawSpeechBubble(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 'right', { x: 772, y: CARD_Y + CARD_H + 134 });
  await drawAvatar(ctx, 300, CARD_Y + CARD_H - 312, 1180, phase, 'share');

  const labelY = CARD_Y + CARD_PAD_TOP;
  const ctaY = labelY + 104;
  const footerY = CARD_Y + CARD_H - 92;

  ctx.textAlign = 'left';
  ctx.fillStyle = C.accent;
  ctx.font = '700 24px sans-serif';
  drawTrackedText(ctx, 'SIGUE LA CUENTA', CONTENT_X, labelY, 3.4);

  ctx.fillStyle = C.text;
  ctx.font = '700 42px sans-serif';
  const ctaLines = fitLines(ctx, script.cta, CONTENT_W - 24, 3);
  drawLines(ctx, ctaLines, CONTENT_X, ctaY, 50);

  ctx.fillStyle = 'rgba(171, 107, 255, 0.9)';
  ctx.fillRect(CONTENT_X, footerY - 34, 88, 2);

  ctx.fillStyle = C.muted;
  ctx.font = '500 24px sans-serif';
  ctx.fillText('Mañana hay otro brief con lo más importante.', CONTENT_X, footerY);

  await writeFile(outputPath, canvas.toBuffer('image/png'));
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
