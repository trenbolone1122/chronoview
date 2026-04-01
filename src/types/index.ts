/** A single historical era for a given location */
export interface Era {
  id: string;
  label: string;
  year: number;
  description: string;
  prompt: string;
  cameraAngle: string;
  imageBase64: string | null;
  imageStatus: "pending" | "loading" | "ready" | "error";
  imageError: string | null;
}

/** Perplexity research response for a location */
export interface PerplexityEra {
  label: string;
  year: number;
  description: string;
  imagePrompt: string;
  cameraAngle: string;
}

export interface PerplexityResponse {
  placeName: string;
  country: string;
  eras: PerplexityEra[];
  citations: string[];
  images: PerplexityImage[];
}

export interface PerplexityImage {
  image_url: string;
  origin_url: string;
  title: string;
  width: number;
  height: number;
}

/** A cached place with all its generated data */
export interface CachedPlace {
  id: string;
  lat: number;
  lng: number;
  placeName: string;
  country: string;
  eras: Era[];
  citations: string[];
  referenceImages: PerplexityImage[];
  savedAt: number;
  /** Image perspective style used for this place */
  imageStyle?: ImageStyle;
  /** View mode used for this place */
  viewMode?: ViewMode;
  /** Custom year if in custom-year mode */
  customYear?: number;
}

/** App-level status */
export type AppStatus = "idle" | "researching" | "generating" | "ready" | "error";

/** Which view mode the user chose after clicking a place */
export type ViewMode = "eras" | "custom-year";

/** Image perspective style chosen in mode picker */
export type ImageStyle = "aerial" | "street";
