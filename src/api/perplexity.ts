import type { PerplexityResponse, PerplexityImage } from "@/types";

const PERPLEXITY_URL = "https://api.perplexity.ai/v1/sonar";

const SCHEMA = {
  type: "object" as const,
  properties: {
    placeName: { type: "string" as const, description: "Modern name of the place" },
    country: { type: "string" as const, description: "Country the place is in" },
    eras: {
      type: "array" as const,
      description:
        "5-6 historically significant eras for this location, chronological, ending at present day. Only real historical periods — no speculative future.",
      items: {
        type: "object" as const,
        properties: {
          label: {
            type: "string" as const,
            description:
              "Short era name, e.g. 'Ancient Rome', 'Medieval Period', 'Colonial Era', 'Industrial Revolution', 'Modern Day'",
          },
          year: {
            type: "integer" as const,
            description: "Representative year for this era (e.g. 100, 1200, 1700, 1900, 2024)",
          },
          description: {
            type: "string" as const,
            description:
              "2-3 sentences describing what this place looked like and what was happening in this era. Include architectural details, landscape features, and atmosphere.",
          },
          imagePrompt: {
            type: "string" as const,
            description:
              "A detailed image generation prompt describing this exact location in this era. Include: architecture style, materials, surrounding landscape, people/activity, time of day, weather, atmospheric details. Use shallow depth of field (f/1.4-f/2.8) to make foreground sharp and background dreamy. Be specific about camera perspective.",
          },
          cameraAngle: {
            type: "string" as const,
            description:
              "Camera angle for the image: one of 'eye-level', 'low-angle', 'high-angle', 'bird-eye', 'street-level', '3/4-angle'",
          },
          referenceImageUrls: {
            type: "array" as const,
            items: { type: "string" as const },
            description:
              "1-3 URLs of reference images showing this place or similar architecture from this era. Use Wikipedia, Wikimedia Commons, or reputable historical image sources.",
          },
        },
        required: [
          "label",
          "year",
          "description",
          "imagePrompt",
          "cameraAngle",
          "referenceImageUrls",
        ],
      },
    },
  },
  required: ["placeName", "country", "eras"],
};

export async function researchPlace(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal
): Promise<PerplexityResponse> {
  const response = await fetch(PERPLEXITY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: "sonar-pro",
      messages: [
        {
          role: "system",
          content: `You are a historical geography expert. Given GPS coordinates, identify the location and provide 5-6 historically significant eras for that place, from the earliest notable period to the present day. Each era must be a real historical period — no speculative future content. For each era, write a vivid image generation prompt that describes exactly what this place looked like. Include specific architectural styles, materials, vegetation, people, and atmospheric details. Use shallow depth of field (f/1.4 to f/2.8) photography style to create cinematic images with sharp foreground subjects and dreamy bokeh backgrounds. Vary the camera angle across eras for visual diversity.`,
        },
        {
          role: "user",
          content: `Research the location at coordinates ${lat.toFixed(
            6
          )}, ${lng.toFixed(
            6
          )}. Identify what place this is, and provide 5-6 historically significant time periods for this exact location, from the earliest known era to present day (no future). For each era, include a detailed image generation prompt and suggest reference images.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { schema: SCHEMA },
      },
      return_images: true,
      image_domain_filter: ["wikimedia.org", "wikipedia.org", "-shutterstock.com", "-gettyimages.com"],
      image_format_filter: ["jpeg", "png", "webp"],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Perplexity API error (${response.status}): ${body}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in Perplexity response");

  let parsed: { placeName: string; country: string; eras: PerplexityResponse["eras"] };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse Perplexity JSON response");
  }

  return {
    placeName: parsed.placeName,
    country: parsed.country,
    eras: parsed.eras,
    citations: data.citations ?? [],
    images: (data.images ?? []) as PerplexityImage[],
  };
}
