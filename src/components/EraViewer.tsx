import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { Era } from "@/types";

interface EraViewerProps {
  era: Era | null;
  placeName: string;
}

export function EraViewer({ era, placeName }: EraViewerProps) {
  if (!era) {
    return (
      <div className="flex h-[50vh] items-center justify-center text-sm text-white/30">
        Select a location on the map
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Image area */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-white/10 bg-black/40">
        {era.imageStatus === "ready" && era.imageBase64 ? (
          <img
            src={era.imageBase64}
            alt={`${placeName} — ${era.label}, ${era.year}`}
            className="h-full w-full object-cover"
          />
        ) : era.imageStatus === "loading" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400/60" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Generating {era.label}...
            </span>
          </div>
        ) : era.imageStatus === "error" ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-red-400/70">
              Generation failed
            </span>
            {era.imageError && (
              <span className="max-w-md text-center text-[11px] text-white/30">
                {era.imageError}
              </span>
            )}
          </div>
        ) : (
          <Skeleton className="h-full w-full bg-white/5" />
        )}
      </div>

      {/* Description */}
      {era.description && (
        <div className="space-y-2 px-1">
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
