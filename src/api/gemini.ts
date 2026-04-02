/**
 * Image generation via OpenRouter API (Gemini Nano Banana models).
 *
 * Uses OpenRouter's chat completions endpoint with `modalities: ["image", "text"]`.
 * Images are returned in `choices[0].message.images[]` as base64 data URLs.
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
  aerial: `You are a photorealistic image generator specializing in WIDE AERIAL/ESTABLISHING SHOTS of cities.

HISTORICAL ACCURACY IS PARAMOUNT. You MUST rigorously depict the city EXACTLY as it would have appeared in the specified year. Research the architecture, infrastructure, vegetation, and development level for that exact time period. Do NOT show modern buildings, roads, vehicles, or technology in historical eras. A city in 1200 AD must look like 1200 AD — no anachronisms whatsoever. If the city did not exist yet, show the undeveloped natural landscape.

EVERY image MUST look like a real photograph taken from an elevated vantage point — a drone, hilltop, rooftop, or aircraft. Show the full cityscape, skyline, landmark buildings, and surrounding geography (rivers, mountains, coastline). Absolutely NO illustrations, paintings, drawings, anime, manga, ukiyo-e, woodblock prints, watercolors, sketches, digital art, CGI renders, or any non-photographic style. NEVER produce street-level, eye-level, or close-up shots. The output must be indistinguishable from a real aerial photograph — proper lighting, atmospheric haze, natural textures, wide depth of field. If the scene is historical, imagine a time traveler flew a drone over the city and photographed it from above. NEVER reproduce watermarks, logos, text overlays, or stock photo marks. The output must be a clean, original photograph with NO text or watermarks anywhere in the image. OUTPUT ONLY A CLEAN PHOTOREALISTIC IMAGE.`,
  street: `You are a photorealistic image generator specializing in STREET-LEVEL photographs of cities showing daily life.

HISTORICAL ACCURACY IS PARAMOUNT. You MUST rigorously depict the city EXACTLY as it would have appeared in the specified year. Every detail matters: clothing must be period-accurate to the exact era and culture (fabrics, cuts, headwear, footwear), architecture must reflect the actual construction techniques and materials of that time, street surfaces must be historically correct (dirt, cobblestone, flagstone — NOT asphalt in ancient eras), vehicles/carts/animals must match the era, shop signs and goods must be period-appropriate. Do NOT show ANY anachronistic elements — no modern clothing, no modern materials, no modern infrastructure in historical scenes. A street in 1400 AD must look unmistakably like 1400 AD.

PEOPLE COMPOSITION: Show a MODERATE number of people (5-12, NOT a crowd of 30+). People should be going about their daily activities — walking, carrying goods, conversing. CRITICALLY: most people should be walking AWAY from the camera or at oblique angles, with their BACKS toward the viewer. Do NOT pose people facing the camera. At most 1-2 people may be partially turned toward the camera. This creates a candid, documentary feel — as if the photographer is observing unnoticed.

EVERY image MUST look like a real photograph taken at eye-level by a person standing in the street. Use shallow depth of field for cinematic bokeh — sharp foreground subjects, dreamy background blur. Absolutely NO illustrations, paintings, drawings, anime, manga, ukiyo-e, woodblock prints, watercolors, sketches, digital art, CGI renders, or any non-photographic style. NEVER produce aerial or bird's-eye shots. The output must be indistinguishable from a real street photograph — proper lighting, film grain, natural textures, bokeh. If the scene is historical, imagine a time traveler took a DSLR camera back in time and photographed the street. NEVER reproduce watermarks, logos, text overlays, or stock photo marks. The output must be a clean, original photograph with NO text or watermarks anywhere in the image. OUTPUT ONLY A CLEAN PHOTOREALISTIC IMAGE.`,
};

const PREFIXES: Record<ImageStyle, string> = {
  aerial:
    "Generate a PHOTOREALISTIC aerial photograph with absolutely NO watermarks, NO text, NO logos, NO stock photo marks. NOT an illustration, NOT a painting, NOT a drawing. STRICT HISTORICAL ACCURACY — show ONLY architecture, infrastructure, and development that existed in the specified year, no anachronisms. Ultra-realistic wide establishing shot from elevated vantage point, DJI Mavic 3 drone, 24mm wide-angle lens, f/8, full cityscape and skyline, natural lighting, atmospheric perspective: ",
  street:
    "Generate a PHOTOREALISTIC street photograph with absolutely NO watermarks, NO text, NO logos, NO stock photo marks. NOT an illustration, NOT a painting, NOT a drawing. STRICT HISTORICAL ACCURACY — period-accurate clothing, architecture, street materials, vehicles, and goods for the exact year specified. Show a MODERATE number of people (5-12, not a huge crowd), mostly WALKING AWAY from camera with backs toward viewer, candid documentary style. Ultra-realistic eye-level shot, Canon EOS R5, 35mm lens, f/1.4, cinematic bokeh, natural lighting, film grain: ",
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
        content: prompt,
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
    throw new OpenRouterError(response.status, errBody);
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

/** Custom error class to carry HTTP status */
class OpenRouterError extends Error {
  status: number;
  constructor(status: number, body: string) {
    super(`OpenRouter API error (${status}): ${body}`);
    this.status = status;
  }
}

/**
 * Generate an image for a historical era using Gemini via OpenRouter.
 * Returns a base64 data URL (data:image/png;base64,...).
 *
 * Retries once on failure.
 */
export async function generateEraImage(
  prompt: string,
  apiKey: string,
  signal?: AbortSignal,
  model?: string,
  imageStyle: ImageStyle = "aerial",
  eraYear?: number,
  placeName?: string
): Promise<string> {
  const resolvedModel = model || DEFAULT_MODEL;
  const systemPrompt = SYSTEM_PROMPTS[imageStyle];
  // Anchor the prompt with explicit year + place so the model can't drift temporally
  const yearLabel = eraYear != null
    ? (eraYear < 0 ? `${Math.abs(eraYear)} BC` : `${eraYear} AD`)
    : null;
  const timeAnchor = yearLabel && placeName
    ? `[YEAR: ${yearLabel} | PLACE: ${placeName}] Depict this location EXACTLY as it appeared in ${yearLabel}. `
    : yearLabel
      ? `[YEAR: ${yearLabel}] Depict this location EXACTLY as it appeared in ${yearLabel}. `
      : "";
  const fullPrompt = PREFIXES[imageStyle] + timeAnchor + prompt;

  console.log(
    `[Chronoview] 🎨 Generating image | style=${imageStyle} | model=${resolvedModel}`
  );
  console.log(`[Chronoview] 📝 Prompt: ${prompt.slice(0, 120)}...`);

  // Attempt 1
  try {
    const result = await callOpenRouter(
      fullPrompt, systemPrompt,
      apiKey, resolvedModel, signal
    );
    console.log(`[Chronoview] ✅ Image generated successfully`);
    return result;
  } catch (err) {
    if (signal?.aborted) throw err;

    console.warn(
      `[Chronoview] ⚠️ Attempt 1 failed`,
      err instanceof Error ? err.message : err
    );

    // Attempt 2: retry once
    console.log(`[Chronoview] 🔄 Retrying...`);
    try {
      const result = await callOpenRouter(
        fullPrompt, systemPrompt,
        apiKey, resolvedModel, signal
      );
      console.log(`[Chronoview] ✅ Image generated successfully (retry)`);
      return result;
    } catch (retryErr) {
      if (signal?.aborted) throw retryErr;
      console.error(
        `[Chronoview] ❌ Retry also failed:`,
        retryErr instanceof Error ? retryErr.message : retryErr
      );
      throw retryErr;
    }
  }
}
