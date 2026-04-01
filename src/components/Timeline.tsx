import { cn } from "@/lib/utils";
import type { Era } from "@/types";

interface TimelineProps {
  eras: Era[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

export function Timeline({ eras, activeIndex, onSelect }: TimelineProps) {
  if (!eras.length) return null;

  const DOT_SIZE = 14;
  const ACTIVE_DOT_SIZE = 20;
  const MASK_PAD = 6;

  const cols = eras.length;
  const last = cols - 1;

  /* Each dot is positioned at i/(cols-1)*100% so the first dot is flush-left
     and the last dot is flush-right. Lines only exist BETWEEN dots. */
  const dotPct = (i: number) => (last === 0 ? 50 : (i / last) * 100);

  return (
    <div className="w-full px-2 py-2">
      {/* Container — labels are placed below via flex; the dot+line layer is
          positioned absolutely so dots can be placed at exact percentages. */}
      <div className="relative w-full" style={{ minHeight: ACTIVE_DOT_SIZE }}>
        {/* Background line — from first dot center to last dot center */}
        {cols > 1 && (
          <div
            className="pointer-events-none absolute h-px bg-white/10"
            style={{
              top: ACTIVE_DOT_SIZE / 2,
              left: "0%",
              right: "0%",
            }}
          />
        )}

        {/* Progress (lit) line — from first dot center to active dot center */}
        {cols > 1 && activeIndex > 0 && (
          <div
            className="pointer-events-none absolute h-px bg-cyan-400/60 transition-all duration-700 ease-out"
            style={{
              top: ACTIVE_DOT_SIZE / 2,
              left: "0%",
              width: `${dotPct(activeIndex)}%`,
            }}
          />
        )}

        {/* Dots — absolutely positioned at their percentage */}
        {eras.map((era, i) => {
          const isActive = i === activeIndex;
          const isFilled = era.imageStatus === "ready";
          const isLoading = era.imageStatus === "loading";
          const isError = era.imageStatus === "error";
          const isPast = i <= activeIndex;
          const dotSize = isActive ? ACTIVE_DOT_SIZE : DOT_SIZE;

          return (
            <button
              key={era.id}
              type="button"
              onClick={() => onSelect(i)}
              className="absolute z-10 flex flex-col items-center"
              style={{
                left: `${dotPct(i)}%`,
                top: 0,
                transform: "translateX(-50%)",
              }}
            >
              {/* Dot container */}
              <div
                className="relative flex items-center justify-center"
                style={{ width: ACTIVE_DOT_SIZE, height: ACTIVE_DOT_SIZE }}
              >
                {/* Dark mask — hides line behind dot */}
                <div
                  className="absolute rounded-full bg-[#0a0a0a] transition-all duration-300"
                  style={{
                    width: dotSize + MASK_PAD,
                    height: dotSize + MASK_PAD,
                  }}
                />

                {/* Visible dot */}
                <div
                  className={cn(
                    "relative flex items-center justify-center rounded-full border-2 transition-all duration-300",
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
                  style={{ width: dotSize, height: dotSize }}
                >
                  {isLoading && (
                    <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30" />
                  )}
                  {isActive && isFilled && (
                    <div className="absolute -inset-1.5 rounded-full bg-cyan-400/20 blur-sm" />
                  )}
                </div>
              </div>

              {/* Label + year */}
              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                <span
                  className={cn(
                    "max-w-[140px] truncate text-center text-[11px] font-semibold uppercase leading-tight tracking-[0.04em] transition-colors",
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
                    "text-[10px] tabular-nums transition-colors",
                    isActive ? "text-cyan-300/70" : "text-white/20"
                  )}
                >
                  {era.year < 0 ? `${Math.abs(era.year)} BC` : era.year}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Spacer to account for the labels below the absolutely positioned dots */}
      <div style={{ height: 36 }} />
    </div>
  );
}
