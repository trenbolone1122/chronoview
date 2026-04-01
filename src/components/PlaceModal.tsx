import { X, Loader2 } from "lucide-react";
import { Timeline } from "@/components/Timeline";
import { EraViewer } from "@/components/EraViewer";
import type { Era, AppStatus } from "@/types";

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
}: PlaceModalProps) {
  if (!open) return null;

  const activeEra = eras[activeEraIndex] ?? null;
  const formatCoord = (v: number) => v.toFixed(4);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm md:p-6"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl rounded-xl border border-white/10 bg-[#0a0a0a]/95 p-5 shadow-2xl backdrop-blur-xl md:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-4 space-y-1 pr-10">
          <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
            {status === "researching" ? "Researching..." : placeName || "Unknown Location"}
          </h2>
          <div className="flex items-center gap-3 text-xs text-white/40">
            {country && <span>{country}</span>}
            {coords && (
              <span className="font-mono tabular-nums">
                {formatCoord(coords.lat)}, {formatCoord(coords.lng)}
              </span>
            )}
          </div>
        </div>

        {/* Research loading state */}
        {status === "researching" && (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400/60" />
            <span className="text-xs font-medium uppercase tracking-[0.2em] text-white/40">
              Researching historical eras...
            </span>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="flex h-[40vh] flex-col items-center justify-center gap-2 px-6">
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

        {/* Main content: Timeline + Era viewer */}
        {(status === "generating" || status === "ready") && eras.length > 0 && (
          <div className="space-y-4">
            <Timeline
              eras={eras}
              activeIndex={activeEraIndex}
              onSelect={onSelectEra}
            />
            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <EraViewer era={activeEra} placeName={placeName} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
