import type { CachedPlace } from "@/types";

const STORAGE_KEY = "chronoview.history";
const HISTORY_LIMIT = 100;
const CACHE_RADIUS_METERS = 1000;

/** Haversine distance in meters */
function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  if (!a || !b) return Infinity;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6_371_000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function isSamePlace(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): boolean {
  const d = distanceMeters(a, b);
  return Number.isFinite(d) && d <= CACHE_RADIUS_METERS;
}

export function loadHistory(): CachedPlace[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item: unknown) => item && typeof item === "object"
    ) as CachedPlace[];
  } catch {
    return [];
  }
}

export function saveHistory(places: CachedPlace[]): void {
  if (typeof window === "undefined") return;
  try {
    // Strip heavy base64 image data — images are stored in IndexedDB.
    // Only lightweight metadata goes into localStorage.
    const lightweight = places.map((p) => ({
      ...p,
      eras: p.eras.map((e) => ({ ...e, imageBase64: null })),
    }));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
  } catch {
    // Ignore storage failures
  }
}

export function findCachedPlace(
  lat: number,
  lng: number,
  history: CachedPlace[]
): CachedPlace | null {
  return history.find((p) => isSamePlace(p, { lat, lng })) ?? null;
}

export function upsertHistory(
  history: CachedPlace[],
  place: CachedPlace
): CachedPlace[] {
  const filtered = history.filter((p) => !isSamePlace(p, place));
  const next = [place, ...filtered].slice(0, HISTORY_LIMIT);
  saveHistory(next);
  return next;
}
