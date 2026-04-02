import { fetchFirstStoryImage } from '../enrich/story-image.js';

const story = {
  source: 'Preview Mode',
  headline: 'OpenAI launches new enterprise AI tools',
};

const imageUrl = await fetchFirstStoryImage(story);

if (!imageUrl) {
  console.log('[smoke:image] No image returned. Check GOOGLE_CUSTOM_SEARCH_API_KEY and GOOGLE_CUSTOM_SEARCH_ENGINE_ID.');
  process.exit(0);
}

console.log(`[smoke:image] ${imageUrl}`);
process.exit(0);
