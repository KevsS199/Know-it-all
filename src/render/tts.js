import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const VOICE = {
  languageCode: 'es-US',
  name: 'es-US-Journey-F',
};

const AUDIO_CONFIG = {
  audioEncoding: 'MP3',
  speakingRate: 1.05,
};

function bypassBrokenProxyForGoogleApis() {
  const proxyKeys = [
    'HTTP_PROXY',
    'HTTPS_PROXY',
    'ALL_PROXY',
    'http_proxy',
    'https_proxy',
    'all_proxy',
  ];
  const brokenProxyPattern = /^https?:\/\/(?:127\.0\.0\.1|localhost):9\/?$/i;

  const hasBrokenProxy = proxyKeys.some((key) => {
    const value = process.env[key];
    return value && brokenProxyPattern.test(value);
  });

  if (!hasBrokenProxy) return;

  for (const key of proxyKeys) {
    delete process.env[key];
  }

  const noProxyHosts = [
    'localhost',
    '127.0.0.1',
    '::1',
    '.googleapis.com',
    'googleapis.com',
    'oauth2.googleapis.com',
    'texttospeech.googleapis.com',
  ];

  const existing = (process.env.NO_PROXY || process.env.no_proxy || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const merged = [...new Set([...existing, ...noProxyHosts])];
  process.env.NO_PROXY = merged.join(',');
  process.env.no_proxy = process.env.NO_PROXY;

  console.warn('[tts] Ignoring broken local proxy settings for Google TTS');
}

function buildClient() {
  bypassBrokenProxyForGoogleApis();

  const jsonEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  if (jsonEnv) {
    const credentials = JSON.parse(jsonEnv);
    return new TextToSpeechClient({ credentials });
  }
  // Falls back to GOOGLE_APPLICATION_CREDENTIALS file path (set by ADC)
  return new TextToSpeechClient();
}

async function synthesizeSpeech(client, text, outputPath) {
  const [response] = await client.synthesizeSpeech({
    input: { text },
    voice: VOICE,
    audioConfig: AUDIO_CONFIG,
  });
  await writeFile(outputPath, response.audioContent, 'binary');
  console.log(`[tts] Written: ${outputPath}`);
}

export async function generateAudio(script, tmpDir) {
  const client = buildClient();

  const sections = [
    { key: 'hook', text: script.hook },
    ...script.segments.map((s) => ({
      key: `segment_${s.index}`,
      text: `${s.headline}. ${s.body}`,
    })),
    { key: 'cta', text: script.cta },
  ];

  const paths = {};

  for (const section of sections) {
    const filePath = join(tmpDir, `${section.key}.mp3`);
    await synthesizeSpeech(client, section.text, filePath);
    paths[section.key] = filePath;
  }

  console.log(`[tts] Generated ${sections.length} audio files`);
  return paths;
}
