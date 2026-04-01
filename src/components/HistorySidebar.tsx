import { useState } from "react";
import { History, ChevronLeft, MapPin, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CachedPlace } from "@/types";

interface HistorySidebarProps {
  history: CachedPlace[];
  onSelect: (lat: number, lng: number) => void;
  onClear: () => void;
}

export function HistorySidebar({ history, onSelect, onClear }: HistorySidebarProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        "absolute left-0 top-0 z-20 flex h-full flex-row-reverse transition-all duration-300 ease-out",
        expanded ? "w-72" : "w-10"
      )}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center self-center rounded-r-lg border border-l-0 border-white/10 bg-black/60 text-white/50 backdrop-blur-lg transition-colors hover:bg-black/80 hover:text-white/80"
        title={expanded ? "Collapse history" : "Expand history"}
      >
        {expanded ? (
          <ChevronLeft className="h-4 w-4" />
        ) : (
          <div className="relative">
            <History className="h-4 w-4" />
            {history.length > 0 && (
              <div className="absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full bg-cyan-500 text-[7px] font-bold text-black">
                {history.length > 9 ? "9+" : history.length}
              </div>
            )}
          </div>
        )}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "flex flex-col overflow-hidden border-r border-white/10 bg-[#0a0a0a]/90 backdrop-blur-xl transition-all duration-300",
          expanded ? "w-[calc(100%-2.5rem)] opacity-100" : "w-0 opacity-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <History className="h-3 w-3 text-white/40" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">
              History
            </span>
          </div>
          {history.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1 text-[9px] text-white/25 transition-colors hover:text-red-400/60"
              title="Clear history"
            >
              <Trash2 className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center">
              <MapPin className="h-5 w-5 text-white/10" />
              <span className="text-[10px] text-white/20">
                No places visited yet
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              {history.map((place) => {
                const readyCount = place.eras.filter(
                  (e) => e.imageStatus === "ready"
                ).length;
                const totalCount = place.eras.length;

                return (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => onSelect(place.lat, place.lng)}
                    className="flex flex-col gap-1 border-b border-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="text-sm font-medium text-white/70 leading-tight">
                      {place.placeName}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/35">
                        {place.country}
                      </span>
                      <span className="text-[11px] text-white/20">
                        {readyCount}/{totalCount} images
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
