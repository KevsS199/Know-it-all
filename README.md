# Know-it-all

Automated daily vertical video pipeline for AI and business news. It ingests current stories, selects the strongest items, generates a short Spanish script, and renders a narrated `1080x1920` MP4 ready for Reels, TikTok, or Shorts.

The project is designed to run locally or on a schedule through GitHub Actions.

---

## Sources

Current inputs include:

- RSS feeds such as Hacker News, MIT Technology Review, TechCrunch, and VentureBeat
- Recent YouTube coverage from selected channels when a transcript or usable description is available

The exact source list lives in [`src/ingest/rss.js`](/c:/Users/kevin/Documents/GitHub/Know-it-all/src/ingest/rss.js) and [`src/ingest/youtube.js`](/c:/Users/kevin/Documents/GitHub/Know-it-all/src/ingest/youtube.js).

---

## Pipeline

```text
Ingest -> Parse -> Synthesize -> TTS -> Canvas -> FFmpeg
```

1. `Ingest`
Pulls RSS stories and the latest usable YouTube video from configured channels.

2. `Parse`
Normalizes text, strips noisy markup, and removes duplicate stories.

3. `Synthesize`
Builds a structured Spanish script with a hook, 3 story segments, and a CTA.

4. `TTS`
Generates narrated audio clips through Google Cloud Text-to-Speech.

5. `Canvas`
Renders the animated vertical visual frames, including the robot avatar and speech-bubble news card design.

6. `FFmpeg`
Stitches frames and audio into the final MP4.

---

## Setup

### 1. Install dependencies

```bash
git clone https://github.com/KevsS199/Know-it-all.git
cd Know-it-all
npm install
```

### 2. Configure environment variables

Create a local `.env` file and add the keys you need.

Required for full runs:

- `ANTHROPIC_API_KEY`
- `YOUTUBE_API_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`

Optional:

- `OUTPUT_DIR`

Example local run:

```bash
npm start
```

Output is written to:

- [`output`](/c:/Users/kevin/Documents/GitHub/Know-it-all/output)

Typical final filename:

- `output/YYYY-MM-DD.mp4`

---

## Useful commands

Run the full pipeline:

```bash
npm start
```

Render a fast visual-only preview:

```bash
npm run preview
```

Smoke-test RSS ingestion:

```bash
npm run smoke:rss
```

Smoke-test Google TTS:

```bash
npm run smoke:tts
```

Smoke-test story image lookup helper:

```bash
npm run smoke:image
```

---

## Assets

Avatar PNG expressions live in:

- [`public/avatar`](/c:/Users/kevin/Documents/GitHub/Know-it-all/public/avatar)

These are used by the canvas renderer to animate the robot host across the hook, story, and CTA scenes.

---

## GitHub Actions

To run this automatically in GitHub Actions, add these repository secrets:

- `ANTHROPIC_API_KEY`
- `YOUTUBE_API_KEY`
- `GOOGLE_APPLICATION_CREDENTIALS_JSON`

Then trigger the workflow from the Actions tab or wire it to a schedule.

---

## Project structure

```text
src/
  ingest/
    rss.js
    youtube.js
  parse/
    clean.js
  synthesize/
    claude.js
  render/
    tts.js
    canvas.js
    ffmpeg.js
  smoke/
    preview.js
    rss.js
    tts.js
    image-search.js
  index.js
public/
  avatar/
output/
```

---

## Notes

- Local runs load `.env` automatically through the npm scripts.
- The preview command is the fastest way to inspect layout and motion without waiting for the full content pipeline.
- If a story image is available from RSS or YouTube metadata, the renderer can place it inside the speech bubble card.

---

## License

MIT
