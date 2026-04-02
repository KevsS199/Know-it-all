import { mkdir, rm } from 'fs/promises';
import { join } from 'path';

import { generateFrames } from '../render/canvas.js';
import { renderPreviewVideo } from '../render/ffmpeg.js';

const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';
const tmpDir = join(OUTPUT_DIR, '.tmp_preview');
const outputPath = join(OUTPUT_DIR, 'preview.mp4');

const script = {
  date: new Date().toISOString().split('T')[0],
  hook: 'Así se verá el brief de hoy con avatar, burbuja y movimiento mínimo.',
  segments: [
    {
      index: 1,
      source: 'Preview Mode',
      headline: 'Este video existe solo para revisar diseño',
      body: 'Usa este preview para checar colores, posiciones, tipografía y expresiones del avatar sin esperar toda la cadena de ingestión, síntesis, voz y render completo.',
      emoji: 'AI',
    },
    {
      index: 2,
      source: 'Preview Mode',
      headline: 'Segundo bloque de ejemplo',
      body: 'Este segmento extra existe para que el layout se parezca al real cuando cambies la composición o el avatar.',
      emoji: 'GO',
    },
    {
      index: 3,
      source: 'Preview Mode',
      headline: 'Tercer bloque de ejemplo',
      body: 'Si el look te convence aquí, después ya vale la pena correr el pipeline completo con noticias reales.',
      emoji: 'OK',
    },
  ],
  cta: 'Si te gusta este look, ahora sí lanzamos el render completo.',
};

await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });
await mkdir(OUTPUT_DIR, { recursive: true });

const framePaths = await generateFrames(script, tmpDir);
await renderPreviewVideo(framePaths, outputPath, tmpDir);

console.log(`\n[preview] Ready: ${outputPath}`);
process.exit(0);
