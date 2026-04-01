import { mkdir, rm } from 'fs/promises';

import { generateAudio } from '../render/tts.js';

const tmpDir = './output/.tmp_tts_smoke';
const script = {
  hook: 'Prueba de hook',
  segments: [
    { index: 1, headline: 'Uno', body: 'Texto uno', emoji: '1', source: 'smoke' },
    { index: 2, headline: 'Dos', body: 'Texto dos', emoji: '2', source: 'smoke' },
    { index: 3, headline: 'Tres', body: 'Texto tres', emoji: '3', source: 'smoke' },
  ],
  cta: 'Cierre',
};

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

const paths = await generateAudio(script, tmpDir);

console.log('\n[smoke:tts] Google TTS OK');
console.log(`[smoke:tts] Files: ${Object.keys(paths).length}`);
console.log(`[smoke:tts] Output dir: ${tmpDir}`);

process.exit(0);
