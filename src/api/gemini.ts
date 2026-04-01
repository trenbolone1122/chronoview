/**
 * Image generation via OpenRouter API (Gemini Nano Banana models).
 *
 * Uses OpenRouter's chat completions endpoint with `modalities: ["image", "text"]`.
 * Images are returned in `choices[0].message.images[]` as base64 data URLs.
 */

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

  // Pass reference images as URL-based image parts (OpenRouter fetches them)
  for (const url of referenceImageUrls.slice(0, 3)) {
    parts.push({
      type: "image_url",
      image_url: { url },
    });
  }

  return parts;
}

/**
 * Generate an image for a historical era using Gemini via OpenRouter.
 * Returns a base64 data URL (data:image/png;base64,...).
 */
export async function generateEraImage(
  prompt: string,
  referenceImageUrls: string[],
  apiKey: string,
  signal?: AbortSignal,
  model?: string
): Promise<string> {
  const body = {
    model: model || DEFAULT_MODEL,
    messages: [
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
