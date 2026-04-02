const GOOGLE_IMAGE_SEARCH_URL = 'https://customsearch.googleapis.com/customsearch/v1';

function compactTerms(value) {
  return String(value || '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildStoryImageQuery(story) {
  const parts = [
    compactTerms(story?.headline),
    compactTerms(story?.title),
    compactTerms(story?.source),
  ].filter(Boolean);

  return parts.join(' ');
}

export async function fetchFirstStoryImage(story, options = {}) {
  const key = options.apiKey || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
  const cx = options.searchEngineId || process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;
  const query = options.query || buildStoryImageQuery(story);

  if (!key || !cx || !query) {
    return null;
  }

  const params = new URLSearchParams({
    key,
    cx,
    q: query,
    searchType: 'image',
    num: '1',
    safe: 'active',
    imgSize: 'large',
  });

  const response = await fetch(`${GOOGLE_IMAGE_SEARCH_URL}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Google image search failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.items?.[0]?.link || null;
}
