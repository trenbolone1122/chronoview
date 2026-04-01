import { X, Loader2 } from "lucide-react";
import { Timeline } from "@/components/Timeline";
import { EraViewer } from "@/components/EraViewer";
import type { Era, AppStatus, ViewMode } from "@/types";

interface PlaceModalProps {
  open: boolean;
  onClose: () => void;
  placeName: string;
  country: string;
  coords: { lat: number; lng: number } | null;
  eras: Era[];
  activeEraIndex: number;
  onSelectEra: (index: number) => void;
  status: AppStatus;
  error: string;
  viewMode: ViewMode;
  customYear?: number;
}

export function PlaceModal({
  open,
  onClose,
  placeName,
  country,
  coords,
  eras,
  activeEraIndex,
  onSelectEra,
  status,
  error,
  viewMode,
  customYear,
}: PlaceModalProps) {
  if (!open) return null;

  const activeEra = eras[activeEraIndex] ?? null;
  const formatCoord = (v: number) => v.toFixed(4);

  // In custom year mode, hide description if year is in the future
  const currentYear = new Date().getFullYear();
  const hideDescription =
    viewMode === "custom-year" && customYear != null && customYear > currentYear;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm md:p-5"
      onClick={onClose}
    >
      <div
        className="relative flex h-[92vh] w-full max-w-6xl flex-col rounded-xl border border-white/10 bg-[#0a0a0a]/95 p-4 shadow-2xl backdrop-blur-xl md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header — compact */}
        <div className="mb-3 shrink-0 space-y-0.5 pr-10">
          <h2 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
            {status === "researching" ? "Researching..." : placeName || "Unknown Location"}
          </h2>
          <div className="flex items-center gap-3 text-[11px] text-white/40">
            {country && <span>{country}</span>}
            {coords && (
              <span className="font-mono tabular-nums">
                {formatCoord(coords.lat)}, {formatCoord(coords.lng)}
              </span>
            )}
            {viewMode === "custom-year" && customYear != null && (
              <span className="rounded bg-cyan-400/10 px-1.5 py-0.5 text-cyan-300/80">
                Year {customYear < 0 ? `${Math.abs(customYear)} BC` : customYear}
              </span>
            )}
          </div>
        </div>

        {/* Research loading state */}
        {status === "researching" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400/60" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Researching historical eras...
            </span>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-red-400/70">
              Research failed
            </span>
            {error && (
              <span className="max-w-md text-center text-[11px] text-white/30">
                {error}
              </span>
            )}
          </div>
        )}

        {/* Main content */}
        {(status === "generating" || status === "ready") && eras.length > 0 && (
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Timeline — only in eras mode */}
            {viewMode === "eras" && (
              <div className="shrink-0">
                <Timeline
                  eras={eras}
                  activeIndex={activeEraIndex}
                  onSelect={onSelectEra}
                />
              </div>
            )}

            {/* Era viewer — fills remaining space */}
            <div className="min-h-0 flex-1">
              <EraViewer
                era={activeEra}
                placeName={placeName}
                hideDescription={hideDescription}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
