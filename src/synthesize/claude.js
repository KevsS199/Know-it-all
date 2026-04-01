import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic();
const MODEL = 'claude-opus-4-5';

const SYSTEM_PROMPT = `Eres el guionista de "Know-it-all", un noticiero diario de IA y negocios en formato Reels/TikTok vertical.

REGLAS ABSOLUTAS:
- Escribe TODO en español nativo. No traduzcas — piensa y redacta directamente en español.
- Tono: amigo inteligente explicando las noticias, directo, sin jerga innecesaria.
- Devuelve ÚNICAMENTE JSON válido. Sin markdown, sin comentarios, sin texto antes o después del JSON.

ESTRUCTURA DEL VIDEO:
- hook: gancho de apertura. Máximo 20 palabras. Debe atrapar en 3 segundos.
- segments: exactamente 3 historias. Cada una ~50 palabras en el body (~20 segundos narrados).
- cta: llamada a la acción. Máximo 15 palabras.

CRITERIOS DE SELECCIÓN:
- Elige las 3 historias con mayor impacto real en IA y negocios.
- Prioriza lo concreto (productos, decisiones, datos) sobre lo especulativo.
- Ignora noticias de entretenimiento, política sin relación con tech/negocios, o contenido de baja señal.

ESQUEMA JSON (devuelve exactamente esto, sin campos extra):
{
  "date": "YYYY-MM-DD",
  "hook": "string",
  "segments": [
    {
      "index": 1,
      "source": "string",
      "headline": "string — máximo 8 palabras",
      "body": "string — ~50 palabras, tono conversacional",
      "emoji": "string — un solo emoji representativo"
    }
  ],
  "cta": "string"
}`;

function buildUserPrompt(articles, date) {
  const lines = articles
    .map(
      (a, i) =>
        `[${i + 1}] FUENTE: ${a.source}\nTÍTULO: ${a.title}\nCONTENIDO: ${a.summary}`
    )
    .join('\n\n---\n\n');

  return `Fecha de hoy: ${date}\n\nArtículos disponibles:\n\n${lines}\n\nSelecciona las 3 mejores y genera el guión en JSON.`;
}

function validateScript(script) {
  if (!script.hook || typeof script.hook !== 'string') throw new Error('Missing or invalid hook');
  if (!Array.isArray(script.segments) || script.segments.length !== 3)
    throw new Error(`Expected 3 segments, got ${script.segments?.length}`);
  for (const s of script.segments) {
    if (!s.headline || !s.body || !s.emoji || !s.source)
      throw new Error(`Segment ${s.index} is missing required fields`);
  }
  if (!script.cta || typeof script.cta !== 'string') throw new Error('Missing or invalid cta');
}

export async function synthesize(articles) {
  const date = new Date().toISOString().split('T')[0];
  const userPrompt = buildUserPrompt(articles, date);

  console.log(`[claude] Sending ${articles.length} articles to ${MODEL}...`);

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const raw = message.content[0]?.text || '';

  let script;
  try {
    // Strip accidental markdown code fences if Claude adds them
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    script = JSON.parse(cleaned);
  } catch (err) {
    console.error('[claude] Raw response:\n', raw);
    throw new Error(`Claude returned invalid JSON: ${err.message}`);
  }

  validateScript(script);
  script.date = date; // always use today's date

  console.log(`[claude] Script generated: "${script.hook.slice(0, 60)}..."`);
  return script;
}
