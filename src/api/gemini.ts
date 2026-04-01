/**
 * Image generation via OpenRouter API (Gemini Nano Banana models).
 *
 * Uses OpenRouter's chat completions endpoint with `modalities: ["image", "text"]`.
 * Images are returned in `choices[0].message.images[]` as base64 data URLs.
 *
 * IMPORTANT: We intentionally do NOT pass Sonar's reference images to Gemini.
 * Those images are often historical illustrations, paintings, or woodblock prints,
 * and Gemini mimics their art style — producing illustrations instead of photos.
 * Text-only prompts with our strong photorealism system prompt yield much better
 * photorealistic results.
 */

import type { ImageStyle } from "@/types";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

// Available Nano Banana models on OpenRouter (best → fastest):
// "google/gemini-3-pro-image-preview"       — Nano Banana Pro (best quality)
// "google/gemini-3.1-flash-image-preview"   — Nano Banana 2 (fast + extended ratios)
// "google/gemini-2.5-flash-image"           — Nano Banana (original, GA)
const DEFAULT_MODEL = "google/gemini-2.5-flash-image";

interface OpenRouterImage {
  type: string;
  image_url: { url: string };
}

/* ── Per-style system prompts and prefixes ──────────────────────────── */

const SYSTEM_PROMPTS: Record<ImageStyle, string> = {
  aerial: `You are a photorealistic image generator specializing in WIDE AERIAL/ESTABLISHING SHOTS of cities. EVERY image you produce MUST look like a real photograph taken from an elevated vantage point — a drone, hilltop, rooftop, or aircraft. Show the full cityscape, skyline, landmark buildings, and surrounding geography (rivers, mountains, coastline). Absolutely NO illustrations, paintings, drawings, anime, manga, ukiyo-e, woodblock prints, watercolors, sketches, digital art, CGI renders, or any non-photographic style. NEVER produce street-level, eye-level, or close-up shots. The output must be indistinguishable from a real aerial photograph — proper lighting, atmospheric haze, natural textures, wide depth of field. If the scene is historical, imagine a time traveler flew a drone over the city and photographed it from above. OUTPUT ONLY A PHOTOREALISTIC IMAGE.`,
  street: `You are a photorealistic image generator specializing in STREET-LEVEL photographs of cities showing daily life. EVERY image you produce MUST look like a real photograph taken at eye-level by a person standing in the street. Show people in period-accurate clothing, market activity, vehicles or carts, architectural facades, shop fronts, and street textures. Use shallow depth of field for cinematic bokeh — sharp foreground subjects, dreamy background blur. Absolutely NO illustrations, paintings, drawings, anime, manga, ukiyo-e, woodblock prints, watercolors, sketches, digital art, CGI renders, or any non-photographic style. NEVER produce aerial or bird's-eye shots. The output must be indistinguishable from a real street photograph — proper lighting, film grain, natural textures, bokeh. If the scene is historical, imagine a time traveler took a DSLR camera back in time and photographed the street. OUTPUT ONLY A PHOTOREALISTIC IMAGE.`,
};

const PREFIXES: Record<ImageStyle, string> = {
  aerial:
    "Generate a PHOTOREALISTIC aerial photograph (NOT an illustration, NOT a painting, NOT a drawing, NOT a sketch, NOT watercolor, NOT digital art). Ultra-realistic wide establishing shot from elevated vantage point, DJI Mavic 3 drone, 24mm wide-angle lens, f/8, full cityscape and skyline, natural lighting, atmospheric perspective: ",
  street:
    "Generate a PHOTOREALISTIC street photograph (NOT an illustration, NOT a painting, NOT a drawing, NOT a sketch, NOT watercolor, NOT digital art). Ultra-realistic eye-level shot, Canon EOS R5, 35mm lens, f/1.4, cinematic bokeh, people and daily life, natural lighting, film grain: ",
};

/* ── Core fetch + parse logic ──────────────────────────────────────── */

async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  apiKey: string,
  model: string,
  signal?: AbortSignal
): Promise<string> {
  const body = {
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
      {
        role: "user" as const,
        content: [{ type: "text", text: prompt }],
      },
    ],
    modalities: ["image", "text"],
    image_config: {
      aspect_ratio: "16:9",
      image_size: "1K",
    },
    stream: false,
  };

  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://chronoview.app",
      "X-Title": "Chronoview",
    },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`OpenRouter API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();

  // OpenRouter returns images in choices[0].message.images[]
  const images: OpenRouterImage[] =
    data?.choices?.[0]?.message?.images ?? [];

  if (images.length > 0) {
    const imageUrl = images[0]?.image_url?.url;
    if (imageUrl && imageUrl.startsWith("data:image")) {
      return imageUrl;
    }
  }

  // Fallback: some models might return inline_data in content parts
  const content = data?.choices?.[0]?.message?.content;
  if (content && typeof content === "string" && content.startsWith("data:image")) {
    return content;
  }

  throw new Error("No image generated in OpenRouter response");
}

/**
 * Generate an image for a historical era using Gemini via OpenRouter.
 * Returns a base64 data URL (data:image/png;base64,...).
 *
 * Reference image URLs are accepted for API compatibility but intentionally
 * NOT sent to Gemini — they're often illustrations that poison the output style.
 * On failure, retries once automatically.
 */
export async function generateEraImage(
  prompt: string,
  _referenceImageUrls: string[],
  apiKey: string,
  signal?: AbortSignal,
  model?: string,
  imageStyle: ImageStyle = "aerial"
): Promise<string> {
  const resolvedModel = model || DEFAULT_MODEL;
  const systemPrompt = SYSTEM_PROMPTS[imageStyle];
  const fullPrompt = PREFIXES[imageStyle] + prompt;

  try {
    return await callOpenRouter(fullPrompt, systemPrompt, apiKey, resolvedModel, signal);
  } catch (err) {
    // If aborted, don't retry
    if (signal?.aborted) throw err;

    // Retry once — sometimes Gemini just hiccups
    console.warn("[Chronoview] Image gen failed, retrying once:", err);
    return await callOpenRouter(fullPrompt, systemPrompt, apiKey, resolvedModel, signal);
  }
}
