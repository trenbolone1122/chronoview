/**
 * Reverse geocode using Mapbox Geocoding v6.
 *
 * Returns city-level name by walking the context hierarchy:
 *   place (city) → locality → district → region → country
 *
 * Japan-aware: In Japan, `place` = city, `region` = prefecture.
 * The `block` type is Japan-specific (chome / oaza sit under locality).
 */

export interface ReverseGeocodeResult {
  /** City / municipality name (or best fallback) */
  cityName: string;
  /** Region / state / prefecture */
  regionName: string;
  /** Country name */
  countryName: string;
  /** ISO 3166 alpha-2 country code (e.g. "JP", "US") */
  countryCode: string;
}

interface ContextComponent {
  mapbox_id: string;
  name: string;
  [key: string]: unknown;
}

interface GeocodingFeature {
  properties: {
    feature_type: string;
    name: string;
    context: {
      place?: ContextComponent;
      locality?: ContextComponent;
      district?: ContextComponent;
      region?: ContextComponent;
      country?: ContextComponent & { country_code?: string };
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  token: string,
  signal?: AbortSignal
): Promise<ReverseGeocodeResult> {
  const url = `https://api.mapbox.com/search/geocode/v6/reverse?longitude=${lng}&latitude=${lat}&access_token=${token}&language=en`;

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Reverse geocode failed (${res.status})`);

  const data = await res.json();
  const features: GeocodingFeature[] = data.features ?? [];

  if (features.length === 0) {
    return { cityName: "Unknown", regionName: "", countryName: "", countryCode: "" };
  }

  // The first feature is the most granular. Walk its context to find city-level.
  const ctx = features[0].properties.context;

  // City: place → locality → district → region (fallback chain)
  const cityName =
    ctx.place?.name ??
    ctx.locality?.name ??
    ctx.district?.name ??
    ctx.region?.name ??
    features[0].properties.name ??
    "Unknown";

  const regionName = ctx.region?.name ?? "";
  const countryName = ctx.country?.name ?? "";
  const countryCode = (ctx.country as { country_code?: string })?.country_code ?? "";

  return { cityName, regionName, countryName, countryCode };
}
