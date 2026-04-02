/**
 * Pre-download reference image URLs to base64 data URLs.
 *
 * This avoids 400 errors from OpenRouter when Sonar image URLs are
 * 403-blocked at their origin. By downloading client-side first,
 * we only send images we successfully fetched.
 */

/** Year cutoff: only send reference images for eras from 1880 onwards */
export const REF_IMAGE_YEAR_CUTOFF = 1880;

/**
 * Download an image URL to a base64 data URL.
 * Returns null if the download fails for any reason.
 */
async function downloadToBase64(
  url: string,
  signal?: AbortSignal
): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal,
      // No credentials — these are third-party image URLs
      mode: "cors",
      headers: { Accept: "image/*" },
    });

    if (!response.ok) return null;

    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) return null;

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Pre-download up to `maxImages` reference image URLs to base64.
 * Skips any that fail to download. Returns only successfully downloaded images.
 */
export async function preDownloadReferenceImages(
  imageUrls: string[],
  signal?: AbortSignal,
  maxImages = 3
): Promise<string[]> {
  const urls = imageUrls.slice(0, maxImages).filter(Boolean);
  if (urls.length === 0) return [];

  const results = await Promise.all(
    urls.map((url) => downloadToBase64(url, signal))
  );

  return results.filter((r): r is string => r !== null);
}
