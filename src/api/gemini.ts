/**
 * Image generation via OpenRouter API (Gemini Nano Banana models).
 *
 * Uses OpenRouter's chat completions endpoint with `modalities: ["image", "text"]`.
 * Images are returned in `choices[0].message.images[]` as base64 data URLs.
 *
 * Strategy: send reference images from Sonar on the first attempt. If OpenRouter
 * returns a 400 (usually because a reference URL is 403-blocked), retry once
 * without reference images. All attempts are logged to the browser console.
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

/**
 * Build a multimodal message with text + optional reference images.
 * OpenRouter accepts the OpenAI vision format for image inputs.
 */
function buildUserContent(
  prompt: string,
  referenceImageUrls: string[]
): Array<{ type: string; text?: string; image_url?: { url: string } }> {
  const parts: Array<{
    type: string;
    text?: string;
    image_url?: { url: string };
  }> = [{ type: "text", text: prompt }];

  for (const url of referenceImageUrls.slice(0, 3)) {
    parts.push({
      type: "image_url",
      image_url: { url },
    });
  }

  return parts;
}

/* ── Per-style system prompts and prefixes ──────────────────────────── */

const SYSTEM_PROMPTS: Record<ImageStyle, string> = {
  aerial: `You are a photorealistic image generator specializing in WIDE AERIAL/ESTABLISHING SHOTS of cities. EVERY image you produce MUST look like a real photograph taken from an elevated vantage point — a drone, hilltop, rooftop, or aircraft. Show the full cityscape, skyline, landmark buildings, and surrounding geography (rivers, mountains, coastline). Absolutely NO illustrations, paintings, drawings, anime, manga, ukiyo-e, woodblock prints, watercolors, sketches, digital art, CGI renders, or any non-photographic style. NEVER produce street-level, eye-level, or close-up shots. The output must be indistinguishable from a real aerial photograph — proper lighting, atmospheric haze, natural textures, wide depth of field. If the scene is historical, imagine a time traveler flew a drone over the city and photographed it from above. The reference images are for LOCATION CONTEXT ONLY — do NOT mimic their art style, only use them to understand the geography and architecture. NEVER reproduce watermarks, logos, text overlays, stock photo marks (Alamy, Getty, Shutterstock, iStock, etc.), or any branding from reference images. The output must be a clean, original photograph with NO text or watermarks anywhere in the image. OUTPUT ONLY A CLEAN PHOTOREALISTIC IMAGE.`,
  street: `You are a photorealistic image generator specializing in STREET-LEVEL photographs of cities showing daily life. EVERY image you produce MUST look like a real photograph taken at eye-level by a person standing in the street. Show people in period-accurate clothing, market activity, vehicles or carts, architectural facades, shop fronts, and street textures. Use shallow depth of field for cinematic bokeh — sharp foreground subjects, dreamy background blur. Absolutely NO illustrations, paintings, drawings, anime, manga, ukiyo-e, woodblock prints, watercolors, sketches, digital art, CGI renders, or any non-photographic style. NEVER produce aerial or bird's-eye shots. The output must be indistinguishable from a real street photograph — proper lighting, film grain, natural textures, bokeh. If the scene is historical, imagine a time traveler took a DSLR camera back in time and photographed the street. The reference images are for LOCATION CONTEXT ONLY — do NOT mimic their art style, only use them to understand the geography and architecture. NEVER reproduce watermarks, logos, text overlays, stock photo marks (Alamy, Getty, Shutterstock, iStock, etc.), or any branding from reference images. The output must be a clean, original photograph with NO text or watermarks anywhere in the image. OUTPUT ONLY A CLEAN PHOTOREALISTIC IMAGE.`,
};

const PREFIXES: Record<ImageStyle, string> = {
  aerial:
    "Generate a PHOTOREALISTIC aerial photograph with absolutely NO watermarks, NO text, NO logos, NO stock photo marks. NOT an illustration, NOT a painting, NOT a drawing. Ignore the art style of any reference images — use them only for geographic/architectural context. Ultra-realistic wide establishing shot from elevated vantage point, DJI Mavic 3 drone, 24mm wide-angle lens, f/8, full cityscape and skyline, natural lighting, atmospheric perspective: ",
  street:
    "Generate a PHOTOREALISTIC street photograph with absolutely NO watermarks, NO text, NO logos, NO stock photo marks. NOT an illustration, NOT a painting, NOT a drawing. Ignore the art style of any reference images — use them only for geographic/architectural context. Ultra-realistic eye-level shot, Canon EOS R5, 35mm lens, f/1.4, cinematic bokeh, people and daily life, natural lighting, film grain: ",
};

/* ── Core fetch + parse logic ──────────────────────────────────────── */

async function callOpenRouter(
  prompt: string,
  systemPrompt: string,
  referenceImageUrls: string[],
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
        content: buildUserContent(prompt, referenceImageUrls),
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
 * Strategy:
 *  1. Try with reference images from Sonar
 *  2. If 400 error (usually blocked ref URLs), retry without reference images
 *  3. If other error, retry once with same config
 *
 * All attempts are logged to browser console for debugging.
 */
export async function generateEraImage(
  prompt: string,
  referenceImageUrls: string[],
  apiKey: string,
  signal?: AbortSignal,
  model?: string,
  imageStyle: ImageStyle = "aerial"
): Promise<string> {
  const resolvedModel = model || DEFAULT_MODEL;
  const systemPrompt = SYSTEM_PROMPTS[imageStyle];
  const fullPrompt = PREFIXES[imageStyle] + prompt;
  const refCount = referenceImageUrls.length;

  console.log(
    `[Chronoview] 🎨 Generating image | style=${imageStyle} | model=${resolvedModel} | refs=${refCount}`
  );
  console.log(`[Chronoview] 📝 Prompt: ${prompt.slice(0, 120)}...`);
  if (refCount > 0) {
    console.log(`[Chronoview] 🖼️ Reference URLs:`, referenceImageUrls.slice(0, 3));
  }

  // Attempt 1: with reference images
  try {
    const result = await callOpenRouter(
      fullPrompt, systemPrompt, referenceImageUrls.slice(0, 3),
      apiKey, resolvedModel, signal
    );
    console.log(`[Chronoview] ✅ Image generated successfully (with ${refCount} refs)`);
    return result;
  } catch (err) {
    if (signal?.aborted) throw err;

    const isOpenRouterErr = err instanceof OpenRouterError;
    const status = isOpenRouterErr ? err.status : 0;

    console.warn(
      `[Chronoview] ⚠️ Attempt 1 failed | status=${status} | refs=${refCount}`,
      err instanceof Error ? err.message : err
    );

    // Attempt 2: if 400 and we had refs, retry without them (blocked URLs likely)
    if (status === 400 && refCount > 0) {
      console.log(`[Chronoview] 🔄 Retrying WITHOUT reference images (400 = likely blocked ref URLs)`);
      try {
        const result = await callOpenRouter(
          fullPrompt, systemPrompt, [],
          apiKey, resolvedModel, signal
        );
        console.log(`[Chronoview] ✅ Image generated successfully (no refs, retry)`);
        return result;
      } catch (retryErr) {
        if (signal?.aborted) throw retryErr;
        console.error(
          `[Chronoview] ❌ Attempt 2 (no refs) also failed:`,
          retryErr instanceof Error ? retryErr.message : retryErr
        );
        throw retryErr;
      }
    }

    // Attempt 2: for non-400 errors, retry once with same config
    console.log(`[Chronoview] 🔄 Retrying with same config (non-400 error)`);
    try {
      const result = await callOpenRouter(
        fullPrompt, systemPrompt, referenceImageUrls.slice(0, 3),
        apiKey, resolvedModel, signal
      );
      console.log(`[Chronoview] ✅ Image generated successfully (retry with refs)`);
      return result;
    } catch (retryErr) {
      if (signal?.aborted) throw retryErr;
      console.error(
        `[Chronoview] ❌ Attempt 2 (retry) also failed:`,
        retryErr instanceof Error ? retryErr.message : retryErr
      );
      throw retryErr;
    }
  }
}
