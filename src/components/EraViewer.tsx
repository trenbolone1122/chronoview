import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Era } from "@/types";

interface EraViewerProps {
  era: Era | null;
  placeName: string;
  /** Hide the text description below the image (used for future custom years) */
  hideDescription?: boolean;
}

export function EraViewer({ era, placeName, hideDescription }: EraViewerProps) {
  // ── Dual-layer crossfade ─────────────────────────────────────────────
  // Two image layers alternate: one fades in while the other holds the old image.
  const [layerA, setLayerA] = useState<string | null>(null);
  const [layerB, setLayerB] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<"A" | "B">("A");
  const prevEraId = useRef<string | null>(null);

  useEffect(() => {
    if (!era) {
      setLayerA(null);
      setLayerB(null);
      prevEraId.current = null;
      return;
    }

    if (era.imageStatus === "ready" && era.imageBase64) {
      if (prevEraId.current !== era.id) {
        // New era → load into the inactive layer, then flip
        if (activeLayer === "A") {
          setLayerB(era.imageBase64);
          setActiveLayer("B");
        } else {
          setLayerA(era.imageBase64);
          setActiveLayer("A");
        }
        prevEraId.current = era.id;
      } else {
        // Same era, just ensure it's shown on the active layer
        if (activeLayer === "A") {
          setLayerA(era.imageBase64);
        } else {
          setLayerB(era.imageBase64);
        }
      }
    }
  }, [era?.id, era?.imageStatus, era?.imageBase64]);

  if (!era) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/30">
        Select a location on the map
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Image area — fills available space */}
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-white/10 bg-black/40">
        {/* Layer A */}
        {layerA && (
          <img
            src={layerA}
            alt={`${placeName} — ${era.label}, ${era.year}`}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out"
            style={{ opacity: activeLayer === "A" ? 1 : 0 }}
          />
        )}

        {/* Layer B */}
        {layerB && (
          <img
            src={layerB}
            alt={`${placeName} — ${era.label}, ${era.year}`}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out"
            style={{ opacity: activeLayer === "B" ? 1 : 0 }}
          />
        )}

        {/* Loading / pending / error overlays */}
        {era.imageStatus === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400/60" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Generating {era.label}...
            </span>
          </div>
        )}

        {era.imageStatus === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40 px-6">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-red-400/70">
              Generation failed
            </span>
            {era.imageError && (
              <span className="max-w-md text-center text-[11px] text-white/30">
                {era.imageError}
              </span>
            )}
          </div>
        )}

        {era.imageStatus === "pending" && !layerA && !layerB && (
          <Skeleton className="h-full w-full bg-white/5" />
        )}
      </div>

      {/* Description — compact below image */}
      {!hideDescription && era.description && (
        <div className="shrink-0 space-y-1.5 px-1 pt-3">
          <div className="text-[12px] font-semibold uppercase tracking-[0.15em] text-white/50">
            {era.label}, {era.year < 0 ? `${Math.abs(era.year)} BC` : era.year}
          </div>
          <p className="text-sm leading-relaxed text-white/70">
            {era.description}
          </p>
        </div>
      )}
    </div>
  );
}
