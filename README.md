# Chronoview — AI Time Machine

Click any place on the map → AI researches its history → generates images for each era → browse through time with a visual timeline.

## How It Works

1. **Click a location** on the dark world map
2. **Perplexity Sonar** researches the place and identifies 5-6 historically significant eras (structured JSON + reference images)
3. **Gemini Nano Banana** generates a cinematic image for each era using the research data + Google Search grounding + reference images
4. **Timeline UI** lets you browse through eras with progressive fill animation

## Tech Stack

- React 18 + Vite + TypeScript
- Tailwind CSS v4 + shadcn/ui primitives
- Mapbox GL JS (dark theme)
- Perplexity Sonar Pro API (historical research + structured JSON + image search)
- OpenRouter API → Gemini Nano Banana models (image generation)
- Geist Sans + Geist Mono fonts
- localStorage caching (1km radius dedup)

## Setup

```bash
# Clone
git clone <repo-url>
cd chronoview

# Install
npm install

# Configure API keys
cp .env.example .env
# Edit .env with your keys

# Run
npm run dev
```

## Required API Keys

| Key | Where to get it |
|-----|----------------|
| `VITE_PERPLEXITY_API_KEY` | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| `VITE_OPENROUTER_API_KEY` | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `VITE_MAPBOX_TOKEN` | [mapbox.com/account/access-tokens](https://account.mapbox.com/access-tokens/) |
| `VITE_IMAGE_MODEL` (optional) | Override model. Default: `google/gemini-2.5-flash-image` |

## Architecture

```
User clicks map (lat, lng)
  │
  ├─ Cache hit? (within 1km) → Show cached eras + images instantly
  │
  └─ Cache miss →
      │
      ├─ Perplexity Sonar Pro
      │   ├─ Structured JSON: place name, country, 5-6 eras
      │   ├─ Each era: label, year, description, image prompt, camera angle
      │   └─ Reference images from web search (wikimedia, etc.)
      │
      └─ For each era (sequential):
          │
          └─ OpenRouter → Gemini Nano Banana
              ├─ Image prompt from Perplexity research
              ├─ Reference images as image_url parts (up to 3)
              ├─ modalities: ["image", "text"]
              └─ Output: 16:9, 1K resolution, base64 PNG
```

## License

MIT
