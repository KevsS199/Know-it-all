import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Know-it-all-bot/1.0)' },
  customFields: {
    item: [['content:encoded', 'contentEncoded']],
  },
});

const SOURCES = [
  {
    name: 'Hacker News',
    url: 'https://news.ycombinator.com/rss',
  },
  {
    name: 'MIT Technology Review',
    url: 'https://www.technologyreview.com/feed/',
  },
  {
    name: 'TechCrunch',
    url: 'https://techcrunch.com/feed/',
  },
  {
    name: 'Ben Evans',
    url: 'https://www.ben-evans.com/benedictevans/rss.xml',
  },
  {
    name: 'VentureBeat',
    url: 'https://venturebeat.com/feed/',
  },
];

const MAX_ARTICLES_PER_SOURCE = 3;
const MAX_SUMMARY_CHARS = 800;
const WINDOW_HOURS = 48;
const FETCH_TIMEOUT_MS = 12000;

function extractImageUrl(item) {
  const candidates = [
    item.enclosure?.url,
    item['media:content']?.url,
    item['media:thumbnail']?.url,
    item.thumbnail,
  ].filter(Boolean);

  const htmlSources = [item.contentEncoded, item.content, item.summary];
  for (const html of htmlSources) {
    const match = String(html || '').match(/<img[^>]+src=["']([^"']+)["']/i);
    if (match?.[1]) candidates.push(match[1]);
  }

  return candidates.find((value) => /^https?:\/\//i.test(value)) || null;
}

function extractText(item) {
  const raw = item.contentEncoded || item.content || item.summary || item.contentSnippet || '';

  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_SUMMARY_CHARS);
}

function isWithinWindow(dateStr) {
  if (!dateStr) return true;

  const pub = new Date(dateStr);
  if (Number.isNaN(pub.getTime())) return true;

  const cutoff = new Date(Date.now() - WINDOW_HOURS * 60 * 60 * 1000);
  return pub >= cutoff;
}

function describeSourceError(err) {
  const message = err?.message || 'Unknown error';

  if (/altnames|certificate|TLS/i.test(message)) {
    return 'TLS certificate mismatch';
  }

  if (/timeout/i.test(message)) {
    return 'Request timed out';
  }

  if (/ENOTFOUND|EAI_AGAIN/i.test(message)) {
    return 'DNS lookup failed';
  }

  if (/ECONNRESET|socket hang up/i.test(message)) {
    return 'Connection reset';
  }

  return message;
}

async function withTimeout(promise, timeoutMs, sourceName) {
  let timeoutId;

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${sourceName} request timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchSource(source) {
  try {
    const feed = await withTimeout(parser.parseURL(source.url), FETCH_TIMEOUT_MS, source.name);
    const articles = feed.items
      .filter((item) => isWithinWindow(item.pubDate || item.isoDate))
      .slice(0, MAX_ARTICLES_PER_SOURCE)
      .map((item) => ({
        source: source.name,
        title: (item.title || '').trim(),
        summary: extractText(item),
        imageUrl: extractImageUrl(item),
        url: item.link || '',
        publishedAt: item.pubDate || item.isoDate || null,
      }))
      .filter((article) => article.title && article.summary);

    console.log(`[rss] ${source.name}: ${articles.length} articles`);
    return { source: source.name, articles, error: null };
  } catch (err) {
    return {
      source: source.name,
      articles: [],
      error: describeSourceError(err),
    };
  }
}

export async function ingestRSS() {
  const results = await Promise.all(SOURCES.map(fetchSource));
  const articles = results.flatMap((result) => result.articles);
  const failures = results.filter((result) => result.error);

  if (failures.length > 0) {
    const summary = failures.map((result) => `${result.source} (${result.error})`).join(', ');
    console.warn(`[rss] Skipped ${failures.length} source${failures.length === 1 ? '' : 's'}: ${summary}`);
  }

  if (articles.length === 0) {
    throw new Error('All RSS sources failed - cannot continue');
  }

  console.log(`[rss] Total articles ingested: ${articles.length}`);
  return articles;
}
