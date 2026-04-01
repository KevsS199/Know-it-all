const DUPLICATE_THRESHOLD = 0.6;

function tokenize(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardOverlap(a, b) {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (!tokensA.size || !tokensB.size) return 0;

  let intersection = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) intersection++;
  }

  const union = new Set([...tokensA, ...tokensB]).size;
  return intersection / union;
}

function isDuplicate(candidate, accepted) {
  for (const a of accepted) {
    if (jaccardOverlap(candidate.title, a.title) >= DUPLICATE_THRESHOLD) return true;
  }
  return false;
}

export function cleanAndDeduplicate(articles) {
  const accepted = [];

  for (const article of articles) {
    if (!article.title || !article.summary) continue;
    if (isDuplicate(article, accepted)) {
      console.log(`[parse] Duplicate dropped: "${article.title.slice(0, 60)}"`);
      continue;
    }
    accepted.push(article);
  }

  console.log(`[parse] ${articles.length} in → ${accepted.length} out (${articles.length - accepted.length} duplicates removed)`);
  return accepted;
}
