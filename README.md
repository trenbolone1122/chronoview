# Chronoview — AI Time Machine

Click any place on the globe. AI researches its history, generates photorealistic images for each era, and lets you scrub through time on a visual timeline.

![React](https://img.shields.io/badge/React_19-20232A?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind_v4-38B2AC?style=flat&logo=tailwindcss&logoColor=white)
![Mapbox](https://img.shields.io/badge/Mapbox_GL-000?style=flat&logo=mapbox&logoColor=white)

---

## How It Works

1. **Click a location** on the dark world map (or search for a city)
2. **Choose a view mode** — browse through historically significant eras, or enter a custom year
3. **Pick an image style** — aerial (drone/cityscape) or street view (eye-level with people)
4. **Perplexity Sonar Pro** researches the place: identifies 5–6 key eras, writes historically grounded image prompts, and returns reference images from the web
5. **Gemini (via OpenRouter)** generates a photorealistic image for each era using the research context + reference images
6. **Browse the timeline** — click any era dot to jump between periods. Everything is cached so re-visiting a place is instant

### Caching

First click on a place triggers the full research + generation pipeline. Every result (research JSON, generated images) is cached locally in `localStorage` and `IndexedDB`. Re-clicking the same place (within ~1km), or opening it from the history sidebar, serves the cache instantly — no API calls, no credits burned.

### Image Styles

- **Aerial** — Wide establishing shots from an elevated vantage point. DJI drone aesthetic, 24mm wide-angle, full cityscape and skyline, atmospheric perspective.
- **Street View** — Eye-level candid photography. Canon DSLR aesthetic, 35mm f/1.4, shallow depth of field with bokeh, period-accurate people going about daily life.

Both styles enforce strict historical accuracy — architecture, clothing, street materials, and infrastructure must match the exact year. No anachronisms.

---

## Quick Start

### Option 1: npm

```bash
git clone https://github.com/trenbolone1122/chronoview.git
cd chronoview
npm install
cp .env.example .env
# Add your API keys to .env
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Option 2: Docker

```bash
git clone https://github.com/trenbolone1122/chronoview.git
cd chronoview
cp .env.example .env
# Add your API keys to .env
docker compose up
```

Open [http://localhost:5173](http://localhost:5173). Source files are volume-mounted — edits to `src/` hot-reload automatically.

---

## API Keys (BYOK)

You need three API keys. All run client-side — nothing leaves your browser except direct API calls with your own keys.

| Variable | What it does | Get it here |
|----------|-------------|-------------|
| `VITE_PERPLEXITY_API_KEY` | Historical research via Sonar Pro | [perplexity.ai/settings/api](https://www.perplexity.ai/settings/api) |
| `VITE_OPENROUTER_API_KEY` | Image generation via Gemini | [openrouter.ai/keys](https://openrouter.ai/keys) |
| `VITE_MAPBOX_TOKEN` | Map rendering + geocoding | [mapbox.com/account/access-tokens](https://account.mapbox.com/access-tokens/) |
| `VITE_IMAGE_MODEL` (optional) | Override the default image model | Default: `google/gemini-2.5-flash-image` |

---

## Architecture

```
User clicks map (lat, lng)
  │
  ├─ Cache hit? (within 1km) → Show cached eras + images instantly
  │
  └─ Cache miss →
      │
      ├─ Reverse geocode (Mapbox v6) → City, Country
      │
      ├─ Perplexity Sonar Pro (max 8192 tokens)
      │   ├─ Structured JSON: place name, country, 5-6 eras
      │   ├─ Each era: label, year, description, image prompt, camera angle
      │   └─ Reference images via return_images (wikimedia, etc.)
      │
      └─ For each era (sequential):
          │
          └─ OpenRouter → Gemini 2.5 Flash Image
              ├─ System prompt: per-style (aerial / street), strict historical accuracy
              ├─ User prompt: research-generated image description + prefix
              ├─ Reference images as multimodal image_url parts (up to 3)
              ├─ Retry logic: 400 → retry without refs, other → retry same config
              └─ Output: 16:9, 1K resolution, base64 PNG → stored in IndexedDB
```

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS v4, shadcn/ui primitives, Geist fonts
- **Map**: Mapbox GL JS (dark-v11 style)
- **Research**: Perplexity Sonar Pro API (structured JSON + web image search)
- **Image Gen**: OpenRouter API → Gemini 2.5 Flash Image (photorealistic, 16:9)
- **Storage**: localStorage (research cache, 1km dedup), IndexedDB (base64 images)

---

## Project Structure

```
src/
├── api/
│   ├── perplexity.ts    # Sonar integration, per-style prompt configs
│   ├── gemini.ts        # OpenRouter integration, per-style system prompts
│   └── geocode.ts       # Mapbox v6 reverse geocoding
├── components/
│   ├── PlaceModal.tsx    # Main modal with city name, image viewer, description
│   ├── Timeline.tsx      # Interactive era timeline with progress animation
│   ├── EraViewer.tsx     # Crossfade image transitions between eras
│   ├── ModePicker.tsx    # Image style toggle + view mode selector
│   ├── SearchBar.tsx     # Forward geocode search
│   └── HistorySidebar.tsx
├── lib/
│   ├── cache.ts          # localStorage cache logic
│   └── imageStore.ts     # IndexedDB for base64 image blobs
├── types/
│   └── index.ts
└── App.tsx               # Main orchestrator, state management
```

---

## License

MIT
