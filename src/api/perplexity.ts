import type { PerplexityResponse, PerplexityImage, ImageStyle } from "@/types";

const PERPLEXITY_URL = "https://api.perplexity.ai/v1/sonar";

/* ── Prompt configs per image style ─────────────────────────────────── */

const IMAGE_PROMPT_DESC: Record<ImageStyle, string> = {
  aerial:
    "A detailed PHOTOREALISTIC image prompt showing this city/place in this era as a WIDE ESTABLISHING SHOT. The prompt MUST begin with the exact year (e.g. '300 BC Naples:' or '1850 London:'). MUST be an elevated or aerial perspective (bird's-eye, drone shot, hilltop viewpoint, or high-angle panorama) that captures the full cityscape, skyline, landmark buildings, surrounding geography (rivers, mountains, coastline), and the overall urban/settlement layout. Show what makes THIS specific place visually unique — not a generic street scene. Include era-accurate architecture, infrastructure, vegetation, and atmosphere SPECIFIC TO THAT EXACT YEAR — no anachronisms. The image must look like a real photograph from a drone or elevated vantage point, NEVER an illustration.",
  street:
    "A detailed PHOTOREALISTIC image prompt showing this city/place in this era as a STREET-LEVEL photograph. The prompt MUST begin with the exact year (e.g. '300 BC Naples:' or '1850 London:'). Shot at eye-level or slightly low angle, capturing the daily life of the city — people in period-accurate clothing for THAT EXACT YEAR AND CULTURE, market stalls, vehicles/carts, shop fronts, street textures, and architectural facades lining the road. Include shallow depth of field (f/1.4-f/2.8) for cinematic bokeh. Show what makes THIS specific place's streets visually unique — not a generic scene. Include era-accurate architecture, signage, vegetation, lighting, and atmosphere SPECIFIC TO THAT EXACT YEAR — no anachronisms. The image must look like a real photograph taken by a person standing in the street, NEVER an illustration.",
};

const CAMERA_ANGLE_DESC: Record<ImageStyle, string> = {
  aerial:
    "Camera angle: MUST be one of 'bird-eye', 'drone-aerial', 'high-angle-panorama', 'hilltop-viewpoint', 'elevated-3/4'. Always elevated to show the full cityscape — never street-level or eye-level.",
  street:
    "Camera angle: MUST be one of 'eye-level', 'low-angle', 'street-level', '3/4-angle'. Always at ground level showing the street scene with people — never aerial or bird's-eye.",
};

function buildSystemPrompt(imageStyle: ImageStyle): string {
  const currentYear = new Date().getFullYear();
  if (imageStyle === "aerial") {
    return `You are a historical geography expert. The current year is ${currentYear}. Given GPS coordinates, identify the location and provide 5-6 historically significant eras for that place, from the earliest notable period to the present day (${currentYear}). Each era must be a real historical period — no speculative future content. The final era should represent the present day and use the year ${currentYear}. IMPORTANT: For BC/BCE years, use NEGATIVE integers (e.g. -3000 for 3000 BC, -500 for 500 BC, -44 for 44 BC). For AD/CE years, use positive integers. For each era, write a vivid image generation prompt describing a WIDE ESTABLISHING SHOT from an elevated/aerial vantage point — as if photographed by a drone, from a hilltop, or from an aircraft. Show the full cityscape, skyline, and surrounding geography. Include specific architectural styles, landmark buildings, infrastructure, river/coast/mountain features, and era-accurate atmosphere. NEVER describe street-level or eye-level scenes. Every image must look like a real photograph.`;
  }
  return `You are a historical geography expert. The current year is ${currentYear}. Given GPS coordinates, identify the location and provide 5-6 historically significant eras for that place, from the earliest notable period to the present day (${currentYear}). Each era must be a real historical period — no speculative future content. The final era should represent the present day and use the year ${currentYear}. IMPORTANT: For BC/BCE years, use NEGATIVE integers (e.g. -3000 for 3000 BC, -500 for 500 BC, -44 for 44 BC). For AD/CE years, use positive integers. For each era, write a vivid image generation prompt describing a STREET-LEVEL PHOTOGRAPH taken at eye-level showing daily life in that era. Include people in period-accurate clothing, market activity, vehicles or carts, architectural facades, shop fronts, street textures, and atmospheric details. Use shallow depth of field (f/1.4-f/2.8) for cinematic bokeh. NEVER describe aerial or bird's-eye views. Every image must look like a real photograph.`;
}

function buildCustomYearSystemPrompt(imageStyle: ImageStyle): string {
  const currentYear = new Date().getFullYear();
  if (imageStyle === "aerial") {
    return `You are a historical geography expert. The current year is ${currentYear}. Given GPS coordinates and a specific year, describe what this location looked like (or would plausibly look like) in that year. IMPORTANT: For BC/BCE years, return the year as a NEGATIVE integer (e.g. -300 for 300 BC). For AD/CE years, use positive integers. Write a vivid image generation prompt describing a WIDE ESTABLISHING SHOT from an elevated/aerial vantage point — as if photographed by a drone, from a hilltop, or from an aircraft. Show the full cityscape, skyline, and surrounding geography. Include specific architectural styles, landmark buildings, infrastructure, and era-accurate atmosphere. NEVER describe street-level or eye-level scenes. Every image must look like a real photograph.`;
  }
  return `You are a historical geography expert. The current year is ${currentYear}. Given GPS coordinates and a specific year, describe what this location looked like (or would plausibly look like) in that year. IMPORTANT: For BC/BCE years, return the year as a NEGATIVE integer (e.g. -300 for 300 BC). For AD/CE years, use positive integers. Write a vivid image generation prompt describing a STREET-LEVEL PHOTOGRAPH taken at eye-level showing daily life in that year. Include people in period-accurate clothing, market activity, vehicles or carts, architectural facades, shop fronts, street textures, and atmospheric details. Use shallow depth of field (f/1.4-f/2.8) for cinematic bokeh. NEVER describe aerial or bird's-eye views. Every image must look like a real photograph.`;
}

/* ── Schemas (built dynamically per image style) ────────────────────── */

function buildSchema(imageStyle: ImageStyle) {
  return {
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
              description: `Representative year for this era. Use NEGATIVE numbers for BC/BCE years (e.g. -3000 for 3000 BC, -500 for 500 BC, -44 for 44 BC). Use positive numbers for AD/CE years (e.g. 100, 1200, 1700, ${new Date().getFullYear()}).`,
            },
            description: {
              type: "string" as const,
              description:
                "2-3 sentences describing what this place looked like and what was happening in this era. Include architectural details, landscape features, and atmosphere.",
            },
            imagePrompt: {
              type: "string" as const,
              description: IMAGE_PROMPT_DESC[imageStyle],
            },
            cameraAngle: {
              type: "string" as const,
              description: CAMERA_ANGLE_DESC[imageStyle],
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
}

function buildCustomYearSchema(imageStyle: ImageStyle) {
  return {
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
          year: { type: "integer" as const, description: "The requested year. Use NEGATIVE numbers for BC/BCE years (e.g. -300 for 300 BC). Use positive for AD/CE." },
          description: {
            type: "string" as const,
            description:
              "2-3 sentences describing what this place looked like in this year. Include architectural details, landscape features, and atmosphere.",
          },
          imagePrompt: {
            type: "string" as const,
            description: IMAGE_PROMPT_DESC[imageStyle],
          },
          cameraAngle: {
            type: "string" as const,
            description: CAMERA_ANGLE_DESC[imageStyle],
          },
        },
        required: ["label", "year", "description", "imagePrompt", "cameraAngle"],
      },
    },
    required: ["placeName", "country", "era"],
  };
}

/* ── API functions ──────────────────────────────────────────────────── */

/** Research a place for its historical eras (multi-era timeline mode). */
export async function researchPlace(
  lat: number,
  lng: number,
  apiKey: string,
  signal?: AbortSignal,
  placeHint?: string,
  imageStyle: ImageStyle = "aerial"
): Promise<PerplexityResponse> {
  const currentYear = new Date().getFullYear();
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
          content: buildSystemPrompt(imageStyle),
        },
        {
          role: "user",
          content: placeHint
            ? `Research the city of ${placeHint} (coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}). Provide 5-6 historically significant time periods for this city, from the earliest known era to present day (${currentYear}). The last era must use the year ${currentYear}. For each era, include a detailed image generation prompt.`
            : `Research the location at coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}. Identify what place this is, and provide 5-6 historically significant time periods for this exact location, from the earliest known era to present day (${currentYear}). The last era must use the year ${currentYear}. For each era, include a detailed image generation prompt.`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { schema: buildSchema(imageStyle) },
      },
      return_images: true,
      image_format_filter: ["jpeg", "png", "webp"],
      temperature: 0.3,
      max_tokens: 8192,
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
  placeHint?: string,
  imageStyle: ImageStyle = "aerial"
): Promise<CustomYearResponse> {
  const currentYear = new Date().getFullYear();
  const isFuture = year > currentYear;
  const yearLabel = year < 0 ? `${Math.abs(year)} BC` : `${year}`;

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
          content: buildCustomYearSystemPrompt(imageStyle),
        },
        {
          role: "user",
          content: placeHint
            ? `Research the city of ${placeHint} (coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)}) in the year ${yearLabel}. Describe what this place looked like${isFuture ? " or would plausibly look like" : ""} and provide a detailed image generation prompt.${year < 0 ? ` Return the year field as ${year} (negative integer for BC).` : ""}`
            : `Research the location at coordinates ${lat.toFixed(6)}, ${lng.toFixed(6)} in the year ${yearLabel}. Describe what this place looked like${isFuture ? " or would plausibly look like" : ""} and provide a detailed image generation prompt.${year < 0 ? ` Return the year field as ${year} (negative integer for BC).` : ""}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { schema: buildCustomYearSchema(imageStyle) },
      },
      return_images: true,
      image_format_filter: ["jpeg", "png", "webp"],
      temperature: 0.3,
      max_tokens: 8192,
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
