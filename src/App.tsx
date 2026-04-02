import { useCallback, useEffect, useRef, useState } from "react";
import { PlaceModal } from "@/components/PlaceModal";
import { ModePicker } from "@/components/ModePicker";
import { SearchBar } from "@/components/SearchBar";
import { HistorySidebar } from "@/components/HistorySidebar";
import { reverseGeocode } from "@/api/geocode";
import { researchPlace, researchCustomYear } from "@/api/perplexity";
import { generateEraImage } from "@/api/gemini";
import { findCachedPlace, loadHistory, upsertHistory, saveHistory } from "@/lib/cache";
import { saveImage, getImages, clearImages } from "@/lib/imageStore";
import { preDownloadReferenceImages, REF_IMAGE_YEAR_CUTOFF } from "@/lib/imageDownload";
import type { Era, CachedPlace, AppStatus, PerplexityResponse, ViewMode, ImageStyle } from "@/types";

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

  // Mode picker state
  const [showModePicker, setShowModePicker] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingCityName, setPendingCityName] = useState("");
  const [pendingCountry, setPendingCountry] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("eras");
  const [customYear, setCustomYear] = useState<number | undefined>(undefined);
  const [imageStyle, setImageStyle] = useState<ImageStyle>("aerial");

  // Keep a ref to history so handleMapClick always reads the latest cache
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
      signal: AbortSignal,
      style: ImageStyle = "aerial",
      resolvedPlaceName?: string
    ) => {
      // Pre-download Sonar reference images once (only used for eras >= 1880)
      const sonarUrls = (researchData.images ?? []).map((img) => img.image_url).filter(Boolean);
      const needsRefs = eraList.some((e) => e.year >= REF_IMAGE_YEAR_CUTOFF);
      let refBase64: string[] = [];
      if (needsRefs && sonarUrls.length > 0 && !signal.aborted) {
        console.log(`[Chronoview] 📥 Pre-downloading ${sonarUrls.length} reference images...`);
        refBase64 = await preDownloadReferenceImages(sonarUrls, signal);
        console.log(`[Chronoview] 📥 Downloaded ${refBase64.length} reference images as base64`);
      }

      for (let i = 0; i < eraList.length; i++) {
        // Check abort at EVERY possible point
        if (signal.aborted) return;

        // Skip eras that already have images or errored out
        if (eraList[i].imageStatus === "ready" || eraList[i].imageStatus === "error") {
          continue;
        }

        if (signal.aborted) return;

        // Set loading state for this era
        setEras((prev) => {
          if (signal.aborted) return prev;
          const next = [...prev];
          if (next[i]) next[i] = { ...next[i], imageStatus: "loading" };
          return next;
        });

        if (signal.aborted) return;

        try {
          const pEra = researchData.eras[i];
          // Only send reference images for photography-era (>= 1880)
          const eraRefs = pEra.year >= REF_IMAGE_YEAR_CUTOFF ? refBase64 : [];
          const imageBase64 = await generateEraImage(
            pEra.imagePrompt,
            openrouterKey,
            signal,
            imageModel,
            style,
            pEra.year,
            resolvedPlaceName ?? researchData.placeName,
            eraRefs
          );

          if (signal.aborted) return;

          // Persist to IndexedDB
          const eraId = eraList[i].id;
          saveImage(eraId, imageBase64).catch(() => {});

          if (signal.aborted) return;

          setEras((prev) => {
            if (signal.aborted) return prev;
            const next = [...prev];
            if (next[i])
              next[i] = { ...next[i], imageBase64, imageStatus: "ready" };
            return next;
          });

          // Auto-advance to this era once its image is ready
          if (!signal.aborted) setActiveEraIndex(i);
        } catch (err: unknown) {
          if (signal.aborted) return;
          const msg = err instanceof Error ? err.message : "Unknown error";
          setEras((prev) => {
            if (signal.aborted) return prev;
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

      if (!signal.aborted) setStatus("ready");
    },
    [openrouterKey, imageModel]
  );

  // ── Place marker + fly ────────────────────────────────────────────────
  const placeMarkerAndFly = useCallback((lat: number, lng: number) => {
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
  }, []);

  // ── Handle map click — reverse geocode first, then show mode picker ───
  const handleMapClick = useCallback(
    async (lat: number, lng: number) => {
      // Abort any in-flight requests
      if (abortRef.current) abortRef.current.abort();

      placeMarkerAndFly(lat, lng);

      // Check cache first — if cached, skip mode picker and go straight to eras
      const cached = findCachedPlace(lat, lng, historyRef.current);
      if (cached) {
        // Reuse cached data directly — skip picker entirely
        // Determine view mode: explicit from cache, or infer from era count
        const restoredMode = cached.viewMode ?? (cached.eras.length === 1 ? "custom-year" : "eras");
        setViewMode(restoredMode);
        setCustomYear(cached.customYear ?? (restoredMode === "custom-year" ? cached.eras[0]?.year : undefined));
        setImageStyle(cached.imageStyle ?? "aerial");
        startFromCache(lat, lng, cached);
        return;
      }

      // Reverse geocode to get city name
      let cityName = "";
      let countryName = "";
      try {
        const geo = await reverseGeocode(lat, lng, mapboxToken);
        cityName = geo.cityName;
        countryName = geo.countryName;
      } catch {
        // If reverse geocode fails, proceed without city hint
      }

      // Show mode picker
      setPendingCoords({ lat, lng });
      setPendingCityName(cityName);
      setPendingCountry(countryName);
      setShowModePicker(true);
    },
    [mapboxToken, placeMarkerAndFly]
  );

  // ── Start from cache (eras mode) — uses stored imageStyle ─────────────
  const startFromCache = useCallback(
    async (lat: number, lng: number, cached: CachedPlace) => {
      const cachedStyle = cached.imageStyle ?? "aerial";
      const controller = new AbortController();
      abortRef.current = controller;

      setCoords({ lat, lng });
      setActiveEraIndex(0);
      setModalOpen(true);
      setPlaceName(cached.placeName);
      setCountry(cached.country);
      setError("");

      // Hydrate images from IndexedDB
      const eraIds = cached.eras.map((e) => e.id);
      const imageMap = await getImages(eraIds);

      const hydratedEras = cached.eras.map((e) => {
        const img = imageMap.get(e.id) ?? null;
        if (img) {
          return { ...e, imageBase64: img, imageStatus: "ready" as const };
        }
        return e;
      });

      setEras(hydratedEras);

      const allReady = hydratedEras.every((e) => e.imageStatus === "ready");
      const anyReady = hydratedEras.some((e) => e.imageStatus === "ready");

      if (allReady) {
        // All images present — just show them
        setStatus("ready");
      } else if (anyReady) {
        // Partially completed (user cancelled mid-generation) — show what we have
        const lastReadyIdx = hydratedEras.map((e, i) => e.imageStatus === "ready" ? i : -1).filter((i) => i >= 0).pop() ?? 0;
        setActiveEraIndex(lastReadyIdx);
        setStatus("ready");
      } else {
        // No images at all — show the timeline/structure but don't burn credits
        // User can re-click from the globe to trigger fresh generation
        setStatus("ready");
      }
    },
    [generateAllImages]
  );

  // ── Mode picker selection → start appropriate flow ────────────────────
  const handleModeSelect = useCallback(
    async (mode: ViewMode, style: ImageStyle, yearInput?: number) => {
      if (!pendingCoords) return;

      setShowModePicker(false);
      setViewMode(mode);
      setCustomYear(yearInput);
      setImageStyle(style);

      const { lat, lng } = pendingCoords;
      const controller = new AbortController();
      abortRef.current = controller;

      setCoords({ lat, lng });
      setActiveEraIndex(0);
      setModalOpen(true);
      // Show city name from reverse geocode immediately (Sonar may refine it later)
      setPlaceName(pendingCityName);
      setCountry(pendingCountry);
      setEras([]);
      setError("");
      setStatus("researching");

      try {
        if (mode === "eras") {
          // ── Standard multi-era flow ──────────────────────────────
          const research = await researchPlace(
            lat,
            lng,
            perplexityKey,
            controller.signal,
            pendingCityName || undefined,
            style
          );

          if (controller.signal.aborted) return;

          setPlaceName(research.placeName);
          setCountry(research.country);

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
            imageStyle: style,
            viewMode: "eras",
          };
          setHistory((prev) => upsertHistory(prev, cacheEntry));

          await generateAllImages(eraList, research, controller.signal, style);
        } else {
          // ── Custom year flow ─────────────────────────────────────
          const year = yearInput!;
          const research = await researchCustomYear(
            lat,
            lng,
            year,
            perplexityKey,
            controller.signal,
            pendingCityName || undefined,
            style
          );

          if (controller.signal.aborted) return;

          setPlaceName(research.placeName);
          setCountry(research.country);

          const singleEra: Era = {
            id: `${lat}-${lng}-custom-${year}`,
            label: research.era.label,
            year: research.era.year,
            description: research.era.description,
            prompt: research.era.imagePrompt,
            cameraAngle: research.era.cameraAngle,
            imageBase64: null,
            imageStatus: "loading",
            imageError: null,
          };

          setEras([singleEra]);
          setStatus("generating");

          // Cache custom year result in history
          const cacheEntry: CachedPlace = {
            id: `${lat.toFixed(4)}-${lng.toFixed(4)}`,
            lat,
            lng,
            placeName: research.placeName,
            country: research.country,
            eras: [singleEra],
            citations: research.citations,
            referenceImages: research.images,
            savedAt: Date.now(),
            imageStyle: style,
            viewMode: "custom-year",
            customYear: year,
          };
          setHistory((prev) => upsertHistory(prev, cacheEntry));

          try {
            // Pre-download refs for photography-era custom years
            let customRefs: string[] = [];
            if (year >= REF_IMAGE_YEAR_CUTOFF) {
              const urls = (research.images ?? []).map((img) => img.image_url).filter(Boolean);
              if (urls.length > 0 && !controller.signal.aborted) {
                customRefs = await preDownloadReferenceImages(urls, controller.signal);
              }
            }
            if (controller.signal.aborted) return;

            const imageBase64 = await generateEraImage(
              research.era.imagePrompt,
              openrouterKey,
              controller.signal,
              imageModel,
              style,
              research.era.year,
              research.placeName,
              customRefs
            );

            if (controller.signal.aborted) return;

            saveImage(singleEra.id, imageBase64).catch(() => {});

            setEras([{ ...singleEra, imageBase64, imageStatus: "ready" }]);
            setStatus("ready");
          } catch (err: unknown) {
            if (controller.signal.aborted) return;
            const msg = err instanceof Error ? err.message : "Unknown error";
            setEras([{ ...singleEra, imageStatus: "error", imageError: msg }]);
            setStatus("ready");
          }
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : "Unknown error";
        setError(msg);
        setStatus("error");
      }
    },
    [
      pendingCoords,
      pendingCityName,
      pendingCountry,
      perplexityKey,
      openrouterKey,
      imageModel,
      generateAllImages,
    ]
  );

  // ── Sync era statuses to localStorage ────────────────────────────────
  useEffect(() => {
    if (!coords || eras.length === 0 || viewMode !== "eras") return;
    const hasAnyDone = eras.some(
      (e) => e.imageStatus === "ready" || e.imageStatus === "error"
    );
    if (!hasAnyDone) return;

    const existing = findCachedPlace(coords.lat, coords.lng, historyRef.current);
    if (existing) {
      const updatedEras = eras.map((e) => ({
        ...e,
        imageBase64: null,
      }));
      const updated: CachedPlace = { ...existing, eras: updatedEras, savedAt: Date.now() };
      setHistory((prev) => upsertHistory(prev, updated));
    }
  }, [eras, coords, viewMode]);

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

  // ── Close modal (also acts as cancel) ───────────────────────────────────
  const handleCloseModal = useCallback(() => {
    // Abort in-flight API calls
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Persist whatever images were completed; mark loading/pending eras back to pending
    // so they don't show as "loading" in history but also don't auto-restart
    setEras((prev) => {
      if (!coords) return prev;
      const settled = prev.map((e) =>
        e.imageStatus === "loading"
          ? { ...e, imageStatus: "pending" as const }
          : e
      );
      // Update cache with settled statuses
      const existing = findCachedPlace(coords.lat, coords.lng, historyRef.current);
      if (existing) {
        const updatedEras = settled.map((e) => ({ ...e, imageBase64: null }));
        const updated: CachedPlace = { ...existing, eras: updatedEras, savedAt: Date.now() };
        setHistory((h) => upsertHistory(h, updated));
      }
      return settled;
    });

    setModalOpen(false);
    setStatus("idle");
  }, [coords]);

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
      <div className="absolute left-14 right-4 top-4 z-20 flex items-start justify-between gap-4">
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

      {/* History sidebar */}
      <HistorySidebar
        history={history}
        onSelect={handleSearchSelect}
        onClear={handleClearHistory}
      />

      {/* Mode picker */}
      {showModePicker && (
        <ModePicker
          cityName={pendingCityName}
          onSelect={handleModeSelect}
          onClose={() => setShowModePicker(false)}
        />
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
        viewMode={viewMode}
        customYear={customYear}
      />
    </div>
  );
}
