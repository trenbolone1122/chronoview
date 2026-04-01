import { useCallback, useEffect, useRef, useState } from "react";
import { PlaceModal } from "@/components/PlaceModal";
import { researchPlace } from "@/api/perplexity";
import { generateEraImage } from "@/api/gemini";
import { findCachedPlace, loadHistory, upsertHistory } from "@/lib/cache";
import type { Era, CachedPlace, AppStatus, PerplexityResponse } from "@/types";

export default function App() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [status, setStatus] = useState<AppStatus>("idle");
  const [error, setError] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [placeName, setPlaceName] = useState("");
  const [country, setCountry] = useState("");
  const [eras, setEras] = useState<Era[]>([]);
  const [activeEraIndex, setActiveEraIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [history, setHistory] = useState<CachedPlace[]>(() => loadHistory());

  const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;
  const perplexityKey = import.meta.env.VITE_PERPLEXITY_API_KEY;
  const openrouterKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  const imageModel = import.meta.env.VITE_IMAGE_MODEL;

  // ── Map initialization ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || !mapboxToken || mapRef.current) return;
    mapboxgl.accessToken = mapboxToken;
    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [12.4964, 41.9028], // Rome
      zoom: 3,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    const marker = new mapboxgl.Marker({ color: "#22d3ee" });
    markerRef.current = marker;
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mapboxToken]);

  // ── Generate images for all eras sequentially ─────────────────────────
  const generateAllImages = useCallback(
    async (
      eraList: Era[],
      researchData: PerplexityResponse,
      signal: AbortSignal
    ) => {
      for (let i = 0; i < eraList.length; i++) {
        if (signal.aborted) return;

        // Set loading state for this era
        setEras((prev) => {
          const next = [...prev];
          if (next[i]) next[i] = { ...next[i], imageStatus: "loading" };
          return next;
        });

        // Auto-advance to the era being generated
        setActiveEraIndex(i);

        try {
          const pEra = researchData.eras[i];
          // Feed real image URLs from Sonar's return_images (top-level images[])
          // NOT per-era hallucinated URLs — Sonar provides a shared pool of reference images
          const refUrls = (researchData.images ?? []).map((img) => img.image_url).filter(Boolean);
          const imageBase64 = await generateEraImage(
            pEra.imagePrompt,
            refUrls,
            openrouterKey,
            signal,
            imageModel
          );

          if (signal.aborted) return;

          setEras((prev) => {
            const next = [...prev];
            if (next[i])
              next[i] = { ...next[i], imageBase64, imageStatus: "ready" };
            return next;
          });
        } catch (err: unknown) {
          if (signal.aborted) return;
          const msg = err instanceof Error ? err.message : "Unknown error";
          setEras((prev) => {
            const next = [...prev];
            if (next[i])
              next[i] = {
                ...next[i],
                imageStatus: "error",
                imageError: msg,
              };
            return next;
          });
        }
      }

      setStatus("ready");
    },
    [openrouterKey, imageModel]
  );

  // ── Handle map click ──────────────────────────────────────────────────
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      // Abort any in-flight requests
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      // Place marker
      const marker = markerRef.current;
      const map = mapRef.current;
      if (marker && map) {
        marker.setLngLat([lng, lat]).addTo(map);
        map.flyTo({
          center: [lng, lat],
          zoom: Math.max(map.getZoom(), 8),
          duration: 900,
        });
      }

      setCoords({ lat, lng });
      setActiveEraIndex(0);
      setModalOpen(true);

      // Check cache first
      const cached = findCachedPlace(lat, lng, history);
      if (cached) {
        setPlaceName(cached.placeName);
        setCountry(cached.country);
        setEras(cached.eras);
        setStatus(cached.eras.every((e) => e.imageStatus === "ready") ? "ready" : "generating");
        setError("");
        // If any images are still pending, regenerate them
        const hasPending = cached.eras.some(
          (e) => e.imageStatus !== "ready"
        );
        if (hasPending) {
          // Reconstruct minimal research data for re-generation
          const researchData: PerplexityResponse = {
            placeName: cached.placeName,
            country: cached.country,
            eras: cached.eras.map((e) => ({
              label: e.label,
              year: e.year,
              description: e.description,
              imagePrompt: e.prompt,
              cameraAngle: e.cameraAngle,
            })),
            citations: cached.citations,
            images: cached.referenceImages,
          };
          generateAllImages(cached.eras, researchData, controller.signal);
        }
        return;
      }

      // Fresh research
      setPlaceName("");
      setCountry("");
      setEras([]);
      setError("");
      setStatus("researching");

      try {
        const research = await researchPlace(
          lat,
          lng,
          perplexityKey,
          controller.signal
        );

        if (controller.signal.aborted) return;

        setPlaceName(research.placeName);
        setCountry(research.country);

        // Build era objects
        const eraList: Era[] = research.eras.map((e, i) => ({
          id: `${lat}-${lng}-${i}`,
          label: e.label,
          year: e.year,
          description: e.description,
          prompt: e.imagePrompt,
          cameraAngle: e.cameraAngle,
          imageBase64: null,
          imageStatus: "pending",
          imageError: null,
        }));

        setEras(eraList);
        setStatus("generating");

        // Save to cache immediately (images will be updated as they generate)
        const cacheEntry: CachedPlace = {
          id: `${lat.toFixed(4)}-${lng.toFixed(4)}`,
          lat,
          lng,
          placeName: research.placeName,
          country: research.country,
          eras: eraList,
          citations: research.citations,
          referenceImages: research.images,
          savedAt: Date.now(),
        };
        setHistory((prev) => upsertHistory(prev, cacheEntry));

        // Start generating images
        await generateAllImages(eraList, research, controller.signal);

        // Update cache with generated images
        setEras((currentEras) => {
          const finalEntry: CachedPlace = {
            ...cacheEntry,
            eras: currentEras,
            savedAt: Date.now(),
          };
          setHistory((prev) => upsertHistory(prev, finalEntry));
          return currentEras;
        });
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setStatus("error");
      }
    },
    [history, perplexityKey, openrouterKey, generateAllImages]
  );

  // ── Bind map click handler ────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const handler = (e: mapboxgl.MapMouseEvent) => {
      handleMapClick(e.lngLat.lat, e.lngLat.lng);
    };

    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [handleMapClick]);

  // ── Close modal ───────────────────────────────────────────────────────
  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  // ── Missing keys warning ──────────────────────────────────────────────
  const missingKeys: string[] = [];
  if (!mapboxToken) missingKeys.push("VITE_MAPBOX_TOKEN");
  if (!perplexityKey) missingKeys.push("VITE_PERPLEXITY_API_KEY");
  if (!openrouterKey) missingKeys.push("VITE_OPENROUTER_API_KEY");

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Map */}
      <div ref={mapContainerRef} className="absolute inset-0 z-0 h-full w-full" />

      {/* Title overlay */}
      <div className="pointer-events-none absolute left-4 top-4 z-20">
        <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
          Chronoview
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/30">
          Click anywhere to travel through time
        </div>
      </div>

      {/* Missing keys banner */}
      {missingKeys.length > 0 && (
        <div className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-950/80 px-4 py-2 text-xs text-red-300 backdrop-blur">
          Missing env vars: {missingKeys.join(", ")}. Copy{" "}
          <code className="rounded bg-red-900/50 px-1">.env.example</code> to{" "}
          <code className="rounded bg-red-900/50 px-1">.env</code> and add your keys.
        </div>
      )}

      {/* Place modal */}
      <PlaceModal
        open={modalOpen}
        onClose={handleCloseModal}
        placeName={placeName}
        country={country}
        coords={coords}
        eras={eras}
        activeEraIndex={activeEraIndex}
        onSelectEra={setActiveEraIndex}
        status={status}
        error={error}
      />
    </div>
  );
}
