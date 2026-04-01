import { YoutubeTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';

const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const MAX_TRANSCRIPT_CHARS = 3000;
const MAX_DESCRIPTION_CHARS = 1200;
const WINDOW_HOURS = 48;

// Primary + backup channels
const CHANNELS = [
  { name: 'Wes Roth', id: 'UCnksaZxhG_TLABaBlD04uTQ' },
  { name: 'Matt Wolfe', id: 'UCXv0mDzsyjDetlRklSXTQIQ' },
];

async function getLatestVideo(channelId, apiKey) {
  const url =
    `${YOUTUBE_API}/search?part=snippet&channelId=${channelId}` +
    `&order=date&maxResults=1&type=video&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);

  const data = await res.json();
  if (!data.items?.length) return null;

  const item = data.items[0];
  const publishedAt = item.snippet?.publishedAt;

  // Check if within window
  if (publishedAt) {
    const pub = new Date(publishedAt);
    const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
    if (pub < cutoff) return null;
  }

  return {
    videoId: item.id?.videoId,
    title: item.snippet?.title || '',
    description: (item.snippet?.description || '').slice(0, MAX_DESCRIPTION_CHARS),
    publishedAt,
  };
}

async function getTranscript(videoId) {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId, { lang: 'en' });
    return segments
      .map((s) => s.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, MAX_TRANSCRIPT_CHARS);
  } catch {
    return null;
  }
}

async function tryChannel(channel, apiKey) {
  try {
    const video = await getLatestVideo(channel.id, apiKey);
    if (!video?.videoId) {
      console.log(`[youtube] ${channel.name}: no recent video`);
      return null;
    }

    // Try transcript first, fall back to description
    let content = await getTranscript(video.videoId);
    let contentSource = 'transcript';

    if (!content) {
      console.log(`[youtube] ${channel.name}: transcript unavailable, using description`);
      content = video.description;
      contentSource = 'description';
    }

    if (!content) {
      console.log(`[youtube] ${channel.name}: no usable content`);
      return null;
    }

    console.log(`[youtube] ${channel.name}: OK (${contentSource}, ${content.length} chars)`);
    return {
      source: channel.name,
      title: video.title,
      summary: content,
      url: `https://www.youtube.com/watch?v=${video.videoId}`,
      publishedAt: video.publishedAt,
    };
  } catch (err) {
    console.warn(`[youtube] ${channel.name} failed: ${err.message}`);
    return null;
  }
}

export async function ingestYouTube() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('[youtube] YOUTUBE_API_KEY not set — skipping');
    return null;
  }

  for (const channel of CHANNELS) {
    const result = await tryChannel(channel, apiKey);
    if (result) return result;
  }

  console.warn('[youtube] All channels skipped or failed');
  return null;
}
