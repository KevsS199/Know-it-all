import { ingestRSS } from '../ingest/rss.js';

const start = Date.now();
const articles = await ingestRSS();
const elapsedMs = Date.now() - start;
const sources = [...new Set(articles.map((article) => article.source))];

console.log('\n[smoke:rss] RSS ingest OK');
console.log(`[smoke:rss] Articles: ${articles.length}`);
console.log(`[smoke:rss] Sources: ${sources.join(', ')}`);
console.log(`[smoke:rss] Time: ${elapsedMs}ms`);

process.exit(0);
