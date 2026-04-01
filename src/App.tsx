import { useCallback, useEffect, useRef, useState } from "react";
import { PlaceModal } from "@/components/PlaceModal";
import { SearchBar } from "@/components/SearchBar";
import { HistorySidebar } from "@/components/HistorySidebar";
import { researchPlace } from "@/api/perplexity";
import { generateEraImage } from "@/api/gemini";
import { findCachedPlace, loadHistory, upsertHistory, saveHistory } from "@/lib/cache";
import { saveImage, getImages, clearImages } from "@/lib/imageStore";
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

  // Keep a ref to history so handleMapClick always reads the latest cache
  // without needing history in its dependency array (avoids stale closures)
  const historyRef = useRef(history);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

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

        // Skip eras that already have images or errored out
        if (eraList[i].imageStatus === "ready" || eraList[i].imageStatus === "error") {
          continue;
        }

        // Set loading state for this era
        setEras((prev) => {
          const next = [...prev];
          if (next[i]) next[i] = { ...next[i], imageStatus: "loading" };
          return next;
        });

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

          // Persist to IndexedDB so cache hits don't need re-generation
          const eraId = eraList[i].id;
          saveImage(eraId, imageBase64).catch(() => {});

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

      // Check cache first (use ref for latest history to avoid stale closures)
      const cached = findCachedPlace(lat, lng, historyRef.current);
      if (cached) {
        setPlaceName(cached.placeName);
        setCountry(cached.country);
        setError("");

        // Hydrate images from IndexedDB
        const eraIds = cached.eras.map((e) => e.id);
        const imageMap = await getImages(eraIds);

        // Rebuild eras with images from IndexedDB + mark status correctly
        const hydratedEras = cached.eras.map((e) => {
          const img = imageMap.get(e.id) ?? null;
          if (img) {
            return { ...e, imageBase64: img, imageStatus: "ready" as const };
          }
          // Keep existing status (error stays error, pending stays pending)
          return e;
        });

        setEras(hydratedEras);

        const allReady = hydratedEras.every((e) => e.imageStatus === "ready");
        if (allReady) {
          setStatus("ready");
        } else {
          setStatus("generating");
          // Only regenerate truly pending eras (not errored ones — those cost credits)
          const hasPending = hydratedEras.some((e) => e.imageStatus === "pending");
          if (hasPending) {
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
            generateAllImages(hydratedEras, researchData, controller.signal);
          }
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

        // Start generating images (each one saves to IndexedDB on success)
        await generateAllImages(eraList, research, controller.signal);
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setStatus("error");
      }
    },
    [perplexityKey, openrouterKey, generateAllImages]
  );

  // ── Sync era statuses to localStorage (not images — those are in IndexedDB)
  // This ensures cache entries know which eras succeeded/errored.
  useEffect(() => {
    if (!coords || eras.length === 0) return;
    const hasAnyDone = eras.some(
      (e) => e.imageStatus === "ready" || e.imageStatus === "error"
    );
    if (!hasAnyDone) return;

    const existing = findCachedPlace(coords.lat, coords.lng, historyRef.current);
    if (existing) {
      // Update statuses only (imageBase64 is stripped by saveHistory anyway)
      const updatedEras = eras.map((e) => ({
        ...e,
        imageBase64: null, // always null in localStorage
      }));
      const updated: CachedPlace = { ...existing, eras: updatedEras, savedAt: Date.now() };
      setHistory((prev) => upsertHistory(prev, updated));
    }
  }, [eras, coords]);

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

  // ── Search bar selection → fly + trigger research ─────────────────────
  const handleSearchSelect = useCallback(
    (lat: number, lng: number) => {
      handleMapClick(lat, lng);
    },
    [handleMapClick]
  );

  // ── Clear history ─────────────────────────────────────────────────────
  const handleClearHistory = useCallback(() => {
    setHistory([]);
    saveHistory([]);
    clearImages().catch(() => {});
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

      {/* Top bar: title + search */}
      <div className="absolute left-4 right-14 top-4 z-20 flex items-start justify-between gap-4">
        <div className="pointer-events-none">
          <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">
            Chronoview
          </div>
          <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/30">
            Click anywhere to travel through time
          </div>
        </div>
        {mapboxToken && (
          <SearchBar mapboxToken={mapboxToken} onSelect={handleSearchSelect} />
        )}
      </div>

      {/* Missing keys banner */}
      {missingKeys.length > 0 && (
        <div className="absolute left-1/2 top-16 z-30 -translate-x-1/2 rounded-lg border border-red-500/30 bg-red-950/80 px-4 py-2 text-xs text-red-300 backdrop-blur">
          Missing env vars: {missingKeys.join(", ")}. Copy{" "}
          <code className="rounded bg-red-900/50 px-1">.env.example</code> to{" "}
          <code className="rounded bg-red-900/50 px-1">.env</code> and add your keys.
        </div>
      )}

      {/* History sidebar (right edge) */}
      <HistorySidebar
        history={history}
        onSelect={handleSearchSelect}
        onClear={handleClearHistory}
      />

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
