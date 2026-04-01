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
  // ── Crossfade state ─────────────────────────────────────────────────
  const [displayedImage, setDisplayedImage] = useState<string | null>(null);
  const [fadingIn, setFadingIn] = useState(false);
  const prevEraId = useRef<string | null>(null);

  useEffect(() => {
    if (!era) {
      setDisplayedImage(null);
      prevEraId.current = null;
      return;
    }

    if (era.imageStatus === "ready" && era.imageBase64) {
      if (prevEraId.current !== era.id) {
        // New era image → trigger crossfade
        setFadingIn(false);
        // Small delay so the browser registers opacity 0 first
        requestAnimationFrame(() => {
          setDisplayedImage(era.imageBase64);
          requestAnimationFrame(() => setFadingIn(true));
        });
        prevEraId.current = era.id;
      } else {
        // Same era, just ensure it's shown
        setDisplayedImage(era.imageBase64);
        setFadingIn(true);
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
        {/* Crossfade image layer */}
        {displayedImage && (
          <img
            src={displayedImage}
            alt={`${placeName} — ${era.label}, ${era.year}`}
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-in-out"
            style={{ opacity: fadingIn ? 1 : 0 }}
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

        {era.imageStatus === "pending" && !displayedImage && (
          <Skeleton className="h-full w-full bg-white/5" />
        )}
      </div>

      {/* Description — compact below image */}
      {!hideDescription && era.description && (
        <div className="shrink-0 space-y-1.5 px-1 pt-3">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/40">
            <span className="h-px w-3 bg-white/10" />
            <span>
              {era.label} — {era.year < 0 ? `${Math.abs(era.year)} BC` : era.year}
            </span>
          </div>
          <p className="text-sm leading-relaxed text-white/70">
            {era.description}
          </p>
        </div>
      )}
    </div>
  );
}
