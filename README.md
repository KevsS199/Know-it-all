# Know-it-all 🧠

Automated daily vertical video (1080×1920) that ingests the top AI & business newsletters, synthesizes the 3 most relevant insights of the day using Claude, and renders a narrated MP4 in Spanish — ready for Instagram Reels or TikTok.

Runs every day at 7:00 AM UTC via GitHub Actions. Zero cost to run (free tiers cover everything at this scale).

---

## Sources

| Source | Type |
|---|---|
| Peter Diamandis — Moonshots | RSS |
| Harvard Business Review | RSS |
| Y Combinator Blog | RSS |
| AI Daily Brief | RSS |
| MIT Technology Review | RSS |
| Wes Roth | YouTube transcript |

---

## Pipeline

```
Ingest → Parse → Synthesize (Claude) → TTS → Canvas Frames → FFmpeg MP4
```

1. **Ingest** — pulls RSS feeds and the latest Wes Roth YouTube transcript
2. **Parse** — strips HTML, normalizes text, deduplicates similar stories
3. **Synthesize** — Claude selects the top 3 stories and writes a Spanish video script (hook + 3 segments + CTA) as structured JSON
4. **TTS** — Google Cloud Text-to-Speech generates one MP3 per script section (Spanish voice)
5. **Canvas** — `node-canvas` renders 1080×1920 PNG frames with dark design
6. **FFmpeg** — stitches frames + audio into a single MP4, synced by audio duration

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/KevsS199/Know-it-all.git
cd Know-it-all
npm install
```

### 2. Get your API keys

| Key | Where to get it |
|---|---|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `YOUTUBE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com) → APIs → YouTube Data API v3 |
| `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Google Cloud → IAM → Service Accounts → create key → download JSON → paste as one line |

### 3. Configure environment

```bash
cp .env.example .env
# Fill in your keys in .env
```

### 4. Run locally

```bash
node --env-file=.env src/index.js
# Output: ./output/YYYY-MM-DD.mp4
```

---

## GitHub Actions (automated daily run)

Add the following **Repository Secrets** in `Settings → Secrets and variables → Actions`:

- `ANTHROPIC_API_KEY`
- `YOUTUBE_API_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`

The workflow runs automatically every day at 7:00 AM UTC. The rendered MP4 is uploaded as a GitHub Actions artifact (retained 30 days). You can also trigger it manually from the **Actions** tab.

---

## Project structure

```
src/
  ingest/
    rss.js          # Pulls all RSS sources
    youtube.js      # Wes Roth latest video transcript
  parse/
    clean.js        # HTML stripping, deduplication
  synthesize/
    claude.js       # Claude API → Spanish JSON script
  render/
    tts.js          # Google TTS → MP3 per section
    canvas.js       # node-canvas → 1080x1920 PNG frames
    ffmpeg.js       # fluent-ffmpeg → final MP4
  index.js          # Orchestrator
.github/
  workflows/
    daily.yml       # Cron job
```

---

## License

MIT
