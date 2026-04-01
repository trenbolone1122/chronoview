const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-preview-image-generation:generateContent";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

/**
 * Fetch a reference image and convert to base64.
 * Returns null if the fetch fails (CORS, 404, etc.)
 */
async function fetchImageAsBase64(
  url: string,
  signal?: AbortSignal
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return {
      data: btoa(binary),
      mimeType: blob.type || "image/jpeg",
    };
  } catch {
    return null;
  }
}

/**
 * Generate an image for a historical era using Gemini Nano Banana.
 * Optionally passes reference images for grounding.
 */
export async function generateEraImage(
  prompt: string,
  referenceImageUrls: string[],
  apiKey: string,
  signal?: AbortSignal
): Promise<string> {
  // Build parts: text prompt first, then any reference images
  const parts: GeminiPart[] = [{ text: prompt }];

  // Try to fetch up to 3 reference images
  const imagePromises = referenceImageUrls.slice(0, 3).map((url) =>
    fetchImageAsBase64(url, signal)
  );
  const refImages = await Promise.all(imagePromises);
  for (const img of refImages) {
    if (img) {
      parts.push({
        inlineData: {
          mimeType: img.mimeType,
          data: img.data,
        },
      });
    }
  }

  const body = {
    contents: [{ parts }],
    tools: [{ google_search: {} }],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: "16:9",
        imageSize: "1K",
      },
    },
  };

  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errBody}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  if (!candidate?.content?.parts) {
    throw new Error("No content in Gemini response");
  }

  // Find the image part
  for (const part of candidate.content.parts) {
    if (part.inlineData?.data) {
      const mimeType = part.inlineData.mimeType || "image/png";
      return `data:${mimeType};base64,${part.inlineData.data}`;
    }
  }

  throw new Error("No image generated in Gemini response");
}
