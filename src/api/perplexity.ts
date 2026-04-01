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
            description: `Representative year for this era (e.g. 100, 1200, 1700, 1900, ${new Date().getFullYear()})`,
          },
          description: {
            type: "string" as const,
            description:
              "2-3 sentences describing what this place looked like and what was happening in this era. Include architectural details, landscape features, and atmosphere.",
          },
          imagePrompt: {
            type: "string" as const,
            description:
              "A detailed PHOTOREALISTIC image generation prompt describing this exact location in this era as if photographed by a real camera. The image must look like a real photograph, NEVER an illustration, painting, drawing, or artistic rendering. Include: architecture style, materials, surrounding landscape, people/activity, time of day, weather, atmospheric details. Use shallow depth of field (f/1.4-f/2.8) to make foreground sharp and background dreamy. Be specific about camera perspective and lens choice.",
          },
          cameraAngle: {
            type: "string" as const,
            description:
              "Camera angle for the image: one of 'eye-level', 'low-angle', 'high-angle', 'bird-eye', 'street-level', '3/4-angle'",
          },
        },
        required: [
          "label",
          "year",
          "description",
          "imagePrompt",
          "cameraAngle",
        ],
      },
    },
  },
  required: ["placeName", "country", "eras"],
};

/** Research a place for its historical eras (multi-era timeline mode). */
export async function researchPlace(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal,
  /** Optional city name from reverse geocode — steers Sonar away from POIs */
  placeHint?: string
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
          content: `You are a historical geography expert. The current year is ${new Date().getFullYear()}. Given GPS coordinates, identify the location and provide 5-6 historically significant eras for that place, from the earliest notable period to the present day (${new Date().getFullYear()}). Each era must be a real historical period — no speculative future content. The final era should represent the present day and use the year ${new Date().getFullYear()}. For each era, write a vivid image generation prompt that describes exactly what this place looked like. Include specific architectural styles, materials, vegetation, people, and atmospheric details. Use shallow depth of field (f/1.4 to f/2.8) photography style to create cinematic images with sharp foreground subjects and dreamy bokeh backgrounds. Vary the camera angle across eras for visual diversity.`,
        },
        {
          role: "user",
          content: placeHint
            ? `Research the city of ${placeHint} (coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}). Provide 5-6 historically significant time periods for this city, from the earliest known era to present day (${new Date().getFullYear()}). The last era must use the year ${new Date().getFullYear()}. For each era, include a detailed image generation prompt.`
            : `Research the location at coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}. Identify what place this is, and provide 5-6 historically significant time periods for this exact location, from the earliest known era to present day (${new Date().getFullYear()}). The last era must use the year ${new Date().getFullYear()}. For each era, include a detailed image generation prompt.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { schema: SCHEMA },
      },
      return_images: true,
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

  let parsed: { placeName: string; country: string; eras: Array<{
    label: string; year: number; description: string; imagePrompt: string; cameraAngle: string;
  }> };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse Perplexity JSON response");
  }

  // Perplexity's return_images gives us real, fetchable image URLs in the
  // top-level `images` array. These are the reference images we'll feed to
  // Gemini — NOT the hallucinated wiki-page URLs the model might produce.
  const sonarImages: PerplexityImage[] = (data.images ?? []).map(
    (img: Record<string, unknown>) => ({
      image_url: img.image_url ?? "",
      origin_url: img.origin_url ?? "",
      title: img.title ?? "",
      width: img.width ?? 0,
      height: img.height ?? 0,
    })
  );

  // Strip Perplexity's inline citation markers like [1], [2][3], etc.
  const stripCitations = (s: string) => s.replace(/\[\d+\]/g, "").trim();

  return {
    placeName: stripCitations(parsed.placeName),
    country: stripCitations(parsed.country),
    eras: parsed.eras.map((e) => ({
      label: stripCitations(e.label),
      year: e.year,
      description: stripCitations(e.description),
      imagePrompt: e.imagePrompt,
      cameraAngle: e.cameraAngle,
    })),
    citations: data.citations ?? [],
    images: sonarImages,
  };
}

/* ── Custom year mode ─────────────────────────────────────────────────── */

const CUSTOM_YEAR_SCHEMA = {
  type: "object" as const,
  properties: {
    placeName: { type: "string" as const, description: "Modern name of the place" },
    country: { type: "string" as const, description: "Country the place is in" },
    era: {
      type: "object" as const,
      properties: {
        label: {
          type: "string" as const,
          description: "Short era name describing this period for this place",
        },
        year: { type: "integer" as const, description: "The requested year" },
        description: {
          type: "string" as const,
          description:
            "2-3 sentences describing what this place looked like in this year. Include architectural details, landscape features, and atmosphere.",
        },
        imagePrompt: {
          type: "string" as const,
          description:
            "A detailed PHOTOREALISTIC image generation prompt describing this exact location in this year as if photographed by a real camera. The image must look like a real photograph, NEVER an illustration, painting, drawing, or artistic rendering. Include: architecture style, materials, surrounding landscape, people/activity, time of day, weather, atmospheric details. Use shallow depth of field (f/1.4-f/2.8). Be specific about camera perspective and lens choice.",
        },
        cameraAngle: {
          type: "string" as const,
          description:
            "Camera angle for the image: one of 'eye-level', 'low-angle', 'high-angle', 'bird-eye', 'street-level', '3/4-angle'",
        },
      },
      required: ["label", "year", "description", "imagePrompt", "cameraAngle"],
    },
  },
  required: ["placeName", "country", "era"],
};

export interface CustomYearResponse {
  placeName: string;
  country: string;
  era: {
    label: string;
    year: number;
    description: string;
    imagePrompt: string;
    cameraAngle: string;
  };
  citations: string[];
  images: PerplexityImage[];
}

/** Research a specific year for a given place (custom year mode). */
export async function researchCustomYear(
  lat: number,
  lng: number,
  year: number,
  apiKey: string,
  signal?: AbortSignal,
  placeHint?: string
): Promise<CustomYearResponse> {
  const currentYear = new Date().getFullYear();
  const isFuture = year > currentYear;

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
          content: `You are a historical geography expert. The current year is ${currentYear}. Given GPS coordinates and a specific year, describe what this location looked like (or would plausibly look like) in that year. Write a vivid image generation prompt with specific architectural styles, materials, vegetation, people, and atmospheric details. Use shallow depth of field (f/1.4 to f/2.8) photography style.`,
        },
        {
          role: "user",
          content: placeHint
            ? `Research the city of ${placeHint} (coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}) in the year ${year}. Describe what this place looked like${isFuture ? " or would plausibly look like" : ""} and provide a detailed image generation prompt.`
            : `Research the location at coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)} in the year ${year}. Describe what this place looked like${isFuture ? " or would plausibly look like" : ""} and provide a detailed image generation prompt.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { schema: CUSTOM_YEAR_SCHEMA },
      },
      return_images: true,
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

  let parsed: {
    placeName: string;
    country: string;
    era: { label: string; year: number; description: string; imagePrompt: string; cameraAngle: string };
  };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("Failed to parse Perplexity JSON response");
  }

  const sonarImages: PerplexityImage[] = (data.images ?? []).map(
    (img: Record<string, unknown>) => ({
      image_url: img.image_url ?? "",
      origin_url: img.origin_url ?? "",
      title: img.title ?? "",
      width: img.width ?? 0,
      height: img.height ?? 0,
    })
  );

  const stripCitations = (s: string) => s.replace(/\[\d+\]/g, "").trim();

  return {
    placeName: stripCitations(parsed.placeName),
    country: stripCitations(parsed.country),
    era: {
      label: stripCitations(parsed.era.label),
      year: parsed.era.year,
      description: stripCitations(parsed.era.description),
      imagePrompt: parsed.era.imagePrompt,
      cameraAngle: parsed.era.cameraAngle,
    },
    citations: data.citations ?? [],
    images: sonarImages,
  };
}
