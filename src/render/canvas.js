import { createCanvas, loadImage } from '@napi-rs/canvas';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const W = 1080;
const H = 1920;
const LOOP_FRAMES = 12;
const LOOP_FPS = 6;
const AVATAR_DIR = join(process.cwd(), 'public', 'avatar');

const C = {
  bg: '#0b0614',
  bgDeep: '#05030b',
  panel: 'rgba(26, 14, 45, 0.9)',
  bubble: 'rgba(20, 11, 38, 0.95)',
  bubbleStroke: 'rgba(171, 107, 255, 0.24)',
  accent: '#ab6bff',
  accentSoft: '#d7bbff',
  accentDim: '#7f49c9',
  text: '#f6f2ff',
  muted: '#b9add2',
  shadow: 'rgba(0, 0, 0, 0.28)',
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

function getBlockHeight(lineCount, lineHeight) {
  if (lineCount <= 0) return 0;
  return (lineCount - 1) * lineHeight + lineHeight;
}

function drawPill(ctx, text, x, y, options = {}) {
  const {
    font = '600 24px sans-serif',
    bg = 'rgba(171, 107, 255, 0.16)',
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

function drawSpeechBubble(ctx, x, y, w, h, tail = 'left') {
  ctx.save();
  ctx.shadowColor = C.shadow;
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = C.bubble;
  ctx.strokeStyle = C.bubbleStroke;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 46);
  if (tail === 'left') {
    ctx.moveTo(x + 110, y + h);
    ctx.lineTo(x + 72, y + h + 58);
    ctx.lineTo(x + 168, y + h - 4);
    ctx.closePath();
  } else {
    ctx.moveTo(x + w - 110, y + h);
    ctx.lineTo(x + w - 72, y + h + 58);
    ctx.lineTo(x + w - 168, y + h - 4);
    ctx.closePath();
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

async function drawStoryCard(ctx, segment, x, y, w, h) {
  const image = await getStoryImage(segment.storyImageUrl);

  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.strokeStyle = 'rgba(171, 107, 255, 0.18)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 28);
  ctx.fill();
  ctx.stroke();

  if (image) {
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
  } else {
    ctx.fillStyle = C.accentSoft;
    ctx.font = '700 26px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NEWS', x + w / 2, y + h / 2 - 8);
    ctx.fillStyle = C.muted;
    ctx.font = '500 20px sans-serif';
    ctx.fillText(segment.source.toUpperCase(), x + w / 2, y + h / 2 + 28);
  }

  ctx.restore();
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

async function drawHookScene(script, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;
  const bubbleX = 300;
  const bubbleY = 130;
  const bubbleW = 650;
  const titleX = 360;
  const titleY = 228;

  fillBackground(ctx, phase);
  drawProgress(ctx, 1, 3);
  await drawAvatar(ctx, -170, 820, 900, phase, 'logo');

  ctx.fillStyle = C.accent;
  ctx.font = '700 28px sans-serif';
  ctx.textAlign = 'left';
  const headerY = titleY;
  const dateY = headerY + 42;

  ctx.fillStyle = C.text;
  ctx.font = '700 74px sans-serif';
  const hookLines = fitLines(ctx, script.hook, 500, 5);
  const hookBlockHeight = getBlockHeight(hookLines.length, 82);
  const hookTextY = dateY + 82;
  const footerY = hookTextY + hookBlockHeight + 60;
  const bubbleH = Math.max(560, footerY - bubbleY + 86);

  drawSpeechBubble(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 'left');

  ctx.fillStyle = C.accent;
  ctx.font = '700 28px sans-serif';
  ctx.fillText('KNOW-IT-ALL DAILY BRIEF', titleX, headerY);

  ctx.fillStyle = C.muted;
  ctx.font = '500 24px sans-serif';
  ctx.fillText(script.date, titleX, dateY);

  ctx.fillStyle = C.text;
  ctx.font = '700 74px sans-serif';
  drawLines(ctx, hookLines, titleX, hookTextY, 82);

  ctx.fillStyle = C.accentSoft;
  ctx.font = '600 26px sans-serif';
  ctx.fillText('Noticias explicadas por tu robot anfitrión', titleX, footerY);

  await writeFile(outputPath, canvas.toBuffer('image/png'));
}

async function drawSegmentScene(segment, total, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;
  const bubbleX = 300;
  const bubbleY = 130;
  const bubbleW = 650;
  const contentX = 352;
  const storyCardX = 820;
  const storyCardY = 180;
  const storyCardW = 260;
  const storyCardH = 280;

  fillBackground(ctx, phase);
  drawProgress(ctx, segment.index, total);
  await drawStoryCard(ctx, segment, storyCardX, storyCardY, storyCardW, storyCardH);

  ctx.fillStyle = C.muted;
  ctx.font = '600 22px sans-serif';

  ctx.fillStyle = C.text;
  ctx.font = '700 62px sans-serif';
  const headlineLines = fitLines(ctx, segment.headline, 260, 5);
  const headlineBlockHeight = getBlockHeight(headlineLines.length, 74);
  ctx.font = '500 34px sans-serif';
  const bodyLines = fitLines(ctx, segment.body, 520, 12);
  const bodyBlockHeight = getBlockHeight(bodyLines.length, 48);
  const pillY = 204;
  const headlineY = 286;
  const dividerY = headlineY + headlineBlockHeight + 10;
  const bodyY = dividerY + 72;
  const bubbleH = Math.max(620, bodyY + bodyBlockHeight - bubbleY + 96);

  drawSpeechBubble(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 'left');

  const pill = drawPill(ctx, segment.source.toUpperCase(), contentX, pillY);

  ctx.fillStyle = C.muted;
  ctx.font = '600 22px sans-serif';
  ctx.fillText(`Historia ${segment.index} de ${total}`, contentX + pill.width + 22, pillY + 34);

  ctx.fillStyle = C.accent;
  ctx.fillRect(contentX, dividerY, 120, 4);

  ctx.fillStyle = C.text;
  ctx.font = '700 62px sans-serif';
  drawLines(ctx, headlineLines, contentX, headlineY, 74);

  ctx.fillStyle = C.text;
  ctx.font = '500 34px sans-serif';
  drawLines(ctx, bodyLines, contentX, bodyY, 48);

  await drawAvatar(ctx, -220, 860, 980, phase, getSegmentExpression(segment.index));

  await writeFile(outputPath, canvas.toBuffer('image/png'));
}

async function drawCTAScene(script, outputPath, frameIndex) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const phase = (frameIndex / LOOP_FRAMES) * Math.PI * 2;
  const bubbleX = 90;
  const bubbleY = 160;
  const bubbleW = 650;
  const textX = 144;

  fillBackground(ctx, phase);
  await drawAvatar(ctx, 260, 760, 840, phase, 'share');

  ctx.textAlign = 'left';
  ctx.fillStyle = C.accent;
  ctx.font = '700 30px sans-serif';

  ctx.fillStyle = C.text;
  ctx.font = '700 64px sans-serif';
  const ctaLines = fitLines(ctx, script.cta, 520, 4);
  const ctaBlockHeight = getBlockHeight(ctaLines.length, 76);
  const headerY = 270;
  const ctaY = 370;
  const footerY = ctaY + ctaBlockHeight + 64;
  const bubbleH = Math.max(500, footerY - bubbleY + 86);

  drawSpeechBubble(ctx, bubbleX, bubbleY, bubbleW, bubbleH, 'right');

  ctx.fillStyle = C.accent;
  ctx.font = '700 30px sans-serif';
  ctx.fillText('SIGUE LA CUENTA', textX, headerY);

  ctx.fillStyle = C.text;
  ctx.font = '700 64px sans-serif';
  drawLines(ctx, ctaLines, textX, ctaY, 76);

  ctx.fillStyle = C.muted;
  ctx.font = '500 28px sans-serif';
  ctx.fillText('Mañana hay otro brief con lo más importante.', textX, footerY);

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
