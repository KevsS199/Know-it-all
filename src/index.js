import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

import { ingestRSS } from './ingest/rss.js';
import { ingestYouTube } from './ingest/youtube.js';
import { cleanAndDeduplicate } from './parse/clean.js';
import { synthesize } from './synthesize/claude.js';
import { writePostDescription } from './output/description.js';
import { generateAudio } from './render/tts.js';
import { generateFrames } from './render/canvas.js';
import { renderVideo } from './render/ffmpeg.js';

const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';
const date = new Date().toISOString().split('T')[0];
const tmpDir = join(OUTPUT_DIR, `.tmp_${date}`);
const outputPath = join(OUTPUT_DIR, `${date}.mp4`);
const descriptionPath = join(OUTPUT_DIR, `${date}.txt`);

function log(stage, msg) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  [${stage}] ${msg}`);
  console.log('─'.repeat(50));
}

async function run() {
  // Setup dirs
  await mkdir(OUTPUT_DIR, { recursive: true });
  await mkdir(tmpDir, { recursive: true });

  try {
    // ── Stage 1: Ingest ────────────────────────────────
    log('INGEST', 'Fetching RSS + YouTube...');
    const [rssArticles, ytArticle] = await Promise.all([ingestRSS(), ingestYouTube()]);
    const raw = ytArticle ? [...rssArticles, ytArticle] : rssArticles;
    console.log(`Collected ${raw.length} raw articles`);

    // ── Stage 2: Parse ─────────────────────────────────
    log('PARSE', 'Cleaning and deduplicating...');
    const articles = cleanAndDeduplicate(raw);
    if (articles.length < 3) {
      throw new Error(`Not enough articles after dedup: ${articles.length} (need at least 3)`);
    }

    // ── Stage 3: Synthesize ────────────────────────────
    log('SYNTHESIZE', 'Generating Spanish script via Claude...');
    const script = await synthesize(articles);
    console.log(`Hook: "${script.hook}"`);
    const description = await writePostDescription(script, descriptionPath);
    console.log(`[description] Saved: ${descriptionPath}`);
    console.log(`[description] Preview: "${description.split('\n')[0]}"`);

    // ── Stage 4: TTS ───────────────────────────────────
    log('TTS', 'Generating audio with Google TTS...');
    const audioPaths = await generateAudio(script, tmpDir);

    // ── Stage 5: Canvas ────────────────────────────────
    log('CANVAS', 'Rendering 1080×1920 frames...');
    const framePaths = await generateFrames(script, tmpDir);

    // ── Stage 6: FFmpeg ────────────────────────────────
    log('FFMPEG', `Rendering final video → ${outputPath}`);
    await renderVideo(framePaths, audioPaths, outputPath, tmpDir);

    log('DONE', `Video ready: ${outputPath}`);
  } finally {
    // Always clean up tmp dir
    await rm(tmpDir, { recursive: true, force: true });
  }
}

run().catch((err) => {
  console.error('\n[FATAL]', err.message);
  process.exit(1);
});
