import { cn } from "@/lib/utils";
import type { Era } from "@/types";

interface TimelineProps {
  eras: Era[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function Timeline({ eras, activeIndex, onSelect }: TimelineProps) {
  if (!eras.length) return null;

  // Dot row height is fixed at 20px. Line goes through the center (10px).
  const DOT_ROW_H = 20; // px
  const LINE_TOP = DOT_ROW_H / 2; // center of dot row

  return (
    <div className="w-full px-4 py-3">
      {/* ── Dot row with lines ────────────────────────────── */}
      <div className="relative flex w-full items-center justify-between" style={{ height: DOT_ROW_H }}>
        {/* Background line */}
        <div
          className="pointer-events-none absolute left-0 right-0 h-px bg-white/10"
          style={{ top: LINE_TOP }}
        />

        {/* Progress line */}
        {eras.length > 1 && (
          <div
            className="pointer-events-none absolute left-0 h-px bg-cyan-400/60 transition-all duration-700 ease-out"
            style={{
              top: LINE_TOP,
              width: `${(activeIndex / (eras.length - 1)) * 100}%`,
            }}
          />
        )}

        {/* Dots */}
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";
          const isLoading = era.imageStatus === "loading";
          const isError = era.imageStatus === "error";
          const isPast = i <= activeIndex;

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelect(i)}
              className="relative z-10 flex items-center justify-center"
              style={{ width: DOT_ROW_H, height: DOT_ROW_H }}
            >
              <div
                className={cn(
                  "relative flex h-3 w-3 items-center justify-center rounded-full border-2 transition-all duration-300",
                  isActive && "scale-150",
                  isError
                    ? "border-red-400/60 bg-red-400/20"
                    : isLoading
                      ? "border-cyan-400/60 bg-transparent"
                      : isFilled
                        ? "border-cyan-400 bg-cyan-400"
                        : isPast
                          ? "border-white/40 bg-white/10"
                          : "border-white/20 bg-transparent"
                )}
              >
                {isLoading && (
                  <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30" />
                )}
                {isActive && isFilled && (
                  <div className="absolute -inset-1.5 rounded-full bg-cyan-400/20 blur-sm" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Label row ─────────────────────────────────────── */}
      <div className="mt-1.5 flex w-full justify-between">
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";

          return (
            <button
              key={`lbl-${era.id}`}
              type="button"
              onClick={() => onSelect(i)}
              className="flex flex-col items-center gap-0.5"
              style={{ width: `${100 / eras.length}%` }}
            >
              <span
                className={cn(
                  "max-w-[90px] truncate text-center text-[9px] font-semibold uppercase leading-tight tracking-[0.08em] transition-colors",
                  isActive
                    ? "text-cyan-300"
                    : isFilled
                      ? "text-white/60"
                      : "text-white/25"
                )}
              >
                {era.label}
              </span>
              <span
                className={cn(
                  "text-[8px] tabular-nums transition-colors",
                  isActive ? "text-cyan-300/70" : "text-white/15"
                )}
              >
                {era.year < 0 ? `${Math.abs(era.year)} BC` : era.year}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
